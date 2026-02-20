import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/auth-guards';
import { setRepository } from '@/db/repositories/set.repository';
import { cueRepository } from '@/db/repositories/cue.repository';
import { CreateSetSchema } from '@/lib/schemas';
import { generateId } from '@/lib/creator-token';
import { buildDefaultConfig } from '@/constants/visualizer-presets';
import { successResponse, errorResponse, safeParseConfig } from '@/lib/api-utils';

export async function POST(request: NextRequest) {
  const { session, error } = await requireAuth();
  if (error) return error;

  let body;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const parsed = CreateSetSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(`Validation error: ${parsed.error.message}`, 400);
  }

  const setId = generateId();
  const set = await setRepository.create({
    id: setId,
    userId: session.userId,
    name: parsed.data.name,
    description: parsed.data.description,
    youtubePlaylistUrl: parsed.data.youtubePlaylistUrl,
    isPublic: parsed.data.isPublic,
  });

  // Create default cue
  const cueId = generateId();
  const defaultConfig = buildDefaultConfig('particles');
  await cueRepository.create({
    id: cueId,
    setId,
    position: 1,
    name: 'Cue 1',
    config: JSON.stringify(defaultConfig),
  });

  if (!set) {
    return errorResponse('Failed to create set', 500);
  }

  const cues = await cueRepository.findBySetId(setId);

  return successResponse(
    {
      id: set.id,
      name: set.name,
      description: set.description,
      youtubePlaylistUrl: set.youtubePlaylistUrl,
      isPublic: set.isPublic,
      url: `/v/${set.id}`,
      cues: cues.map((c) => ({
        id: c.id,
        position: c.position,
        name: c.name,
        config: safeParseConfig(c.config),
        textureUrl: c.textureUrl,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      })),
      createdAt: set.createdAt.toISOString(),
      updatedAt: set.updatedAt.toISOString(),
    },
    201
  );
}

export async function GET() {
  const { session, error } = await requireAuth();
  if (error) return error;

  const sets = await setRepository.listByUserWithCueCount(session.userId);

  return successResponse(
    sets.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      youtubePlaylistUrl: s.youtubePlaylistUrl,
      isPublic: s.isPublic,
      cueCount: s.cueCount,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    }))
  );
}
