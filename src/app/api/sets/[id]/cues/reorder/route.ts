import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/auth-guards';
import { setRepository } from '@/db/repositories/set.repository';
import { cueRepository } from '@/db/repositories/cue.repository';
import { ReorderCuesSchema } from '@/lib/schemas';
import { successResponse, errorResponse, safeParseConfig } from '@/lib/api-utils';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    return errorResponse('Invalid JSON', 400);
  }

  const parsed = ReorderCuesSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(`Validation error: ${parsed.error.message}`, 400);
  }

  // Verify all cues belong to this set and payload is complete
  const existingCues = await cueRepository.findBySetId(setId);
  const existingCueIds = new Set(existingCues.map((c) => c.id));

  if (parsed.data.length !== existingCues.length) {
    return errorResponse(`Expected ${existingCues.length} cues, got ${parsed.data.length}`, 400);
  }

  const positions = new Set(parsed.data.map((item) => item.position));
  if (positions.size !== parsed.data.length) {
    return errorResponse('Duplicate positions are not allowed', 400);
  }

  for (const item of parsed.data) {
    if (!existingCueIds.has(item.id)) {
      return errorResponse(`Cue ${item.id} not found in this set`, 400);
    }
  }

  await cueRepository.reorder(parsed.data);

  const updatedCues = await cueRepository.findBySetId(setId);

  return successResponse(
    updatedCues.map((c) => ({
      id: c.id,
      position: c.position,
      name: c.name,
      config: safeParseConfig(c.config),
      textureUrl: c.textureUrl,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    }))
  );
}
