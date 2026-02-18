import { verifySession } from './session';
import { userRepository } from '@/db/repositories/user.repository';
import { errorResponse } from '@/lib/api-utils';

export async function requireAdmin() {
  const session = await verifySession();
  if (!session) {
    return { session: null, error: errorResponse('Authentication required', 401) };
  }
  if (session.role !== 'admin') {
    return { session: null, error: errorResponse('Admin access required', 403) };
  }

  // Re-validate against DB — role may have changed since JWT was issued
  const user = await userRepository.findById(session.userId);
  if (!user || user.role !== 'admin') {
    return { session: null, error: errorResponse('Admin access required', 403) };
  }

  return { session, error: null };
}

export async function requireAuth() {
  const session = await verifySession();
  if (!session) {
    return { session: null, error: errorResponse('Authentication required', 401) };
  }

  // Verify user still exists
  const user = await userRepository.findById(session.userId);
  if (!user) {
    return { session: null, error: errorResponse('Authentication required', 401) };
  }

  return { session, error: null };
}
