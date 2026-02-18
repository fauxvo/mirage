import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/auth-guards';
import { apiKeyRepository } from '@/db/repositories/api-key.repository';
import { successResponse, errorResponse } from '@/lib/api-utils';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const { id } = await params;

  const key = await apiKeyRepository.findByIdAndUser(id, session!.userId);
  if (!key) {
    return errorResponse('API key not found', 404);
  }

  if (key.revokedAt) {
    return errorResponse('API key already revoked', 400);
  }

  await apiKeyRepository.revoke(id);
  return successResponse({ message: 'API key revoked' });
}
