'use client';

import { useState } from 'react';
import { ExternalLink, Trash2, Copy, Check } from 'lucide-react';

interface SessionInfo {
  id: string;
  config: Record<string, unknown>;
  textureUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

interface SessionListProps {
  sessions: SessionInfo[];
  onDelete: (id: string) => void;
}

export function SessionList({ sessions, onDelete }: SessionListProps) {
  return (
    <div className="space-y-3">
      {sessions.map((session) => (
        <SessionCard key={session.id} session={session} onDelete={onDelete} />
      ))}
    </div>
  );
}

function SessionCard({
  session,
  onDelete,
}: {
  session: SessionInfo;
  onDelete: (id: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const sceneName = (session.config as Record<string, string>).scene || 'Unknown';
  const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/v/${session.id}`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4">
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="text-sm font-medium text-white">Session {session.id}</p>
          <p className="text-[10px] text-white/40 mt-0.5">
            Scene: {sceneName} | Updated: {new Date(session.updatedAt).toLocaleDateString()}
          </p>
        </div>
      </div>

      <div className="flex gap-2 mt-3">
        <a
          href={`/v/${session.id}`}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-medium text-white/70 hover:text-white transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Open
        </a>
        <button
          onClick={handleCopy}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-medium text-white/70 hover:text-white transition-colors"
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? 'Copied' : 'Copy Link'}
        </button>
        <button
          onClick={() => {
            if (confirmDelete) {
              onDelete(session.id);
            } else {
              setConfirmDelete(true);
              setTimeout(() => setConfirmDelete(false), 3000);
            }
          }}
          className="flex items-center justify-center gap-1.5 px-3 py-2 bg-white/10 hover:bg-red-500/30 rounded-lg text-xs font-medium text-white/70 hover:text-red-300 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
          {confirmDelete ? 'Confirm' : 'Delete'}
        </button>
      </div>
    </div>
  );
}
