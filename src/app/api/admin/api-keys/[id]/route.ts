import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/auth/auth-guards';
import { apiKeyRepository } from '@/db/repositories/api-key.repository';
import { successResponse, errorResponse } from '@/lib/api-utils';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);
  if (isNaN(id)) {
    return errorResponse('Invalid key ID', 400);
  }

  const key = await apiKeyRepository.findById(id);
  if (!key) {
    return errorResponse('API key not found', 404);
  }

  if (key.revokedAt) {
    return errorResponse('API key already revoked', 400);
  }

  await apiKeyRepository.revoke(id);
  return successResponse({ message: 'API key revoked' });
}
