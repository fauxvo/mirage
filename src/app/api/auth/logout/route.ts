import { deleteSession } from '@/lib/auth/session';
import { successResponse } from '@/lib/api-utils';

export async function POST() {
  await deleteSession();
  return successResponse({ message: 'Logged out' });
}
