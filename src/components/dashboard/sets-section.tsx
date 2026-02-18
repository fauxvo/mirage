'use client';

import { Layers, Sparkles } from 'lucide-react';

export function SetsSection({ username }: { username: string }) {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-lg font-semibold text-white/90 mb-1">Welcome back, {username}</h1>
        <p className="text-sm text-white/30">Your visualizer sets and configurations.</p>
      </div>

      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-12 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-white/[0.04] border border-white/[0.06] mb-4">
          <Layers className="w-5 h-5 text-white/25" />
        </div>
        <h3 className="text-sm font-medium text-white/60 mb-2">No sets yet</h3>
        <p className="text-xs text-white/25 max-w-xs mx-auto leading-relaxed mb-6">
          Sets let you save, organize, and share your visualizer configurations. This feature is
          coming soon.
        </p>
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.06] text-[10px] font-medium text-white/30 tracking-wide uppercase">
          <Sparkles className="w-3 h-3" />
          Coming Soon
        </div>
      </div>
    </div>
  );
}
