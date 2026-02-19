'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SetSettingsPanelProps {
  setId: string;
  name: string;
  description: string | null;
  youtubePlaylistUrl: string | null;
  isPublic: boolean;
  isOwner: boolean;
  onMetadataChange: (fields: {
    name?: string;
    description?: string | null;
    youtubePlaylistUrl?: string | null;
    isPublic?: boolean;
  }) => void;
}

export function SetSettingsPanel({
  setId,
  name,
  description,
  youtubePlaylistUrl,
  isPublic,
  isOwner,
  onMetadataChange,
}: SetSettingsPanelProps) {
  const [localName, setLocalName] = useState(name);
  const [localDescription, setLocalDescription] = useState(description ?? '');
  const [localYoutubeUrl, setLocalYoutubeUrl] = useState(youtubePlaylistUrl ?? '');
  const [localIsPublic, setLocalIsPublic] = useState(isPublic);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync external changes
  useEffect(() => {
    setLocalName(name);
  }, [name]);
  useEffect(() => {
    setLocalDescription(description ?? '');
  }, [description]);
  useEffect(() => {
    setLocalYoutubeUrl(youtubePlaylistUrl ?? '');
  }, [youtubePlaylistUrl]);
  useEffect(() => {
    setLocalIsPublic(isPublic);
  }, [isPublic]);

  const debouncedSave = useCallback(
    (fields: {
      name?: string;
      description?: string | null;
      youtubePlaylistUrl?: string | null;
      isPublic?: boolean;
    }) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      setSaveError('');
      saveTimerRef.current = setTimeout(async () => {
        try {
          const res = await fetch(`/api/sets/${setId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(fields),
          });
          if (res.ok) {
            onMetadataChange(fields);
            setSaved(true);
            if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
            savedTimerRef.current = setTimeout(() => setSaved(false), 2000);
          } else {
            const data = await res.json().catch(() => null);
            setSaveError(data?.error || 'Failed to save');
          }
        } catch {
          setSaveError('Network error');
        }
      }, 500);
    },
    [setId, onMetadataChange]
  );

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, []);

  const inputClass =
    'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 placeholder:text-white/20 focus:outline-none focus:border-white/25 transition-colors disabled:opacity-50';

  return (
    <div className="space-y-5">
      {/* Name */}
      <div>
        <label className="block text-white/70 text-xs font-medium mb-1.5 uppercase tracking-wider">
          Set Name
        </label>
        <input
          type="text"
          value={localName}
          disabled={!isOwner}
          onChange={(e) => {
            setLocalName(e.target.value);
            debouncedSave({ name: e.target.value });
          }}
          className={inputClass}
          placeholder="My Set"
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-white/70 text-xs font-medium mb-1.5 uppercase tracking-wider">
          Description
        </label>
        <textarea
          value={localDescription}
          disabled={!isOwner}
          onChange={(e) => {
            setLocalDescription(e.target.value);
            debouncedSave({ description: e.target.value || null });
          }}
          rows={3}
          className={cn(inputClass, 'resize-none')}
          placeholder="Optional description..."
        />
      </div>

      {/* YouTube Playlist URL */}
      <div>
        <label className="block text-white/70 text-xs font-medium mb-1.5 uppercase tracking-wider">
          YouTube Playlist URL
        </label>
        <input
          type="url"
          value={localYoutubeUrl}
          disabled={!isOwner}
          onChange={(e) => {
            setLocalYoutubeUrl(e.target.value);
            debouncedSave({ youtubePlaylistUrl: e.target.value || null });
          }}
          className={inputClass}
          placeholder="https://youtube.com/playlist?list=..."
        />
      </div>

      {/* Public toggle */}
      <div className="flex items-center justify-between">
        <div>
          <label className="text-white/70 text-xs font-medium uppercase tracking-wider">
            Public
          </label>
          <p className="text-white/30 text-[10px] mt-0.5">
            {localIsPublic ? 'Visible to everyone' : 'Only accessible via direct link'}
          </p>
        </div>
        <button
          disabled={!isOwner}
          onClick={() => {
            const next = !localIsPublic;
            setLocalIsPublic(next);
            debouncedSave({ isPublic: next });
          }}
          className={cn(
            'w-10 h-5 rounded-full transition-colors relative shrink-0 disabled:opacity-50',
            localIsPublic ? 'bg-white/30' : 'bg-white/10'
          )}
        >
          <span
            className={cn(
              'absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform',
              localIsPublic ? 'translate-x-[20px]' : 'translate-x-0'
            )}
          />
        </button>
      </div>

      {/* Saved indicator */}
      {saved && (
        <div className="flex items-center gap-1.5 text-emerald-400/70 text-xs">
          <Check className="w-3.5 h-3.5" />
          Saved
        </div>
      )}

      {/* Error */}
      {saveError && (
        <div className="p-2 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400">
          {saveError}
        </div>
      )}
    </div>
  );
}
