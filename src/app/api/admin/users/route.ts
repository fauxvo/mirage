import { NextRequest } from 'next/server';
import { hash } from 'bcryptjs';
import { requireAdmin } from '@/lib/auth/require-admin';
import { adminUserRepository } from '@/db/repositories/admin-user.repository';
import { CreateAdminUserSchema } from '@/lib/admin-schemas';
import { successResponse, errorResponse } from '@/lib/api-utils';

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const users = await adminUserRepository.listAll();
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

  const parsed = CreateAdminUserSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0]?.message ?? 'Validation error', 400);
  }

  const existing = await adminUserRepository.findByUsername(parsed.data.username);
  if (existing) {
    return errorResponse('Username already exists', 409);
  }

  const passwordHash = await hash(parsed.data.password, 12);
  const user = await adminUserRepository.create({
    username: parsed.data.username,
    passwordHash,
  });

  return successResponse(
    {
      id: user!.id,
      username: user!.username,
      createdAt: user!.createdAt,
      updatedAt: user!.updatedAt,
    },
    201
  );
}
