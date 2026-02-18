import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./session', () => ({
  verifySession: vi.fn(),
}));

vi.mock('@/db/repositories/user.repository', () => ({
  userRepository: {
    findById: vi.fn(),
  },
}));

import { requireAdmin, requireAuth } from './auth-guards';
import { verifySession } from './session';
import { userRepository } from '@/db/repositories/user.repository';

const mockVerifySession = vi.mocked(verifySession);
const mockFindById = vi.mocked(userRepository.findById);

describe('requireAdmin', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns 401 when no session', async () => {
    mockVerifySession.mockResolvedValue(null);

    const { session, error } = await requireAdmin();
    expect(session).toBeNull();
    expect(error).toBeTruthy();
    const data = await error!.json();
    expect(data.error).toBe('Authentication required');
  });

  it('returns 403 when JWT role is not admin', async () => {
    mockVerifySession.mockResolvedValue({
      userId: 'user-1',
      username: 'user',
      role: 'user',
      exp: 0,
    });

    const { session, error } = await requireAdmin();
    expect(session).toBeNull();
    expect(error).toBeTruthy();
    const data = await error!.json();
    expect(data.error).toBe('Admin access required');
  });

  it('returns 403 when user no longer exists in DB', async () => {
    mockVerifySession.mockResolvedValue({
      userId: 'user-1',
      username: 'admin',
      role: 'admin',
      exp: 0,
    });
    mockFindById.mockResolvedValue(null);

    const { session, error } = await requireAdmin();
    expect(session).toBeNull();
    expect(error).toBeTruthy();
    const data = await error!.json();
    expect(data.error).toBe('Admin access required');
  });

  it('returns 403 when DB role changed from admin to user', async () => {
    mockVerifySession.mockResolvedValue({
      userId: 'user-1',
      username: 'admin',
      role: 'admin',
      exp: 0,
    });
    mockFindById.mockResolvedValue({
      id: 'user-1',
      username: 'admin',
      email: 'admin@test.com',
      passwordHash: 'hash',
      role: 'user',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const { session, error } = await requireAdmin();
    expect(session).toBeNull();
    expect(error).toBeTruthy();
    const data = await error!.json();
    expect(data.error).toBe('Admin access required');
  });

  it('returns session when JWT and DB both confirm admin', async () => {
    mockVerifySession.mockResolvedValue({
      userId: 'user-1',
      username: 'admin',
      role: 'admin',
      exp: 0,
    });
    mockFindById.mockResolvedValue({
      id: 'user-1',
      username: 'admin',
      email: 'admin@test.com',
      passwordHash: 'hash',
      role: 'admin',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const { session, error } = await requireAdmin();
    expect(error).toBeNull();
    expect(session).toBeTruthy();
    expect(session!.role).toBe('admin');
  });
});

describe('requireAuth', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns 401 when no session', async () => {
    mockVerifySession.mockResolvedValue(null);

    const { session, error } = await requireAuth();
    expect(session).toBeNull();
    expect(error).toBeTruthy();
    const data = await error!.json();
    expect(data.error).toBe('Authentication required');
  });

  it('returns 401 when user no longer exists in DB', async () => {
    mockVerifySession.mockResolvedValue({
      userId: 'user-1',
      username: 'user',
      role: 'user',
      exp: 0,
    });
    mockFindById.mockResolvedValue(null);

    const { session, error } = await requireAuth();
    expect(session).toBeNull();
    expect(error).toBeTruthy();
    const data = await error!.json();
    expect(data.error).toBe('Authentication required');
  });

  it('returns session when user exists', async () => {
    mockVerifySession.mockResolvedValue({
      userId: 'user-1',
      username: 'user',
      role: 'user',
      exp: 0,
    });
    mockFindById.mockResolvedValue({
      id: 'user-1',
      username: 'user',
      email: 'user@test.com',
      passwordHash: 'hash',
      role: 'user',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const { session, error } = await requireAuth();
    expect(error).toBeNull();
    expect(session).toBeTruthy();
    expect(session!.userId).toBe('user-1');
  });
});
