'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, Plus } from 'lucide-react';
import { KeyRevealModal } from './key-reveal-modal';

interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export function ApiKeyList({
  initialKeys,
  apiEndpoint = '/api/admin/api-keys',
}: {
  initialKeys: ApiKey[];
  apiEndpoint?: string;
}) {
  const router = useRouter();
  const [keys, setKeys] = useState<ApiKey[]>(initialKeys);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [revealKey, setRevealKey] = useState<string | null>(null);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error);
        return;
      }

      setRevealKey(data.data.rawKey);
      setKeys([
        ...keys,
        {
          id: data.data.id,
          name: data.data.name,
          keyPrefix: data.data.keyPrefix,
          lastUsedAt: null,
          revokedAt: null,
          createdAt: new Date().toISOString(),
        },
      ]);
      setName('');
      setShowForm(false);
      router.refresh();
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }

  async function handleRevoke(id: string) {
    if (!confirm('Are you sure you want to revoke this API key? This cannot be undone.')) return;

    try {
      const res = await fetch(`${apiEndpoint}/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) {
        alert(data.error);
        return;
      }
      setKeys(keys.map((k) => (k.id === id ? { ...k, revokedAt: new Date().toISOString() } : k)));
      router.refresh();
    } catch {
      alert('Network error');
    }
  }

  return (
    <div className="space-y-3">
      {revealKey && <KeyRevealModal rawKey={revealKey} onClose={() => setRevealKey(null)} />}

      <div className="rounded-lg border border-white/[0.06] overflow-hidden">
        {keys.length === 0 ? (
          <div className="px-4 py-6 text-center text-xs text-white/20">
            No API keys yet. Create one to get started.
          </div>
        ) : (
          keys.map((key) => {
            const isRevoked = !!key.revokedAt;
            return (
              <div
                key={key.id}
                className={`flex items-center justify-between px-4 py-3 border-b border-white/[0.04] last:border-0 ${isRevoked ? 'opacity-40' : ''}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-white/80 truncate">{key.name}</span>
                      {isRevoked ? (
                        <span className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded bg-red-500/10 text-red-400/60">
                          Revoked
                        </span>
                      ) : (
                        <span className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400/60">
                          Active
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-xs text-white/20 font-mono">{key.keyPrefix}...</p>
                      {key.lastUsedAt && (
                        <p className="text-[10px] text-white/15">
                          Last used{' '}
                          {new Date(key.lastUsedAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                {!isRevoked && (
                  <button
                    onClick={() => handleRevoke(key.id)}
                    className="p-1.5 rounded text-white/20 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                    title="Revoke key"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      {showForm ? (
        <form onSubmit={handleCreate} className="space-y-3">
          {error && (
            <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">
              {error}
            </div>
          )}
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Key name (e.g. 'Production')"
            required
            maxLength={100}
            className="w-full px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/20 transition-colors"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-white text-black text-xs font-medium rounded-lg hover:bg-white/90 disabled:opacity-50 transition-all"
            >
              {loading ? 'Creating...' : 'Create Key'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setError('');
              }}
              className="px-4 py-2 text-xs text-white/40 hover:text-white/60 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-1.5 text-xs text-white/30 hover:text-white/50 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Create API Key
        </button>
      )}
    </div>
  );
}
