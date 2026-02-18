import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock dependencies before imports
vi.mock('@/lib/auth/seed', () => ({
  ensureAdminSeeded: vi.fn(),
}));

vi.mock('@/lib/auth/session', () => ({
  createSession: vi.fn(),
}));

vi.mock('@/db/repositories/admin-user.repository', () => ({
  adminUserRepository: {
    findByUsername: vi.fn(),
  },
}));

vi.mock('bcryptjs', () => ({
  compare: vi.fn(),
}));

import { POST } from './route';
import { adminUserRepository } from '@/db/repositories/admin-user.repository';
import { createSession } from '@/lib/auth/session';
import { compare } from 'bcryptjs';

const mockFindByUsername = vi.mocked(adminUserRepository.findByUsername);
const mockCompare = vi.mocked(compare);
const mockCreateSession = vi.mocked(createSession);

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost:4444/api/admin/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/admin/auth/login', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns 401 for invalid JSON', async () => {
    const req = new NextRequest('http://localhost:4444/api/admin/auth/login', {
      method: 'POST',
      body: 'not json',
    });
    const res = await POST(req);
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.success).toBe(false);
  });

  it('returns 401 for missing credentials', async () => {
    const res = await POST(makeRequest({}));
    const data = await res.json();
    expect(res.status).toBe(401);
    expect(data.success).toBe(false);
  });

  it('returns 401 for unknown user', async () => {
    mockFindByUsername.mockResolvedValue(null);

    const res = await POST(makeRequest({ username: 'unknown', password: 'pass123' }));
    const data = await res.json();
    expect(res.status).toBe(401);
    expect(data.error).toBe('Invalid credentials');
  });

  it('returns 401 for wrong password', async () => {
    mockFindByUsername.mockResolvedValue({
      id: 1,
      username: 'admin',
      passwordHash: '$2a$12$hash',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockCompare.mockResolvedValue(false as never);

    const res = await POST(makeRequest({ username: 'admin', password: 'wrong' }));
    const data = await res.json();
    expect(res.status).toBe(401);
    expect(data.error).toBe('Invalid credentials');
  });

  it('returns 200 and creates session on valid login', async () => {
    mockFindByUsername.mockResolvedValue({
      id: 1,
      username: 'admin',
      passwordHash: '$2a$12$hash',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockCompare.mockResolvedValue(true as never);
    mockCreateSession.mockResolvedValue('jwt-token');

    const res = await POST(makeRequest({ username: 'admin', password: 'correct' }));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.userId).toBe(1);
    expect(data.data.username).toBe('admin');
    expect(mockCreateSession).toHaveBeenCalledWith(1, 'admin');
  });
});
