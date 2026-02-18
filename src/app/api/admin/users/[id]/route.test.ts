import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth/require-admin', () => ({
  requireAdmin: vi.fn(),
}));

vi.mock('@/db/repositories/admin-user.repository', () => ({
  adminUserRepository: {
    findById: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
}));

import { DELETE } from './route';
import { requireAdmin } from '@/lib/auth/require-admin';
import { adminUserRepository } from '@/db/repositories/admin-user.repository';
import { errorResponse } from '@/lib/api-utils';

const mockRequireAdmin = vi.mocked(requireAdmin);
const mockFindById = vi.mocked(adminUserRepository.findById);
const mockDelete = vi.mocked(adminUserRepository.delete);
const mockCount = vi.mocked(adminUserRepository.count);

function callDelete(id: string) {
  const req = new NextRequest(`http://localhost:4444/api/admin/users/${id}`, { method: 'DELETE' });
  return DELETE(req, { params: Promise.resolve({ id }) });
}

describe('DELETE /api/admin/users/[id]', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockRequireAdmin.mockResolvedValue({
      session: { userId: 1, username: 'admin', exp: 0 },
      error: null,
    });
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireAdmin.mockResolvedValue({
      session: null,
      error: errorResponse('Authentication required', 401),
    });

    const res = await callDelete('2');
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid ID', async () => {
    const res = await callDelete('abc');
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toBe('Invalid user ID');
  });

  it('returns 400 when trying to delete self', async () => {
    const res = await callDelete('1');
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toBe('Cannot delete your own account');
  });

  it('returns 400 when only one admin exists', async () => {
    mockCount.mockResolvedValue(1);

    const res = await callDelete('2');
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toBe('Cannot delete the last admin user');
  });

  it('returns 404 when user not found', async () => {
    mockCount.mockResolvedValue(3);
    mockFindById.mockResolvedValue(null);

    const res = await callDelete('999');
    const data = await res.json();
    expect(res.status).toBe(404);
    expect(data.error).toBe('User not found');
  });

  it('deletes user successfully', async () => {
    mockCount.mockResolvedValue(3);
    mockFindById.mockResolvedValue({
      id: 2,
      username: 'other',
      passwordHash: 'hash',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockDelete.mockResolvedValue(undefined);

    const res = await callDelete('2');
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockDelete).toHaveBeenCalledWith(2);
  });
});
