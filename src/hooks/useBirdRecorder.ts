import { useState, useRef, useEffect, useCallback } from 'react';
import { AudioRecorderService, getAnalyserAudioLevel } from '../utils/audio';
import { AnalysisResponse, OneTapRecordingState } from '../types/birdnet';
import { apiUrl } from '../utils/api';

interface UseBirdRecorderOptions {
  onSuccess?: (result: AnalysisResponse, blob: Blob, duration: number) => void;
  onError?: (error: string) => void;
  minConfidence?: number;
  latitude?: number | null;
  longitude?: number | null;
}

export function useBirdRecorder(options: UseBirdRecorderOptions = {}) {
  const [state, setState] = useState<OneTapRecordingState>('idle');
  const [countdownRemaining, setCountdownRemaining] = useState<number>(6);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<AnalysisResponse | null>(null);

  const recorderRef = useRef<AudioRecorderService | null>(null);
  const isMountedRef = useRef<boolean>(true);
  const timerIntervalRef = useRef<number | null>(null);
  const stopTimeoutRef = useRef<number | null>(null);
  const meterAnimRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const isExecutingRef = useRef<boolean>(false);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const cleanup = useCallback(() => {
    if (timerIntervalRef.current) {
      window.clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (stopTimeoutRef.current) {
      window.clearTimeout(stopTimeoutRef.current);
      stopTimeoutRef.current = null;
    }
    if (meterAnimRef.current) {
      window.cancelAnimationFrame(meterAnimRef.current);
      meterAnimRef.current = null;
    }
    if (recorderRef.current) {
      recorderRef.current.cancelRecording();
      recorderRef.current = null;
    }
    setAnalyser(null);
    setAudioLevel(0);
    isExecutingRef.current = false;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      cleanup();
    };
  }, [cleanup]);

  // Live audio level meter loop
  const startLevelMeter = useCallback((node: AnalyserNode) => {
    const loop = () => {
      if (!isMountedRef.current || !node) return;
      const level = getAnalyserAudioLevel(node);
      setAudioLevel(level);
      meterAnimRef.current = window.requestAnimationFrame(loop);
    };
    meterAnimRef.current = window.requestAnimationFrame(loop);
  }, []);

  // Main entrypoint: Start one-tap 6-second recording session
  const startOneTapRecording = useCallback(async () => {
    // Prevent overlapping sessions or duplicate clicks
    if (
      isExecutingRef.current ||
      state === 'recording' ||
      state === 'processing' ||
      state === 'requesting_permission'
    ) {
      return;
    }

    isExecutingRef.current = true;
    setErrorMessage(null);
    setState('requesting_permission');
    setCountdownRemaining(6);
    setElapsedSeconds(0);

    const recorder = new AudioRecorderService();
    recorderRef.current = recorder;

    let stream: MediaStream;
    try {
      stream = await recorder.requestPermission({
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      });
    } catch (err: any) {
      if (!isMountedRef.current) return;
      const msg = err.message || 'Microphone permission denied or device unavailable.';
      setErrorMessage(msg);
      setState('error');
      isExecutingRef.current = false;
      optionsRef.current.onError?.(msg);
      return;
    }

    if (!isMountedRef.current) {
      recorder.cancelRecording();
      return;
    }

    try {
      const node = recorder.setupAnalyser(stream);
      setAnalyser(node);
      startLevelMeter(node);

      recorder.startRecording();
      setState('recording');
      startTimeRef.current = Date.now();

      // Progress interval for 6.0s countdown (updates every 50ms)
      const TOTAL_MS = 6000;
      timerIntervalRef.current = window.setInterval(() => {
        if (!isMountedRef.current) return;
        const elapsed = Date.now() - startTimeRef.current;
        const elapsedSec = Math.min(6.0, elapsed / 1000);
        const remSec = Math.max(0, Math.ceil((TOTAL_MS - elapsed) / 1000));
        setElapsedSeconds(elapsedSec);
        setCountdownRemaining(remSec);
      }, 50);

      // Automatic stop after exactly 6000ms
      stopTimeoutRef.current = window.setTimeout(async () => {
        if (!isMountedRef.current) return;
        if (timerIntervalRef.current) {
          window.clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = null;
        }
        if (meterAnimRef.current) {
          window.cancelAnimationFrame(meterAnimRef.current);
          meterAnimRef.current = null;
        }

        const actualDuration = (Date.now() - startTimeRef.current) / 1000;
        setElapsedSeconds(actualDuration);
        setCountdownRemaining(0);
        setState('processing');

        try {
          const { blob, mimeType } = await recorder.stopRecording();
          setAnalyser(null);
          setAudioLevel(0);

          if (!blob || blob.size < 500) {
            throw new Error('Recorded audio is empty. Please verify your microphone and try again.');
          }

          // Call API
          const ext = mimeType.includes('ogg') ? 'ogg' : mimeType.includes('mp4') ? 'm4a' : 'webm';
          const filename = `onetap_recording_${Date.now()}.${ext}`;

          const formData = new FormData();
          formData.append('audio', blob, filename);
          formData.append('min_confidence', (optionsRef.current.minConfidence ?? 0.05).toString());
          if (optionsRef.current.latitude != null && optionsRef.current.longitude != null) {
            formData.append('latitude', optionsRef.current.latitude.toString());
            formData.append('longitude', optionsRef.current.longitude.toString());
          }

          const res = await fetch(apiUrl('/api/analyze'), {
            method: 'POST',
            body: formData,
          });

          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || `Server responded with status ${res.status}`);
          }

          const analysis: AnalysisResponse = await res.json();
          if (!isMountedRef.current) return;

          setLastResult(analysis);
          if (analysis.top_prediction) {
            setState('success');
          } else {
            setState('no_detection');
          }

          optionsRef.current.onSuccess?.(analysis, blob, actualDuration);
        } catch (err: any) {
          if (!isMountedRef.current) return;
          const msg = err.message || 'Error occurred while analyzing audio.';
          setErrorMessage(msg);
          setState('error');
          optionsRef.current.onError?.(msg);
        } finally {
          isExecutingRef.current = false;
        }
      }, TOTAL_MS);

    } catch (err: any) {
      if (!isMountedRef.current) return;
      cleanup();
      const msg = err.message || 'Failed to start recording session.';
      setErrorMessage(msg);
      setState('error');
      optionsRef.current.onError?.(msg);
    }
  }, [cleanup, startLevelMeter, state]);

  const cancel = useCallback(() => {
    cleanup();
    setState('idle');
    setErrorMessage(null);
    setCountdownRemaining(6);
    setElapsedSeconds(0);
  }, [cleanup]);

  const reset = useCallback(() => {
    cleanup();
    setState('idle');
    setErrorMessage(null);
    setCountdownRemaining(6);
    setElapsedSeconds(0);
    setLastResult(null);
  }, [cleanup]);

  return {
    state,
    countdownRemaining,
    elapsedSeconds,
    audioLevel,
    analyser,
    errorMessage,
    lastResult,
    startOneTapRecording,
    cancel,
    reset,
  };
}
