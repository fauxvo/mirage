import { verifySession, createSession } from '@/lib/auth/session';
import { ChangeUsernameSchema } from '@/lib/auth-schemas';
import { userRepository } from '@/db/repositories/user.repository';
import { successResponse, errorResponse } from '@/lib/api-utils';

export async function PUT(request: Request) {
  const session = await verifySession();
  if (!session) {
    return errorResponse('Authentication required', 401);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON body', 400);
  }
  const parsed = ChangeUsernameSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? 'Invalid input';
    return errorResponse(message, 400);
  }

  // Normalize to lowercase for case-insensitive uniqueness
  const username = parsed.data.username.toLowerCase();

  if (username === session.username) {
    return successResponse({ username });
  }

  const existing = await userRepository.findByUsername(username);
  if (existing) {
    return errorResponse('Username is already taken', 409);
  }

  try {
    await userRepository.updateUsername(session.userId, username);
  } catch (err: unknown) {
    // Catch UNIQUE constraint violation from DB (TOCTOU race guard)
    const message = err instanceof Error ? err.message : '';
    if (message.includes('UNIQUE constraint failed')) {
      return errorResponse('Username is already taken', 409);
    }
    return errorResponse('Failed to update username', 500);
  }

  // Reissue JWT with new username; if this fails the DB write already succeeded
  try {
    await createSession(session.userId, username, session.role);
  } catch {
    return successResponse({ username, warning: 'Please log in again to refresh your session' });
  }

  return successResponse({ username });
}
