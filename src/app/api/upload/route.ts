import { NextRequest } from 'next/server';
import { nanoid } from 'nanoid';
import { isS3Configured, uploadTexture } from '@/lib/s3';
import { requireAuth } from '@/lib/auth/auth-guards';
import { setRepository } from '@/db/repositories/set.repository';
import { cueRepository } from '@/db/repositories/cue.repository';
import { successResponse, errorResponse } from '@/lib/api-utils';

export async function POST(request: NextRequest) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const setId = request.headers.get('x-set-id');
  if (!setId) {
    return errorResponse('Missing x-set-id header', 400);
  }

  const set = await setRepository.findById(setId);
  if (!set) {
    return errorResponse('Set not found', 404);
  }
  if (set.userId !== session.userId) {
    return errorResponse('Forbidden', 403);
  }

  if (!isS3Configured()) {
    return errorResponse('S3 storage not configured. Use base64 in config instead.', 501);
  }

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  if (!file) {
    return errorResponse('No file provided', 400);
  }

  if (!file.type.startsWith('image/')) {
    return errorResponse('File must be an image', 400);
  }

  if (file.size > 10 * 1024 * 1024) {
    return errorResponse('File must be under 10MB', 400);
  }

  const ext = file.type.split('/')[1] || 'png';
  const key = `textures/${setId}/${nanoid(8)}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const url = await uploadTexture(key, buffer, file.type);

  // Optionally persist textureUrl to a specific cue
  const cueId = request.headers.get('x-cue-id');
  if (cueId) {
    const cue = await cueRepository.findBySetIdAndId(setId, cueId);
    if (cue) {
      await cueRepository.update(cueId, { textureUrl: url });
    }
  }

  return successResponse({ url }, 201);
}
