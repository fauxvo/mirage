import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/auth/session', () => ({
  verifySession: vi.fn(),
}));

vi.mock('bcryptjs', () => ({
  compare: vi.fn(),
  hash: vi.fn(),
}));

vi.mock('@/db/repositories/user.repository', () => ({
  userRepository: {
    findById: vi.fn(),
    updatePassword: vi.fn(),
  },
}));

import { PUT } from './route';
import { verifySession } from '@/lib/auth/session';
import { compare, hash } from 'bcryptjs';
import { userRepository } from '@/db/repositories/user.repository';

const mockVerifySession = vi.mocked(verifySession);
const mockCompare = vi.mocked(compare);
const mockHash = vi.mocked(hash);
const mockFindById = vi.mocked(userRepository.findById);
const mockUpdatePassword = vi.mocked(userRepository.updatePassword);

function makeRequest(body: unknown): Request {
  return new Request('http://localhost:4444/api/auth/password', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('PUT /api/auth/password', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    mockVerifySession.mockResolvedValue(null);

    const res = await PUT(makeRequest({ currentPassword: 'old', newPassword: 'newpass123' }));
    const data = await res.json();
    expect(res.status).toBe(401);
    expect(data.error).toBe('Authentication required');
  });

  it('returns 400 when currentPassword is missing', async () => {
    mockVerifySession.mockResolvedValue({
      userId: 'user-1',
      username: 'testuser',
      role: 'user',
      exp: Date.now() / 1000 + 3600,
    });

    const res = await PUT(makeRequest({ newPassword: 'newpass123' }));
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBeDefined();
  });

  it('returns 400 when newPassword is too short', async () => {
    mockVerifySession.mockResolvedValue({
      userId: 'user-1',
      username: 'testuser',
      role: 'user',
      exp: Date.now() / 1000 + 3600,
    });

    const res = await PUT(makeRequest({ currentPassword: 'oldpass123', newPassword: 'short' }));
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toBe('New password must be at least 8 characters');
  });

  it('returns 404 when user not found in database', async () => {
    mockVerifySession.mockResolvedValue({
      userId: 'user-1',
      username: 'testuser',
      role: 'user',
      exp: Date.now() / 1000 + 3600,
    });
    mockFindById.mockResolvedValue(null);

    const res = await PUT(
      makeRequest({ currentPassword: 'oldpass123', newPassword: 'newpass123' })
    );
    const data = await res.json();
    expect(res.status).toBe(404);
    expect(data.error).toBe('User not found');
  });

  it('returns 403 when current password is wrong', async () => {
    mockVerifySession.mockResolvedValue({
      userId: 'user-1',
      username: 'testuser',
      role: 'user',
      exp: Date.now() / 1000 + 3600,
    });
    mockFindById.mockResolvedValue({
      id: 'user-1',
      username: 'testuser',
      email: 'test@test.com',
      passwordHash: '$2a$12$hashed',
      role: 'user',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockCompare.mockResolvedValue(false as never);

    const res = await PUT(makeRequest({ currentPassword: 'wrongpass', newPassword: 'newpass123' }));
    const data = await res.json();
    expect(res.status).toBe(403);
    expect(data.error).toBe('Current password is incorrect');
  });

  it('updates password and returns success', async () => {
    mockVerifySession.mockResolvedValue({
      userId: 'user-1',
      username: 'testuser',
      role: 'user',
      exp: Date.now() / 1000 + 3600,
    });
    mockFindById.mockResolvedValue({
      id: 'user-1',
      username: 'testuser',
      email: 'test@test.com',
      passwordHash: '$2a$12$oldhash',
      role: 'user',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockCompare.mockResolvedValue(true as never);
    mockHash.mockResolvedValue('$2a$12$newhash' as never);
    mockUpdatePassword.mockResolvedValue(undefined);

    const res = await PUT(
      makeRequest({ currentPassword: 'oldpass123', newPassword: 'newpass123' })
    );
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.message).toBe('Password updated');
    expect(mockHash).toHaveBeenCalledWith('newpass123', 12);
    expect(mockUpdatePassword).toHaveBeenCalledWith('user-1', '$2a$12$newhash');
  });
});
