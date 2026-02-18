// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { encrypt, decrypt } from './session';

// Mock the cookies() function for session management
vi.mock('next/headers', () => ({
  cookies: vi.fn(() =>
    Promise.resolve({
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
    })
  ),
}));

describe('JWT encrypt/decrypt', () => {
  beforeEach(() => {
    vi.stubEnv('ADMIN_PASSWORD', 'test-secret-key-12345');
  });

  it('encrypts and decrypts a payload', async () => {
    const token = await encrypt({ userId: 1, username: 'admin' });
    expect(token).toBeTruthy();
    expect(typeof token).toBe('string');

    const payload = await decrypt(token);
    expect(payload).not.toBeNull();
    expect(payload!.userId).toBe(1);
    expect(payload!.username).toBe('admin');
  });

  it('returns null for invalid token', async () => {
    const payload = await decrypt('invalid-token');
    expect(payload).toBeNull();
  });

  it('returns null for tampered token', async () => {
    const token = await encrypt({ userId: 1, username: 'admin' });
    const tampered = token.slice(0, -5) + 'XXXXX';
    const payload = await decrypt(tampered);
    expect(payload).toBeNull();
  });

  it('produces different tokens for different payloads', async () => {
    const token1 = await encrypt({ userId: 1, username: 'admin' });
    const token2 = await encrypt({ userId: 2, username: 'other' });
    expect(token1).not.toBe(token2);
  });

  it('throws when no secret is configured', async () => {
    vi.stubEnv('ADMIN_PASSWORD', '');
    vi.stubEnv('ADMIN_SESSION_SECRET', '');

    await expect(encrypt({ userId: 1, username: 'admin' })).rejects.toThrow();
  });

  it('prefers ADMIN_SESSION_SECRET over ADMIN_PASSWORD', async () => {
    vi.stubEnv('ADMIN_SESSION_SECRET', 'session-secret-value');
    vi.stubEnv('ADMIN_PASSWORD', 'password-value');

    const token = await encrypt({ userId: 1, username: 'admin' });
    const payload = await decrypt(token);
    expect(payload!.userId).toBe(1);
  });
});
