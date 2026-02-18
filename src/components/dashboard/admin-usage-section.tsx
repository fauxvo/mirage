'use client';

import { BarChart3, Sparkles } from 'lucide-react';

export function AdminUsageSection() {
  return (
    <div>
      <div className="mb-8">
        <div className="flex items-center gap-2.5 mb-1">
          <BarChart3 className="w-4 h-4 text-white/30" />
          <h1 className="text-lg font-semibold text-white/90">Usage</h1>
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400/50 tracking-wide uppercase">
            Admin
          </span>
        </div>
        <p className="text-sm text-white/30">API key usage statistics and analytics.</p>
      </div>

      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-12 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-white/[0.04] border border-white/[0.06] mb-4">
          <BarChart3 className="w-5 h-5 text-white/25" />
        </div>
        <h3 className="text-sm font-medium text-white/60 mb-2">Usage analytics</h3>
        <p className="text-xs text-white/25 max-w-xs mx-auto leading-relaxed mb-6">
          Track API key usage, request counts, and session activity. This feature is coming soon.
        </p>
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.06] text-[10px] font-medium text-white/30 tracking-wide uppercase">
          <Sparkles className="w-3 h-3" />
          Coming Soon
        </div>
      </div>
    </div>
  );
}
