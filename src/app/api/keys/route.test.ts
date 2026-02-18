import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth/auth-guards', () => ({
  requireAuth: vi.fn(),
}));

vi.mock('@/db/repositories/api-key.repository', () => ({
  apiKeyRepository: {
    listByUser: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock('@/lib/api-key', () => ({
  hashKey: vi.fn().mockResolvedValue('mocked-hash'),
}));

vi.mock('nanoid', () => ({
  nanoid: vi.fn().mockReturnValue('abcdefghijklmnopqrstuvwxyz123456'),
}));

import { GET, POST } from './route';
import { requireAuth } from '@/lib/auth/auth-guards';
import { apiKeyRepository } from '@/db/repositories/api-key.repository';
import { errorResponse } from '@/lib/api-utils';

const mockRequireAuth = vi.mocked(requireAuth);
const mockListByUser = vi.mocked(apiKeyRepository.listByUser);
const mockCreate = vi.mocked(apiKeyRepository.create);

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost:4444/api/keys', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('GET /api/keys', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireAuth.mockResolvedValue({
      session: null,
      error: errorResponse('Authentication required', 401),
    });

    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns user keys when authenticated', async () => {
    const keys = [
      {
        id: 'key-abc123',
        name: 'My Key',
        keyHash: 'hash',
        keyPrefix: 'mk_abcdef12',
        createdById: 'user-1',
        lastUsedAt: null,
        revokedAt: null,
        createdAt: new Date(),
      },
    ];
    mockRequireAuth.mockResolvedValue({
      session: { userId: 'user-1', username: 'testuser', role: 'user', exp: 0 },
      error: null,
    });
    mockListByUser.mockResolvedValue(keys);

    const res = await GET();
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toHaveLength(1);
    expect(data.data[0].id).toBe('key-abc123');
    expect(mockListByUser).toHaveBeenCalledWith('user-1');
  });
});

describe('POST /api/keys', () => {
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

    const res = await POST(makeRequest({ name: 'Test' }));
    expect(res.status).toBe(401);
  });

  it('returns 400 for empty name', async () => {
    const res = await POST(makeRequest({ name: '' }));
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.success).toBe(false);
  });

  it('creates key and returns raw key', async () => {
    mockCreate.mockResolvedValue({
      id: 'key-new123',
      name: 'My Key',
      keyHash: 'hash',
      keyPrefix: 'mk_abcdefgh',
      createdById: 'user-1',
      lastUsedAt: null,
      revokedAt: null,
      createdAt: new Date(),
    });

    const res = await POST(makeRequest({ name: 'My Key' }));
    const data = await res.json();
    expect(res.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.data.rawKey).toMatch(/^mk_/);
    expect(data.data.id).toBe('key-new123');
  });
});
