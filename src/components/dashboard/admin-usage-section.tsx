'use client';

import { useState, useEffect, useCallback } from 'react';
import { BarChart3, Activity, Clock, Key } from 'lucide-react';

interface PerKeyStat {
  apiKeyId: string;
  keyName: string | null;
  keyPrefix: string | null;
  requestCount: number;
  avgResponseTime: number | null;
  lastRequest: string | null;
}

interface MethodBreakdown {
  method: string;
  count: number;
}

interface UsageStats {
  period: string;
  totalRequests: number;
  perKeyStats: PerKeyStat[];
  methodBreakdown: MethodBreakdown[];
}

const PERIODS = [
  { label: '1h', value: '1h' },
  { label: '24h', value: '24h' },
  { label: '7d', value: '7d' },
  { label: '30d', value: '30d' },
];

export function AdminUsageSection() {
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [period, setPeriod] = useState('24h');
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/usage?period=${period}`);
      const data = await res.json();
      if (data.success) {
        setStats(data.data);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return (
    <div>
      <div className="mb-8">
        <div className="flex items-center gap-2.5 mb-1">
          <BarChart3 className="w-4 h-4 text-white/30" />
          <h1 className="text-lg font-semibold text-white/90">Usage</h1>
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400/50 tracking-wide uppercase">
            Admin
          </span>
        </div>
        <p className="text-sm text-white/30">API key usage statistics and analytics.</p>
      </div>

      {/* Period selector */}
      <div className="flex gap-1 mb-6">
        {PERIODS.map((p) => (
          <button
            key={p.value}
            onClick={() => setPeriod(p.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              period === p.value
                ? 'bg-white/[0.08] text-white/80'
                : 'text-white/30 hover:text-white/50 hover:bg-white/[0.03]'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="rounded-lg border border-white/[0.06] p-8 text-center">
          <p className="text-xs text-white/20">Loading...</p>
        </div>
      ) : !stats || stats.totalRequests === 0 ? (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-12 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-white/[0.04] border border-white/[0.06] mb-4">
            <BarChart3 className="w-5 h-5 text-white/25" />
          </div>
          <h3 className="text-sm font-medium text-white/60 mb-2">No usage data yet</h3>
          <p className="text-xs text-white/25 max-w-xs mx-auto leading-relaxed">
            Usage data will appear here once API keys are used to make requests.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-white/[0.06] p-4">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="w-3.5 h-3.5 text-white/20" />
                <span className="text-[10px] text-white/25 uppercase tracking-wide">
                  Total Requests
                </span>
              </div>
              <p className="text-2xl font-semibold text-white/80">
                {stats.totalRequests.toLocaleString()}
              </p>
            </div>
            <div className="rounded-lg border border-white/[0.06] p-4">
              <div className="flex items-center gap-2 mb-2">
                <Key className="w-3.5 h-3.5 text-white/20" />
                <span className="text-[10px] text-white/25 uppercase tracking-wide">
                  Active Keys
                </span>
              </div>
              <p className="text-2xl font-semibold text-white/80">{stats.perKeyStats.length}</p>
            </div>
            <div className="rounded-lg border border-white/[0.06] p-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-3.5 h-3.5 text-white/20" />
                <span className="text-[10px] text-white/25 uppercase tracking-wide">Methods</span>
              </div>
              <div className="flex gap-2 flex-wrap">
                {stats.methodBreakdown.map((m) => (
                  <span
                    key={m.method}
                    className="text-xs text-white/50 bg-white/[0.04] px-1.5 py-0.5 rounded"
                  >
                    {m.method}: {m.count}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Per-key table */}
          <div className="rounded-lg border border-white/[0.06] overflow-hidden">
            <div className="px-4 py-3 border-b border-white/[0.04]">
              <h2 className="text-xs font-medium tracking-wide uppercase text-white/40">
                Usage by Key
              </h2>
            </div>
            {stats.perKeyStats.map((keyStat) => (
              <div
                key={keyStat.apiKeyId}
                className="flex items-center justify-between px-4 py-3 border-b border-white/[0.04] last:border-0"
              >
                <div className="min-w-0">
                  <span className="text-sm text-white/80">{keyStat.keyName ?? 'Unknown Key'}</span>
                  <p className="text-xs text-white/20 font-mono mt-0.5">
                    {keyStat.keyPrefix ?? keyStat.apiKeyId.slice(0, 8)}...
                  </p>
                </div>
                <div className="flex items-center gap-4 text-right">
                  <div>
                    <p className="text-sm text-white/70 font-medium">
                      {keyStat.requestCount.toLocaleString()}
                    </p>
                    <p className="text-[10px] text-white/20">requests</p>
                  </div>
                  {keyStat.avgResponseTime != null && (
                    <div>
                      <p className="text-sm text-white/70 font-medium">
                        {Math.round(keyStat.avgResponseTime)}ms
                      </p>
                      <p className="text-[10px] text-white/20">avg</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
