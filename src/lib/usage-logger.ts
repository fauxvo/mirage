import { apiUsageRepository } from '@/db/repositories/api-usage.repository';
import { apiKeyRepository } from '@/db/repositories/api-key.repository';

/**
 * Fire-and-forget: logs API usage to the database and updates lastUsedAt.
 * Errors are caught silently — best effort.
 */
export function logApiUsage(params: {
  apiKeyId: string;
  method: string;
  path: string;
  statusCode: number;
  responseTimeMs?: number;
  ipAddress?: string;
  userAgent?: string;
}) {
  // Fire and forget — don't await
  Promise.all([
    apiUsageRepository.create(params),
    apiKeyRepository.updateLastUsedAt(params.apiKeyId),
  ]).catch(() => {
    // Silently ignore — best effort logging
  });
}
