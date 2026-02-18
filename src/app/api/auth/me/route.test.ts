import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/auth/auth-guards', () => ({
  requireAuth: vi.fn(),
}));

import { GET } from './route';
import { requireAuth } from '@/lib/auth/auth-guards';
import { errorResponse } from '@/lib/api-utils';

const mockRequireAuth = vi.mocked(requireAuth);

describe('GET /api/auth/me', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireAuth.mockResolvedValue({
      session: null,
      error: errorResponse('Authentication required', 401),
    });

    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns current user when authenticated', async () => {
    mockRequireAuth.mockResolvedValue({
      session: { userId: 'user-1', username: 'admin', role: 'admin', exp: 0 },
      error: null,
    });

    const res = await GET();
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.userId).toBe('user-1');
    expect(data.data.username).toBe('admin');
    expect(data.data.role).toBe('admin');
  });

  it('returns user role for regular users', async () => {
    mockRequireAuth.mockResolvedValue({
      session: { userId: 'user-2', username: 'regularuser', role: 'user', exp: 0 },
      error: null,
    });

    const res = await GET();
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.data.role).toBe('user');
  });
});
