import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { SampleRecording } from '../types/birdnet';

const BIRD_ART: Record<string, { body: string; breast: string; head: string; wing: string; tail: string; crest?: boolean; mask?: boolean; eye?: string }> = {
  robin: { body: '#8a6d4a', breast: '#e0703a', head: '#8a6d4a', wing: '#6b543a', tail: '#54432e' },
  cardinal: { body: '#c62f2f', breast: '#e04a4a', head: '#c62f2f', wing: '#a32424', tail: '#7f1d1d', crest: true, mask: true },
  koel: { body: '#232a33', breast: '#39424e', head: '#1a212b', wing: '#141a22', tail: '#0b0f14', eye: '#ef4444' },
};

const DEFAULT_ART = { body: '#5b6b5f', breast: '#7d8f83', head: '#5b6b5f', wing: '#49564c', tail: '#37413a' };

function BirdArt({ id }: { id: string }) {
  const c = BIRD_ART[id] || DEFAULT_ART;
  return (
    <svg viewBox="0 0 220 200" className="h-44 w-44 sm:h-52 sm:w-52 drop-shadow-2xl" role="img" aria-label="bird illustration">
      <line x1="28" y1="182" x2="192" y2="182" stroke="#3d2f1e" strokeWidth="5" strokeLinecap="round" />
      <path d="M62 128 L18 162 L36 168 L72 142 Z" fill={c.tail} />
      <ellipse cx="108" cy="118" rx="56" ry="42" fill={c.body} />
      <ellipse cx="134" cy="128" rx="30" ry="27" fill={c.breast} />
      <path d="M84 104 Q120 94 142 124 Q114 142 88 134 Z" fill={c.wing} />
      {c.crest && <path d="M136 50 L148 20 L160 48 Z" fill={c.body} />}
      <circle cx="150" cy="70" r="26" fill={c.head} />
      {c.mask && <path d="M138 58 Q152 52 168 62 L166 74 Q150 70 140 68 Z" fill="#111" opacity="0.85" />}
      <path d="M172 64 L198 71 L172 78 Z" fill="#f59e0b" />
      <circle cx="158" cy="64" r="4.2" fill={c.eye || '#0a0f0c'} />
      {!c.eye && <circle cx="159.5" cy="62.5" r="1.3" fill="#fff" />}
      <line x1="104" y1="156" x2="104" y2="180" stroke="#8a6d3b" strokeWidth="3" strokeLinecap="round" />
      <line x1="126" y1="156" x2="126" y2="180" stroke="#8a6d3b" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

interface BirdCarouselProps {
  samples: SampleRecording[];
  onSelectSample: (sample: SampleRecording) => void;
  disabled?: boolean;
}

export const BirdCarousel: React.FC<BirdCarouselProps> = ({ samples, onSelectSample, disabled }) => {
  const [index, setIndex] = useState(0);
  const count = samples.length;
  const current = samples[index];

  const go = (dir: number) => setIndex((i) => (i + dir + count) % count);

  if (!current) return null;

  return (
    <div className="flex flex-col items-center space-y-3">
      <div className="relative flex w-full items-center justify-center">
        <button
          onClick={() => go(-1)}
          disabled={disabled}
          aria-label="Previous bird"
          className="absolute left-0 sm:-left-4 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-[#23442e] bg-[#0f1912]/90 text-[#9db7a4] hover:text-[#10b981] hover:border-[#10b981]/60 transition-colors disabled:opacity-40"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        <button
          onClick={() => onSelectSample(current)}
          disabled={disabled}
          className="group flex flex-col items-center gap-1 rounded-2xl p-2 transition-transform hover:scale-[1.03] active:scale-95 disabled:opacity-50"
          aria-label={`Analyze ${current.common_name} sample`}
        >
          <div key={current.id} className="bird-slide">
            <BirdArt id={current.id} />
          </div>
          <div className="text-center">
            <div className="text-sm font-semibold text-[#f1f7f2] group-hover:text-[#10b981] transition-colors">
              {current.common_name}
            </div>
            <div className="text-[10px] font-mono italic text-[#708c79]">{current.species}</div>
          </div>
        </button>

        <button
          onClick={() => go(1)}
          disabled={disabled}
          aria-label="Next bird"
          className="absolute right-0 sm:-right-4 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-[#23442e] bg-[#0f1912]/90 text-[#9db7a4] hover:text-[#10b981] hover:border-[#10b981]/60 transition-colors disabled:opacity-40"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      <div className="flex items-center gap-1.5">
        {samples.map((s, i) => (
          <button
            key={s.id}
            onClick={() => setIndex(i)}
            disabled={disabled}
            aria-label={`Go to ${s.common_name}`}
            className={`h-1.5 rounded-full transition-all ${
              i === index ? 'w-5 bg-[#10b981]' : 'w-1.5 bg-[#2a4032] hover:bg-[#3d5c49]'
            }`}
          />
        ))}
      </div>
    </div>
  );
};
