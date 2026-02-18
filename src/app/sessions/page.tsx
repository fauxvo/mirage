'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { SessionList } from '@/components/sessions/session-list';

interface SessionInfo {
  id: string;
  config: Record<string, unknown>;
  textureUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSessions() {
      // Find all admin tokens in localStorage
      const adminKeys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('mirage-admin-')) {
          adminKeys.push(key.replace('mirage-admin-', ''));
        }
      }

      if (adminKeys.length === 0) {
        setLoading(false);
        return;
      }

      // Fetch each session
      const results: SessionInfo[] = [];
      for (const sessionId of adminKeys) {
        try {
          const res = await fetch(`/api/sessions/${sessionId}`);
          if (res.ok) {
            const data = await res.json();
            if (data.success) {
              results.push(data.data);
            }
          }
        } catch {
          /* ignore */
        }
      }

      setSessions(results);
      setLoading(false);
    }

    loadSessions();
  }, []);

  const handleDelete = async (sessionId: string) => {
    const token = localStorage.getItem(`mirage-admin-${sessionId}`);
    if (!token) return;

    try {
      await fetch(`/api/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: { 'x-admin-token': token },
      });
      localStorage.removeItem(`mirage-admin-${sessionId}`);
      localStorage.removeItem(`mirage-config-${sessionId}`);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <h1 className="text-2xl font-bold mb-2">My Sessions</h1>
        <p className="text-white/50 text-sm mb-8">
          Sessions you&apos;ve created on this device. Only you can manage these.
        </p>

        {loading ? (
          <div className="text-white/30 text-sm">Loading sessions...</div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-white/40 text-sm mb-4">No sessions found on this device.</p>
            <Link
              href="/v/new"
              className="inline-block px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium transition-colors"
            >
              Create New Session
            </Link>
          </div>
        ) : (
          <SessionList sessions={sessions} onDelete={handleDelete} />
        )}
      </div>
    </div>
  );
}
