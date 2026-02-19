import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth/auth-guards', () => ({
  requireAuth: vi.fn(),
}));

vi.mock('@/lib/auth/session', () => ({
  verifySession: vi.fn(),
}));

vi.mock('@/db/repositories/set.repository', () => ({
  setRepository: {
    findById: vi.fn(),
    findByIdWithCues: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

import { GET, PUT, DELETE } from './route';
import { requireAuth } from '@/lib/auth/auth-guards';
import { verifySession } from '@/lib/auth/session';
import { setRepository } from '@/db/repositories/set.repository';
import { errorResponse } from '@/lib/api-utils';

const mockRequireAuth = vi.mocked(requireAuth);
const mockVerifySession = vi.mocked(verifySession);
const mockFindById = vi.mocked(setRepository.findById);
const mockFindByIdWithCues = vi.mocked(setRepository.findByIdWithCues);
const mockUpdate = vi.mocked(setRepository.update);
const mockDelete = vi.mocked(setRepository.delete);

const now = new Date();

function makeParams(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

function makeRequest(body: unknown, method = 'PUT'): NextRequest {
  return new NextRequest('http://localhost:4444/api/sets/set-1', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('GET /api/sets/[id]', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns 404 for nonexistent set', async () => {
    mockFindByIdWithCues.mockResolvedValue(null);
    const req = new NextRequest('http://localhost:4444/api/sets/nope');
    const res = await GET(req, makeParams('nope'));
    expect(res.status).toBe(404);
  });

  it('returns public set without auth', async () => {
    mockVerifySession.mockResolvedValue(null);
    mockFindByIdWithCues.mockResolvedValue({
      id: 'set-1',
      userId: 'user-1',
      name: 'Public Set',
      description: null,
      youtubePlaylistUrl: null,
      isPublic: true,
      createdAt: now,
      updatedAt: now,
      cues: [
        {
          id: 'cue-1',
          setId: 'set-1',
          position: 1,
          name: 'Cue 1',
          config: '{"scene":"particles"}',
          textureUrl: null,
          createdAt: now,
          updatedAt: now,
        },
      ],
    });

    const req = new NextRequest('http://localhost:4444/api/sets/set-1');
    const res = await GET(req, makeParams('set-1'));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.data.name).toBe('Public Set');
    expect(data.data.isOwner).toBe(false);
    expect(data.data.cues).toHaveLength(1);
  });

  it('returns 404 for private set when not owner', async () => {
    mockFindByIdWithCues.mockResolvedValue({
      id: 'set-1',
      userId: 'user-1',
      name: 'Private Set',
      description: null,
      youtubePlaylistUrl: null,
      isPublic: false,
      createdAt: now,
      updatedAt: now,
      cues: [],
    });
    mockRequireAuth.mockResolvedValue({
      session: { userId: 'user-2', username: 'other', role: 'user', exp: 0 },
      error: null,
    });

    const req = new NextRequest('http://localhost:4444/api/sets/set-1');
    const res = await GET(req, makeParams('set-1'));
    expect(res.status).toBe(404);
  });
});

describe('PUT /api/sets/[id]', () => {
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

    const res = await PUT(makeRequest({ name: 'Updated' }), makeParams('set-1'));
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-owner', async () => {
    mockFindById.mockResolvedValue({
      id: 'set-1',
      userId: 'user-other',
      name: 'Test',
      description: null,
      youtubePlaylistUrl: null,
      isPublic: true,
      createdAt: now,
      updatedAt: now,
    });

    const res = await PUT(makeRequest({ name: 'Updated' }), makeParams('set-1'));
    expect(res.status).toBe(403);
  });

  it('updates set metadata', async () => {
    mockFindById.mockResolvedValue({
      id: 'set-1',
      userId: 'user-1',
      name: 'Old Name',
      description: null,
      youtubePlaylistUrl: null,
      isPublic: true,
      createdAt: now,
      updatedAt: now,
    });
    mockUpdate.mockResolvedValue({
      id: 'set-1',
      userId: 'user-1',
      name: 'New Name',
      description: null,
      youtubePlaylistUrl: null,
      isPublic: true,
      createdAt: now,
      updatedAt: now,
    });

    const res = await PUT(makeRequest({ name: 'New Name' }), makeParams('set-1'));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.data.name).toBe('New Name');
  });
});

describe('DELETE /api/sets/[id]', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockRequireAuth.mockResolvedValue({
      session: { userId: 'user-1', username: 'testuser', role: 'user', exp: 0 },
      error: null,
    });
  });

  it('returns 403 for non-owner', async () => {
    mockFindById.mockResolvedValue({
      id: 'set-1',
      userId: 'user-other',
      name: 'Test',
      description: null,
      youtubePlaylistUrl: null,
      isPublic: true,
      createdAt: now,
      updatedAt: now,
    });

    const req = new NextRequest('http://localhost:4444/api/sets/set-1', { method: 'DELETE' });
    const res = await DELETE(req, makeParams('set-1'));
    expect(res.status).toBe(403);
  });

  it('deletes set owned by user', async () => {
    mockFindById.mockResolvedValue({
      id: 'set-1',
      userId: 'user-1',
      name: 'Test',
      description: null,
      youtubePlaylistUrl: null,
      isPublic: true,
      createdAt: now,
      updatedAt: now,
    });
    mockDelete.mockResolvedValue(undefined);

    const req = new NextRequest('http://localhost:4444/api/sets/set-1', { method: 'DELETE' });
    const res = await DELETE(req, makeParams('set-1'));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.data.deleted).toBe(true);
  });
});
