import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth/require-admin', () => ({
  requireAdmin: vi.fn(),
}));

vi.mock('@/db/repositories/admin-user.repository', () => ({
  adminUserRepository: {
    listAll: vi.fn(),
    findByUsername: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock('bcryptjs', () => ({
  hash: vi.fn().mockResolvedValue('$2a$12$hashed'),
}));

import { GET, POST } from './route';
import { requireAdmin } from '@/lib/auth/require-admin';
import { adminUserRepository } from '@/db/repositories/admin-user.repository';
import { errorResponse } from '@/lib/api-utils';

const mockRequireAdmin = vi.mocked(requireAdmin);
const mockListAll = vi.mocked(adminUserRepository.listAll);
const mockFindByUsername = vi.mocked(adminUserRepository.findByUsername);
const mockCreate = vi.mocked(adminUserRepository.create);

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost:4444/api/admin/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('GET /api/admin/users', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireAdmin.mockResolvedValue({
      session: null,
      error: errorResponse('Authentication required', 401),
    });

    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns list of users when authenticated', async () => {
    const users = [
      { id: 1, username: 'admin', createdAt: new Date(), updatedAt: new Date() },
      { id: 2, username: 'other', createdAt: new Date(), updatedAt: new Date() },
    ];
    mockRequireAdmin.mockResolvedValue({
      session: { userId: 1, username: 'admin', exp: 0 },
      error: null,
    });
    mockListAll.mockResolvedValue(users);

    const res = await GET();
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toHaveLength(2);
  });
});

describe('POST /api/admin/users', () => {
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

    const res = await POST(makeRequest({ username: 'new', password: '12345678' }));
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid username', async () => {
    const res = await POST(makeRequest({ username: 'ab', password: '12345678' }));
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.success).toBe(false);
  });

  it('returns 400 for short password', async () => {
    const res = await POST(makeRequest({ username: 'newuser', password: '1234567' }));
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.success).toBe(false);
  });

  it('returns 409 for duplicate username', async () => {
    mockFindByUsername.mockResolvedValue({
      id: 2,
      username: 'existing',
      passwordHash: 'hash',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await POST(makeRequest({ username: 'existing', password: '12345678' }));
    const data = await res.json();
    expect(res.status).toBe(409);
    expect(data.error).toBe('Username already exists');
  });

  it('creates user on valid input', async () => {
    mockFindByUsername.mockResolvedValue(null);
    mockCreate.mockResolvedValue({
      id: 3,
      username: 'newuser',
      passwordHash: '$2a$12$hashed',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await POST(makeRequest({ username: 'newuser', password: '12345678' }));
    const data = await res.json();
    expect(res.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.data.username).toBe('newuser');
    expect(data.data).not.toHaveProperty('passwordHash');
  });
});
