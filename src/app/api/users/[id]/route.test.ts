import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth/auth-guards', () => ({
  requireAdmin: vi.fn(),
}));

vi.mock('@/db/repositories/user.repository', () => ({
  userRepository: {
    findById: vi.fn(),
    countAdmins: vi.fn(),
    delete: vi.fn(),
  },
}));

import { DELETE } from './route';
import { requireAdmin } from '@/lib/auth/auth-guards';
import { userRepository } from '@/db/repositories/user.repository';
import { errorResponse } from '@/lib/api-utils';

const mockRequireAdmin = vi.mocked(requireAdmin);
const mockFindById = vi.mocked(userRepository.findById);
const mockCountAdmins = vi.mocked(userRepository.countAdmins);
const mockDelete = vi.mocked(userRepository.delete);

function callDelete(id: string) {
  const req = new NextRequest(`http://localhost:4444/api/users/${id}`, {
    method: 'DELETE',
  });
  return DELETE(req, { params: Promise.resolve({ id }) });
}

describe('DELETE /api/users/[id]', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockRequireAdmin.mockResolvedValue({
      session: { userId: 'admin-1', username: 'admin', role: 'admin', exp: 0 },
      error: null,
    });
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireAdmin.mockResolvedValue({
      session: null,
      error: errorResponse('Authentication required', 401),
    });

    const res = await callDelete('user-1');
    expect(res.status).toBe(401);
  });

  it('returns 403 when not admin', async () => {
    mockRequireAdmin.mockResolvedValue({
      session: null,
      error: errorResponse('Admin access required', 403),
    });

    const res = await callDelete('user-1');
    expect(res.status).toBe(403);
  });

  it('returns 400 when trying to delete yourself', async () => {
    const res = await callDelete('admin-1');
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toBe('Cannot delete your own account');
  });

  it('returns 404 when user not found', async () => {
    mockFindById.mockResolvedValue(null);

    const res = await callDelete('nonexistent');
    const data = await res.json();
    expect(res.status).toBe(404);
    expect(data.error).toBe('User not found');
  });

  it('returns 400 when deleting last admin', async () => {
    mockFindById.mockResolvedValue({
      id: 'admin-2',
      username: 'admin2',
      email: 'admin2@test.com',
      passwordHash: 'hash',
      role: 'admin',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockCountAdmins.mockResolvedValue(1);

    const res = await callDelete('admin-2');
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toBe('Cannot delete the last admin user');
  });

  it('deletes regular user successfully', async () => {
    mockFindById.mockResolvedValue({
      id: 'user-1',
      username: 'user1',
      email: 'user@test.com',
      passwordHash: 'hash',
      role: 'user',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockDelete.mockResolvedValue(undefined);

    const res = await callDelete('user-1');
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockDelete).toHaveBeenCalledWith('user-1');
  });

  it('deletes admin when not the last one', async () => {
    mockFindById.mockResolvedValue({
      id: 'admin-2',
      username: 'admin2',
      email: 'admin2@test.com',
      passwordHash: 'hash',
      role: 'admin',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockCountAdmins.mockResolvedValue(2);
    mockDelete.mockResolvedValue(undefined);

    const res = await callDelete('admin-2');
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockDelete).toHaveBeenCalledWith('admin-2');
  });
});
