import { NextRequest } from 'next/server';
import { apiKeyRepository } from '@/db/repositories/api-key.repository';

async function hashKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Validate API key from request headers.
 * Checks: DB-stored keys -> MIRAGE_API_KEY env var fallback -> open access if neither configured.
 */
export async function validateApiKey(request: NextRequest): Promise<boolean> {
  const authHeader = request.headers.get('authorization');
  const apiKeyHeader = request.headers.get('x-api-key');

  const providedKey = apiKeyHeader || (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null);

  if (providedKey) {
    // Check against DB-stored keys
    const keyHash = await hashKey(providedKey);
    const dbKey = await apiKeyRepository.findByHash(keyHash);
    if (dbKey && !dbKey.revokedAt) return true;

    // Check against env var fallback
    const envKey = process.env.MIRAGE_API_KEY;
    if (envKey && providedKey === envKey) return true;

    // Key was provided but didn't match anything
    return false;
  }

  // No key provided — check if any auth is configured
  const envKey = process.env.MIRAGE_API_KEY;
  if (envKey) return false;

  const hasDbKeys = await apiKeyRepository.hasActiveKeys();
  if (hasDbKeys) return false;

  // No auth configured at all — open access
  return true;
}
