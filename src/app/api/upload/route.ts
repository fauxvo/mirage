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

  const isImage = file.type.startsWith('image/');
  const isVideo = file.type.startsWith('video/');

  if (!isImage && !isVideo) {
    return errorResponse('File must be an image or video', 400);
  }

  const maxSize = isVideo ? 250 * 1024 * 1024 : 10 * 1024 * 1024;
  const maxLabel = isVideo ? '250MB' : '10MB';

  if (file.size > maxSize) {
    return errorResponse(`File must be under ${maxLabel}`, 400);
  }

  // Map MIME subtypes that don't match file extensions (e.g. video/quicktime → .mov)
  const MIME_EXT: Record<string, string> = {
    quicktime: 'mov',
    'x-matroska': 'mkv',
    'x-msvideo': 'avi',
  };
  const rawExt = file.type.split('/')[1] || (isVideo ? 'mp4' : 'png');
  const ext = MIME_EXT[rawExt] ?? rawExt;
  const prefix = isVideo ? 'videos' : 'textures';
  const key = `${prefix}/${setId}/${nanoid(8)}.${ext}`;

  // Uint8Array is required — AWS SDK v3 needs the full body to compute the
  // SHA-256 signing hash. ReadableStream was tried (c76459c) and failed.
  // For truly large files, @aws-sdk/lib-storage (multipart upload) would avoid
  // buffering, but that's a separate enhancement.
  const body = new Uint8Array(await file.arrayBuffer());
  const url = await uploadTexture(key, body, file.type, file.size);

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
