'use client';

import { useState } from 'react';
import { Copy, Check, X } from 'lucide-react';

export function KeyRevealModal({ rawKey, onClose }: { rawKey: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(rawKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
      <div className="w-full max-w-md bg-neutral-950 border border-white/[0.08] rounded-xl p-6 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white/90">API Key Created</h3>
            <p className="text-xs text-amber-400/70 mt-1">
              This key will only be shown once. Copy it now.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-white/20 hover:text-white/50 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-2 p-3 bg-white/[0.03] border border-white/[0.06] rounded-lg">
          <code className="flex-1 text-xs text-white/70 font-mono break-all select-all">
            {rawKey}
          </code>
          <button
            onClick={handleCopy}
            className="shrink-0 p-1.5 rounded text-white/30 hover:text-white/60 hover:bg-white/[0.06] transition-colors"
            title="Copy to clipboard"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>

        <button
          onClick={onClose}
          className="w-full py-2 bg-white/[0.06] text-white/60 text-xs font-medium rounded-lg hover:bg-white/[0.1] transition-all"
        >
          Done
        </button>
      </div>
    </div>
  );
}
