import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/auth-guards';
import { setRepository } from '@/db/repositories/set.repository';
import { cueRepository } from '@/db/repositories/cue.repository';
import { CreateCueSchema } from '@/lib/schemas';
import { generateId } from '@/lib/creator-token';
import { successResponse, errorResponse, safeParseConfig } from '@/lib/api-utils';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: setId } = await params;
  const { session, error } = await requireAuth();
  if (error) return error;

  const set = await setRepository.findById(setId);
  if (!set) {
    return errorResponse('Set not found', 404);
  }
  if (set.userId !== session.userId) {
    return errorResponse('Forbidden', 403);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const parsed = CreateCueSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(`Validation error: ${parsed.error.message}`, 400);
  }

  // Determine position: use provided or append after max
  let position = parsed.data.position;
  if (!position) {
    const maxPos = await cueRepository.getMaxPosition(setId);
    position = maxPos + 1;
  }

  const cueId = generateId();
  const cue = await cueRepository.create({
    id: cueId,
    setId,
    position,
    name: parsed.data.name,
    config: JSON.stringify(parsed.data.config),
    textureUrl: parsed.data.textureUrl,
  });
  if (!cue) {
    return errorResponse('Failed to create cue', 500);
  }

  return successResponse(
    {
      id: cue.id,
      setId: cue.setId,
      position: cue.position,
      name: cue.name,
      config: safeParseConfig(cue.config),
      textureUrl: cue.textureUrl,
      createdAt: cue.createdAt.toISOString(),
      updatedAt: cue.updatedAt.toISOString(),
    },
    201
  );
}
