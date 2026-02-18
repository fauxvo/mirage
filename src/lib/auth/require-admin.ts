import { verifySession } from './session';
import { errorResponse } from '@/lib/api-utils';

export async function requireAdmin() {
  const session = await verifySession();
  if (!session) {
    return { session: null, error: errorResponse('Authentication required', 401) };
  }
  return { session, error: null };
}
