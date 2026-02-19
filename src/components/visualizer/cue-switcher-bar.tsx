'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface CueSummary {
  id: string;
  name: string;
  position: number;
}

interface CueSwitcherBarProps {
  visible: boolean;
  cues: CueSummary[];
  activeCueId: string | null;
  onSwitchCue: (cueId: string) => void;
  bottomOffset?: string;
}

export function CueSwitcherBar({
  visible,
  cues,
  activeCueId,
  onSwitchCue,
  bottomOffset = 'bottom-4',
}: CueSwitcherBarProps) {
  const sorted = [...cues].sort((a, b) => a.position - b.position);

  return (
    <div
      className={cn(
        'fixed left-1/2 -translate-x-1/2 z-30',
        bottomOffset,
        'bg-black/60 backdrop-blur-xl rounded-full',
        'border border-white/10',
        'flex items-center gap-1 px-2 py-1.5',
        'max-w-[90vw] overflow-x-auto',
        'transition-opacity duration-300',
        visible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      )}
    >
      <Link
        href="/dashboard"
        className="shrink-0 p-1.5 rounded-full text-white/40 hover:text-white/70 hover:bg-white/10 transition-colors"
        title="Back to Dashboard"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
      </Link>

      <div className="w-px h-4 bg-white/10 shrink-0 mx-0.5" />

      {sorted.map((cue) => (
        <button
          key={cue.id}
          onClick={() => onSwitchCue(cue.id)}
          className={cn(
            'shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-all whitespace-nowrap',
            cue.id === activeCueId
              ? 'bg-white/20 text-white border border-white/30'
              : 'text-white/50 hover:text-white/80 hover:bg-white/10 border border-transparent'
          )}
        >
          {cue.name}
        </button>
      ))}
    </div>
  );
}
