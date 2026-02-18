import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-admin';
import { adminUserRepository } from '@/db/repositories/admin-user.repository';
import { successResponse, errorResponse } from '@/lib/api-utils';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireAdmin();
  if (error) return error;

  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);
  if (isNaN(id)) {
    return errorResponse('Invalid user ID', 400);
  }

  if (id === session!.userId) {
    return errorResponse('Cannot delete your own account', 400);
  }

  const count = await adminUserRepository.count();
  if (count <= 1) {
    return errorResponse('Cannot delete the last admin user', 400);
  }

  const user = await adminUserRepository.findById(id);
  if (!user) {
    return errorResponse('User not found', 404);
  }

  await adminUserRepository.delete(id);
  return successResponse({ message: 'User deleted' });
}
