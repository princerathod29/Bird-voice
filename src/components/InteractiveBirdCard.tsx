import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  AlertCircle,
  RotateCcw,
  Volume2,
  X,
  Play
} from 'lucide-react';
import { OneTapRecordingState, SampleRecording } from '../types/birdnet';

const BIRD_ART: Record<
  string,
  {
    body: string;
    breast: string;
    head: string;
    wing: string;
    tail: string;
    crest?: boolean;
    mask?: boolean;
    eye?: string;
  }
> = {
  robin: {
    body: '#8a6d4a',
    breast: '#e0703a',
    head: '#8a6d4a',
    wing: '#6b543a',
    tail: '#54432e',
  },
  cardinal: {
    body: '#c62f2f',
    breast: '#e04a4a',
    head: '#c62f2f',
    wing: '#a32424',
    tail: '#7f1d1d',
    crest: true,
    mask: true,
  },
  koel: {
    body: '#232a33',
    breast: '#39424e',
    head: '#1a212b',
    wing: '#141a22',
    tail: '#0b0f14',
    eye: '#ef4444',
  },
};

const DEFAULT_ART = {
  body: '#5b6b5f',
  breast: '#7d8f83',
  head: '#5b6b5f',
  wing: '#49564c',
  tail: '#37413a',
};

