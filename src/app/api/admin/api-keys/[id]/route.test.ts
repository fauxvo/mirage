import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth/auth-guards', () => ({
  requireAdmin: vi.fn(),
}));

vi.mock('@/db/repositories/api-key.repository', () => ({
  apiKeyRepository: {
    findById: vi.fn(),
    revoke: vi.fn(),
  },
}));

import { DELETE } from './route';
import { requireAdmin } from '@/lib/auth/auth-guards';
import { apiKeyRepository } from '@/db/repositories/api-key.repository';
import { errorResponse } from '@/lib/api-utils';

const mockRequireAdmin = vi.mocked(requireAdmin);
const mockFindById = vi.mocked(apiKeyRepository.findById);
const mockRevoke = vi.mocked(apiKeyRepository.revoke);

function callDelete(id: string) {
  const req = new NextRequest(`http://localhost:4444/api/admin/api-keys/${id}`, {
    method: 'DELETE',
  });
  return DELETE(req, { params: Promise.resolve({ id }) });
}

describe('DELETE /api/admin/api-keys/[id]', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockRequireAdmin.mockResolvedValue({
      session: { userId: 'user-1', username: 'admin', role: 'admin', exp: 0 },
      error: null,
    });
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireAdmin.mockResolvedValue({
      session: null,
      error: errorResponse('Authentication required', 401),
    });

    const res = await callDelete('key-abc123');
    expect(res.status).toBe(401);
  });

  it('returns 404 when key not found', async () => {
    mockFindById.mockResolvedValue(null);

    const res = await callDelete('key-nonexistent');
    const data = await res.json();
    expect(res.status).toBe(404);
    expect(data.error).toBe('API key not found');
  });

  it('returns 400 when key already revoked', async () => {
    mockFindById.mockResolvedValue({
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
    mockFindById.mockResolvedValue({
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
