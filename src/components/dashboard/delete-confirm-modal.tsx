'use client';

import { X, AlertTriangle } from 'lucide-react';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  loading: boolean;
}

export function DeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  loading,
}: DeleteConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
      <div className="w-full max-w-sm bg-neutral-950 border border-white/[0.08] rounded-xl p-6 space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-full bg-red-500/10 border border-red-500/20">
              <AlertTriangle className="w-4 h-4 text-red-400" />
            </div>
            <h3 className="text-sm font-semibold text-white/90">{title}</h3>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-1 rounded text-white/20 hover:text-white/50 transition-colors disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-white/40 leading-relaxed">{message}</p>

        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 py-2 bg-red-500/15 text-red-400 text-xs font-medium rounded-lg hover:bg-red-500/25 border border-red-500/20 disabled:opacity-50 transition-all"
          >
            {loading ? 'Deleting...' : 'Delete'}
          </button>
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-2 text-xs text-white/40 hover:text-white/60 rounded-lg hover:bg-white/[0.04] transition-all"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
