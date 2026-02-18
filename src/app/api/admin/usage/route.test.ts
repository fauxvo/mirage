import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth/auth-guards', () => ({
  requireAdmin: vi.fn(),
}));

vi.mock('@/db/repositories/api-usage.repository', () => ({
  apiUsageRepository: {
    getOverviewStats: vi.fn(),
  },
}));

import { GET } from './route';
import { requireAdmin } from '@/lib/auth/auth-guards';
import { apiUsageRepository } from '@/db/repositories/api-usage.repository';
import { errorResponse } from '@/lib/api-utils';

const mockRequireAdmin = vi.mocked(requireAdmin);
const mockGetOverviewStats = vi.mocked(apiUsageRepository.getOverviewStats);

function makeRequest(period?: string): NextRequest {
  const url = period
    ? `http://localhost:4444/api/admin/usage?period=${period}`
    : 'http://localhost:4444/api/admin/usage';
  return new NextRequest(url, { method: 'GET' });
}

describe('GET /api/admin/usage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireAdmin.mockResolvedValue({
      session: null,
      error: errorResponse('Authentication required', 401),
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-admin users', async () => {
    mockRequireAdmin.mockResolvedValue({
      session: null,
      error: errorResponse('Admin access required', 403),
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(403);
  });

  it('returns usage stats', async () => {
    mockRequireAdmin.mockResolvedValue({
      session: { userId: 'user-1', username: 'admin', role: 'admin', exp: 0 },
      error: null,
    });
    mockGetOverviewStats.mockResolvedValue({
      totalRequests: 42,
      perKeyStats: [
        {
          apiKeyId: 'key-1',
          keyName: 'Production',
          keyPrefix: 'mk_abc',
          requestCount: 42,
          avgResponseTime: 150,
          lastRequest: '2026-02-18T00:00:00.000Z',
        },
      ],
      methodBreakdown: [{ method: 'POST', count: 42 }],
    });

    const res = await GET(makeRequest());
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.totalRequests).toBe(42);
    expect(data.data.period).toBe('24h');
    expect(data.data.perKeyStats).toHaveLength(1);
  });

  it('respects period param', async () => {
    mockRequireAdmin.mockResolvedValue({
      session: { userId: 'user-1', username: 'admin', role: 'admin', exp: 0 },
      error: null,
    });
    mockGetOverviewStats.mockResolvedValue({
      totalRequests: 0,
      perKeyStats: [],
      methodBreakdown: [],
    });

    const res = await GET(makeRequest('7d'));
    const data = await res.json();
    expect(data.data.period).toBe('7d');
    expect(mockGetOverviewStats).toHaveBeenCalled();
  });
});
