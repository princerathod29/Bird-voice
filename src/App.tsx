import React, { useState, useEffect, useCallback } from 'react';
import { AlertCircle } from 'lucide-react';
import { GhostFibers } from './components/GhostFibers';
import { Header } from './components/Header';
import { RecordingView } from './components/RecordingView';
import { ResultsView } from './components/ResultsView';
import { HistoryModal } from './components/HistoryModal';
import { SamplesModal } from './components/SamplesModal';
import { AboutModal } from './components/AboutModal';
import { useBirdRecorder } from './hooks/useBirdRecorder';
import { apiUrl } from './utils/api';
import { AnalysisResponse, HistoryItem, SampleRecording } from './types/birdnet';

export function App() {
  const [view, setView] = useState<'recording' | 'results'>('recording');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResponse | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | undefined>(undefined);
  const [currentFileName, setCurrentFileName] = useState<string | undefined>(undefined);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [backendUp, setBackendUp] = useState<boolean | null>(null);

  // Settings
  const [minConfidence, setMinConfidence] = useState<number>(0.05);
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);

  // Modals
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isSamplesOpen, setIsSamplesOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);

  // History & Samples data
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem('birdvoice_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [samples, setSamples] = useState<SampleRecording[]>([
    {
      id: 'robin',
      name: 'European Robin (Song)',
      species: 'Erithacus rubecula',
      common_name: 'European Robin',
      duration: 7.0,
      description: 'Rich liquid warble recorded in temperate woodland habitat.',
      audio_url: '/samples/robin.mp3',
      sample_file: 'robin.mp3',
    },
    {
      id: 'cardinal',
      name: 'Northern Cardinal (Whistle)',
      species: 'Cardinalis cardinalis',
      common_name: 'Northern Cardinal',
      duration: 6.0,
      description: 'Clear resonant whistle notes followed by rapid trill.',
      audio_url: '/samples/cardinal.mp3',
      sample_file: 'cardinal.mp3',
    },
    {
      id: 'koel',
      name: 'Asian Koel (Breeding Call)',
      species: 'Eudynamys scolopaceus',
      common_name: 'Asian Koel',
      duration: 6.0,
      description: "Loud repetitive 'ko-el' breeding crescendo recorded in tropical canopy.",
      audio_url: '/samples/koel.mp3',
      sample_file: 'koel.mp3',
    },
  ]);

  // Helper: Save observation to history
  const saveObservationToHistory = useCallback((res: AnalysisResponse, filename: string, durationSec: number) => {
    if (!res.top_prediction) return;
    const newItem: HistoryItem = {
      id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      duration: durationSec || res.duration,
      topSpecies: res.top_prediction.common_name,
      scientificName: res.top_prediction.scientific_name,
      confidence: res.top_prediction.confidence,
      audioFileName: filename,
      diversityScore: res.soundscape_diversity_score,
      predictionsCount: res.species_detected_count,
      response: res,
    };
    setHistory((prev) => {
      const exists = prev.some((h) => h.id === newItem.id);
      if (exists) return prev;
      return [newItem, ...prev.slice(0, 49)];
    });
  }, []);

  // One-Tap 4-Second Bird Recorder Hook
  const {
    state: recordingState,
    countdownRemaining,
    elapsedSeconds,
    audioLevel,
    analyser,
    errorMessage: recorderError,
    startOneTapRecording,
    cancel: cancelRecording,
    reset: resetRecording,
  } = useBirdRecorder({
    minConfidence,
    latitude,
    longitude,
    onSuccess: (result, blob, duration) => {
      setAudioBlob(blob);
      setAudioUrl(undefined);
      const stamp = new Date().toLocaleTimeString().replace(/:/g, '-');
      const filename = `Mic_Recording_${stamp}.webm`;
      setCurrentFileName(filename);
      setAnalysisResult(result);
      setView('results');

      if (result.top_prediction) {
        saveObservationToHistory(result, filename, duration);
      }
    },
    onError: (err) => {
      setErrorMessage(err);
    },
  });

  // Load samples from backend
  useEffect(() => {
    fetch(apiUrl('/api/samples'))
      .then((res) => res.json())
      .then((data) => {
        if (data.samples && Array.isArray(data.samples)) {
          setSamples(
            data.samples.map((s: SampleRecording) => ({ ...s, audio_url: apiUrl(s.audio_url) }))
          );
        }
      })
      .catch((err) => console.log('Samples fetch notice:', err));
  }, []);

  // Detect whether the AI backend is reachable
  useEffect(() => {
    fetch(apiUrl('/api/health'))
      .then((res) => setBackendUp(res.ok))
      .catch(() => setBackendUp(false));
  }, []);

  // Sync history to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('birdvoice_history', JSON.stringify(history));
    } catch {}
  }, [history]);

  // Upload audio file handler
  const handleUploadFile = async (file: File) => {
    setErrorMessage(null);
    const allowed = /\.(wav|mp3|m4a|ogg|flac|webm|aac)$/i;
    if (!allowed.test(file.name) && !file.type.startsWith('audio/')) {
      setErrorMessage('Unsupported format. Please select a WAV, MP3, M4A, OGG, FLAC, or WEBM audio file.');
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      setErrorMessage('Audio file exceeds 25 MB limit.');
      return;
    }

    setAudioBlob(file);
    setAudioUrl(undefined);
    setCurrentFileName(file.name);
    await processAudio(file, file.name);
  };

  // Select pre-recorded sample handler
  const handleSelectSample = async (sample: SampleRecording) => {
    setErrorMessage(null);
    setIsAnalyzing(true);
    setCurrentFileName(sample.name);

    try {
      let audioRes = await fetch(sample.audio_url);
      if (!audioRes.ok) throw new Error('Failed to load sample audio from server.');
      let blob = await audioRes.blob();
      setAudioBlob(blob);
      setAudioUrl(sample.audio_url);

      await processAudio(blob, sample.sample_file);
    } catch (err: any) {
      try {
        const localUrl = `/samples/${sample.id}.mp3`;
        const localRes = await fetch(localUrl);
        if (!localRes.ok) throw new Error('Sample audio unavailable.');
        const blob = await localRes.blob();
        setAudioBlob(blob);
        setAudioUrl(localUrl);
        setErrorMessage(
          backendUp === false
            ? 'AI backend not connected — playing the bundled sample.'
            : err.message || 'Failed to process sample audio.'
        );
        setIsAnalyzing(false);
      } catch {
        setErrorMessage(err.message || 'Failed to process sample audio.');
        setIsAnalyzing(false);
      }
    }
  };

  // Core API call to /api/analyze (used for uploaded files & sample selector)
  const processAudio = async (blob: Blob, filename: string) => {
    setIsAnalyzing(true);
    setErrorMessage(null);

    const formData = new FormData();
    formData.append('audio', blob, filename);
    formData.append('min_confidence', minConfidence.toString());
    if (latitude !== null && longitude !== null) {
      formData.append('latitude', latitude.toString());
      formData.append('longitude', longitude.toString());
    }

    try {
      const response = await fetch(apiUrl('/api/analyze'), {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (backendUp === false) {
          throw new Error('AI backend not connected. Run the backend locally or set VITE_API_BASE_URL.');
        }
        throw new Error(errorData.error || errorData.detail || `Server error (${response.status})`);
      }

      const result: AnalysisResponse = await response.json();
      setAnalysisResult(result);
      setView('results');

      if (result.top_prediction) {
        saveObservationToHistory(result, filename, result.duration);
      }
    } catch (err: any) {
      console.error('Analysis failed:', err);
      setErrorMessage(err.message || 'Error occurred while running BirdNET neural analysis. Please verify your connection.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Revisit history item
  const handleSelectHistoryItem = (item: HistoryItem) => {
    setAnalysisResult(item.response);
    setCurrentFileName(item.audioFileName || item.topSpecies);
    setAudioBlob(null);
    setView('results');
  };

  const handleClearHistory = () => {
    setHistory([]);
  };

  const handleRemoveHistoryItem = (id: string) => {
    setHistory((prev) => prev.filter((item) => item.id !== id));
  };

  const handleReset = () => {
    setView('recording');
    setAnalysisResult(null);
    setAudioBlob(null);
    setAudioUrl(undefined);
    setCurrentFileName(undefined);
    setErrorMessage(null);
    resetRecording();
  };

  return (
    <div className="min-h-screen bg-[#070b08] text-[#e3ece5] flex flex-col font-sans selection:bg-[#10b981] selection:text-black relative">
      {/* Bioacoustic dynamic ambient background layer */}
      <GhostFibers opacity={0.65} speed={1.0} interactive={true} />

      {/* Backend status banner if unreachable */}
      {backendUp === false && (
        <div className="relative z-10 mx-auto mt-4 flex w-full max-w-3xl items-start gap-3 rounded-xl border border-amber-900/50 bg-amber-950/30 p-4 text-xs text-amber-200">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5 text-amber-400" />
          <div className="space-y-1">
            <p className="font-semibold text-amber-300">AI backend not connected</p>
            <p className="leading-relaxed text-amber-200/80">
              For live BirdNET identification, ensure the local backend is running (port 3000) or configure{' '}
              <span className="font-mono text-amber-300">VITE_API_BASE_URL</span>.
            </p>
          </div>
        </div>
      )}

      {/* Navigation Header */}
      <Header
        onOpenHistory={() => setIsHistoryOpen(true)}
        onOpenSamples={() => setIsSamplesOpen(true)}
        onOpenAbout={() => setIsAboutOpen(true)}
        historyCount={history.length}
        isAnalyzing={isAnalyzing || recordingState === 'processing'}
        onReset={handleReset}
      />

      {/* Main Content Area */}
      <main className="flex-1 relative z-10">
        {view === 'recording' ? (
          <RecordingView
            recordingState={recordingState}
            countdownRemaining={countdownRemaining}
            elapsedSeconds={elapsedSeconds}
            audioLevel={audioLevel}
            analyser={analyser}
            onTapBird={startOneTapRecording}
            onCancelRecording={cancelRecording}
            onRetryRecording={startOneTapRecording}
            onUploadFile={handleUploadFile}
            onSelectSample={handleSelectSample}
            samples={samples}
            minConfidence={minConfidence}
            onChangeMinConfidence={setMinConfidence}
            latitude={latitude}
            longitude={longitude}
            onSetLocation={(lat, lon) => {
              setLatitude(lat);
              setLongitude(lon);
            }}
            errorMessage={recorderError || errorMessage}
            isAnalyzing={isAnalyzing || recordingState === 'processing'}
            backendUp={backendUp}
          />
        ) : (
          analysisResult && (
            <ResultsView
              analysis={analysisResult}
              audioBlob={audioBlob}
              audioUrl={audioUrl}
              onReset={handleReset}
              fileName={currentFileName}
              onSaveObservation={() => {
                if (analysisResult?.top_prediction) {
                  saveObservationToHistory(
                    analysisResult,
                    currentFileName || 'Observation',
                    analysisResult.duration
                  );
                }
              }}
              isSaved={
                analysisResult.top_prediction
                  ? history.some(
                      (h) =>
                        h.topSpecies === analysisResult.top_prediction?.common_name &&
                        h.response === analysisResult
                    )
                  : false
              }
            />
          )
        )}
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-[#15231a] bg-[#09100b]/85 backdrop-blur-sm py-6 text-center text-xs text-[#5a7663]">
        <div className="mx-auto max-w-6xl px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#10b981]" />
            <span className="font-semibold text-[#8ca393]">BirdVoice AI</span>
            <span>·</span>
            <span>Cornell Lab BirdNET Neural Engine</span>
          </div>

          <div className="flex items-center gap-4 text-[11px] text-[#6d8b76]">
            <span>6,521 Avian Species</span>
            <span>·</span>
            <span>One-Tap 6s Audio ID</span>
            <span>·</span>
            <span>High-pass Rumble Filter</span>
            <span>·</span>
            <span>STFT Spectrogram</span>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <HistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        history={history}
        onSelectHistoryItem={handleSelectHistoryItem}
        onClearHistory={handleClearHistory}
        onRemoveHistoryItem={handleRemoveHistoryItem}
      />

      <SamplesModal
        isOpen={isSamplesOpen}
        onClose={() => setIsSamplesOpen(false)}
        samples={samples}
        onSelectSample={handleSelectSample}
        isAnalyzing={isAnalyzing || recordingState === 'processing'}
      />

      <AboutModal
        isOpen={isAboutOpen}
        onClose={() => setIsAboutOpen(false)}
      />
    </div>
  );
}

export default App;
