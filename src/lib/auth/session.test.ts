// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { encrypt, decrypt, createSession, deleteSession } from './session';
import { cookies } from 'next/headers';

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
    vi.stubEnv('JWT_SECRET', 'test-secret-key-12345');
    vi.stubEnv('ADMIN_PASSWORD', '');
    vi.stubEnv('ADMIN_SESSION_SECRET', '');
  });

  it('encrypts and decrypts a payload', async () => {
    const token = await encrypt({ userId: 'abc123', username: 'admin', role: 'admin' });
    expect(token).toBeTruthy();
    expect(typeof token).toBe('string');

    const payload = await decrypt(token);
    expect(payload).not.toBeNull();
    expect(payload!.userId).toBe('abc123');
    expect(payload!.username).toBe('admin');
    expect(payload!.role).toBe('admin');
  });

  it('returns null for invalid token', async () => {
    const payload = await decrypt('invalid-token');
    expect(payload).toBeNull();
  });

  it('returns null for tampered token', async () => {
    const token = await encrypt({ userId: 'abc123', username: 'admin', role: 'admin' });
    const tampered = token.slice(0, -5) + 'XXXXX';
    const payload = await decrypt(tampered);
    expect(payload).toBeNull();
  });

  it('produces different tokens for different payloads', async () => {
    const token1 = await encrypt({ userId: 'abc123', username: 'admin', role: 'admin' });
    const token2 = await encrypt({ userId: 'def456', username: 'other', role: 'user' });
    expect(token1).not.toBe(token2);
  });

  it('throws when no secret is configured', async () => {
    vi.stubEnv('JWT_SECRET', '');
    vi.stubEnv('ADMIN_PASSWORD', '');
    vi.stubEnv('ADMIN_SESSION_SECRET', '');

    await expect(encrypt({ userId: 'abc123', username: 'admin', role: 'admin' })).rejects.toThrow();
  });

  it('prefers JWT_SECRET over ADMIN_SESSION_SECRET and ADMIN_PASSWORD', async () => {
    vi.stubEnv('JWT_SECRET', 'jwt-secret-value');
    vi.stubEnv('ADMIN_SESSION_SECRET', 'session-secret-value');
    vi.stubEnv('ADMIN_PASSWORD', 'password-value');

    const token = await encrypt({ userId: 'abc123', username: 'admin', role: 'admin' });
    const payload = await decrypt(token);
    expect(payload!.userId).toBe('abc123');
  });

  it('falls back to ADMIN_SESSION_SECRET when JWT_SECRET not set', async () => {
    vi.stubEnv('JWT_SECRET', '');
    vi.stubEnv('ADMIN_SESSION_SECRET', 'session-secret-value');

    const token = await encrypt({ userId: 'abc123', username: 'admin', role: 'admin' });
    const payload = await decrypt(token);
    expect(payload!.userId).toBe('abc123');
  });

  it('preserves role in token', async () => {
    const userToken = await encrypt({ userId: 'u1', username: 'user1', role: 'user' });
    const adminToken = await encrypt({ userId: 'a1', username: 'admin1', role: 'admin' });

    const userPayload = await decrypt(userToken);
    const adminPayload = await decrypt(adminToken);

    expect(userPayload!.role).toBe('user');
    expect(adminPayload!.role).toBe('admin');
  });
});

describe('createSession cookie secure flag', () => {
  const mockSet = vi.fn();

  beforeEach(() => {
    vi.stubEnv('JWT_SECRET', 'test-secret-key-12345');
    vi.stubEnv('ADMIN_PASSWORD', '');
    vi.stubEnv('ADMIN_SESSION_SECRET', '');
    mockSet.mockClear();
    vi.mocked(cookies).mockResolvedValue({
      get: vi.fn(),
      set: mockSet,
      delete: vi.fn(),
    } as never);
  });

  it('sets secure: true when SECURE_COOKIES=true', async () => {
    vi.stubEnv('SECURE_COOKIES', 'true');
    await createSession('u1', 'admin', 'admin');
    expect(mockSet).toHaveBeenCalledWith(
      'mirage-session',
      expect.any(String),
      expect.objectContaining({ secure: true })
    );
  });

  it('sets secure: false when SECURE_COOKIES=false', async () => {
    vi.stubEnv('SECURE_COOKIES', 'false');
    await createSession('u1', 'admin', 'admin');
    expect(mockSet).toHaveBeenCalledWith(
      'mirage-session',
      expect.any(String),
      expect.objectContaining({ secure: false })
    );
  });

  it('falls back to NODE_ENV=production when SECURE_COOKIES is empty', async () => {
    vi.stubEnv('SECURE_COOKIES', '');
    vi.stubEnv('NODE_ENV', 'production');
    await createSession('u1', 'admin', 'admin');
    expect(mockSet).toHaveBeenCalledWith(
      'mirage-session',
      expect.any(String),
      expect.objectContaining({ secure: true })
    );
  });

  it('falls back to NODE_ENV=development when SECURE_COOKIES is empty', async () => {
    vi.stubEnv('SECURE_COOKIES', '');
    vi.stubEnv('NODE_ENV', 'development');
    await createSession('u1', 'admin', 'admin');
    expect(mockSet).toHaveBeenCalledWith(
      'mirage-session',
      expect.any(String),
      expect.objectContaining({ secure: false })
    );
  });

  it('deleteSession uses matching secure flag', async () => {
    vi.stubEnv('SECURE_COOKIES', 'true');
    await deleteSession();
    expect(mockSet).toHaveBeenCalledWith(
      'mirage-session',
      '',
      expect.objectContaining({ secure: true, maxAge: 0 })
    );
  });

  it('deleteSession respects SECURE_COOKIES=false', async () => {
    vi.stubEnv('SECURE_COOKIES', 'false');
    await deleteSession();
    expect(mockSet).toHaveBeenCalledWith(
      'mirage-session',
      '',
      expect.objectContaining({ secure: false, maxAge: 0 })
    );
  });
});
