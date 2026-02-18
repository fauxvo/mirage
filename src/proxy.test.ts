import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('jose', () => ({
  jwtVerify: vi.fn(),
}));

import { proxy } from './proxy';
import { jwtVerify } from 'jose';

const mockJwtVerify = vi.mocked(jwtVerify);

function makeRequest(pathname: string, token?: string): NextRequest {
  const url = `http://localhost:4444${pathname}`;
  const req = new NextRequest(url);
  if (token) {
    req.cookies.set('mirage-session', token);
  }
  return req;
}

describe('proxy', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetAllMocks();
    process.env.JWT_SECRET = 'test-secret';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('public routes', () => {
    it.each(['/', '/login', '/register'])('allows %s without auth', async (path) => {
      const res = await proxy(makeRequest(path));
      expect(res.status).toBe(200);
    });

    it.each([
      '/v/abc123',
      '/api/auth/login',
      '/api/health',
      '/api/openapi',
      '/api/sessions/abc',
      '/api/textures/img.png',
      '/sessions',
      '/sessions/list',
      '/_next/static/chunk.js',
    ])('allows %s without auth', async (path) => {
      const res = await proxy(makeRequest(path));
      expect(res.status).toBe(200);
    });
  });

  describe('unauthenticated access', () => {
    it('redirects page requests to /login with redirect param', async () => {
      const res = await proxy(makeRequest('/some-page'));
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toContain('/login');
      expect(res.headers.get('location')).toContain('redirect=%2Fsome-page');
    });

    it('returns JSON 401 for API requests', async () => {
      const res = await proxy(makeRequest('/api/some-endpoint'));
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toBe('Authentication required');
    });

    it('redirects unauthenticated /dashboard to /login', async () => {
      const res = await proxy(makeRequest('/dashboard'));
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toContain('/login');
      expect(res.headers.get('location')).toContain('redirect=%2Fdashboard');
    });
  });

  describe('authenticated access', () => {
    beforeEach(() => {
      mockJwtVerify.mockResolvedValue({
        payload: { userId: 'user-1', username: 'testuser', role: 'user' },
        protectedHeader: { alg: 'HS256' },
      } as never);
    });

    it('allows authenticated user to access non-admin routes', async () => {
      const res = await proxy(makeRequest('/some-page', 'valid-token'));
      expect(res.status).toBe(200);
    });

    it('allows authenticated user to access /dashboard', async () => {
      const res = await proxy(makeRequest('/dashboard', 'valid-token'));
      expect(res.status).toBe(200);
    });

    it('allows authenticated user to access /dashboard/account', async () => {
      const res = await proxy(makeRequest('/dashboard/account', 'valid-token'));
      expect(res.status).toBe(200);
    });

    it('allows admin to access admin routes', async () => {
      mockJwtVerify.mockResolvedValue({
        payload: { userId: 'admin-1', username: 'admin', role: 'admin' },
        protectedHeader: { alg: 'HS256' },
      } as never);
      const res = await proxy(makeRequest('/admin', 'valid-token'));
      expect(res.status).toBe(200);
    });

    it('allows admin to access admin API routes', async () => {
      mockJwtVerify.mockResolvedValue({
        payload: { userId: 'admin-1', username: 'admin', role: 'admin' },
        protectedHeader: { alg: 'HS256' },
      } as never);
      const res = await proxy(makeRequest('/api/admin/api-keys', 'valid-token'));
      expect(res.status).toBe(200);
    });

    it('allows admin to access /api/users', async () => {
      mockJwtVerify.mockResolvedValue({
        payload: { userId: 'admin-1', username: 'admin', role: 'admin' },
        protectedHeader: { alg: 'HS256' },
      } as never);
      const res = await proxy(makeRequest('/api/users', 'valid-token'));
      expect(res.status).toBe(200);
    });
  });

  describe('admin-only routes', () => {
    beforeEach(() => {
      mockJwtVerify.mockResolvedValue({
        payload: { userId: 'user-1', username: 'testuser', role: 'user' },
        protectedHeader: { alg: 'HS256' },
      } as never);
    });

    it('redirects non-admin page request to /', async () => {
      const res = await proxy(makeRequest('/admin', 'valid-token'));
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toContain('/');
    });

    it('returns JSON 403 for non-admin API request', async () => {
      const res = await proxy(makeRequest('/api/admin/api-keys', 'valid-token'));
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toBe('Admin access required');
    });

    it('returns JSON 403 for non-admin accessing /api/users', async () => {
      const res = await proxy(makeRequest('/api/users', 'valid-token'));
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toBe('Admin access required');
    });
  });

  describe('invalid token', () => {
    beforeEach(() => {
      mockJwtVerify.mockRejectedValue(new Error('Invalid token'));
    });

    it('clears cookie and redirects for page requests', async () => {
      const res = await proxy(makeRequest('/some-page', 'invalid-token'));
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toContain('/login');
      const setCookie = res.headers.get('set-cookie');
      expect(setCookie).toContain('mirage-session');
    });

    it('clears cookie and returns 401 for API requests', async () => {
      const res = await proxy(makeRequest('/api/some-endpoint', 'invalid-token'));
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe('Authentication required');
    });
  });

  describe('missing secret', () => {
    it('clears cookie and returns 401 when no secret configured', async () => {
      delete process.env.JWT_SECRET;
      delete process.env.ADMIN_SESSION_SECRET;
      delete process.env.ADMIN_PASSWORD;

      const res = await proxy(makeRequest('/api/some-endpoint', 'some-token'));
      expect(res.status).toBe(401);
      const setCookie = res.headers.get('set-cookie');
      expect(setCookie).toContain('mirage-session');
    });
  });
});
