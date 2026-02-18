import { NextRequest } from 'next/server';
import { validateApiKey } from '@/lib/api-key';
import { generateSessionId, generateAdminToken } from '@/lib/creator-token';
import { sessionRepository } from '@/db/repositories/session.repository';
import { CreateSessionSchema } from '@/lib/schemas';
import { successResponse, errorResponse } from '@/lib/api-utils';

export async function POST(request: NextRequest) {
  if (!(await validateApiKey(request))) {
    return errorResponse('Invalid or missing API key', 401);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const parsed = CreateSessionSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(`Validation error: ${parsed.error.message}`, 400);
  }

  const sessionId = generateSessionId();
  const adminToken = generateAdminToken();
  const config = parsed.data.config ? JSON.stringify(parsed.data.config) : '{}';

  await sessionRepository.create({
    id: sessionId,
    adminToken,
    config,
    textureUrl: parsed.data.textureUrl ?? null,
  });

  return successResponse(
    {
      sessionId,
      adminToken,
      url: `/v/${sessionId}`,
    },
    201
  );
}
