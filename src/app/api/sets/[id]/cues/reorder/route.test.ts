import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth/auth-guards', () => ({
  requireAuth: vi.fn(),
}));

vi.mock('@/db/repositories/set.repository', () => ({
  setRepository: {
    findById: vi.fn(),
  },
}));

vi.mock('@/db/repositories/cue.repository', () => ({
  cueRepository: {
    reorder: vi.fn(),
    findBySetId: vi.fn(),
  },
}));

import { PUT } from './route';
import { requireAuth } from '@/lib/auth/auth-guards';
import { setRepository } from '@/db/repositories/set.repository';
import { cueRepository } from '@/db/repositories/cue.repository';
import { errorResponse } from '@/lib/api-utils';

const mockRequireAuth = vi.mocked(requireAuth);
const mockSetFindById = vi.mocked(setRepository.findById);
const mockReorder = vi.mocked(cueRepository.reorder);
const mockFindBySetId = vi.mocked(cueRepository.findBySetId);

const now = new Date();

function makeParams(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost:4444/api/sets/set-1/cues/reorder', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('PUT /api/sets/[id]/cues/reorder', () => {
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

    const res = await PUT(makeRequest([{ id: 'cue-1', position: 1 }]), makeParams('set-1'));
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-owner', async () => {
    mockSetFindById.mockResolvedValue({
      id: 'set-1',
      userId: 'user-other',
      name: 'Test',
      description: null,
      youtubePlaylistUrl: null,
      isPublic: true,
      createdAt: now,
      updatedAt: now,
    });

    const res = await PUT(makeRequest([{ id: 'cue-1', position: 1 }]), makeParams('set-1'));
    expect(res.status).toBe(403);
  });

  it('reorders cues', async () => {
    mockSetFindById.mockResolvedValue({
      id: 'set-1',
      userId: 'user-1',
      name: 'Test',
      description: null,
      youtubePlaylistUrl: null,
      isPublic: true,
      createdAt: now,
      updatedAt: now,
    });
    // First call: validation; second call: response
    mockFindBySetId.mockResolvedValueOnce([
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
    ]);
    mockReorder.mockResolvedValue(undefined);
    mockFindBySetId.mockResolvedValueOnce([
      {
        id: 'cue-1',
        setId: 'set-1',
        position: 2,
        name: 'Cue 1',
        config: '{"scene":"particles"}',
        textureUrl: null,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    const res = await PUT(makeRequest([{ id: 'cue-1', position: 2 }]), makeParams('set-1'));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.data[0].position).toBe(2);
  });

  it('returns 400 for invalid positions', async () => {
    mockSetFindById.mockResolvedValue({
      id: 'set-1',
      userId: 'user-1',
      name: 'Test',
      description: null,
      youtubePlaylistUrl: null,
      isPublic: true,
      createdAt: now,
      updatedAt: now,
    });

    const res = await PUT(makeRequest([{ id: 'cue-1', position: 0 }]), makeParams('set-1'));
    expect(res.status).toBe(400);
  });

  it('returns 400 when cue not in set', async () => {
    mockSetFindById.mockResolvedValue({
      id: 'set-1',
      userId: 'user-1',
      name: 'Test',
      description: null,
      youtubePlaylistUrl: null,
      isPublic: true,
      createdAt: now,
      updatedAt: now,
    });
    mockFindBySetId.mockResolvedValue([]);

    const res = await PUT(makeRequest([{ id: 'nonexistent', position: 1 }]), makeParams('set-1'));
    expect(res.status).toBe(400);
  });
});
