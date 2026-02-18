import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth/auth-guards', () => ({
  requireAdmin: vi.fn(),
}));

vi.mock('bcryptjs', () => ({
  hash: vi.fn().mockResolvedValue('$2a$12$hashed'),
}));

vi.mock('nanoid', () => ({
  nanoid: vi.fn().mockReturnValue('mock-nanoid-id-16'),
}));

vi.mock('@/db/repositories/user.repository', () => ({
  userRepository: {
    listAll: vi.fn(),
    findByUsername: vi.fn(),
    findByEmail: vi.fn(),
    create: vi.fn(),
  },
}));

import { GET, POST } from './route';
import { requireAdmin } from '@/lib/auth/auth-guards';
import { userRepository } from '@/db/repositories/user.repository';
import { errorResponse } from '@/lib/api-utils';

const mockRequireAdmin = vi.mocked(requireAdmin);
const mockListAll = vi.mocked(userRepository.listAll);
const mockFindByUsername = vi.mocked(userRepository.findByUsername);
const mockFindByEmail = vi.mocked(userRepository.findByEmail);
const mockCreate = vi.mocked(userRepository.create);

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost:4444/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('GET /api/users', () => {
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

  it('returns 403 when not admin', async () => {
    mockRequireAdmin.mockResolvedValue({
      session: null,
      error: errorResponse('Admin access required', 403),
    });

    const res = await GET();
    expect(res.status).toBe(403);
  });

  it('returns list of users when admin', async () => {
    const users = [
      {
        id: 'user-1',
        username: 'admin',
        email: 'admin@test.com',
        role: 'admin' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    mockRequireAdmin.mockResolvedValue({
      session: { userId: 'user-1', username: 'admin', role: 'admin', exp: 0 },
      error: null,
    });
    mockListAll.mockResolvedValue(users);

    const res = await GET();
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toHaveLength(1);
  });
});

describe('POST /api/users', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockRequireAdmin.mockResolvedValue({
      session: { userId: 'user-1', username: 'admin', role: 'admin', exp: 0 },
      error: null,
    });
    mockFindByUsername.mockResolvedValue(null);
    mockFindByEmail.mockResolvedValue(null);
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireAdmin.mockResolvedValue({
      session: null,
      error: errorResponse('Authentication required', 401),
    });

    const res = await POST(
      makeRequest({ username: 'test', email: 'test@test.com', password: 'password123' })
    );
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid data', async () => {
    const res = await POST(makeRequest({ username: 'ab' }));
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.success).toBe(false);
  });

  it('returns 409 for duplicate username', async () => {
    mockFindByUsername.mockResolvedValue({
      id: 'existing',
      username: 'test',
      email: 'other@test.com',
      passwordHash: 'hash',
      role: 'user',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await POST(
      makeRequest({ username: 'test', email: 'test@test.com', password: 'password123' })
    );
    const data = await res.json();
    expect(res.status).toBe(409);
    expect(data.error).toBe('Username already exists');
  });

  it('returns 409 for duplicate email', async () => {
    mockFindByEmail.mockResolvedValue({
      id: 'existing',
      username: 'other',
      email: 'test@test.com',
      passwordHash: 'hash',
      role: 'user',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await POST(
      makeRequest({ username: 'test', email: 'test@test.com', password: 'password123' })
    );
    const data = await res.json();
    expect(res.status).toBe(409);
    expect(data.error).toBe('Email already in use');
  });

  it('creates user with specified role', async () => {
    mockCreate.mockResolvedValue({
      id: 'mock-nanoid-id-16',
      username: 'newadmin',
      email: 'admin2@test.com',
      passwordHash: '$2a$12$hashed',
      role: 'admin',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await POST(
      makeRequest({
        username: 'newadmin',
        email: 'admin2@test.com',
        password: 'password123',
        role: 'admin',
      })
    );
    const data = await res.json();
    expect(res.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.data.username).toBe('newadmin');
    expect(data.data.role).toBe('admin');
  });

  it('defaults to user role', async () => {
    mockCreate.mockResolvedValue({
      id: 'mock-nanoid-id-16',
      username: 'newuser',
      email: 'user@test.com',
      passwordHash: '$2a$12$hashed',
      role: 'user',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await POST(
      makeRequest({
        username: 'newuser',
        email: 'user@test.com',
        password: 'password123',
      })
    );
    const data = await res.json();
    expect(res.status).toBe(201);
    expect(data.data.role).toBe('user');
  });
});
