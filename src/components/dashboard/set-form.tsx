'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Globe, Lock, ExternalLink } from 'lucide-react';

interface SetFormProps {
  mode: 'create' | 'edit';
  setId?: string;
}

export function SetForm({ mode, setId }: SetFormProps) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [youtubePlaylistUrl, setYoutubePlaylistUrl] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(mode === 'edit');
  const [createdSetId, setCreatedSetId] = useState<string | null>(null);

  useEffect(() => {
    if (mode !== 'edit' || !setId) return;

    async function fetchSet() {
      try {
        const res = await fetch(`/api/sets/${setId}`);
        const data = await res.json();
        if (!data.success) {
          setError(data.error || 'Failed to load set');
          return;
        }
        setName(data.data.name);
        setDescription(data.data.description || '');
        setYoutubePlaylistUrl(data.data.youtubePlaylistUrl || '');
        setIsPublic(data.data.isPublic);
      } catch {
        setError('Failed to load set');
      } finally {
        setFetching(false);
      }
    }

    fetchSet();
  }, [mode, setId]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const body: Record<string, unknown> = { name, isPublic };
    if (description.trim()) body.description = description.trim();
    if (youtubePlaylistUrl.trim()) body.youtubePlaylistUrl = youtubePlaylistUrl.trim();
    if (mode === 'edit') {
      if (!description.trim()) body.description = null;
      if (!youtubePlaylistUrl.trim()) body.youtubePlaylistUrl = null;
    }

    try {
      const url = mode === 'create' ? '/api/sets' : `/api/sets/${setId}`;
      const method = mode === 'create' ? 'POST' : 'PUT';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || 'Something went wrong');
        return;
      }
      if (mode === 'create') {
        setCreatedSetId(data.data.id);
      } else {
        router.push('/dashboard');
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }

  if (createdSetId) {
    return (
      <div className="max-w-lg">
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-8 text-center space-y-4">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <svg
              className="w-5 h-5 text-emerald-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white/90 mb-1">Set Created</h3>
            <p className="text-xs text-white/30">
              Your set &ldquo;{name}&rdquo; is ready. A default cue has been added.
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            <Link
              href={`/v/${createdSetId}`}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-white text-black text-xs font-medium rounded-lg hover:bg-white/90 transition-all"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Open in Visualizer
            </Link>
            <Link
              href="/dashboard"
              className="px-4 py-2 text-xs text-white/40 hover:text-white/60 rounded-lg hover:bg-white/[0.04] transition-all"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-xs text-white/30 hover:text-white/50 transition-colors mb-6"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to Sets
      </Link>

      <div className="mb-6">
        <h1 className="text-lg font-semibold text-white/90 mb-1">
          {mode === 'create' ? 'Create Set' : 'Edit Set'}
        </h1>
        <p className="text-sm text-white/30">
          {mode === 'create'
            ? 'Sets organize your visualizer cues into shareable collections.'
            : 'Update your set details.'}
        </p>
      </div>

      {fetching ? (
        <div className="rounded-lg border border-white/[0.06] p-8">
          <div className="flex items-center justify-center gap-2">
            <div className="w-3 h-3 rounded-full bg-white/10 animate-pulse" />
            <span className="text-xs text-white/25">Loading set...</span>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">
              {error}
            </div>
          )}

          {/* Name */}
          <div className="space-y-1.5">
            <label htmlFor="set-name" className="text-xs font-medium text-white/50">
              Name <span className="text-white/20">*</span>
            </label>
            <input
              id="set-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Awesome Set"
              required
              maxLength={100}
              className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-white placeholder:text-white/15 focus:outline-none focus:border-white/20 transition-colors"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label htmlFor="set-desc" className="text-xs font-medium text-white/50">
              Description
            </label>
            <textarea
              id="set-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A collection of cues for..."
              maxLength={500}
              rows={3}
              className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-white placeholder:text-white/15 focus:outline-none focus:border-white/20 transition-colors resize-none"
            />
            <p className="text-[10px] text-white/15">{description.length}/500</p>
          </div>

          {/* YouTube Playlist URL */}
          <div className="space-y-1.5">
            <label htmlFor="set-youtube" className="text-xs font-medium text-white/50">
              YouTube Playlist URL
            </label>
            <input
              id="set-youtube"
              type="url"
              value={youtubePlaylistUrl}
              onChange={(e) => setYoutubePlaylistUrl(e.target.value)}
              placeholder="https://youtube.com/playlist?list=..."
              className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-white placeholder:text-white/15 focus:outline-none focus:border-white/20 transition-colors"
            />
          </div>

          {/* Public toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] border border-white/[0.06]">
            <div className="flex items-center gap-2.5">
              {isPublic ? (
                <Globe className="w-4 h-4 text-white/30" />
              ) : (
                <Lock className="w-4 h-4 text-white/30" />
              )}
              <div>
                <p className="text-xs font-medium text-white/60">
                  {isPublic ? 'Public' : 'Private'}
                </p>
                <p className="text-[10px] text-white/25">
                  {isPublic ? 'Anyone with the link can view' : 'Only you can access this set'}
                </p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={isPublic}
              onClick={() => setIsPublic(!isPublic)}
              className={`relative w-9 h-5 rounded-full transition-colors ${isPublic ? 'bg-white/20' : 'bg-white/[0.06]'}`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${isPublic ? 'translate-x-4' : 'translate-x-0'}`}
              />
            </button>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="px-5 py-2.5 bg-white text-black text-xs font-medium rounded-lg hover:bg-white/90 disabled:opacity-50 transition-all"
            >
              {loading
                ? mode === 'create'
                  ? 'Creating...'
                  : 'Saving...'
                : mode === 'create'
                  ? 'Create Set'
                  : 'Save Changes'}
            </button>
            <Link
              href="/dashboard"
              className="px-4 py-2.5 text-xs text-white/40 hover:text-white/60 transition-colors"
            >
              Cancel
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}
