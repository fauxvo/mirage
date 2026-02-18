import { NextRequest } from 'next/server';

/**
 * Validate API key from request headers.
 * If MIRAGE_API_KEY is not set, access is open (returns true).
 */
export function validateApiKey(request: NextRequest): boolean {
  const requiredKey = process.env.MIRAGE_API_KEY;
  if (!requiredKey) return true; // Open access

  const authHeader = request.headers.get('authorization');
  const apiKeyHeader = request.headers.get('x-api-key');

  if (apiKeyHeader === requiredKey) return true;
  if (authHeader?.startsWith('Bearer ') && authHeader.slice(7) === requiredKey) return true;

  return false;
}
