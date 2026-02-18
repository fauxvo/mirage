import { NextRequest } from 'next/server';
import { nanoid } from 'nanoid';
import { isS3Configured, uploadTexture } from '@/lib/s3';
import { sessionRepository } from '@/db/repositories/session.repository';
import { validateAdminToken } from '@/lib/creator-token';
import { successResponse, errorResponse } from '@/lib/api-utils';

export async function POST(request: NextRequest) {
  const sessionId = request.headers.get('x-session-id');
  const adminToken = request.headers.get('x-admin-token');

  if (!sessionId) {
    return errorResponse('Missing x-session-id header', 400);
  }

  const session = await sessionRepository.findById(sessionId);
  if (!session) {
    return errorResponse('Session not found', 404);
  }

  if (!validateAdminToken(adminToken, session.adminToken)) {
    return errorResponse('Invalid admin token', 403);
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
  const key = `textures/${sessionId}/${nanoid(8)}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const url = await uploadTexture(key, buffer, file.type);

  await sessionRepository.update(sessionId, { textureUrl: url });

  return successResponse({ url }, 201);
}
