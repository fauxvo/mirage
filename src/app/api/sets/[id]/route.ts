import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/auth-guards';
import { verifySession } from '@/lib/auth/session';
import { setRepository } from '@/db/repositories/set.repository';
import { UpdateSetSchema } from '@/lib/schemas';
import { successResponse, errorResponse, safeParseConfig } from '@/lib/api-utils';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const setWithCues = await setRepository.findByIdWithCues(id);
  if (!setWithCues) {
    return errorResponse('Set not found', 404);
  }

  let isOwner = false;

  if (!setWithCues.isPublic) {
    const { session, error } = await requireAuth();
    if (error) return error;
    if (session.userId !== setWithCues.userId) {
      return errorResponse('Set not found', 404);
    }
    isOwner = true;
  } else {
    // For public sets, optionally check ownership
    const session = await verifySession();
    if (session && session.userId === setWithCues.userId) {
      isOwner = true;
    }
  }

  return successResponse({
    id: setWithCues.id,
    isOwner,
    name: setWithCues.name,
    description: setWithCues.description,
    youtubePlaylistUrl: setWithCues.youtubePlaylistUrl,
    isPublic: setWithCues.isPublic,
    cues: setWithCues.cues.map((c) => ({
      id: c.id,
      position: c.position,
      name: c.name,
      config: safeParseConfig(c.config),
      textureUrl: c.textureUrl,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    })),
    createdAt: setWithCues.createdAt.toISOString(),
    updatedAt: setWithCues.updatedAt.toISOString(),
  });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, error } = await requireAuth();
  if (error) return error;

  const set = await setRepository.findById(id);
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
    return errorResponse('Invalid JSON', 400);
  }

  const parsed = UpdateSetSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(`Validation error: ${parsed.error.message}`, 400);
  }

  const updates: {
    name?: string;
    description?: string | null;
    youtubePlaylistUrl?: string | null;
    isPublic?: boolean;
  } = {};
  if (parsed.data.name !== undefined) updates.name = parsed.data.name;
  if (parsed.data.description !== undefined) updates.description = parsed.data.description;
  if (parsed.data.youtubePlaylistUrl !== undefined)
    updates.youtubePlaylistUrl = parsed.data.youtubePlaylistUrl;
  if (parsed.data.isPublic !== undefined) updates.isPublic = parsed.data.isPublic;

  const updated = await setRepository.update(id, updates);
  if (!updated) {
    return errorResponse('Failed to update set', 500);
  }

  return successResponse({
    id: updated.id,
    name: updated.name,
    description: updated.description,
    youtubePlaylistUrl: updated.youtubePlaylistUrl,
    isPublic: updated.isPublic,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { session, error } = await requireAuth();
  if (error) return error;

  const set = await setRepository.findById(id);
  if (!set) {
    return errorResponse('Set not found', 404);
  }
  if (set.userId !== session.userId) {
    return errorResponse('Forbidden', 403);
  }

  await setRepository.delete(id);
  return successResponse({ deleted: true });
}