export function BirdSvg({
  id,
  isRecording = false,
  scaleFactor = 1.0,
}: {
  id: string;
  isRecording?: boolean;
  scaleFactor?: number;
}) {
  const c = BIRD_ART[id] || DEFAULT_ART;
  return (
    <svg
      viewBox="0 0 220 200"
      className="h-44 w-44 sm:h-56 sm:w-56 drop-shadow-2xl transition-transform duration-150 select-none pointer-events-none"
      style={{
        transform: isRecording ? `scale(${1.0 + Math.min(0.08, scaleFactor * 0.1)})` : undefined,
      }}
      role="img"
      aria-label="Bird illustration"
    >
      {/* Branch */}
      <line
        x1="24"
        y1="182"
        x2="196"
        y2="182"
        stroke="#3d2f1e"
        strokeWidth="6"
        strokeLinecap="round"
      />
      {/* Foliage hint on branch */}
      <circle cx="36" cy="178" r="4" fill="#1e3a24" />
      <circle cx="184" cy="178" r="4" fill="#1e3a24" />

      {/* Tail */}
      <path d="M62 128 L16 164 L36 170 L72 142 Z" fill={c.tail} />

      {/* Body */}
      <ellipse cx="108" cy="118" rx="56" ry="42" fill={c.body} />

      {/* Breast */}
      <ellipse cx="134" cy="128" rx="30" ry="27" fill={c.breast} />

      {/* Wing */}
      <path d="M84 104 Q120 94 142 124 Q114 142 88 134 Z" fill={c.wing} />

      {/* Crest */}
      {c.crest && <path d="M136 50 L148 18 L162 48 Z" fill={c.body} />}

      {/* Head */}
      <circle cx="150" cy="70" r="26" fill={c.head} />

      {/* Facial Mask */}
      {c.mask && (
        <path
          d="M138 58 Q152 52 168 62 L166 74 Q150 70 140 68 Z"
          fill="#111"
          opacity="0.88"
        />
      )}

      {/* Beak */}
      <path d="M172 64 L200 71 L172 78 Z" fill="#f59e0b" />

      {/* Eye */}
      <circle cx="158" cy="64" r="4.2" fill={c.eye || '#0a0f0c'} />
      {!c.eye && <circle cx="159.5" cy="62.5" r="1.3" fill="#fff" />}

      {/* Legs */}
      <line
        x1="104"
        y1="156"
        x2="104"
        y2="180"
        stroke="#8a6d3b"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <line
        x1="126"
        y1="156"
        x2="126"
        y2="180"
        stroke="#8a6d3b"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

interface InteractiveBirdCardProps {
  state: OneTapRecordingState;
  countdownRemaining: number;
  elapsedSeconds: number;
  audioLevel: number;
  analyser: AnalyserNode | null;
  errorMessage: string | null;
  samples: SampleRecording[];
  onTapBird: () => void;
  onCancel: () => void;
  onRetry: () => void;
  onSelectSample: (sample: SampleRecording) => void;
  disabled?: boolean;
}

export const InteractiveBirdCard: React.FC<InteractiveBirdCardProps> = ({
  state,
  countdownRemaining,
  elapsedSeconds,
  audioLevel,
  analyser,
  errorMessage,
  samples,
  onTapBird,
  onCancel,
  onRetry,
  onSelectSample,
  disabled = false,
}) => {
  const [sampleIndex, setSampleIndex] = useState(0);
  const count = samples.length;
  const currentSample = samples[sampleIndex] || {
    id: 'robin',
    name: 'European Robin',
    common_name: 'European Robin',
    species: 'Erithacus rubecula',
  };

  const go = (dir: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (count > 0) {
      setSampleIndex((i) => (i + dir + count) % count);
    }
  };

  // Sound meter mini bars
  const [meterBars, setMeterBars] = useState<number[]>(new Array(16).fill(0.1));
  const meterRafRef = useRef<number | null>(null);

  useEffect(() => {
    if (state !== 'recording' || !analyser) {
      if (meterRafRef.current) cancelAnimationFrame(meterRafRef.current);
      return;
    }

    const buffer = new Uint8Array(analyser.frequencyBinCount);
    const update = () => {
      analyser.getByteFrequencyData(buffer);
      const step = Math.max(1, Math.floor(buffer.length / 16));
      const bars = [];
      for (let i = 0; i < 16; i++) {
        const val = buffer[i * step] || 0;
        bars.push(Math.max(0.1, val / 255));
      }
      setMeterBars(bars);
      meterRafRef.current = requestAnimationFrame(update);
    };
    meterRafRef.current = requestAnimationFrame(update);

    return () => {
      if (meterRafRef.current) cancelAnimationFrame(meterRafRef.current);
    };
  }, [state, analyser]);

  // Circular countdown calculations (circumference for radius 92)
  const radius = 94;
  const circumference = 2 * Math.PI * radius;
  // Progress from 0 to 1 over 6 seconds
  const progressRatio = Math.min(1.0, elapsedSeconds / 6.0);
  const strokeDashoffset = circumference * (1 - progressRatio);

  const isBusy =
    state === 'requesting_permission' ||
    state === 'recording' ||
    state === 'processing';

  return (
    <div className="relative w-full rounded-2xl border border-[#1f3826] bg-[#0c140f] p-6 sm:p-8 shadow-2xl overflow-hidden transition-all">
      {/* Background radial ambient glow */}
      <div
        className={`pointer-events-none absolute -inset-20 transition-opacity duration-700 ${
          state === 'recording'
            ? 'opacity-80 bg-[radial-gradient(circle_at_center,rgba(239,68,68,0.12)_0%,transparent_70%)]'
            : state === 'processing'
            ? 'opacity-80 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.18)_0%,transparent_70%)]'
            : 'opacity-40 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.08)_0%,transparent_70%)]'
        }`}
      />

      {/* Error state card if mic permission was denied */}
      {state === 'error' && errorMessage && (
        <div className="relative z-20 mb-6 flex items-start gap-3 rounded-xl border border-red-900/60 bg-red-950/50 p-4 text-xs text-red-200">
          <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1 space-y-1">
            <p className="font-semibold text-red-300">Microphone Notice</p>
            <p className="text-red-200/90 leading-relaxed">{errorMessage}</p>
            <div className="pt-2 flex items-center gap-2">
              <button
                onClick={onRetry}
                className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-500 transition-colors shadow"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Retry Permission</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Interactive Stage */}
      <div className="relative z-10 flex flex-col items-center text-center">
        {/* Sample browsing arrows (inactive during recording/processing) */}
        {!isBusy && count > 1 && (
          <div className="absolute top-1/2 -translate-y-1/2 w-full flex justify-between pointer-events-none px-0 sm:-px-2 z-20">
            <button
              onClick={(e) => go(-1, e)}
              disabled={disabled || isBusy}
              aria-label="Previous bird artwork"
              className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full border border-[#23442e] bg-[#0f1912]/90 text-[#9db7a4] hover:text-[#10b981] hover:border-[#10b981]/60 transition-colors disabled:opacity-30 shadow-lg"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={(e) => go(1, e)}
              disabled={disabled || isBusy}
              aria-label="Next bird artwork"
              className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full border border-[#23442e] bg-[#0f1912]/90 text-[#9db7a4] hover:text-[#10b981] hover:border-[#10b981]/60 transition-colors disabled:opacity-30 shadow-lg"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        )}

        {/* Central Clickable Bird Area */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            if (!isBusy && state !== 'error') {
              onTapBird();
            }
          }}
          onKeyDown={(e) => {
            if ((e.key === 'Enter' || e.key === ' ') && !isBusy) {
              e.preventDefault();
              onTapBird();
            }
          }}
          aria-label={
            state === 'recording'
              ? `Recording bird audio, ${countdownRemaining} seconds remaining`
              : state === 'processing'
              ? 'Analyzing bird call with BirdNET'
              : 'Tap bird to record and identify bird call'
          }
          className={`group relative flex flex-col items-center justify-center rounded-3xl p-4 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-[#10b981]/70 ${
            !isBusy
              ? 'cursor-pointer hover:scale-[1.03] active:scale-95'
              : 'cursor-default'
          }`}
        >
          {/* Circular Countdown Ring & Glowing Aura when recording */}
          <div className="relative flex items-center justify-center">
            {/* SVG Circular Progress Ring */}
            <svg
              className={`absolute -inset-4 h-56 w-56 sm:h-64 sm:w-64 -rotate-90 pointer-events-none transition-opacity duration-300 ${
                state === 'recording' ? 'opacity-100' : 'opacity-0'
              }`}
            >
              {/* Background Track */}
              <circle
                cx="112"
                cy="112"
                r={radius}
                className="stroke-[#192b1e]"
                strokeWidth="6"
                fill="transparent"
              />
              {/* Animated Progress Circle */}
              <circle
                cx="112"
                cy="112"
                r={radius}
                className="stroke-red-500 transition-all duration-75"
                strokeWidth="6"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="transparent"
              />
            </svg>

            {/* Concentric soundwave ripples during recording */}
            {state === 'recording' && (
              <>
                <span className="absolute -inset-2 rounded-full border-2 border-red-500/30 animate-ping pointer-events-none" />
                <span className="absolute -inset-6 rounded-full border border-red-500/20 animate-pulse pointer-events-none" />
              </>
            )}

            {/* Neural scan spinning aura during processing */}
            {state === 'processing' && (
              <div className="absolute -inset-4 rounded-full border-2 border-[#10b981]/20 border-t-[#10b981] animate-spin pointer-events-none" />
            )}

            {/* Ambient Idle Ring with subtle glow */}
            {state === 'idle' && (
              <div className="absolute -inset-2 rounded-full border border-[#10b981]/20 group-hover:border-[#10b981]/50 group-hover:shadow-[0_0_35px_rgba(16,185,129,0.22)] transition-all duration-300 pointer-events-none" />
            )}

            {/* High quality Bird SVG Illustration */}
            <div className="relative z-10 transition-transform">
              <BirdSvg
                id={currentSample.id}
                isRecording={state === 'recording'}
                scaleFactor={audioLevel}
              />
            </div>

            {/* Circular Countdown Number Floating Badge */}
            {state === 'recording' && (
              <div className="absolute top-2 right-2 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-red-600 font-mono text-base font-extrabold text-white shadow-xl border-2 border-[#0c140f] animate-pulse">
                {countdownRemaining}s
              </div>
            )}

            {/* Pulsing Mic Badge in Idle State */}
            {state === 'idle' && (
              <div className="absolute bottom-2 right-4 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-[#10b981] text-black shadow-lg group-hover:scale-110 group-hover:bg-[#34d399] transition-all">
                <Mic className="h-5 w-5" />
              </div>
            )}
          </div>

          {/* Bird Artwork Subtitle */}
          <div className="mt-2 text-center pointer-events-none">
            <div className="text-sm font-semibold text-[#f1f7f2] group-hover:text-[#10b981] transition-colors">
              {currentSample.common_name}
            </div>
            <div className="text-[11px] font-mono italic text-[#708c79]">
              {currentSample.species}
            </div>
          </div>
        </div>

        {/* Carousel sample switcher dots (idle state) */}
        {!isBusy && count > 1 && (
          <div className="mt-2 flex items-center gap-1.5">
            {samples.map((s, i) => (
              <button
                key={s.id}
                onClick={(e) => {
                  e.stopPropagation();
                  setSampleIndex(i);
                }}
                disabled={disabled || isBusy}
                aria-label={`Show ${s.common_name}`}
                className={`h-1.5 rounded-full transition-all ${
                  i === sampleIndex
                    ? 'w-5 bg-[#10b981]'
                    : 'w-1.5 bg-[#2a4032] hover:bg-[#3d5c49]'
                }`}
              />
            ))}
          </div>
        )}

        {/* Dynamic Contextual Action States & Text */}
        <div className="mt-5 w-full max-w-md space-y-3">
          {/* State 1: IDLE */}
          {state === 'idle' && (
            <div className="space-y-3">
              <div className="space-y-1">
                <h3 className="text-base sm:text-lg font-semibold text-[#f1f7f2]">
                  Tap the bird to identify a call
                </h3>
                <p className="text-xs text-[#769380]">
                  One tap records 6 seconds of natural audio and identifies species instantly.
                </p>
              </div>

              {/* Direct Tap Action Button */}
              <button
                onClick={onTapBird}
                disabled={disabled}
                className="group relative inline-flex items-center gap-2.5 rounded-full bg-[#10b981] px-6 py-2.5 text-xs sm:text-sm font-bold text-black shadow-lg hover:bg-[#34d399] hover:scale-105 active:scale-95 transition-all"
              >
                <Mic className="h-4 w-4 fill-black" />
                <span>Tap Bird to Record (6s)</span>
              </button>
            </div>
          )}

          {/* State 2: REQUESTING PERMISSION */}
          {state === 'requesting_permission' && (
            <div className="space-y-2 py-2">
              <div className="flex items-center justify-center gap-2 text-sm font-semibold text-amber-300">
                <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping" />
                <span>Requesting microphone permission...</span>
              </div>
              <p className="text-xs text-[#769380]">
                Please allow microphone access in your browser prompt.
              </p>
            </div>
          )}

          {/* State 3: RECORDING */}
          {state === 'recording' && (
            <div className="space-y-4 py-1">
              <div className="space-y-1">
                <div className="flex items-center justify-center gap-2 font-mono text-sm font-semibold text-red-400">
                  <span className="flex h-2.5 w-2.5 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                  </span>
                  <span>Listening to nature...</span>
                  <span>({countdownRemaining}s)</span>
                </div>
                <p className="text-xs text-[#8ca393]">
                  Hold steady · Automatically stops and classifies at 6s
                </p>
              </div>

              {/* Live sound level bars */}
              <div className="flex items-center justify-center gap-1 h-8 px-4">
                {meterBars.map((val, idx) => (
                  <div
                    key={idx}
                    className="w-1.5 rounded-full bg-gradient-to-t from-emerald-600 via-emerald-400 to-mint-200 transition-all duration-75"
                    style={{
                      height: `${Math.max(12, val * 32)}px`,
                      opacity: 0.4 + val * 0.6,
                    }}
                  />
                ))}
              </div>

              {/* Cancel Button */}
              <div>
                <button
                  onClick={onCancel}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#23442e] bg-[#122017] px-4 py-1.5 text-xs font-medium text-[#8ca393] hover:text-[#f1f7f2] hover:bg-[#1a2e21] transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                  <span>Cancel</span>
                </button>
              </div>
            </div>
          )}

          {/* State 4: PROCESSING */}
          {state === 'processing' && (
            <div className="space-y-3 py-2">
              <div className="space-y-1">
                <div className="flex items-center justify-center gap-2 font-semibold text-[#10b981] text-sm">
                  <Sparkles className="h-4 w-4 animate-spin" />
                  <span>Analyzing your recording...</span>
                </div>
                <p className="text-xs text-[#708c79]">
                  Generating bioacoustic STFT & running BirdNET neural network across 6,521 species
                </p>
              </div>
            </div>
          )}

          {/* State 5: ERROR */}
          {state === 'error' && (
            <div className="space-y-2">
              <button
                onClick={onRetry}
                className="inline-flex items-center gap-2 rounded-xl bg-[#10b981] px-5 py-2 text-xs font-semibold text-black hover:bg-[#34d399] transition-colors"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Try Recording Again</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
