import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth/require-admin', () => ({
  requireAdmin: vi.fn(),
}));

vi.mock('@/db/repositories/api-key.repository', () => ({
  apiKeyRepository: {
    listAll: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock('nanoid', () => ({
  nanoid: vi.fn().mockReturnValue('abcdefghijklmnopqrstuvwxyz123456'),
}));

import { GET, POST } from './route';
import { requireAdmin } from '@/lib/auth/require-admin';
import { apiKeyRepository } from '@/db/repositories/api-key.repository';
import { errorResponse } from '@/lib/api-utils';

const mockRequireAdmin = vi.mocked(requireAdmin);
const mockListAll = vi.mocked(apiKeyRepository.listAll);
const mockCreate = vi.mocked(apiKeyRepository.create);

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost:4444/api/admin/api-keys', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('GET /api/admin/api-keys', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireAdmin.mockResolvedValue({
      session: null,
      error: errorResponse('Authentication required', 401),
    });

    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns list of keys when authenticated', async () => {
    const keys = [
      {
        id: 1,
        name: 'Production',
        keyHash: 'hash',
        keyPrefix: 'mk_abcdef12',
        createdById: 1,
        revokedAt: null,
        createdAt: new Date(),
      },
    ];
    mockRequireAdmin.mockResolvedValue({
      session: { userId: 1, username: 'admin', exp: 0 },
      error: null,
    });
    mockListAll.mockResolvedValue(keys);

    const res = await GET();
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toHaveLength(1);
  });
});

describe('POST /api/admin/api-keys', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockRequireAdmin.mockResolvedValue({
      session: { userId: 1, username: 'admin', exp: 0 },
      error: null,
    });
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireAdmin.mockResolvedValue({
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

  it('returns 400 for missing name', async () => {
    const res = await POST(makeRequest({}));
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.success).toBe(false);
  });

  it('creates API key and returns raw key', async () => {
    mockCreate.mockResolvedValue({
      id: 1,
      name: 'Production',
      keyHash: 'hash',
      keyPrefix: 'mk_abcdefgh',
      createdById: 1,
      revokedAt: null,
      createdAt: new Date(),
    });

    const res = await POST(makeRequest({ name: 'Production' }));
    const data = await res.json();
    expect(res.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.data.name).toBe('Production');
    expect(data.data.rawKey).toMatch(/^mk_/);
    expect(data.data.keyPrefix).toBeTruthy();
  });
});
