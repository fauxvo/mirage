import { NextRequest } from 'next/server';
import { nanoid } from 'nanoid';
import { hash } from 'bcryptjs';
import { createSession } from '@/lib/auth/session';
import { userRepository } from '@/db/repositories/user.repository';
import { RegisterSchema } from '@/lib/auth-schemas';
import { successResponse, errorResponse } from '@/lib/api-utils';

export async function POST(request: NextRequest) {
  if (process.env.ALLOW_REGISTRATION === 'false') {
    return errorResponse('Registration is disabled', 403);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON', 400);
  }

  const parsed = RegisterSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0]?.message ?? 'Validation error', 400);
  }

  const email = parsed.data.email.toLowerCase().trim();

  const existingUsername = await userRepository.findByUsername(parsed.data.username);
  if (existingUsername) {
    return errorResponse('Username already exists', 409);
  }

  const existingEmail = await userRepository.findByEmail(email);
  if (existingEmail) {
    return errorResponse('Email already in use', 409);
  }

  const passwordHash = await hash(parsed.data.password, 12);
  const user = await userRepository.create({
    id: nanoid(16),
    username: parsed.data.username,
    email,
    passwordHash,
    role: 'user',
  });

  await createSession(user!.id, user!.username, 'user');

  return successResponse(
    {
      id: user!.id,
      username: user!.username,
      email: user!.email,
      role: user!.role,
    },
    201
  );
}
