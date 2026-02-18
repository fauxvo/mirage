import { NextRequest } from 'next/server';
import { compare } from 'bcryptjs';
import { ensureAdminSeeded } from '@/lib/auth/seed';
import { createSession } from '@/lib/auth/session';
import { adminUserRepository } from '@/db/repositories/admin-user.repository';
import { LoginSchema } from '@/lib/admin-schemas';
import { successResponse, errorResponse } from '@/lib/api-utils';

export async function POST(request: NextRequest) {
  await ensureAdminSeeded();

  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON', 400);
  }

  const parsed = LoginSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse('Invalid credentials', 401);
  }

  const user = await adminUserRepository.findByUsername(parsed.data.username);
  if (!user) {
    return errorResponse('Invalid credentials', 401);
  }

  const valid = await compare(parsed.data.password, user.passwordHash);
  if (!valid) {
    return errorResponse('Invalid credentials', 401);
  }

  await createSession(user.id, user.username);

  return successResponse({ userId: user.id, username: user.username });
}
