import { NextRequest } from 'next/server';
import { sessionRepository } from '@/db/repositories/session.repository';
import { UpdateSessionSchema } from '@/lib/schemas';
import { validateAdminToken } from '@/lib/creator-token';
import { successResponse, errorResponse } from '@/lib/api-utils';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await sessionRepository.findById(id);
  if (!session) {
    return errorResponse('Session not found', 404);
  }

  return successResponse({
    id: session.id,
    config: JSON.parse(session.config),
    textureUrl: session.textureUrl,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
  });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await sessionRepository.findById(id);
  if (!session) {
    return errorResponse('Session not found', 404);
  }

  const adminToken = request.headers.get('x-admin-token');
  if (!validateAdminToken(adminToken, session.adminToken)) {
    return errorResponse('Invalid admin token', 403);
  }

  const body = await request.json();
  const parsed = UpdateSessionSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(`Validation error: ${parsed.error.message}`, 400);
  }

  const updates: { config?: string; textureUrl?: string | null } = {};
  if (parsed.data.config) {
    updates.config = JSON.stringify(parsed.data.config);
  }
  if (parsed.data.textureUrl !== undefined) {
    updates.textureUrl = parsed.data.textureUrl;
  }

  const updated = await sessionRepository.update(id, updates);
  return successResponse({
    id: updated!.id,
    config: JSON.parse(updated!.config),
    textureUrl: updated!.textureUrl,
    createdAt: updated!.createdAt.toISOString(),
    updatedAt: updated!.updatedAt.toISOString(),
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await sessionRepository.findById(id);
  if (!session) {
    return errorResponse('Session not found', 404);
  }

  const adminToken = request.headers.get('x-admin-token');
  if (!validateAdminToken(adminToken, session.adminToken)) {
    return errorResponse('Invalid admin token', 403);
  }

  await sessionRepository.delete(id);
  return successResponse({ deleted: true });
}
