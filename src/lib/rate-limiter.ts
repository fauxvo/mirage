const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS = 100; // per window per key
const CLEANUP_INTERVAL_MS = 5 * 60_000; // 5 minutes

interface RequestRecord {
  timestamps: number[];
}

const store = new Map<string, RequestRecord>();

let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function ensureCleanup() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, record] of store) {
      record.timestamps = record.timestamps.filter((ts) => now - ts < WINDOW_MS);
      if (record.timestamps.length === 0) {
        store.delete(key);
      }
    }
    if (store.size === 0 && cleanupTimer) {
      clearInterval(cleanupTimer);
      cleanupTimer = null;
    }
  }, CLEANUP_INTERVAL_MS);
  // Don't prevent process exit
  if (cleanupTimer && typeof cleanupTimer === 'object' && 'unref' in cleanupTimer) {
    cleanupTimer.unref();
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number | null;
}

export function checkRateLimit(apiKeyId: string): RateLimitResult {
  ensureCleanup();

  const now = Date.now();
  let record = store.get(apiKeyId);

  if (!record) {
    record = { timestamps: [] };
    store.set(apiKeyId, record);
  }

  // Sliding window — keep only timestamps within the window
  record.timestamps = record.timestamps.filter((ts) => now - ts < WINDOW_MS);

  if (record.timestamps.length >= MAX_REQUESTS) {
    const oldestInWindow = record.timestamps[0];
    const retryAfterMs = WINDOW_MS - (now - oldestInWindow);
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs,
    };
  }

  record.timestamps.push(now);
  return {
    allowed: true,
    remaining: MAX_REQUESTS - record.timestamps.length,
    retryAfterMs: null,
  };
}

/** Reset for testing */
export function _resetRateLimiter() {
  store.clear();
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
}
