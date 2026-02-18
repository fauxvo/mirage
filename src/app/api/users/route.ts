import { NextRequest } from 'next/server';
import { nanoid } from 'nanoid';
import { hash } from 'bcryptjs';
import { requireAdmin } from '@/lib/auth/auth-guards';
import { userRepository } from '@/db/repositories/user.repository';
import { CreateUserSchema } from '@/lib/auth-schemas';
import { successResponse, errorResponse } from '@/lib/api-utils';

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const users = await userRepository.listAll();
  return successResponse(users);
}

export async function POST(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON', 400);
  }

  const parsed = CreateUserSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0]?.message ?? 'Validation error', 400);
  }

  const existingUsername = await userRepository.findByUsername(parsed.data.username);
  if (existingUsername) {
    return errorResponse('Username already exists', 409);
  }

  const email = parsed.data.email.toLowerCase().trim();

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
    role: parsed.data.role,
  });

  return successResponse(
    {
      id: user!.id,
      username: user!.username,
      email: user!.email,
      role: user!.role,
      createdAt: user!.createdAt,
      updatedAt: user!.updatedAt,
    },
    201
  );
}
