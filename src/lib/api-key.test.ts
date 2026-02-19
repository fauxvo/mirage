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
  return new NextRequest('http://localhost:4444/api/sets', { headers: h, method: 'POST' });
}

describe('validateApiKey', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('allows open access when no auth is configured', async () => {
    mockHasActiveKeys.mockResolvedValue(false);

    const result = await validateApiKey(makeRequest());
    expect(result.valid).toBe(true);
    expect(result.apiKey).toBeNull();
  });

  it('rejects when no key provided but DB keys exist', async () => {
    mockHasActiveKeys.mockResolvedValue(true);

    const result = await validateApiKey(makeRequest());
    expect(result.valid).toBe(false);
    expect(result.apiKey).toBeNull();
  });

  it('accepts valid DB key via x-api-key header', async () => {
    const dbKey = {
      id: 'key-abc123',
      name: 'test',
      keyHash: 'hash',
      keyPrefix: 'mk_abc',
      createdById: 'user-1',
      lastUsedAt: null,
      revokedAt: null,
      createdAt: new Date(),
    };
    mockFindByHash.mockResolvedValue(dbKey);

    const result = await validateApiKey(makeRequest({ 'x-api-key': 'mk_some_key' }));
    expect(result.valid).toBe(true);
    expect(result.apiKey).toEqual(dbKey);
  });

  it('accepts valid DB key via Bearer header', async () => {
    const dbKey = {
      id: 'key-abc123',
      name: 'test',
      keyHash: 'hash',
      keyPrefix: 'mk_abc',
      createdById: 'user-1',
      lastUsedAt: null,
      revokedAt: null,
      createdAt: new Date(),
    };
    mockFindByHash.mockResolvedValue(dbKey);

    const result = await validateApiKey(makeRequest({ authorization: 'Bearer mk_some_key' }));
    expect(result.valid).toBe(true);
    expect(result.apiKey).toEqual(dbKey);
  });

  it('rejects revoked DB key', async () => {
    mockFindByHash.mockResolvedValue({
      id: 'key-abc123',
      name: 'test',
      keyHash: 'hash',
      keyPrefix: 'mk_abc',
      createdById: 'user-1',
      lastUsedAt: null,
      revokedAt: new Date(),
      createdAt: new Date(),
    });

    const result = await validateApiKey(makeRequest({ 'x-api-key': 'mk_some_key' }));
    expect(result.valid).toBe(false);
    expect(result.apiKey).toBeNull();
  });

  it('rejects invalid key when DB keys exist', async () => {
    mockFindByHash.mockResolvedValue(null);

    const result = await validateApiKey(makeRequest({ 'x-api-key': 'wrong-key' }));
    expect(result.valid).toBe(false);
    expect(result.apiKey).toBeNull();
  });

  it('returns the matched apiKey row for valid keys', async () => {
    const dbKey = {
      id: 'key-abc123',
      name: 'Production',
      keyHash: 'hash',
      keyPrefix: 'mk_abc',
      createdById: 'user-1',
      lastUsedAt: null,
      revokedAt: null,
      createdAt: new Date(),
    };
    mockFindByHash.mockResolvedValue(dbKey);

    const result = await validateApiKey(makeRequest({ 'x-api-key': 'mk_db_key' }));
    expect(result.valid).toBe(true);
    expect(result.apiKey?.id).toBe('key-abc123');
    expect(result.apiKey?.name).toBe('Production');
    expect(mockFindByHash).toHaveBeenCalled();
  });
});
