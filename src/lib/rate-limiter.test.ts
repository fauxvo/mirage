import { describe, it, expect, beforeEach, vi } from 'vitest';
import { checkRateLimit, _resetRateLimiter } from './rate-limiter';

describe('rate-limiter', () => {
  beforeEach(() => {
    _resetRateLimiter();
  });

  it('allows requests under the limit', () => {
    const result = checkRateLimit('key-1');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(99);
    expect(result.retryAfterMs).toBeNull();
  });

  it('blocks at the limit', () => {
    for (let i = 0; i < 100; i++) {
      checkRateLimit('key-1');
    }
    const result = checkRateLimit('key-1');
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfterMs).toBeGreaterThan(0);
  });

  it('tracks keys independently', () => {
    for (let i = 0; i < 100; i++) {
      checkRateLimit('key-1');
    }

    // key-1 is at limit
    expect(checkRateLimit('key-1').allowed).toBe(false);

    // key-2 should still be fine
    expect(checkRateLimit('key-2').allowed).toBe(true);
  });

  it('sliding window expires old requests', () => {
    vi.useFakeTimers();
    const now = Date.now();
    vi.setSystemTime(now);

    // Fill up the limit
    for (let i = 0; i < 100; i++) {
      checkRateLimit('key-1');
    }
    expect(checkRateLimit('key-1').allowed).toBe(false);

    // Advance time past the window (1 minute)
    vi.setSystemTime(now + 61_000);

    const result = checkRateLimit('key-1');
    expect(result.allowed).toBe(true);

    vi.useRealTimers();
  });

  it('returns correct remaining count', () => {
    for (let i = 0; i < 50; i++) {
      checkRateLimit('key-1');
    }
    const result = checkRateLimit('key-1');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(49);
  });
});
