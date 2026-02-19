'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Layers, Plus } from 'lucide-react';
import { SetCard } from './set-card';
import { DeleteConfirmModal } from './delete-confirm-modal';
import type { SetListItem } from '@/types/api';

export function SetsSection({ username }: { username: string }) {
  const [sets, setSets] = useState<SetListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<SetListItem | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    async function fetchSets() {
      try {
        const res = await fetch('/api/sets');
        const data = await res.json();
        if (!data.success) {
          setError(data.error || 'Failed to load sets');
          return;
        }
        setSets(data.data);
      } catch {
        setError('Failed to load sets');
      } finally {
        setLoading(false);
      }
    }

    fetchSets();
  }, []);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteLoading(true);

    try {
      const res = await fetch(`/api/sets/${deleteTarget.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || 'Failed to delete set');
        return;
      }
      setSets((prev) => prev.filter((s) => s.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch {
      setError('Network error');
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-lg font-semibold text-white/90 mb-1">Welcome back, {username}</h1>
          <p className="text-sm text-white/30">Your visualizer sets and configurations.</p>
        </div>
        <Link
          href="/dashboard/sets/new"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white text-black text-xs font-medium rounded-lg hover:bg-white/90 transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          New Set
        </Link>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400 flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={() => setError('')}
            className="text-red-400/60 hover:text-red-400 transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-lg border border-white/[0.06] p-4 animate-pulse">
              <div className="h-4 w-40 bg-white/[0.04] rounded mb-2" />
              <div className="h-3 w-64 bg-white/[0.03] rounded" />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && sets.length === 0 && (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-12 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-white/[0.04] border border-white/[0.06] mb-4">
            <Layers className="w-5 h-5 text-white/25" />
          </div>
          <h3 className="text-sm font-medium text-white/60 mb-2">No sets yet</h3>
          <p className="text-xs text-white/25 max-w-xs mx-auto leading-relaxed mb-6">
            Sets let you save, organize, and share your visualizer configurations. Create your first
            set to get started.
          </p>
          <Link
            href="/dashboard/sets/new"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-white text-black text-xs font-medium rounded-lg hover:bg-white/90 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            Create Your First Set
          </Link>
        </div>
      )}

      {/* Sets list */}
      {!loading && sets.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {sets.map((set) => (
            <SetCard
              key={set.id}
              set={set}
              onDeleteClick={setDeleteTarget}
              onUpdate={(updated) => {
                setSets((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
              }}
            />
          ))}
        </div>
      )}

      {/* Delete confirmation */}
      <DeleteConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Set"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? All cues in this set will be permanently removed. This cannot be undone.`}
        loading={deleteLoading}
      />
    </div>
  );
}
