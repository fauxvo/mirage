import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/auth/session', () => ({
  verifySession: vi.fn(),
  createSession: vi.fn(),
}));

vi.mock('@/db/repositories/user.repository', () => ({
  userRepository: {
    findByUsername: vi.fn(),
    updateUsername: vi.fn(),
  },
}));

import { PUT } from './route';
import { verifySession, createSession } from '@/lib/auth/session';
import { userRepository } from '@/db/repositories/user.repository';

const mockVerifySession = vi.mocked(verifySession);
const mockCreateSession = vi.mocked(createSession);
const mockFindByUsername = vi.mocked(userRepository.findByUsername);
const mockUpdateUsername = vi.mocked(userRepository.updateUsername);

function makeRequest(body: unknown): Request {
  return new Request('http://localhost:4444/api/auth/username', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const session = {
  userId: 'user-1',
  username: 'oldname',
  role: 'user' as const,
  exp: Date.now() / 1000 + 3600,
};

describe('PUT /api/auth/username', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns 400 for invalid JSON body', async () => {
    mockVerifySession.mockResolvedValue(session);

    const req = new Request('http://localhost:4444/api/auth/username', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    });
    const res = await PUT(req);
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toBe('Invalid JSON body');
  });

  it('returns 401 when not authenticated', async () => {
    mockVerifySession.mockResolvedValue(null);

    const res = await PUT(makeRequest({ username: 'newname' }));
    const data = await res.json();
    expect(res.status).toBe(401);
    expect(data.error).toBe('Authentication required');
  });

  it('returns 400 when username is missing', async () => {
    mockVerifySession.mockResolvedValue(session);

    const res = await PUT(makeRequest({}));
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.success).toBe(false);
  });

  it('returns 400 when username is too short', async () => {
    mockVerifySession.mockResolvedValue(session);

    const res = await PUT(makeRequest({ username: 'ab' }));
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toMatch(/at least 3/);
  });

  it('returns 400 when username has invalid characters', async () => {
    mockVerifySession.mockResolvedValue(session);

    const res = await PUT(makeRequest({ username: 'bad name!' }));
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toMatch(/alphanumeric/);
  });

  it('returns success without DB call when username is unchanged', async () => {
    mockVerifySession.mockResolvedValue(session);

    const res = await PUT(makeRequest({ username: 'oldname' }));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.username).toBe('oldname');
    expect(mockFindByUsername).not.toHaveBeenCalled();
    expect(mockUpdateUsername).not.toHaveBeenCalled();
  });

  it('normalizes username to lowercase', async () => {
    mockVerifySession.mockResolvedValue(session);
    mockFindByUsername.mockResolvedValue(null);
    mockUpdateUsername.mockResolvedValue(undefined);
    mockCreateSession.mockResolvedValue('new-token');

    const res = await PUT(makeRequest({ username: 'NewName' }));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.data.username).toBe('newname');
    expect(mockUpdateUsername).toHaveBeenCalledWith('user-1', 'newname');
  });

  it('returns 409 when username is already taken', async () => {
    mockVerifySession.mockResolvedValue(session);
    mockFindByUsername.mockResolvedValue({
      id: 'user-2',
      username: 'taken',
      email: 'other@test.com',
      passwordHash: '$2a$12$hash',
      role: 'user',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await PUT(makeRequest({ username: 'taken' }));
    const data = await res.json();
    expect(res.status).toBe(409);
    expect(data.error).toBe('Username is already taken');
  });

  it('returns 409 when DB UNIQUE constraint fails (TOCTOU race)', async () => {
    mockVerifySession.mockResolvedValue(session);
    mockFindByUsername.mockResolvedValue(null);
    const sqliteError = Object.assign(new Error('UNIQUE constraint failed: users.username'), {
      code: 'SQLITE_CONSTRAINT_UNIQUE',
    });
    mockUpdateUsername.mockRejectedValue(sqliteError);

    const res = await PUT(makeRequest({ username: 'newname' }));
    const data = await res.json();
    expect(res.status).toBe(409);
    expect(data.error).toBe('Username is already taken');
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  it('updates username, reissues session cookie, and returns success', async () => {
    mockVerifySession.mockResolvedValue(session);
    mockFindByUsername.mockResolvedValue(null);
    mockUpdateUsername.mockResolvedValue(undefined);
    mockCreateSession.mockResolvedValue('new-token');

    const res = await PUT(makeRequest({ username: 'newname' }));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.username).toBe('newname');
    expect(mockUpdateUsername).toHaveBeenCalledWith('user-1', 'newname');
    expect(mockCreateSession).toHaveBeenCalledWith('user-1', 'newname', 'user');
  });

  it('returns 500 when updateUsername throws non-constraint error', async () => {
    mockVerifySession.mockResolvedValue(session);
    mockFindByUsername.mockResolvedValue(null);
    mockUpdateUsername.mockRejectedValue(new Error('SQLITE_BUSY'));

    const res = await PUT(makeRequest({ username: 'newname' }));
    const data = await res.json();
    expect(res.status).toBe(500);
    expect(data.error).toBe('Failed to update username');
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  it('returns success with warning when createSession fails after DB write', async () => {
    mockVerifySession.mockResolvedValue(session);
    mockFindByUsername.mockResolvedValue(null);
    mockUpdateUsername.mockResolvedValue(undefined);
    mockCreateSession.mockRejectedValue(new Error('Cookie store error'));

    const res = await PUT(makeRequest({ username: 'newname' }));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.username).toBe('newname');
    expect(data.data.warning).toBe('Please log in again to refresh your session');
  });
});
