'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ChevronDown,
  ExternalLink,
  Pencil,
  Trash2,
  Globe,
  Lock,
  Copy,
  Check,
  Layers,
} from 'lucide-react';
import { CuesList } from './cues-list';
import { SetEditModal } from './set-edit-modal';
import type { CueResponse, SetListItem } from '@/types/api';

interface SetCardProps {
  set: SetListItem;
  onDeleteClick: (set: SetListItem) => void;
  onUpdate: (updated: SetListItem) => void;
}

export function SetCard({ set, onDeleteClick, onUpdate }: SetCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [cues, setCues] = useState<CueResponse[] | null>(null);
  const [loadingCues, setLoadingCues] = useState(false);
  const [cueError, setCueError] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  async function loadCues() {
    if (cues || loadingCues) return;
    setLoadingCues(true);
    setCueError(false);
    try {
      const res = await fetch(`/api/sets/${set.id}`);
      const data = await res.json();
      if (data.success) {
        setCues(data.data.cues);
      } else {
        setCueError(true);
      }
    } catch {
      setCueError(true);
    } finally {
      setLoadingCues(false);
    }
  }

  async function handleToggle() {
    if (expanded) {
      setExpanded(false);
      return;
    }
    setExpanded(true);
    await loadCues();
  }

  async function handleCopyLink() {
    try {
      const url = `${window.location.origin}/v/${set.id}`;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API may not be available in all contexts
    }
  }

  const formattedDate = new Date(set.createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="rounded-lg border border-white/[0.06] overflow-hidden hover:border-white/[0.1] transition-colors">
      {/* Card header */}
      <div className="px-4 py-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-sm font-medium text-white/80 truncate">{set.name}</h3>
              {set.isPublic ? (
                <span className="shrink-0 inline-flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.06] text-white/30">
                  <Globe className="w-2.5 h-2.5" />
                  Public
                </span>
              ) : (
                <span className="shrink-0 inline-flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.06] text-white/25">
                  <Lock className="w-2.5 h-2.5" />
                  Private
                </span>
              )}
            </div>
            {set.description && (
              <p className="text-xs text-white/25 line-clamp-2 leading-relaxed mb-1.5">
                {set.description}
              </p>
            )}
            <p className="text-[10px] text-white/15">{formattedDate}</p>
          </div>

          {/* Actions */}
          <div className="shrink-0 flex items-center gap-1">
            {set.isPublic && (
              <button
                onClick={handleCopyLink}
                className="p-1.5 rounded text-white/30 hover:text-white/50 hover:bg-white/[0.06] transition-colors"
                title="Copy share link"
              >
                {copied ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            )}
            <button
              onClick={() => setShowEditModal(true)}
              className="p-1.5 rounded text-white/30 hover:text-white/50 hover:bg-white/[0.06] transition-colors"
              title="Edit set"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <Link
              href={`/v/${set.id}`}
              className="p-1.5 rounded text-orange-400/70 hover:text-orange-400 hover:bg-orange-400/10 transition-colors"
              title="Open in visualizer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
            <button
              onClick={() => onDeleteClick(set)}
              className="p-1.5 rounded text-white/25 hover:text-red-400 hover:bg-red-400/10 transition-colors"
              title="Delete set"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Expand/collapse toggle */}
      <button
        onClick={handleToggle}
        className="w-full flex items-center justify-between px-4 py-2 border-t border-white/[0.04] text-white/25 hover:text-white/40 hover:bg-white/[0.02] transition-colors"
      >
        <span className="flex items-center gap-1.5 text-[10px] font-medium tracking-wide uppercase">
          <Layers className="w-3 h-3" />
          Cues ({cues ? cues.length : set.cueCount})
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Expanded cues list */}
      {expanded && (
        <div className="border-t border-white/[0.04] px-4 py-3">
          {loadingCues ? (
            <div className="flex items-center justify-center gap-2 py-2">
              <div className="w-2.5 h-2.5 rounded-full bg-white/10 animate-pulse" />
              <span className="text-[10px] text-white/20">Loading cues...</span>
            </div>
          ) : cueError ? (
            <div className="py-2 text-center">
              <p className="text-xs text-red-400/70">Failed to load cues</p>
              <button
                onClick={() => {
                  setCueError(false);
                  loadCues();
                }}
                className="mt-1 text-[10px] text-white/30 hover:text-white/50 underline"
              >
                Retry
              </button>
            </div>
          ) : cues && cues.length > 0 ? (
            <CuesList setId={set.id} cues={cues} onCuesChange={setCues} />
          ) : (
            <div className="py-2 text-center text-xs text-white/20">No cues found.</div>
          )}
        </div>
      )}

      {/* Edit modal */}
      {showEditModal && (
        <SetEditModal
          set={set}
          onClose={() => setShowEditModal(false)}
          onSaved={(updated) => {
            setShowEditModal(false);
            onUpdate(updated);
          }}
        />
      )}
    </div>
  );
}
