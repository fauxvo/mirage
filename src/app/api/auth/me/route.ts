import { requireAuth } from '@/lib/auth/auth-guards';
import { successResponse } from '@/lib/api-utils';

export async function GET() {
  const { session, error } = await requireAuth();
  if (error) return error;

  return successResponse({
    userId: session!.userId,
    username: session!.username,
    role: session!.role,
  });
}
