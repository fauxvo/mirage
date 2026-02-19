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
    findBySetIdAndId: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    countBySetId: vi.fn(),
  },
}));

import { PUT, DELETE } from './route';
import { requireAuth } from '@/lib/auth/auth-guards';
import { setRepository } from '@/db/repositories/set.repository';
import { cueRepository } from '@/db/repositories/cue.repository';
import { errorResponse } from '@/lib/api-utils';

const mockRequireAuth = vi.mocked(requireAuth);
const mockSetFindById = vi.mocked(setRepository.findById);
const mockCueFindBySetIdAndId = vi.mocked(cueRepository.findBySetIdAndId);
const mockCueUpdate = vi.mocked(cueRepository.update);
const mockCueDelete = vi.mocked(cueRepository.delete);
const mockCountBySetId = vi.mocked(cueRepository.countBySetId);

const now = new Date();

function makeParams(id: string, cueId: string): { params: Promise<{ id: string; cueId: string }> } {
  return { params: Promise.resolve({ id, cueId }) };
}

const validConfig = {
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
};

describe('PUT /api/sets/[id]/cues/[cueId]', () => {
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

    const req = new NextRequest('http://localhost:4444/api/sets/set-1/cues/cue-1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Updated' }),
    });
    const res = await PUT(req, makeParams('set-1', 'cue-1'));
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

    const req = new NextRequest('http://localhost:4444/api/sets/set-1/cues/cue-1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Updated' }),
    });
    const res = await PUT(req, makeParams('set-1', 'cue-1'));
    expect(res.status).toBe(403);
  });

  it('updates cue name', async () => {
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
    mockCueFindBySetIdAndId.mockResolvedValue({
      id: 'cue-1',
      setId: 'set-1',
      position: 1,
      name: 'Old Name',
      config: JSON.stringify(validConfig),
      textureUrl: null,
      createdAt: now,
      updatedAt: now,
    });
    mockCueUpdate.mockResolvedValue({
      id: 'cue-1',
      setId: 'set-1',
      position: 1,
      name: 'New Name',
      config: JSON.stringify(validConfig),
      textureUrl: null,
      createdAt: now,
      updatedAt: now,
    });

    const req = new NextRequest('http://localhost:4444/api/sets/set-1/cues/cue-1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'New Name' }),
    });
    const res = await PUT(req, makeParams('set-1', 'cue-1'));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.data.name).toBe('New Name');
  });
});

describe('DELETE /api/sets/[id]/cues/[cueId]', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockRequireAuth.mockResolvedValue({
      session: { userId: 'user-1', username: 'testuser', role: 'user', exp: 0 },
      error: null,
    });
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

    const req = new NextRequest('http://localhost:4444/api/sets/set-1/cues/cue-1', {
      method: 'DELETE',
    });
    const res = await DELETE(req, makeParams('set-1', 'cue-1'));
    expect(res.status).toBe(403);
  });

  it('deletes cue owned by user', async () => {
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
    mockCueFindBySetIdAndId.mockResolvedValue({
      id: 'cue-1',
      setId: 'set-1',
      position: 1,
      name: 'Cue 1',
      config: '{}',
      textureUrl: null,
      createdAt: now,
      updatedAt: now,
    });
    mockCountBySetId.mockResolvedValue(2);
    mockCueDelete.mockResolvedValue(undefined);

    const req = new NextRequest('http://localhost:4444/api/sets/set-1/cues/cue-1', {
      method: 'DELETE',
    });
    const res = await DELETE(req, makeParams('set-1', 'cue-1'));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.data.deleted).toBe(true);
  });

  it('returns 400 when deleting last cue', async () => {
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
    mockCueFindBySetIdAndId.mockResolvedValue({
      id: 'cue-1',
      setId: 'set-1',
      position: 1,
      name: 'Cue 1',
      config: '{}',
      textureUrl: null,
      createdAt: now,
      updatedAt: now,
    });
    mockCountBySetId.mockResolvedValue(1);

    const req = new NextRequest('http://localhost:4444/api/sets/set-1/cues/cue-1', {
      method: 'DELETE',
    });
    const res = await DELETE(req, makeParams('set-1', 'cue-1'));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('last cue');
  });
});
