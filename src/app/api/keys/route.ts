import { NextRequest } from 'next/server';
import { nanoid } from 'nanoid';
import { requireAuth } from '@/lib/auth/auth-guards';
import { hashKey } from '@/lib/api-key';
import { apiKeyRepository } from '@/db/repositories/api-key.repository';
import { CreateApiKeySchema } from '@/lib/auth-schemas';
import { successResponse, errorResponse } from '@/lib/api-utils';

export async function GET() {
  const { session, error } = await requireAuth();
  if (error) return error;

  const keys = await apiKeyRepository.listByUser(session!.userId);
  return successResponse(
    keys.map((k) => ({
      id: k.id,
      name: k.name,
      keyPrefix: k.keyPrefix,
      lastUsedAt: k.lastUsedAt ? new Date(k.lastUsedAt).toISOString() : null,
      revokedAt: k.revokedAt ? new Date(k.revokedAt).toISOString() : null,
      createdAt: new Date(k.createdAt).toISOString(),
    }))
  );
}

export async function POST(request: NextRequest) {
  const { session, error } = await requireAuth();
  if (error) return error;

  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON', 400);
  }

  const parsed = CreateApiKeySchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0]?.message ?? 'Validation error', 400);
  }

  const rawKey = `mk_${nanoid(32)}`;
  const keyHash = await hashKey(rawKey);
  const keyPrefix = rawKey.slice(0, 11);

  const created = await apiKeyRepository.create({
    name: parsed.data.name,
    keyHash,
    keyPrefix,
    createdById: session!.userId,
  });

  return successResponse(
    {
      id: created.id,
      name: created.name,
      keyPrefix: created.keyPrefix,
      rawKey,
    },
    201
  );
}
