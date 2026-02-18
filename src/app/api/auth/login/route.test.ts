import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth/seed', () => ({
  ensureAdminSeeded: vi.fn(),
}));

vi.mock('@/lib/auth/session', () => ({
  createSession: vi.fn().mockResolvedValue('mock-token'),
}));

vi.mock('bcryptjs', () => ({
  compare: vi.fn(),
}));

vi.mock('@/db/repositories/user.repository', () => ({
  userRepository: {
    findByUsername: vi.fn(),
  },
}));

import { POST } from './route';
import { compare } from 'bcryptjs';
import { userRepository } from '@/db/repositories/user.repository';
import { createSession } from '@/lib/auth/session';

const mockFindByUsername = vi.mocked(userRepository.findByUsername);
const mockCompare = vi.mocked(compare);
const mockCreateSession = vi.mocked(createSession);

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost:4444/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockCreateSession.mockResolvedValue('mock-token');
  });

  it('returns 400 for invalid JSON', async () => {
    const req = new NextRequest('http://localhost:4444/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    });
    const res = await POST(req);
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toBe('Invalid JSON');
  });

  it('returns 401 for missing username', async () => {
    const res = await POST(makeRequest({ password: 'test' }));
    const data = await res.json();
    expect(res.status).toBe(401);
    expect(data.error).toBe('Invalid credentials');
  });

  it('returns 401 for missing password', async () => {
    const res = await POST(makeRequest({ username: 'admin' }));
    const data = await res.json();
    expect(res.status).toBe(401);
    expect(data.error).toBe('Invalid credentials');
  });

  it('returns 401 when user not found', async () => {
    mockFindByUsername.mockResolvedValue(null);

    const res = await POST(makeRequest({ username: 'admin', password: 'password123' }));
    const data = await res.json();
    expect(res.status).toBe(401);
    expect(data.error).toBe('Invalid credentials');
  });

  it('returns 401 when password is wrong', async () => {
    mockFindByUsername.mockResolvedValue({
      id: 'user-1',
      username: 'admin',
      email: 'admin@test.com',
      passwordHash: '$2a$12$hashed',
      role: 'admin',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockCompare.mockResolvedValue(false as never);

    const res = await POST(makeRequest({ username: 'admin', password: 'wrongpass' }));
    const data = await res.json();
    expect(res.status).toBe(401);
    expect(data.error).toBe('Invalid credentials');
  });

  it('returns success and creates session on valid login', async () => {
    mockFindByUsername.mockResolvedValue({
      id: 'user-1',
      username: 'admin',
      email: 'admin@test.com',
      passwordHash: '$2a$12$hashed',
      role: 'admin',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockCompare.mockResolvedValue(true as never);

    const res = await POST(makeRequest({ username: 'admin', password: 'password123' }));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.userId).toBe('user-1');
    expect(data.data.username).toBe('admin');
    expect(data.data.role).toBe('admin');
    expect(mockCreateSession).toHaveBeenCalledWith('user-1', 'admin', 'admin');
  });
});
