import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/auth/auth-guards';
import { userRepository } from '@/db/repositories/user.repository';
import { successResponse, errorResponse } from '@/lib/api-utils';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;

  if (id === session!.userId) {
    return errorResponse('Cannot delete your own account', 400);
  }

  const user = await userRepository.findById(id);
  if (!user) {
    return errorResponse('User not found', 404);
  }

  if (user.role === 'admin') {
    const adminCount = await userRepository.countAdmins();
    if (adminCount <= 1) {
      return errorResponse('Cannot delete the last admin user', 400);
    }
  }

  await userRepository.delete(id);
  return successResponse({ message: 'User deleted' });
}
