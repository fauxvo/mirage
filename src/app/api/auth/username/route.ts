import { NextResponse } from 'next/server';
import { verifySession, createSession } from '@/lib/auth/session';
import { ChangeUsernameSchema } from '@/lib/auth-schemas';
import { userRepository } from '@/db/repositories/user.repository';

export async function PUT(request: Request) {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = ChangeUsernameSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? 'Invalid input';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }

  const { username } = parsed.data;

  if (username === session.username) {
    return NextResponse.json({ success: true, data: { username } });
  }

  const existing = await userRepository.findByUsername(username);
  if (existing) {
    return NextResponse.json(
      { success: false, error: 'Username is already taken' },
      { status: 409 }
    );
  }

  try {
    await userRepository.updateUsername(session.userId, username);
  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to update username' },
      { status: 500 }
    );
  }

  await createSession(session.userId, username, session.role);

  return NextResponse.json({ success: true, data: { username } });
}
