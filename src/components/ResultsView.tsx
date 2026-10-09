import React, { useState, useEffect, useRef } from 'react';
import { 
  RotateCcw, 
  Volume2, 
  CheckCircle2, 
  BookOpen, 
  Sparkles, 
  Layers, 
  ChevronDown, 
  ChevronUp,
  Play,
  Pause,
  Bookmark,
  Check,
  AlertTriangle,
  Sliders,
  ShieldCheck,
  Mic
} from 'lucide-react';
import { AnalysisResponse, SpeciesPrediction, TimelineSegment } from '../types/birdnet';
import { SpectrogramViewer } from './SpectrogramViewer';
import { formatTime } from '../utils/audio';

interface ResultsViewProps {
  analysis: AnalysisResponse;
  audioBlob: Blob | null;
  audioUrl?: string;
  onReset: () => void;
  fileName?: string;
  onSaveObservation?: () => void;
  isSaved?: boolean;
}

export const ResultsView: React.FC<ResultsViewProps> = ({
  analysis,
  audioBlob,
  audioUrl,
  onReset,
  fileName,
  onSaveObservation,
  isSaved: initialIsSaved = false,
}) => {
  const top = analysis.top_prediction;
  const secondaryPredictions = analysis.predictions.slice(1);
  const [selectedSpecies, setSelectedSpecies] = useState<SpeciesPrediction | null>(top);
  const [showAllSecondary, setShowAllSecondary] = useState(false);
  const [isSaved, setIsSaved] = useState(initialIsSaved);

  // Audio playback state for "Listen to recording"
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(analysis.duration || 4.0);
  const [playbackUrl, setPlaybackUrl] = useState<string>('');

  useEffect(() => {
    if (audioBlob) {
      const url = URL.createObjectURL(audioBlob);
      setPlaybackUrl(url);
      return () => URL.revokeObjectURL(url);
    } else if (audioUrl) {
      setPlaybackUrl(audioUrl);
    }
  }, [audioBlob, audioUrl]);

  const togglePlayAudio = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play()
        .then(() => setIsPlaying(true))
        .catch((e) => console.log('Audio playback notice:', e));
    }
  };

  const handleAudioTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || duration <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const target = ratio * duration;
    audioRef.current.currentTime = target;
    setCurrentTime(target);
  };

  const handleSave = () => {
    setIsSaved(true);
    onSaveObservation?.();
  };

  // Confidence styling
  const getConfidenceBadgeColor = (conf: number) => {
    if (conf >= 0.70) return 'text-[#10b981]';
    if (conf >= 0.35) return 'text-amber-400';
    return 'text-[#8ca393]';
  };

  const activeSpecies = selectedSpecies || top;
  const top3Predictions = analysis.predictions.slice(0, 3);
  const quality = analysis.audio_quality;

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-6 sm:py-10">
      {/* Hidden audio element for recording playback */}
      {playbackUrl && (
        <audio
          ref={audioRef}
          src={playbackUrl}
          onTimeUpdate={handleAudioTimeUpdate}
          onEnded={handleAudioEnded}
          onLoadedMetadata={() => {
            if (audioRef.current && audioRef.current.duration > 0) {
              setDuration(audioRef.current.duration);
            }
          }}
        />
      )}

      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#1c2e22] pb-4">
        <div className="flex items-center gap-2.5">
          <button
            onClick={onReset}
            className="flex items-center gap-2 rounded-xl bg-[#10b981] px-4 py-2 text-xs font-semibold text-black shadow hover:bg-[#34d399] transition-all hover:scale-105 active:scale-95"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Try Again (Record 6s)</span>
          </button>

          {onSaveObservation && (
            <button
              onClick={handleSave}
              disabled={isSaved}
              className={`flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-medium transition-colors ${
                isSaved
                  ? 'border-[#10b981]/50 bg-[#10b981]/15 text-[#10b981]'
                  : 'border-[#23442e] bg-[#122017] text-[#d3e5d7] hover:bg-[#1a2e21] hover:text-[#f1f7f2]'
              }`}
            >
              {isSaved ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  <span>Observation Saved</span>
                </>
              ) : (
                <>
                  <Bookmark className="h-3.5 w-3.5 text-[#10b981]" />
                  <span>Save Observation</span>
                </>
              )}
            </button>
          )}
        </div>

        <div className="flex items-center gap-3 text-xs font-mono text-[#769380]">
          {fileName && <span className="truncate max-w-[140px] sm:max-w-none">{fileName}</span>}
          {fileName && <span aria-hidden="true">·</span>}
          <span>{analysis.duration.toFixed(1)}s recorded</span>
          <span aria-hidden="true">·</span>
          <span>Inference: {analysis.processing_time}s</span>
        </div>
      </div>

      {/* Audio Quality Alert / Diagnostics Banner */}
      {quality && quality.warnings && quality.warnings.length > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-900/50 bg-amber-950/40 p-4 text-xs text-amber-200">
          <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-amber-300">Audio Quality Notice</p>
            {quality.warnings.map((warn, i) => (
              <p key={i} className="text-amber-200/90 leading-relaxed">{warn}</p>
            ))}
          </div>
        </div>
      )}

      {/* Audio Preprocessing & Diagnostics Summary Bar */}
      {quality && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#1b3122] bg-[#0c1610] px-4 py-2.5 text-[11px] font-mono text-[#769380]">
          <div className="flex items-center gap-2 text-[#9db7a4]">
            <ShieldCheck className="h-4 w-4 text-[#10b981]" />
            <span className="font-semibold text-[#d3e5d7]">Signal Preprocessing:</span>
            <span>{quality.filter_applied ? '500 Hz High-Pass Filter Active (Wind/Rumble Suppressed)' : 'Standard pass'}</span>
          </div>
          <div className="flex items-center gap-3">
            <span>RMS: {quality.rms}</span>
            <span>Peak: {quality.peak}</span>
            {quality.snr_db != null && <span>SNR: {quality.snr_db} dB</span>}
          </div>
        </div>
      )}

      {/* "Listen to Recording" dedicated audio player control */}
      {playbackUrl && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-[#23442e] bg-[#0e1711] p-4">
          <div className="flex items-center gap-3">
            <button
              onClick={togglePlayAudio}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#10b981] text-black shadow-lg hover:bg-[#34d399] transition-transform active:scale-95"
              aria-label={isPlaying ? 'Pause recording' : 'Listen to recording'}
            >
              {isPlaying ? (
                <Pause className="h-5 w-5 fill-black" />
              ) : (
                <Play className="h-5 w-5 fill-black ml-0.5" />
              )}
            </button>
            <div>
              <div className="text-xs font-semibold text-[#f1f7f2] flex items-center gap-2">
                <Volume2 className="h-4 w-4 text-[#10b981]" />
                <span>Listen to Recording</span>
              </div>
              <div className="text-[11px] font-mono text-[#769380]">
                {formatTime(currentTime)} / {formatTime(duration)}
              </div>
            </div>
          </div>

          {/* Interactive audio progress scrubber */}
          <div
            onClick={handleSeek}
            className="flex-1 max-w-md h-3 bg-[#15271b] rounded-full overflow-hidden cursor-pointer relative group"
            role="slider"
            aria-valuenow={currentTime}
            aria-valuemax={duration}
            aria-label="Audio scrubber"
          >
            <div
              className="h-full bg-gradient-to-r from-emerald-600 to-[#10b981] rounded-full transition-all duration-100"
              style={{ width: `${Math.min(100, (currentTime / Math.max(0.1, duration)) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* No Species Detected State */}
      {!top && (
        <div className="rounded-2xl border border-[#23442e] bg-[#0c140f] p-8 text-center space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-[#14261b] border border-[#23442e] text-[#8ca393]">
            <Volume2 className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-[#f1f7f2]">
              No Distinct Bird Species Identified
            </h3>
            <p className="text-xs text-[#769380] max-w-md mx-auto">
              BirdNET did not detect clear avian vocalizations above the confidence threshold. Ambient wind, background speech, or distance may have masked subtle calls.
            </p>
          </div>
          <div className="pt-2 flex justify-center gap-3">
            <button
              onClick={onReset}
              className="flex items-center gap-2 rounded-xl bg-[#10b981] px-5 py-2.5 text-xs font-semibold text-black hover:bg-[#34d399] transition-colors shadow"
            >
              <Mic className="h-3.5 w-3.5" />
              <span>Record Another 6s Call</span>
            </button>
          </div>
        </div>
      )}

      {/* Primary Detection Hero Card */}
      {top && (
        <div className="relative overflow-hidden rounded-2xl border border-[#23442e] bg-[#0c1510] p-6 sm:p-8 shadow-2xl">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-mono text-[#10b981]">
                <CheckCircle2 className="h-4 w-4" />
                <span className="font-semibold tracking-wider uppercase">Most Likely Species</span>
                {top.regional_match && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-[#a7f3d0]">Regional Match</span>
                  </>
                )}
              </div>

              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-[#f1f7f2]">
                {top.common_name}
              </h2>
              <p className="text-base font-serif italic text-[#8ca393]">
                {top.scientific_name}
              </p>
            </div>

            {/* Confidence Score Pill/Block */}
            <div className="shrink-0 rounded-xl border border-[#23442e] bg-[#122217] p-4 text-center sm:text-right min-w-[140px]">
              <div className="text-[11px] font-mono uppercase tracking-wider text-[#769380]">
                Identification Confidence
              </div>
              <div className={`text-3xl font-extrabold tracking-tight ${getConfidenceBadgeColor(top.confidence)}`}>
                {(top.confidence * 100).toFixed(1)}%
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#1b3323]">
                <div
                  className="h-full rounded-full bg-[#10b981]"
                  style={{ width: `${Math.min(100, top.confidence * 100)}%` }}
                />
              </div>
              <div className="mt-1 text-[10px] font-mono text-[#5d7764]">
                Detected across {top.occurrences} audio {top.occurrences === 1 ? 'window' : 'windows'}
              </div>
            </div>
          </div>

          {/* Top 3 Model Predictions Summary Card */}
          {top3Predictions.length > 0 && (
            <div className="mt-6 pt-6 border-t border-[#1c2e22]">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#9db7a4] mb-3">
                <Sparkles className="h-3.5 w-3.5 text-[#10b981]" />
                <span>Top Model Predictions</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {top3Predictions.map((pred, idx) => (
                  <div
                    key={pred.scientific_name}
                    className={`rounded-xl border p-3 text-xs transition-all ${
                      idx === 0
                        ? 'border-[#10b981]/50 bg-[#122418] shadow-md'
                        : 'border-[#1f3826] bg-[#0e1811]'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px] font-mono mb-1">
                      <span className="text-[#769380]">#{idx + 1} Prediction</span>
                      <span className={`font-bold ${getConfidenceBadgeColor(pred.confidence)}`}>
                        {(pred.confidence * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="font-semibold text-[#f1f7f2] truncate">
                      {pred.common_name}
                    </div>
                    <div className="text-[10px] font-serif italic text-[#708c79] truncate mb-2">
                      {pred.scientific_name}
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-[#1b3323] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#10b981]"
                        style={{ width: `${Math.min(100, pred.confidence * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Species Profile Grid (Habitat, Vocalization, Range) */}
          {top.info && (
            <div className="mt-6 pt-6 border-t border-[#1c2e22] grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-[#d3e5d7]">
              {/* Description & Biology */}
              <div className="space-y-3">
                <h4 className="font-semibold text-[#a7f3d0] flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                  <BookOpen className="h-3.5 w-3.5 text-[#10b981]" />
                  <span>Description & Biology</span>
                </h4>
                <p className="text-[#9db7a4] leading-relaxed">
                  {top.info.description}
                </p>
                
                <div className="space-y-1.5 pt-2">
                  <div className="flex items-baseline gap-2">
                    <span className="font-medium text-[#769380]">Taxonomy:</span>
                    <span className="text-[#f1f7f2]">{top.info.family}</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="font-medium text-[#769380]">Conservation:</span>
                    <span className="text-[#a7f3d0]">{top.info.iucn_status}</span>
                  </div>
                  {top.info.wingspan && (
                    <div className="flex items-baseline gap-2">
                      <span className="font-medium text-[#769380]">Wingspan:</span>
                      <span className="text-[#f1f7f2]">{top.info.wingspan}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Vocalization & Habitat */}
              <div className="space-y-3">
                <h4 className="font-semibold text-[#a7f3d0] flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                  <Volume2 className="h-3.5 w-3.5 text-[#10b981]" />
                  <span>Vocalization Profile</span>
                </h4>
                {top.info.vocalizations && (
                  <div className="rounded-lg border border-[#1a2e20] bg-[#0e1911] p-3 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-[#769380]">Vocal Pattern:</span>
                      <span className="font-medium text-[#f1f7f2]">{top.info.vocalizations.type}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-[#769380]">Frequency Band:</span>
                      <span className="font-mono text-[#10b981]">{top.info.vocalizations.frequency_range}</span>
                    </div>
                    <p className="text-[11px] text-[#8ca393] pt-1 leading-normal">
                      {top.info.vocalizations.characteristics}
                    </p>
                  </div>
                )}

                <div className="space-y-1 pt-1">
                  <div className="flex items-baseline gap-2">
                    <span className="font-medium text-[#769380]">Habitat:</span>
                    <span className="text-[#f1f7f2]">{top.info.habitat}</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="font-medium text-[#769380]">Range:</span>
                    <span className="text-[#f1f7f2]">{top.info.geographic_range}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Interesting Fact Footnote */}
          {top.info?.fun_fact && (
            <div className="mt-5 rounded-lg border border-[#1d3524] bg-[#0e1a12] p-3 text-xs text-[#8ca393] flex items-start gap-2">
              <Sparkles className="h-4 w-4 text-[#10b981] shrink-0 mt-0.5" />
              <span>
                <strong className="text-[#a7f3d0] font-medium">Ornithological Note: </strong>
                {top.info.fun_fact}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Bioacoustic Spectrogram & Audio Playback */}
      <div className="space-y-2">
        <SpectrogramViewer
          spectrogram={analysis.spectrogram}
          timelineSegments={analysis.timeline}
          audioBlob={audioBlob}
          audioUrl={audioUrl}
          highlightedSpecies={activeSpecies?.common_name}
        />
      </div>

      {/* Soundscape Timeline & Chronological Segments */}
      {analysis.timeline.length > 0 && (
        <div className="rounded-xl border border-[#1f3826] bg-[#0c140f] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#9db7a4]">
              <Layers className="h-4 w-4 text-[#10b981]" />
              <span>Soundscape Vocalization Timeline</span>
            </div>
            <div className="text-xs font-mono text-[#769380]">
              {analysis.timeline.length} call intervals identified
            </div>
          </div>

          <div className="space-y-2">
            {analysis.timeline.map((item: TimelineSegment, idx: number) => (
              <div
                key={idx}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border border-[#192b1e] bg-[#0e1811] p-3 text-xs transition-colors hover:border-[#10b981]/50"
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[#10b981] font-semibold bg-[#122317] border border-[#23442e] px-2 py-0.5 rounded">
                    {formatTime(item.start)} - {formatTime(item.end)}
                  </span>
                  <div>
                    <span className="font-semibold text-[#f1f7f2]">{item.top_species}</span>
                    <span className="font-serif italic text-[#708c79] ml-2 text-[11px]">
                      {item.scientific_name}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 font-mono text-[11px]">
                    <span className="text-[#769380]">Confidence:</span>
                    <span className={`font-semibold ${getConfidenceBadgeColor(item.confidence)}`}>
                      {(item.confidence * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Secondary Candidate Species */}
      {secondaryPredictions.length > 0 && (
        <div className="rounded-xl border border-[#1f3826] bg-[#0c140f] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#9db7a4]">
              <Sparkles className="h-4 w-4 text-[#10b981]" />
              <span>Other Species Detected in Soundscape</span>
            </div>
            <span className="text-xs font-mono text-[#769380]">
              {secondaryPredictions.length} candidates
            </span>
          </div>

          <div className="space-y-2">
            {(showAllSecondary ? secondaryPredictions : secondaryPredictions.slice(0, 3)).map((pred: SpeciesPrediction, i: number) => (
              <div
                key={i}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-[#192b1e] bg-[#0e1811] p-3 text-xs"
              >
                <div>
                  <div className="font-semibold text-[#f1f7f2]">{pred.common_name}</div>
                  <div className="text-[11px] font-serif italic text-[#708c79]">
                    {pred.scientific_name}
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="w-28 sm:w-36 space-y-1">
                    <div className="flex justify-between font-mono text-[10px] text-[#769380]">
                      <span>Likelihood</span>
                      <span className={getConfidenceBadgeColor(pred.confidence)}>
                        {(pred.confidence * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-[#1b3323] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#10b981]"
                        style={{ width: `${Math.min(100, pred.confidence * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {secondaryPredictions.length > 3 && (
            <button
              onClick={() => setShowAllSecondary(!showAllSecondary)}
              className="flex items-center gap-1.5 text-xs font-medium text-[#10b981] hover:underline"
            >
              {showAllSecondary ? (
                <>
                  <ChevronUp className="h-3.5 w-3.5" />
                  <span>Show fewer species</span>
                </>
              ) : (
                <>
                  <ChevronDown className="h-3.5 w-3.5" />
                  <span>Show all {secondaryPredictions.length} species candidates</span>
                </>
              )}
            </button>
          )}
        </div>
      )}

      {/* Soundscape Diversity Card */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-xl border border-[#23442e] bg-[#0f1a13] p-4 text-xs">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#16271c] border border-[#23442e] text-[#10b981]">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <div className="font-semibold text-[#f1f7f2]">Soundscape Diversity Rating</div>
            <p className="text-[#769380] text-[11px]">
              Bioacoustic richness index based on vocal frequency spread & distinct species count
            </p>
          </div>
        </div>

        <div className="text-right">
          <span className="text-xl font-bold font-mono text-[#10b981]">
            {analysis.soundscape_diversity_score}/100
          </span>
          <span className="text-[10px] font-mono text-[#769380] block">Richness Score</span>
        </div>
      </div>

      {/* Bottom Sticky Action Button */}
      <div className="pt-4 flex justify-center">
        <button
          onClick={onReset}
          className="flex items-center gap-2 rounded-xl bg-[#10b981] px-8 py-3 text-sm font-semibold text-black shadow-lg hover:bg-[#34d399] transition-all hover:scale-105 active:scale-95"
        >
          <RotateCcw className="h-4 w-4" />
          <span>Listen to Another Bird</span>
        </button>
      </div>
    </div>
  );
};
