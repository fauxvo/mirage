import { NextResponse } from 'next/server';
import { verifySession, type SessionPayload } from './session';
import { userRepository } from '@/db/repositories/user.repository';
import { errorResponse } from '@/lib/api-utils';

type AuthSuccess = { session: SessionPayload; error: null };
type AuthError = { session: null; error: NextResponse };
export type AuthResult = AuthSuccess | AuthError;

export async function requireAdmin(): Promise<AuthResult> {
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

export async function requireAuth(): Promise<AuthResult> {
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
