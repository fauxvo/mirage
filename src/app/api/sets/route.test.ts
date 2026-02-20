import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth/auth-guards', () => ({
  requireAuth: vi.fn(),
}));

vi.mock('@/db/repositories/set.repository', () => ({
  setRepository: {
    create: vi.fn(),
    listByUserWithCueCount: vi.fn(),
  },
}));

vi.mock('@/db/repositories/cue.repository', () => ({
  cueRepository: {
    create: vi.fn(),
    findBySetId: vi.fn(),
  },
}));

vi.mock('@/lib/creator-token', () => ({
  generateId: vi.fn().mockReturnValue('test-id-1234'),
}));

vi.mock('@/constants/visualizer-presets', () => ({
  buildDefaultConfig: vi.fn().mockReturnValue({ scene: 'particles' }),
}));

import { GET, POST } from './route';
import { requireAuth } from '@/lib/auth/auth-guards';
import { setRepository } from '@/db/repositories/set.repository';
import { cueRepository } from '@/db/repositories/cue.repository';
import { errorResponse } from '@/lib/api-utils';

const mockRequireAuth = vi.mocked(requireAuth);
const mockSetCreate = vi.mocked(setRepository.create);
const mockSetListByUser = vi.mocked(setRepository.listByUserWithCueCount);
const mockCueCreate = vi.mocked(cueRepository.create);
const mockCueFindBySetId = vi.mocked(cueRepository.findBySetId);

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost:4444/api/sets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const now = new Date();

describe('POST /api/sets', () => {
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

    const res = await POST(makeRequest({ name: 'Test Set' }));
    expect(res.status).toBe(401);
  });

  it('returns 400 for missing name', async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.success).toBe(false);
  });

  it('creates set with default cue', async () => {
    mockSetCreate.mockResolvedValue({
      id: 'test-id-1234',
      userId: 'user-1',
      name: 'My Set',
      description: null,
      youtubePlaylistUrl: null,
      isPublic: true,
      createdAt: now,
      updatedAt: now,
    });
    mockCueCreate.mockResolvedValue({
      id: 'test-id-1234',
      setId: 'test-id-1234',
      position: 1,
      name: 'Cue 1',
      config: '{"scene":"particles"}',
      textureUrl: null,
      createdAt: now,
      updatedAt: now,
    });
    mockCueFindBySetId.mockResolvedValue([
      {
        id: 'test-id-1234',
        setId: 'test-id-1234',
        position: 1,
        name: 'Cue 1',
        config: '{"scene":"particles"}',
        textureUrl: null,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    const res = await POST(makeRequest({ name: 'My Set' }));
    const data = await res.json();
    expect(res.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.data.name).toBe('My Set');
    expect(data.data.cues).toHaveLength(1);
    expect(data.data.cues[0].name).toBe('Cue 1');
  });

  it('validates name max length', async () => {
    const res = await POST(makeRequest({ name: 'a'.repeat(101) }));
    expect(res.status).toBe(400);
  });
});

describe('GET /api/sets', () => {
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

  it("returns user's sets", async () => {
    mockRequireAuth.mockResolvedValue({
      session: { userId: 'user-1', username: 'testuser', role: 'user', exp: 0 },
      error: null,
    });
    mockSetListByUser.mockResolvedValue([
      {
        id: 'set-1',
        userId: 'user-1',
        name: 'Set One',
        description: null,
        youtubePlaylistUrl: null,
        isPublic: true,
        cueCount: 3,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    const res = await GET();
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toHaveLength(1);
    expect(data.data[0].name).toBe('Set One');
    expect(data.data[0].cueCount).toBe(3);
  });
});
