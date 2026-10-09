import React from 'react';
import { History, Sparkles, HelpCircle, Radio } from 'lucide-react';

interface HeaderProps {
  onOpenHistory: () => void;
  onOpenSamples: () => void;
  onOpenAbout: () => void;
  historyCount: number;
  isAnalyzing: boolean;
  onReset: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenHistory,
  onOpenSamples,
  onOpenAbout,
  historyCount,
  isAnalyzing,
  onReset,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-[#1c2e22] bg-[#0b100d]/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-3 py-2.5 sm:px-6 sm:py-3.5">
        {/* Brand */}
        <button
          onClick={onReset}
          className="group flex items-center gap-2.5 sm:gap-3 text-left transition-opacity hover:opacity-90 focus:outline-none"
          aria-label="BirdVoice AI - Home"
        >
          <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-[#16271c] border border-[#23442e] text-[#10b981] group-hover:border-[#10b981]/60 transition-colors shadow">
            <Radio className="h-5 w-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="text-sm sm:text-base font-bold tracking-tight text-[#f1f7f2]">
                BirdVoice AI
              </span>
              <span className="rounded bg-[#122419] border border-[#23442e] px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider text-[#10b981]">
                BirdNET v2.4
              </span>
            </div>
            <p className="hidden xs:block text-[11px] sm:text-xs text-[#708c79]">
              Bioacoustic avian vocalization identification
            </p>
          </div>
        </button>

        {/* Status & Navigation Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2.5">
          {/* Status Indicator (Desktop only) */}
          <div className="hidden lg:flex items-center gap-2 text-xs font-mono text-[#8ca393] pr-3 border-r border-[#1c2e22]">
            <span className="h-2 w-2 rounded-full bg-[#10b981] animate-pulse" />
            <span>6,521 species catalog</span>
            <span aria-hidden="true">·</span>
            <span>Local Neural STFT</span>
          </div>

          {/* Sample library action */}
          <button
            onClick={onOpenSamples}
            disabled={isAnalyzing}
            className="flex items-center gap-1.5 rounded-lg border border-[#23442e] bg-[#122017] px-2.5 py-1.5 sm:px-3 text-xs font-semibold text-[#d3e5d7] hover:bg-[#1a2e21] hover:text-[#f1f7f2] transition-colors disabled:opacity-40 min-h-[36px]"
            aria-label="Open audio samples library"
          >
            <Sparkles className="h-3.5 w-3.5 text-[#10b981]" />
            <span className="hidden sm:inline">Try Audio</span>
            <span>Samples</span>
          </button>

          {/* History action */}
          <button
            onClick={onOpenHistory}
            className="flex items-center gap-1.5 rounded-lg border border-[#23442e] bg-[#122017] px-2.5 py-1.5 sm:px-3 text-xs font-semibold text-[#d3e5d7] hover:bg-[#1a2e21] hover:text-[#f1f7f2] transition-colors min-h-[36px]"
            aria-label={`Open observation history, ${historyCount} observations recorded`}
          >
            <History className="h-3.5 w-3.5 text-[#8ca393]" />
            <span className="hidden xs:inline">History</span>
            {historyCount > 0 && (
              <span className="rounded-full bg-[#16271c] px-1.5 py-0.2 font-mono text-[10px] text-[#10b981] border border-[#23442e]">
                {historyCount}
              </span>
            )}
          </button>

          {/* About / Specs action */}
          <button
            onClick={onOpenAbout}
            aria-label="Model specifications and documentation"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#23442e] bg-[#122017] text-[#8ca393] hover:text-[#f1f7f2] hover:bg-[#1a2e21] transition-colors"
          >
            <HelpCircle className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
