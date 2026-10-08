import React, { useState, useEffect, useRef } from 'react';
import { GhostFibers } from './components/GhostFibers';
import { Header } from './components/Header';
import { RecordingView } from './components/RecordingView';
import { ResultsView } from './components/ResultsView';
import { HistoryModal } from './components/HistoryModal';
import { SamplesModal } from './components/SamplesModal';
import { AboutModal } from './components/AboutModal';
import { AudioRecorderService } from './utils/audio';
import { AnalysisResponse, HistoryItem, SampleRecording } from './types/birdnet';

export function App() {
  const [view, setView] = useState<'recording' | 'results'>('recording');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResponse | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | undefined>(undefined);
  const [currentFileName, setCurrentFileName] = useState<string | undefined>(undefined);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
      audio_url: '/api/samples/robin/audio',
      sample_file: 'robin.mp3'
    },
    {
      id: 'cardinal',
      name: 'Northern Cardinal (Whistle)',
      species: 'Cardinalis cardinalis',
      common_name: 'Northern Cardinal',
      duration: 7.0,
      description: 'Clear resonant whistle notes followed by rapid trill.',
      audio_url: '/api/samples/cardinal/audio',
      sample_file: 'cardinal.mp3'
    },
    {
      id: 'koel',
      name: 'Asian Koel (Breeding Call)',
      species: 'Eudynamys scolopaceus',
      common_name: 'Asian Koel',
      duration: 6.5,
      description: "Loud repetitive 'ko-el' breeding crescendo recorded in tropical canopy.",
      audio_url: '/api/samples/koel/audio',
      sample_file: 'koel.mp3'
    }
  ]);

  const recorderRef = useRef<AudioRecorderService | null>(null);
  const timerRef = useRef<number | null>(null);

  // Load samples from backend
  useEffect(() => {
    fetch('/api/samples')
      .then((res) => res.json())
      .then((data) => {
        if (data.samples && Array.isArray(data.samples)) {
          setSamples(data.samples);
        }
      })
      .catch((err) => console.log('Samples fetch notice:', err));
  }, []);

  // Sync history to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('birdvoice_history', JSON.stringify(history));
    } catch {}
  }, [history]);

  // Handle live recording timer
  useEffect(() => {
    if (isRecording) {
      setRecordingSeconds(0);
      const start = Date.now();
      timerRef.current = window.setInterval(() => {
        setRecordingSeconds((Date.now() - start) / 1000);
      }, 100);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isRecording]);

  // Start recording
  const handleStartRecording = async () => {
    setErrorMessage(null);
    try {
      const recorder = new AudioRecorderService();
      recorderRef.current = recorder;
      const stream = await recorder.requestPermission();
      const node = recorder.setupAnalyser(stream);
      setAnalyser(node);
      recorder.startRecording();
      setIsRecording(true);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to start microphone recording.');
      setIsRecording(false);
    }
  };

  // Stop recording & trigger analysis
  const handleStopRecording = async () => {
    if (!recorderRef.current || !isRecording) return;
    setIsRecording(false);

    try {
      const { blob, mimeType } = await recorderRef.current.stopRecording();
      if (recordingSeconds < 1.0) {
        setErrorMessage('Recording was too short. Please record for at least 3 seconds.');
        return;
      }
      const ext = mimeType.includes('ogg') ? 'ogg' : mimeType.includes('mp4') ? 'm4a' : 'webm';
      setAudioBlob(blob);
      setAudioUrl(undefined);
      const stamp = new Date().toLocaleTimeString().replace(/:/g, '-');
      setCurrentFileName(`Mic_Recording_${stamp}.${ext}`);
      await processAudio(blob, `mic_recording.${ext}`);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to finish recording audio.');
    }
  };

  // Cancel recording
  const handleCancelRecording = () => {
    if (recorderRef.current) {
      recorderRef.current.cancelRecording();
    }
    setIsRecording(false);
    setAnalyser(null);
    setRecordingSeconds(0);
  };

  // Upload audio file
  const handleUploadFile = async (file: File) => {
    setErrorMessage(null);
    const allowed = /\.(wav|mp3|m4a|ogg|flac|webm|aac)$/i;
    if (!allowed.test(file.name) && !file.type.startsWith('audio/')) {
      setErrorMessage('Unsupported format. Please select a WAV, MP3, M4A, OGG, or FLAC audio file.');
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

  // Select pre-recorded sample
  const handleSelectSample = async (sample: SampleRecording) => {
    setErrorMessage(null);
    setIsAnalyzing(true);
    setCurrentFileName(sample.name);

    try {
      const audioRes = await fetch(sample.audio_url);
      if (!audioRes.ok) throw new Error('Failed to load sample audio from server.');
      const blob = await audioRes.blob();
      setAudioBlob(blob);
      setAudioUrl(sample.audio_url);

      await processAudio(blob, sample.sample_file);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to process sample audio.');
      setIsAnalyzing(false);
    }
  };

  // Core API call to /api/analyze
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
      const response = await fetch('/api/analyze', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.detail || `Server error (${response.status})`);
      }

      const result: AnalysisResponse = await response.json();
      setAnalysisResult(result);
      setView('results');

      // Save to local history if species detected
      if (result.top_prediction) {
        const newHistoryItem: HistoryItem = {
          id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          timestamp: new Date().toISOString(),
          duration: result.duration,
          topSpecies: result.top_prediction.common_name,
          scientificName: result.top_prediction.scientific_name,
          confidence: result.top_prediction.confidence,
          audioFileName: filename,
          diversityScore: result.soundscape_diversity_score,
          predictionsCount: result.species_detected_count,
          response: result,
        };
        setHistory((prev) => [newHistoryItem, ...prev.slice(0, 49)]);
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
    if (isRecording) {
      handleCancelRecording();
    }
  };

  return (
    <div className="min-h-screen bg-[#070b08] text-[#e3ece5] flex flex-col font-sans selection:bg-[#10b981] selection:text-black relative">
      {/* Decorative GhostFibers bioacoustic background layer */}
      <GhostFibers opacity={0.65} speed={1.0} interactive={true} />

      {/* Navigation Header */}
      <Header
        onOpenHistory={() => setIsHistoryOpen(true)}
        onOpenSamples={() => setIsSamplesOpen(true)}
        onOpenAbout={() => setIsAboutOpen(true)}
        historyCount={history.length}
        isAnalyzing={isAnalyzing}
        onReset={handleReset}
      />

      {/* Main Content Area */}
      <main className="flex-1 relative z-10">
        {view === 'recording' ? (
          <RecordingView
            isRecording={isRecording}
            recordingSeconds={recordingSeconds}
            analyser={analyser}
            onStartRecording={handleStartRecording}
            onStopRecording={handleStopRecording}
            onCancelRecording={handleCancelRecording}
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
            errorMessage={errorMessage}
            isAnalyzing={isAnalyzing}
          />
        ) : (
          analysisResult && (
            <ResultsView
              analysis={analysisResult}
              audioBlob={audioBlob}
              audioUrl={audioUrl}
              onReset={handleReset}
              fileName={currentFileName}
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
            <span>Powered by Cornell Lab BirdNET Neural Engine</span>
          </div>

          <div className="flex items-center gap-4 text-[11px] text-[#6d8b76]">
            <span>6,521 Avian Species</span>
            <span>·</span>
            <span>Local Bioacoustic Inference</span>
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
        isAnalyzing={isAnalyzing}
      />

      <AboutModal
        isOpen={isAboutOpen}
        onClose={() => setIsAboutOpen(false)}
      />
    </div>
  );
}

export default App;
