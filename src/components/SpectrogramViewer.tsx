import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, RotateCcw, Volume2, Sparkles } from 'lucide-react';
import { SpectrogramData, TimelineSegment } from '../types/birdnet';
import { formatTime } from '../utils/audio';

interface SpectrogramViewerProps {
  spectrogram: SpectrogramData;
  timelineSegments?: TimelineSegment[];
  audioUrl?: string;
  audioBlob?: Blob | null;
  highlightedSpecies?: string;
}

export const SpectrogramViewer: React.FC<SpectrogramViewerProps> = ({
  spectrogram,
  timelineSegments = [],
  audioUrl,
  audioBlob,
  highlightedSpecies,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(spectrogram.duration || 0);
  const [internalAudioUrl, setInternalAudioUrl] = useState<string>('');

  // Setup audio object URL from blob or prop
  useEffect(() => {
    if (audioBlob) {
      const url = URL.createObjectURL(audioBlob);
      setInternalAudioUrl(url);
      return () => URL.revokeObjectURL(url);
    } else if (audioUrl) {
      setInternalAudioUrl(audioUrl);
    }
  }, [audioBlob, audioUrl]);

  // Audio duration updates
  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      const d = audioRef.current.duration;
      setDuration(Number.isFinite(d) && d > 0 ? d : spectrogram.duration);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => setIsPlaying(true)).catch((e) => console.log('Audio play error:', e));
    }
  };

  const restartAudio = () => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = 0;
    setCurrentTime(0);
    audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || duration <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    const targetTime = ratio * duration;
    audioRef.current.currentTime = targetTime;
    setCurrentTime(targetTime);
  };

  // Render STFT spectrogram onto Canvas with high fidelity bioacoustic colormap
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !spectrogram || !spectrogram.grid || spectrogram.grid.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const grid = spectrogram.grid;
    const numFreqBins = grid.length;
    const numTimeBins = grid[0].length;

    const width = canvas.width;
    const height = canvas.height;

    // Colormap function (bioacoustic spectrum: black -> pine green -> emerald -> gold -> incandescent white)
    const getBioColor = (val: number): [number, number, number] => {
      // val is 0.0 to 1.0
      if (val < 0.15) {
        // Deep background
        const t = val / 0.15;
        return [Math.round(8 + t * 5), Math.round(14 + t * 25), Math.round(10 + t * 15)];
      } else if (val < 0.45) {
        // Pine to emerald
        const t = (val - 0.15) / 0.3;
        return [Math.round(13 + t * 3), Math.round(39 + t * 145), Math.round(25 + t * 80)];
      } else if (val < 0.75) {
        // Emerald to vibrant amber gold
        const t = (val - 0.45) / 0.3;
        return [Math.round(16 + t * 230), Math.round(185 + t * 20), Math.round(105 - t * 80)];
      } else {
        // Gold to white-hot peak
        const t = (val - 0.75) / 0.25;
        return [Math.round(246 + t * 9), Math.round(205 + t * 50), Math.round(25 + t * 230)];
      }
    };

    const imgData = ctx.createImageData(width, height);
    const data = imgData.data;

    const cellWidth = width / numTimeBins;
    const cellHeight = height / numFreqBins;

    // Fast image rendering
    for (let py = 0; py < height; py++) {
      const fy = Math.min(numFreqBins - 1, Math.floor(py / cellHeight));
      const row = grid[fy];

      for (let px = 0; px < width; px++) {
        const tx = Math.min(numTimeBins - 1, Math.floor(px / cellWidth));
        const val = row[tx] || 0;
        const [r, g, b] = getBioColor(val);

        const index = (py * width + px) * 4;
        data[index] = r;
        data[index + 1] = g;
        data[index + 2] = b;
        data[index + 3] = 255;
      }
    }

    ctx.putImageData(imgData, 0, 0);

    // Draw subtle frequency guide lines (e.g. 2, 4, 6, 8, 10 kHz)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    const maxFreq = spectrogram.max_frequency_khz || 12;
    const freqSteps = [2, 4, 6, 8, 10];
    for (const khz of freqSteps) {
      if (khz < maxFreq) {
        const y = height - (khz / maxFreq) * height;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
    }
  }, [spectrogram]);

  const maxFreqKhz = spectrogram.max_frequency_khz || 12;
  const progressRatio = duration > 0 ? Math.min(1, currentTime / duration) : 0;

  return (
    <div className="rounded-xl border border-[#1f3826] bg-[#0c130e] p-4 text-[#e3ece5] shadow-lg">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Volume2 className="h-4 w-4 text-[#10b981]" />
          <h4 className="text-xs font-semibold uppercase tracking-wider text-[#9db7a4]">
            Acoustic Spectrogram & Vocalization Structure
          </h4>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono text-[#769380]">
          <span>{spectrogram.sample_rate || 48000} Hz</span>
          <span aria-hidden="true">·</span>
          <span>STFT (0 – {maxFreqKhz} kHz)</span>
        </div>
      </div>

      {/* Main Interactive Spectrogram Canvas & Overlay */}
      <div
        className="group relative cursor-pointer overflow-hidden rounded-lg border border-[#1a2d20] bg-black select-none"
        onClick={handleSeek}
        role="button"
        tabIndex={0}
        aria-label="Seek audio by clicking on spectrogram"
        onKeyDown={(e) => {
          if (e.key === ' ' || e.key === 'Enter') {
            togglePlay();
          }
        }}
      >
        <canvas
          ref={canvasRef}
          width={800}
          height={220}
          className="h-44 w-full object-cover sm:h-52"
        />

        {/* Frequency scale on left axis */}
        <div className="pointer-events-none absolute inset-y-0 left-2 flex flex-col justify-between py-2 text-[10px] font-mono text-[#89a893] opacity-80">
          <span>{maxFreqKhz} kHz</span>
          <span>{Math.round((maxFreqKhz * 3) / 4)} kHz</span>
          <span>{Math.round(maxFreqKhz / 2)} kHz</span>
          <span>{Math.round(maxFreqKhz / 4)} kHz</span>
          <span>0 kHz</span>
        </div>

        {/* Vocalization Detection Segment Highlight Badges */}
        {timelineSegments.map((seg, idx) => {
          if (duration <= 0) return null;
          const leftPercent = (seg.start / duration) * 100;
          const widthPercent = ((seg.end - seg.start) / duration) * 100;
          const isHighlighted = highlightedSpecies && seg.top_species.toLowerCase().includes(highlightedSpecies.toLowerCase());

          return (
            <div
              key={idx}
              style={{
                left: `${leftPercent}%`,
                width: `${widthPercent}%`,
              }}
              className={`pointer-events-none absolute inset-y-0 border-x transition-colors ${
                isHighlighted
                  ? 'border-[#10b981] bg-[#10b981]/15'
                  : 'border-[#10b981]/40 bg-[#10b981]/5 hover:bg-[#10b981]/10'
              }`}
            >
              <div className="absolute top-1 left-1.5 flex items-center gap-1 rounded bg-black/60 px-1 py-0.5 text-[9px] font-mono text-[#a7f3d0]">
                <Sparkles className="h-2.5 w-2.5 text-[#10b981]" />
                <span className="truncate max-w-[80px]">{seg.top_species}</span>
                <span className="text-[#34d399] font-semibold">
                  {(seg.confidence * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          );
        })}

        {/* Synchronized Playhead Needle */}
        <div
          className="pointer-events-none absolute inset-y-0 w-0.5 bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)] transition-all duration-75"
          style={{ left: `${progressRatio * 100}%` }}
        >
          <div className="absolute -top-1 -left-1 h-2.5 w-2.5 rounded-full bg-red-500 shadow" />
        </div>

        {/* Hover scrub hint */}
        <div className="pointer-events-none absolute bottom-1.5 right-2 rounded bg-black/60 px-1.5 py-0.5 text-[9px] font-mono text-[#6c8e77]">
          Click anywhere to seek
        </div>
      </div>

      {/* Time marks ruler below canvas */}
      <div className="mt-1 flex justify-between px-1 text-[10px] font-mono text-[#617e6b]">
        <span>00:00.0</span>
        <span>{formatTime(duration * 0.25)}</span>
        <span>{formatTime(duration * 0.5)}</span>
        <span>{formatTime(duration * 0.75)}</span>
        <span>{formatTime(duration)}</span>
      </div>

      {/* Audio Playback Controls Bar */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#192b1e] bg-[#0f1912] p-2.5">
        <div className="flex items-center gap-2">
          <button
            onClick={togglePlay}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#10b981] text-black hover:bg-[#34d399] transition-colors shadow-sm"
            aria-label={isPlaying ? 'Pause audio' : 'Play audio'}
          >
            {isPlaying ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current ml-0.5" />}
          </button>

          <button
            onClick={restartAudio}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#23442e] bg-[#142318] text-[#8ca393] hover:text-[#f1f7f2] hover:bg-[#1b3122] transition-colors"
            aria-label="Restart audio from beginning"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>

          {/* Time tracker */}
          <div className="text-xs font-mono text-[#a3bda9] ml-1">
            <span className="text-[#f1f7f2] font-semibold">{formatTime(currentTime)}</span>
            <span className="text-[#597864] mx-1">/</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Legend */}
        <div className="hidden sm:flex items-center gap-3 text-xs text-[#708c79]">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#10b981]" />
            <span className="text-[11px]">Identified Call Segments</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-red-500" />
            <span className="text-[11px]">Audio Playhead</span>
          </div>
        </div>
      </div>

      {/* Hidden audio element */}
      {internalAudioUrl && (
        <audio
          ref={audioRef}
          src={internalAudioUrl}
          onLoadedMetadata={handleLoadedMetadata}
          onTimeUpdate={handleTimeUpdate}
          onEnded={() => setIsPlaying(false)}
          className="hidden"
        />
      )}
    </div>
  );
};
