import React, { useState, useRef } from 'react';
import {
  Mic,
  Upload,
  Play,
  Sparkles,
  MapPin,
  Sliders,
  AlertCircle,
  FileAudio,
  Radio,
  CheckCircle2,
  Activity,
  ShieldCheck
} from 'lucide-react';
import { InteractiveBirdCard } from './InteractiveBirdCard';
import { OneTapRecordingState, SampleRecording } from '../types/birdnet';
import { isMicrophoneSupported } from '../utils/audio';

interface RecordingViewProps {
  recordingState: OneTapRecordingState;
  countdownRemaining: number;
  elapsedSeconds: number;
  audioLevel: number;
  analyser: AnalyserNode | null;
  onTapBird: () => void;
  onCancelRecording: () => void;
  onRetryRecording: () => void;
  onUploadFile: (file: File) => void;
  onSelectSample: (sample: SampleRecording) => void;
  samples: SampleRecording[];
  minConfidence: number;
  onChangeMinConfidence: (val: number) => void;
  latitude: number | null;
  longitude: number | null;
  onSetLocation: (lat: number | null, lon: number | null) => void;
  errorMessage: string | null;
  isAnalyzing: boolean;
  backendUp: boolean | null;
}

export const RecordingView: React.FC<RecordingViewProps> = ({
  recordingState,
  countdownRemaining,
  elapsedSeconds,
  audioLevel,
  analyser,
  onTapBird,
  onCancelRecording,
  onRetryRecording,
  onUploadFile,
  onSelectSample,
  samples,
  minConfidence,
  onChangeMinConfidence,
  latitude,
  longitude,
  onSetLocation,
  errorMessage,
  isAnalyzing,
  backendUp,
}) => {
  const [activeTab, setActiveTab] = useState<'mic' | 'upload'>('mic');
  const [dragActive, setDragActive] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [, setLocStatus] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const hasMic = isMicrophoneSupported();

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      onUploadFile(file);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onUploadFile(e.target.files[0]);
    }
  };

  const requestGeolocation = () => {
    if (!navigator.geolocation) {
      setLocStatus('Geolocation not supported by browser');
      return;
    }
    setGettingLocation(true);
    setLocStatus('Locating...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGettingLocation(false);
        onSetLocation(pos.coords.latitude, pos.coords.longitude);
        setLocStatus(`Lat: ${pos.coords.latitude.toFixed(2)}°, Lon: ${pos.coords.longitude.toFixed(2)}°`);
      },
      (err) => {
        setGettingLocation(false);
        setLocStatus('Location permission denied or unavailable');
        console.log('Geo error:', err);
      },
      { timeout: 8000 }
    );
  };

  const clearLocation = () => {
    onSetLocation(null, null);
    setLocStatus('');
  };

  const isBusy =
    recordingState === 'recording' ||
    recordingState === 'processing' ||
    recordingState === 'requesting_permission' ||
    isAnalyzing;

  return (
    <div className="mx-auto max-w-3xl space-y-7 px-4 py-6 sm:py-9">
      {/* Hero Headline Section */}
      <div className="text-center space-y-3">
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-[#f1f7f2]">
          Discover the Birds Around You
        </h1>
        <p className="mx-auto max-w-xl text-sm sm:text-base text-[#9db7a4] leading-relaxed">
          Tap the bird, listen for six seconds, and identify bird calls with AI.
        </p>

        {/* Clear Status Indicator Bar */}
        <div className="pt-2 flex flex-wrap items-center justify-center gap-2 sm:gap-3 text-xs font-mono">
          {/* AI Model Status */}
          <div className="flex items-center gap-1.5 rounded-full border border-[#1e3825] bg-[#0c1610] px-3 py-1 text-[#a7f3d0]">
            <span
              className={`h-2 w-2 rounded-full ${
                backendUp === false ? 'bg-amber-400' : 'bg-[#10b981]'
              } ${backendUp !== false ? 'animate-pulse' : ''}`}
            />
            <span>
              {backendUp === false ? 'Backend Offline' : 'AI Model Ready (BirdNET v2.4)'}
            </span>
          </div>

          {/* Microphone Status */}
          <div className="flex items-center gap-1.5 rounded-full border border-[#1e3825] bg-[#0c1610] px-3 py-1 text-[#8ca393]">
            {recordingState === 'recording' ? (
              <>
                <span className="h-2 w-2 rounded-full bg-red-500 animate-ping" />
                <span className="text-red-400 font-semibold">Recording Active (6s)</span>
              </>
            ) : recordingState === 'processing' ? (
              <>
                <Activity className="h-3 w-3 text-[#10b981] animate-spin" />
                <span className="text-[#10b981]">Analyzing Audio</span>
              </>
            ) : hasMic ? (
              <>
                <CheckCircle2 className="h-3 w-3 text-[#10b981]" />
                <span>Microphone Ready</span>
              </>
            ) : (
              <span>Mic Unavailable</span>
            )}
          </div>

          {/* Noise Filtering / Preprocessing Status */}
          <div className="hidden sm:flex items-center gap-1.5 rounded-full border border-[#1e3825] bg-[#0c1610] px-3 py-1 text-[#708c79]">
            <ShieldCheck className="h-3 w-3 text-[#10b981]" />
            <span>Bioacoustic DSP Active</span>
          </div>
        </div>
      </div>

      {/* Global Error Notice (if any) */}
      {errorMessage && recordingState !== 'error' && (
        <div className="flex items-start gap-3 rounded-xl border border-red-900/50 bg-red-950/40 p-4 text-xs text-red-200">
          <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-red-300">Analysis Notice</p>
            <p className="text-red-300/80 leading-relaxed">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Mode Selector (Microphone Record vs Upload Audio File) */}
      <div className="flex justify-center">
        <div className="inline-flex rounded-xl border border-[#1f3826] bg-[#0f1912] p-1 shadow-inner">
          <button
            onClick={() => setActiveTab('mic')}
            disabled={isBusy}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-colors ${
              activeTab === 'mic'
                ? 'bg-[#1b3122] text-[#f1f7f2] shadow-sm'
                : 'text-[#7e9985] hover:text-[#d3e5d7]'
            }`}
          >
            <Mic className="h-4 w-4 text-[#10b981]" />
            <span>Tap to Record (6s)</span>
          </button>
          <button
            onClick={() => setActiveTab('upload')}
            disabled={isBusy}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-colors ${
              activeTab === 'upload'
                ? 'bg-[#1b3122] text-[#f1f7f2] shadow-sm'
                : 'text-[#7e9985] hover:text-[#d3e5d7]'
            }`}
          >
            <Upload className="h-4 w-4 text-[#10b981]" />
            <span>Upload File</span>
          </button>
        </div>
      </div>

      {/* Main Interactive Stage */}
      {activeTab === 'mic' ? (
        <InteractiveBirdCard
          state={recordingState}
          countdownRemaining={countdownRemaining}
          elapsedSeconds={elapsedSeconds}
          audioLevel={audioLevel}
          analyser={analyser}
          errorMessage={errorMessage}
          samples={samples}
          onTapBird={onTapBird}
          onCancel={onCancelRecording}
          onRetry={onRetryRecording}
          onSelectSample={onSelectSample}
          disabled={isBusy}
        />
      ) : (
        /* Audio File Upload View */
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition-colors shadow-2xl bg-[#0c140f] ${
            dragActive
              ? 'border-[#10b981] bg-[#10b981]/10'
              : 'border-[#23442e] hover:border-[#386b49]'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*,.wav,.mp3,.m4a,.ogg,.flac,.webm"
            onChange={handleFileInputChange}
            className="hidden"
          />
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#14261b] border border-[#23442e] text-[#10b981]">
            <FileAudio className="h-8 w-8" />
          </div>
          <h3 className="text-base font-semibold text-[#f1f7f2] mb-1">
            Drag & Drop your bird audio file here
          </h3>
          <p className="text-xs text-[#769380] mb-5 max-w-sm">
            Supports WAV, MP3, M4A, OGG, FLAC, WEBM up to 25 MB. Preprocessed through Cornell BirdNET.
          </p>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isBusy}
            className="rounded-xl bg-[#10b981] px-5 py-2.5 text-xs font-bold text-black hover:bg-[#34d399] transition-all hover:scale-105 active:scale-95 disabled:opacity-50 shadow-md"
          >
            Browse Audio File
          </button>
        </div>
      )}

      {/* Quick Authentic Audio Samples Bar */}
      <div className="rounded-2xl border border-[#1a2d20] bg-[#0a120c] p-5 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#a7f3d0]">
            <Sparkles className="h-3.5 w-3.5 text-[#10b981]" />
            <span>No birds singing nearby? Try authentic audio samples:</span>
          </div>
          <span className="text-[11px] font-mono text-[#5f7a67]">
            Recorded in wild habitats
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {samples.map((sample) => (
            <button
              key={sample.id}
              onClick={() => onSelectSample(sample)}
              disabled={isBusy}
              className="flex items-center justify-between rounded-xl border border-[#23442e] bg-[#0e1711] p-3 text-left hover:border-[#10b981]/60 hover:bg-[#142318] transition-all disabled:opacity-50 group hover:scale-[1.01]"
            >
              <div className="truncate pr-2">
                <div className="text-xs font-semibold text-[#f1f7f2] group-hover:text-[#10b981] transition-colors truncate">
                  {sample.common_name}
                </div>
                <div className="text-[10px] font-mono italic text-[#708c79] truncate">
                  {sample.species}
                </div>
              </div>
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#16271c] text-[#10b981] group-hover:bg-[#10b981] group-hover:text-black transition-colors shadow">
                <Play className="h-3.5 w-3.5 fill-current ml-0.5" />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Optional Analysis Settings (Location context & Sensitivity) */}
      <div className="rounded-xl border border-[#1a2d20]/70 bg-[#09110c]/80 p-4 text-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="flex items-center gap-1.5 font-medium text-[#769380] hover:text-[#d3e5d7] transition-colors"
          >
            <Sliders className="h-3.5 w-3.5 text-[#10b981]" />
            <span>Advanced parameters & location filter {showSettings ? '▲' : '▼'}</span>
          </button>

          {latitude && longitude ? (
            <div className="flex items-center gap-1.5 text-[11px] font-mono text-[#10b981]">
              <MapPin className="h-3 w-3" />
              <span>Location Context: {latitude.toFixed(2)}°, {longitude.toFixed(2)}°</span>
              <button
                onClick={clearLocation}
                className="text-[#769380] hover:text-red-400 ml-1 font-bold"
                title="Remove location"
              >
                ×
              </button>
            </div>
          ) : (
            <button
              onClick={requestGeolocation}
              disabled={gettingLocation}
              className="flex items-center gap-1 text-[11px] font-medium text-[#769380] hover:text-[#d3e5d7] transition-colors"
            >
              <MapPin className="h-3 w-3 text-[#10b981]" />
              <span>{gettingLocation ? 'Locating...' : '+ Add Local Region Filter'}</span>
            </button>
          )}
        </div>

        {/* Expanded Settings Box */}
        {showSettings && (
          <div className="mt-3 pt-3 border-t border-[#1a2d20] space-y-4">
            <div className="space-y-1.5">
              <div className="flex justify-between text-[#8ca393]">
                <span>Confidence Threshold:</span>
                <span className="font-mono text-[#10b981] font-semibold">
                  {(minConfidence * 100).toFixed(0)}%
                </span>
              </div>
              <input
                type="range"
                min="0.01"
                max="0.50"
                step="0.01"
                value={minConfidence}
                onChange={(e) => onChangeMinConfidence(parseFloat(e.target.value))}
                className="w-full accent-[#10b981] cursor-pointer"
              />
              <p className="text-[10px] text-[#5d7764]">
                BirdNET default is 5%. Higher settings (15-25%) only return high-confidence species.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
