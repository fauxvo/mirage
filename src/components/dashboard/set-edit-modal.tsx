'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { extractPlaylistId } from '@/lib/youtube';
import type { SetListItem } from '@/types/api';

interface SetEditModalProps {
  set: Pick<SetListItem, 'id' | 'name' | 'description' | 'youtubePlaylistUrl' | 'isPublic'>;
  onClose: () => void;
  onSaved: (updated: SetListItem) => void;
}

export function SetEditModal({ set, onClose, onSaved }: SetEditModalProps) {
  const [name, setName] = useState(set.name);
  const [description, setDescription] = useState(set.description || '');
  const [youtubePlaylistUrl, setYoutubePlaylistUrl] = useState(set.youtubePlaylistUrl || '');
  const [isPublic, setIsPublic] = useState(set.isPublic);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose, saving]);

  async function handleSave() {
    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    const trimmedUrl = youtubePlaylistUrl.trim();
    if (trimmedUrl && !extractPlaylistId(trimmedUrl)) {
      setError('Invalid YouTube playlist URL — must contain a list= parameter');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const res = await fetch(`/api/sets/${set.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          youtubePlaylistUrl: youtubePlaylistUrl.trim() || null,
          isPublic,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        setError(data.error || 'Failed to save');
        return;
      }

      onSaved(data.data);
    } catch {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
      <div className="w-full max-w-md bg-neutral-950 border border-white/[0.08] rounded-xl p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white/90">Edit Set</h3>
          <button
            onClick={onClose}
            disabled={saving}
            className="p-1 rounded text-white/20 hover:text-white/50 transition-colors disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Error */}
        {error && (
          <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {/* Fields */}
        <div className="space-y-3">
          <div>
            <label
              htmlFor="edit-set-name"
              className="block text-[10px] font-medium text-white/30 uppercase tracking-wide mb-1.5"
            >
              Name
            </label>
            <input
              id="edit-set-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={saving}
              className="w-full px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-white/80 placeholder:text-white/20 focus:outline-none focus:border-white/20 disabled:opacity-50 transition-colors"
              placeholder="Set name"
            />
          </div>

          <div>
            <label
              htmlFor="edit-set-description"
              className="block text-[10px] font-medium text-white/30 uppercase tracking-wide mb-1.5"
            >
              Description
            </label>
            <textarea
              id="edit-set-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={saving}
              rows={2}
              className="w-full px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-white/80 placeholder:text-white/20 focus:outline-none focus:border-white/20 disabled:opacity-50 transition-colors resize-none"
              placeholder="Optional description"
            />
          </div>

          <div>
            <label
              htmlFor="edit-set-youtube-url"
              className="block text-[10px] font-medium text-white/30 uppercase tracking-wide mb-1.5"
            >
              YouTube Playlist URL
            </label>
            <input
              id="edit-set-youtube-url"
              type="url"
              value={youtubePlaylistUrl}
              onChange={(e) => setYoutubePlaylistUrl(e.target.value)}
              disabled={saving}
              className="w-full px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-white/80 placeholder:text-white/20 focus:outline-none focus:border-white/20 disabled:opacity-50 transition-colors"
              placeholder="https://www.youtube.com/playlist?list=..."
            />
          </div>

          <div className="flex items-center justify-between py-1">
            <label className="text-xs text-white/50">Public</label>
            <button
              type="button"
              onClick={() => setIsPublic(!isPublic)}
              disabled={saving}
              className={cn(
                'relative w-9 h-5 rounded-full transition-colors disabled:opacity-50',
                isPublic ? 'bg-white/30' : 'bg-white/10'
              )}
            >
              <span
                className={cn(
                  'absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform',
                  isPublic ? 'translate-x-4' : 'translate-x-0'
                )}
              />
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2 bg-white text-black text-xs font-medium rounded-lg hover:bg-white/90 disabled:opacity-50 transition-all"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 py-2 text-xs text-white/40 hover:text-white/60 rounded-lg hover:bg-white/[0.04] transition-all"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
