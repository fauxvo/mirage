import { NextRequest } from 'next/server';
import { validateApiKey } from '@/lib/api-key';
import { checkRateLimit } from '@/lib/rate-limiter';
import { logApiUsage } from '@/lib/usage-logger';
import { generateSessionId, generateAdminToken } from '@/lib/creator-token';
import { sessionRepository } from '@/db/repositories/session.repository';
import { CreateSessionSchema } from '@/lib/schemas';
import { successResponse, errorResponse } from '@/lib/api-utils';

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const { valid, apiKey } = await validateApiKey(request);

  if (!valid) {
    return errorResponse('Invalid or missing API key', 401);
  }

  const log = (statusCode: number) => {
    if (!apiKey) return;
    logApiUsage({
      apiKeyId: apiKey.id,
      method: 'POST',
      path: '/api/sessions',
      statusCode,
      responseTimeMs: Date.now() - startTime,
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });
  };

  // Rate limiting (only for authenticated API key requests)
  if (apiKey) {
    const rateResult = checkRateLimit(apiKey.id);
    if (!rateResult.allowed) {
      const retryAfterSec = Math.ceil((rateResult.retryAfterMs ?? 60_000) / 1000);
      const res = errorResponse('Rate limit exceeded', 429);
      res.headers.set('Retry-After', String(retryAfterSec));
      res.headers.set('X-RateLimit-Remaining', '0');
      log(429);
      return res;
    }
  }

  let body;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const parsed = CreateSessionSchema.safeParse(body);
  if (!parsed.success) {
    log(400);
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

  log(201);

  return successResponse(
    {
      sessionId,
      adminToken,
      url: `/v/${sessionId}`,
    },
    201
  );
}
