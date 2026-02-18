import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { validateApiKey } from './api-key';

// Mock the api-key repository
vi.mock('@/db/repositories/api-key.repository', () => ({
  apiKeyRepository: {
    findByHash: vi.fn(),
    hasActiveKeys: vi.fn(),
  },
}));

import { apiKeyRepository } from '@/db/repositories/api-key.repository';

const mockFindByHash = vi.mocked(apiKeyRepository.findByHash);
const mockHasActiveKeys = vi.mocked(apiKeyRepository.hasActiveKeys);

function makeRequest(headers: Record<string, string> = {}): NextRequest {
  const h = new Headers(headers);
  return new NextRequest('http://localhost:4444/api/sessions', { headers: h, method: 'POST' });
}

describe('validateApiKey', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv('MIRAGE_API_KEY', '');
  });

  it('allows open access when no auth is configured', async () => {
    mockHasActiveKeys.mockResolvedValue(false);

    const result = await validateApiKey(makeRequest());
    expect(result).toBe(true);
  });

  it('rejects when no key provided but env key is configured', async () => {
    vi.stubEnv('MIRAGE_API_KEY', 'env-secret');

    const result = await validateApiKey(makeRequest());
    expect(result).toBe(false);
  });

  it('rejects when no key provided but DB keys exist', async () => {
    mockHasActiveKeys.mockResolvedValue(true);

    const result = await validateApiKey(makeRequest());
    expect(result).toBe(false);
  });

  it('accepts valid env key via x-api-key header', async () => {
    vi.stubEnv('MIRAGE_API_KEY', 'env-secret');
    mockFindByHash.mockResolvedValue(null);

    const result = await validateApiKey(makeRequest({ 'x-api-key': 'env-secret' }));
    expect(result).toBe(true);
  });

  it('accepts valid env key via Bearer header', async () => {
    vi.stubEnv('MIRAGE_API_KEY', 'env-secret');
    mockFindByHash.mockResolvedValue(null);

    const result = await validateApiKey(
      makeRequest({ authorization: 'Bearer env-secret' })
    );
    expect(result).toBe(true);
  });

  it('accepts valid DB key via x-api-key header', async () => {
    mockFindByHash.mockResolvedValue({
      id: 1,
      name: 'test',
      keyHash: 'hash',
      keyPrefix: 'mk_abc',
      createdById: 1,
      revokedAt: null,
      createdAt: new Date(),
    });

    const result = await validateApiKey(makeRequest({ 'x-api-key': 'mk_some_key' }));
    expect(result).toBe(true);
  });

  it('rejects revoked DB key', async () => {
    mockFindByHash.mockResolvedValue({
      id: 1,
      name: 'test',
      keyHash: 'hash',
      keyPrefix: 'mk_abc',
      createdById: 1,
      revokedAt: new Date(),
      createdAt: new Date(),
    });

    const result = await validateApiKey(makeRequest({ 'x-api-key': 'mk_some_key' }));
    expect(result).toBe(false);
  });

  it('rejects invalid key when both DB and env are configured', async () => {
    vi.stubEnv('MIRAGE_API_KEY', 'env-secret');
    mockFindByHash.mockResolvedValue(null);

    const result = await validateApiKey(makeRequest({ 'x-api-key': 'wrong-key' }));
    expect(result).toBe(false);
  });

  it('DB key takes priority over env key check', async () => {
    vi.stubEnv('MIRAGE_API_KEY', 'env-secret');
    mockFindByHash.mockResolvedValue({
      id: 1,
      name: 'test',
      keyHash: 'hash',
      keyPrefix: 'mk_abc',
      createdById: 1,
      revokedAt: null,
      createdAt: new Date(),
    });

    const result = await validateApiKey(makeRequest({ 'x-api-key': 'mk_db_key' }));
    expect(result).toBe(true);
    // findByHash was called, meaning DB is checked first
    expect(mockFindByHash).toHaveBeenCalled();
  });
});
