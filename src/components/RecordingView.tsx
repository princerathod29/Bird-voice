import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Upload, Play, Sparkles, MapPin, Sliders, AlertCircle, RefreshCw, FileAudio } from 'lucide-react';
import { AudioVisualizer } from './AudioVisualizer';
import { BirdCarousel } from './BirdCarousel';
import { SampleRecording } from '../types/birdnet';
import { formatTime } from '../utils/audio';

interface RecordingViewProps {
  isRecording: boolean;
  recordingSeconds: number;
  analyser: AnalyserNode | null;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onCancelRecording: () => void;
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
}

export const RecordingView: React.FC<RecordingViewProps> = ({
  isRecording,
  recordingSeconds,
  analyser,
  onStartRecording,
  onStopRecording,
  onCancelRecording,
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
}) => {
  const [activeTab, setActiveTab] = useState<'mic' | 'upload'>('mic');
  const [dragActive, setDragActive] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [locStatus, setLocStatus] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-6 sm:py-10">
      {/* Hero Headline */}
      <div className="text-center space-y-3">
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[#f1f7f2]">
          Identify Bird Sounds in Nature
        </h1>
        <p className="mx-auto max-w-xl text-sm sm:text-base text-[#9db7a4]">
          Record or upload wild avian vocalizations. Processed directly through Cornell Lab’s official{' '}
          <span className="text-[#10b981] font-medium">BirdNET</span> neural network across 6,521 species.
        </p>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="flex items-start gap-3 rounded-xl border border-red-900/50 bg-red-950/40 p-4 text-xs text-red-200">
          <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-red-300">Analysis Notice</p>
            <p className="text-red-300/80 leading-relaxed">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Input Mode Selector (Segmented control) */}
      <div className="flex justify-center">
        <div className="inline-flex rounded-lg border border-[#1f3826] bg-[#0f1912] p-1">
          <button
            onClick={() => setActiveTab('mic')}
            disabled={isRecording || isAnalyzing}
            className={`flex items-center gap-2 rounded-md px-4 py-2 text-xs font-medium transition-colors ${
              activeTab === 'mic'
                ? 'bg-[#1b3122] text-[#f1f7f2] shadow-sm'
                : 'text-[#7e9985] hover:text-[#d3e5d7]'
            }`}
          >
            <Mic className="h-4 w-4 text-[#10b981]" />
            <span>Microphone Record</span>
          </button>
          <button
            onClick={() => setActiveTab('upload')}
            disabled={isRecording || isAnalyzing}
            className={`flex items-center gap-2 rounded-md px-4 py-2 text-xs font-medium transition-colors ${
              activeTab === 'upload'
                ? 'bg-[#1b3122] text-[#f1f7f2] shadow-sm'
                : 'text-[#7e9985] hover:text-[#d3e5d7]'
            }`}
          >
            <Upload className="h-4 w-4 text-[#10b981]" />
            <span>Upload Audio File</span>
          </button>
        </div>
      </div>

      {/* Main Action Box */}
      <div className="relative rounded-2xl border border-[#1f3826] bg-[#0c140f] p-6 sm:p-8 shadow-2xl">
        {activeTab === 'mic' ? (
          <div className="flex flex-col items-center space-y-6">
            {/* Visualizer when recording */}
            {isRecording ? (
              <div className="w-full space-y-4">
                <AudioVisualizer
                  analyser={analyser}
                  isRecording={isRecording}
                  recordingSeconds={recordingSeconds}
                />
                <div className="flex items-center justify-center gap-4">
                  <button
                    onClick={onStopRecording}
                    className="flex items-center gap-2 rounded-xl bg-red-600 px-6 py-3 text-sm font-semibold text-white shadow-lg hover:bg-red-500 transition-colors"
                  >
                    <span className="h-2.5 w-2.5 rounded-sm bg-white" />
                    <span>Stop & Analyze ({recordingSeconds.toFixed(1)}s)</span>
                  </button>
                  <button
                    onClick={onCancelRecording}
                    className="rounded-xl border border-[#23442e] bg-[#122017] px-4 py-3 text-xs font-medium text-[#8ca393] hover:text-[#f1f7f2] hover:bg-[#1a2e21] transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : isAnalyzing ? (
              /* Analyzing state */
              <div className="py-12 text-center space-y-4">
                <div className="relative mx-auto flex h-20 w-20 items-center justify-center">
                  <div className="absolute inset-0 rounded-full border-2 border-[#10b981]/20 border-t-[#10b981] animate-spin" />
                  <Sparkles className="h-8 w-8 text-[#10b981] animate-pulse" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-semibold text-[#f1f7f2]">
                    Running BirdNET Neural Inference...
                  </h3>
                  <p className="text-xs text-[#708c79]">
                    Extracting spectrogram harmonics · Classifying 6,521 avian sound profiles
                  </p>
                </div>
              </div>
            ) : (
              /* Idle state: bird carousel + record button */
              <div className="flex flex-col items-center py-2 space-y-5 text-center">
                <BirdCarousel samples={samples} onSelectSample={onSelectSample} disabled={isAnalyzing} />

                <div className="space-y-1">
                  <span className="text-sm font-semibold text-[#f1f7f2]">
                    Tap the bird to listen
                  </span>
                  <p className="text-xs text-[#769380] max-w-sm">
                    Point microphone toward the songbird · 3 to 10 seconds of clear call
                  </p>
                </div>

                <button
                  onClick={onStartRecording}
                  className="group relative flex h-16 w-16 items-center justify-center rounded-full bg-[#14261b] border-2 border-[#10b981]/50 shadow-[0_0_30px_rgba(16,185,129,0.15)] hover:border-[#10b981] hover:scale-105 active:scale-95 transition-all"
                  aria-label="Start recording bird sound"
                >
                  <span className="absolute inset-0 rounded-full bg-[#10b981]/10 group-hover:bg-[#10b981]/20 transition-colors" />
                  <Mic className="h-6 w-6 text-[#10b981] group-hover:scale-110 transition-transform" />
                </button>
                <span className="text-[11px] text-[#5d7764] -mt-3">or record your own</span>
              </div>
            )}
          </div>
        ) : (
          /* Audio File Upload View */
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
              dragActive
                ? 'border-[#10b981] bg-[#10b981]/10'
                : 'border-[#23442e] bg-[#0e1711] hover:border-[#386b49]'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*,.wav,.mp3,.m4a,.ogg,.flac,.webm"
              onChange={handleFileInputChange}
              className="hidden"
            />
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-[#14261b] border border-[#23442e] text-[#10b981]">
              <FileAudio className="h-7 w-7" />
            </div>
            <h3 className="text-sm font-semibold text-[#f1f7f2] mb-1">
              Drag & Drop your bird audio file here
            </h3>
            <p className="text-xs text-[#769380] mb-4">
              Supports WAV, MP3, M4A, OGG, FLAC up to 25 MB
            </p>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isAnalyzing}
              className="rounded-lg bg-[#10b981] px-4 py-2 text-xs font-semibold text-black hover:bg-[#34d399] transition-colors disabled:opacity-50"
            >
              Browse Audio File
            </button>
          </div>
        )}

        {/* Quick Sample Selector Bar */}
        <div className="mt-8 pt-6 border-t border-[#1a2d20]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-1.5 text-xs font-medium text-[#9db7a4]">
              <Sparkles className="h-3.5 w-3.5 text-[#10b981]" />
              <span>No birds singing nearby? Try authentic audio samples:</span>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {samples.map((sample) => (
              <button
                key={sample.id}
                onClick={() => onSelectSample(sample)}
                disabled={isAnalyzing || isRecording}
                className="flex items-center justify-between rounded-lg border border-[#23442e] bg-[#0e1711] p-2.5 text-left hover:border-[#10b981]/60 hover:bg-[#142318] transition-colors disabled:opacity-50 group"
              >
                <div className="truncate pr-2">
                  <div className="text-xs font-semibold text-[#f1f7f2] group-hover:text-[#10b981] transition-colors truncate">
                    {sample.common_name}
                  </div>
                  <div className="text-[10px] font-mono italic text-[#708c79] truncate">
                    {sample.species}
                  </div>
                </div>
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-[#16271c] text-[#10b981] group-hover:bg-[#10b981] group-hover:text-black transition-colors">
                  <Play className="h-3 w-3 fill-current ml-0.5" />
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Optional Analysis Settings (Location context & Sensitivity) */}
        <div className="mt-6 pt-4 border-t border-[#1a2d20]/60 flex flex-wrap items-center justify-between gap-3 text-xs">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="flex items-center gap-1.5 text-[#769380] hover:text-[#d3e5d7] transition-colors"
          >
            <Sliders className="h-3.5 w-3.5" />
            <span>Advanced parameters {showSettings ? '▲' : '▼'}</span>
          </button>

          {latitude && longitude ? (
            <div className="flex items-center gap-1.5 text-[11px] font-mono text-[#10b981]">
              <MapPin className="h-3 w-3" />
              <span>Location Context: {latitude.toFixed(2)}°, {longitude.toFixed(2)}°</span>
              <button
                onClick={clearLocation}
                className="text-[#769380] hover:text-red-400 ml-1"
                title="Remove location"
              >
                ×
              </button>
            </div>
          ) : (
            <button
              onClick={requestGeolocation}
              disabled={gettingLocation}
              className="flex items-center gap-1 text-[11px] text-[#769380] hover:text-[#d3e5d7] transition-colors"
            >
              <MapPin className="h-3 w-3 text-[#10b981]" />
              <span>{gettingLocation ? 'Locating...' : '+ Add Local Region Filter'}</span>
            </button>
          )}
        </div>

        {/* Expanded Settings Box */}
        {showSettings && (
          <div className="mt-4 rounded-xl border border-[#1f3826] bg-[#09110c] p-4 space-y-4 text-xs">
            {/* Minimum confidence threshold */}
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
                Lower thresholds (5%) discover subtle background birds; higher thresholds (25%+) return only decisive identifications.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
