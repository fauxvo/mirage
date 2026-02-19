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
    create: vi.fn(),
    getMaxPosition: vi.fn(),
  },
}));

vi.mock('@/lib/creator-token', () => ({
  generateId: vi.fn().mockReturnValue('cue-id-1234'),
}));

import { POST } from './route';
import { requireAuth } from '@/lib/auth/auth-guards';
import { setRepository } from '@/db/repositories/set.repository';
import { cueRepository } from '@/db/repositories/cue.repository';
import { errorResponse } from '@/lib/api-utils';

const mockRequireAuth = vi.mocked(requireAuth);
const mockSetFindById = vi.mocked(setRepository.findById);
const mockCueCreate = vi.mocked(cueRepository.create);
const mockGetMaxPosition = vi.mocked(cueRepository.getMaxPosition);

const now = new Date();

function makeParams(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost:4444/api/sets/set-1/cues', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const validCueBody = {
  name: 'New Cue',
  config: {
    scene: 'particles',
    colorPalette: {
      primary: '#ff0000',
      secondary: '#00ff00',
      accent: '#0000ff',
      background: '#000000',
    },
    particleDensity: 0.5,
    animationSpeed: 1,
    bloomIntensity: 1.5,
    audioReactivity: 0.5,
    cameraMovement: 'drift',
    wireframe: false,
    symmetry: 4,
    depth: 0.5,
    colorCycleSpeed: 0,
    customTextureUrl: null,
    textureScale: 1,
    textureOpacity: 1,
    textureAnimation: 'none',
    patternOffsetX: 0,
  },
};

describe('POST /api/sets/[id]/cues', () => {
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

    const res = await POST(makeRequest(validCueBody), makeParams('set-1'));
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

    const res = await POST(makeRequest(validCueBody), makeParams('set-1'));
    expect(res.status).toBe(403);
  });

  it('creates cue with valid config', async () => {
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
    mockGetMaxPosition.mockResolvedValue(1);
    mockCueCreate.mockResolvedValue({
      id: 'cue-id-1234',
      setId: 'set-1',
      position: 2,
      name: 'New Cue',
      config: JSON.stringify(validCueBody.config),
      textureUrl: null,
      createdAt: now,
      updatedAt: now,
    });

    const res = await POST(makeRequest(validCueBody), makeParams('set-1'));
    const data = await res.json();
    expect(res.status).toBe(201);
    expect(data.data.name).toBe('New Cue');
    expect(data.data.position).toBe(2);
  });

  it('returns 400 for invalid config', async () => {
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

    const res = await POST(
      makeRequest({ name: 'Bad Cue', config: { scene: 'test' } }),
      makeParams('set-1')
    );
    expect(res.status).toBe(400);
  });
});
