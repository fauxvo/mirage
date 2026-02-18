import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth/session', () => ({
  createSession: vi.fn().mockResolvedValue('mock-token'),
}));

vi.mock('bcryptjs', () => ({
  hash: vi.fn().mockResolvedValue('$2a$12$hashed'),
}));

vi.mock('nanoid', () => ({
  nanoid: vi.fn().mockReturnValue('mock-nanoid-id-16'),
}));

vi.mock('@/db/repositories/user.repository', () => ({
  userRepository: {
    findByUsername: vi.fn(),
    findByEmail: vi.fn(),
    create: vi.fn(),
  },
}));

import { POST } from './route';
import { userRepository } from '@/db/repositories/user.repository';
import { createSession } from '@/lib/auth/session';

const mockFindByUsername = vi.mocked(userRepository.findByUsername);
const mockFindByEmail = vi.mocked(userRepository.findByEmail);
const mockCreate = vi.mocked(userRepository.create);
const mockCreateSession = vi.mocked(createSession);

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost:4444/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const validBody = {
  username: 'newuser',
  email: 'new@test.com',
  password: 'password123',
};

describe('POST /api/auth/register', () => {
  const originalEnv = process.env.ALLOW_REGISTRATION;

  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.ALLOW_REGISTRATION;
    mockCreateSession.mockResolvedValue('mock-token');
    mockFindByUsername.mockResolvedValue(null);
    mockFindByEmail.mockResolvedValue(null);
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.ALLOW_REGISTRATION = originalEnv;
    } else {
      delete process.env.ALLOW_REGISTRATION;
    }
  });

  it('returns 403 when registration is disabled', async () => {
    process.env.ALLOW_REGISTRATION = 'false';
    const res = await POST(makeRequest(validBody));
    const data = await res.json();
    expect(res.status).toBe(403);
    expect(data.error).toBe('Registration is disabled');
  });

  it('allows registration when ALLOW_REGISTRATION is not set', async () => {
    mockCreate.mockResolvedValue({
      id: 'mock-nanoid-id-16',
      username: 'newuser',
      email: 'new@test.com',
      passwordHash: '$2a$12$hashed',
      role: 'user',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(201);
  });

  it('returns 400 for invalid JSON', async () => {
    const req = new NextRequest('http://localhost:4444/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    });
    const res = await POST(req);
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toBe('Invalid JSON');
  });

  it('returns 400 for missing fields', async () => {
    const res = await POST(makeRequest({ username: 'test' }));
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.success).toBe(false);
  });

  it('returns 400 for short username', async () => {
    const res = await POST(makeRequest({ ...validBody, username: 'ab' }));
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toContain('at least 3');
  });

  it('returns 400 for invalid username characters', async () => {
    const res = await POST(makeRequest({ ...validBody, username: 'user name!' }));
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toContain('alphanumeric');
  });

  it('returns 400 for invalid email', async () => {
    const res = await POST(makeRequest({ ...validBody, email: 'not-an-email' }));
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toContain('email');
  });

  it('returns 400 for short password', async () => {
    const res = await POST(makeRequest({ ...validBody, password: 'short' }));
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toContain('at least 8');
  });

  it('returns 409 when username already exists', async () => {
    mockFindByUsername.mockResolvedValue({
      id: 'existing',
      username: 'newuser',
      email: 'other@test.com',
      passwordHash: '$2a$12$hashed',
      role: 'user',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await POST(makeRequest(validBody));
    const data = await res.json();
    expect(res.status).toBe(409);
    expect(data.error).toBe('Username already exists');
  });

  it('returns 409 when email already in use', async () => {
    mockFindByEmail.mockResolvedValue({
      id: 'existing',
      username: 'other',
      email: 'new@test.com',
      passwordHash: '$2a$12$hashed',
      role: 'user',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await POST(makeRequest(validBody));
    const data = await res.json();
    expect(res.status).toBe(409);
    expect(data.error).toBe('Email already in use');
  });

  it('normalizes email to lowercase', async () => {
    mockCreate.mockResolvedValue({
      id: 'mock-nanoid-id-16',
      username: 'newuser',
      email: 'new@test.com',
      passwordHash: '$2a$12$hashed',
      role: 'user',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await POST(makeRequest({ ...validBody, email: 'New@Test.COM' }));
    expect(res.status).toBe(201);
    expect(mockFindByEmail).toHaveBeenCalledWith('new@test.com');
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ email: 'new@test.com' }));
  });

  it('creates user and sets session on success', async () => {
    mockCreate.mockResolvedValue({
      id: 'mock-nanoid-id-16',
      username: 'newuser',
      email: 'new@test.com',
      passwordHash: '$2a$12$hashed',
      role: 'user',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await POST(makeRequest(validBody));
    const data = await res.json();
    expect(res.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('mock-nanoid-id-16');
    expect(data.data.username).toBe('newuser');
    expect(data.data.email).toBe('new@test.com');
    expect(data.data.role).toBe('user');
    expect(mockCreateSession).toHaveBeenCalledWith('mock-nanoid-id-16', 'newuser', 'user');
  });
});
