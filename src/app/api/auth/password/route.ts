import { NextResponse } from 'next/server';
import { z } from 'zod';
import { compare, hash } from 'bcryptjs';
import { verifySession } from '@/lib/auth/session';
import { userRepository } from '@/db/repositories/user.repository';

const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

export async function PUT(request: Request) {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }

  const body = await request.json();
  const parsed = ChangePasswordSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? 'Invalid input';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }

  const { currentPassword, newPassword } = parsed.data;

  const user = await userRepository.findById(session.userId);
  if (!user) {
    return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
  }

  const valid = await compare(currentPassword, user.passwordHash);
  if (!valid) {
    return NextResponse.json(
      { success: false, error: 'Current password is incorrect' },
      { status: 403 }
    );
  }

  const newHash = await hash(newPassword, 12);
  await userRepository.updatePassword(session.userId, newHash);

  return NextResponse.json({ success: true, data: { message: 'Password updated' } });
}
