import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth/auth-guards', () => ({
  requireAuth: vi.fn(),
}));

vi.mock('@/db/repositories/api-key.repository', () => ({
  apiKeyRepository: {
    findByIdAndUser: vi.fn(),
    revoke: vi.fn(),
  },
}));

import { DELETE } from './route';
import { requireAuth } from '@/lib/auth/auth-guards';
import { apiKeyRepository } from '@/db/repositories/api-key.repository';
import { errorResponse } from '@/lib/api-utils';

const mockRequireAuth = vi.mocked(requireAuth);
const mockFindByIdAndUser = vi.mocked(apiKeyRepository.findByIdAndUser);
const mockRevoke = vi.mocked(apiKeyRepository.revoke);

function callDelete(id: string) {
  const req = new NextRequest(`http://localhost:4444/api/keys/${id}`, {
    method: 'DELETE',
  });
  return DELETE(req, { params: Promise.resolve({ id }) });
}

describe('DELETE /api/keys/[id]', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockRequireAuth.mockResolvedValue({
      session: { userId: 'user-1', username: 'testuser', role: 'user', exp: 0 },
      error: null,
    });
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireAuth.mockResolvedValue({
      session: null,
      error: errorResponse('Authentication required', 401),
    });

    const res = await callDelete('key-abc123');
    expect(res.status).toBe(401);
  });

  it('returns 404 for other users key', async () => {
    mockFindByIdAndUser.mockResolvedValue(null);

    const res = await callDelete('key-other-user');
    const data = await res.json();
    expect(res.status).toBe(404);
    expect(data.error).toBe('API key not found');
    expect(mockFindByIdAndUser).toHaveBeenCalledWith('key-other-user', 'user-1');
  });

  it('returns 400 when key already revoked', async () => {
    mockFindByIdAndUser.mockResolvedValue({
      id: 'key-abc123',
      name: 'test',
      keyHash: 'hash',
      keyPrefix: 'mk_abc',
      createdById: 'user-1',
      lastUsedAt: null,
      revokedAt: new Date(),
      createdAt: new Date(),
    });

    const res = await callDelete('key-abc123');
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toBe('API key already revoked');
  });

  it('revokes key successfully', async () => {
    mockFindByIdAndUser.mockResolvedValue({
      id: 'key-abc123',
      name: 'test',
      keyHash: 'hash',
      keyPrefix: 'mk_abc',
      createdById: 'user-1',
      lastUsedAt: null,
      revokedAt: null,
      createdAt: new Date(),
    });
    mockRevoke.mockResolvedValue(undefined);

    const res = await callDelete('key-abc123');
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockRevoke).toHaveBeenCalledWith('key-abc123');
  });
});
