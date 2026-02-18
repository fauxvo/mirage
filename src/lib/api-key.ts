import { NextRequest } from 'next/server';
import { apiKeyRepository, type ApiKeyRow } from '@/db/repositories/api-key.repository';

export async function hashKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export interface ValidateApiKeyResult {
  valid: boolean;
  apiKey: ApiKeyRow | null;
}

/**
 * Validate API key from request headers.
 * Checks DB-stored keys only. Returns the matched key row for rate limiting/usage tracking.
 * If no keys exist in the DB, access is open (returns valid with null apiKey).
 */
export async function validateApiKey(request: NextRequest): Promise<ValidateApiKeyResult> {
  const authHeader = request.headers.get('authorization');
  const apiKeyHeader = request.headers.get('x-api-key');

  const providedKey =
    apiKeyHeader || (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null);

  if (providedKey) {
    const keyHash = await hashKey(providedKey);
    const dbKey = await apiKeyRepository.findByHash(keyHash);
    if (dbKey && !dbKey.revokedAt) {
      return { valid: true, apiKey: dbKey };
    }
    // Key was provided but didn't match anything
    return { valid: false, apiKey: null };
  }

  // No key provided — check if any auth is configured
  const hasDbKeys = await apiKeyRepository.hasActiveKeys();
  if (hasDbKeys) {
    return { valid: false, apiKey: null };
  }

  // No auth configured at all — open access
  return { valid: true, apiKey: null };
}
