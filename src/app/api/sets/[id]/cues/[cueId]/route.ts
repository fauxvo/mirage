import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/auth-guards';
import { setRepository } from '@/db/repositories/set.repository';
import { cueRepository } from '@/db/repositories/cue.repository';
import { UpdateCueSchema } from '@/lib/schemas';
import { successResponse, errorResponse, safeParseConfig } from '@/lib/api-utils';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; cueId: string }> }
) {
  const { id: setId, cueId } = await params;
  const { session, error } = await requireAuth();
  if (error) return error;

  const set = await setRepository.findById(setId);
  if (!set) {
    return errorResponse('Set not found', 404);
  }
  if (set.userId !== session.userId) {
    return errorResponse('Forbidden', 403);
  }

  const cue = await cueRepository.findBySetIdAndId(setId, cueId);
  if (!cue) {
    return errorResponse('Cue not found', 404);
  }

  return successResponse({
    id: cue.id,
    setId: cue.setId,
    position: cue.position,
    name: cue.name,
    config: safeParseConfig(cue.config),
    textureUrl: cue.textureUrl,
    createdAt: cue.createdAt.toISOString(),
    updatedAt: cue.updatedAt.toISOString(),
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; cueId: string }> }
) {
  const { id: setId, cueId } = await params;
  const { session, error } = await requireAuth();
  if (error) return error;

  const set = await setRepository.findById(setId);
  if (!set) {
    return errorResponse('Set not found', 404);
  }
  if (set.userId !== session.userId) {
    return errorResponse('Forbidden', 403);
  }

  const cue = await cueRepository.findBySetIdAndId(setId, cueId);
  if (!cue) {
    return errorResponse('Cue not found', 404);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON', 400);
  }

  const parsed = UpdateCueSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(`Validation error: ${parsed.error.message}`, 400);
  }

  const updates: {
    name?: string;
    config?: string;
    position?: number;
    textureUrl?: string | null;
  } = {};
  if (parsed.data.name !== undefined) updates.name = parsed.data.name;
  if (parsed.data.config !== undefined) updates.config = JSON.stringify(parsed.data.config);
  if (parsed.data.position !== undefined) updates.position = parsed.data.position;
  if (parsed.data.textureUrl !== undefined) updates.textureUrl = parsed.data.textureUrl;

  const updated = await cueRepository.update(cueId, updates);
  if (!updated) {
    return errorResponse('Failed to update cue', 500);
  }

  return successResponse({
    id: updated.id,
    setId: updated.setId,
    position: updated.position,
    name: updated.name,
    config: safeParseConfig(updated.config),
    textureUrl: updated.textureUrl,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; cueId: string }> }
) {
  const { id: setId, cueId } = await params;
  const { session, error } = await requireAuth();
  if (error) return error;

  const set = await setRepository.findById(setId);
  if (!set) {
    return errorResponse('Set not found', 404);
  }
  if (set.userId !== session.userId) {
    return errorResponse('Forbidden', 403);
  }

  const cue = await cueRepository.findBySetIdAndId(setId, cueId);
  if (!cue) {
    return errorResponse('Cue not found', 404);
  }

  // Prevent deleting the last cue in a set
  const cueCount = await cueRepository.countBySetId(setId);
  if (cueCount <= 1) {
    return errorResponse('Cannot delete the last cue in a set', 400);
  }

  await cueRepository.delete(cueId);
  return successResponse({ deleted: true });
}
