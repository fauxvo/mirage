import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const COOKIE_NAME = 'mirage-session';

const PUBLIC_PATHS = ['/', '/login', '/register'];

const PUBLIC_PREFIXES = [
  '/v/',
  '/api/auth/',
  '/api/health',
  '/api/openapi',
  '/api/sessions',
  '/api/textures/',
  '/sessions',
  '/_next/',
  '/favicon',
];

const ADMIN_PREFIXES = ['/admin', '/api/admin/', '/api/users'];

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isAdminOnly(pathname: string): boolean {
  return ADMIN_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isApiRoute(pathname: string): boolean {
  return pathname.startsWith('/api/');
}

function getSecret(): Uint8Array {
  const secret =
    process.env.JWT_SECRET || process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD;
  if (!secret) return new Uint8Array(0);
  return new TextEncoder().encode(secret);
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public routes — no auth needed
  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  // Get token from cookie
  const token = request.cookies.get(COOKIE_NAME)?.value;

  if (!token) {
    if (isApiRoute(pathname)) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Verify token
  const secret = getSecret();
  if (secret.length === 0) {
    const response = isApiRoute(pathname)
      ? NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
      : NextResponse.redirect(new URL('/login', request.url));
    response.cookies.delete(COOKIE_NAME);
    return response;
  }

  try {
    const { payload } = await jwtVerify(token, secret);
    const role = payload.role as string | undefined;

    // Admin-only routes
    if (isAdminOnly(pathname)) {
      if (role !== 'admin') {
        if (isApiRoute(pathname)) {
          return NextResponse.json(
            { success: false, error: 'Admin access required' },
            { status: 403 }
          );
        }
        return NextResponse.redirect(new URL('/', request.url));
      }
    }

    return NextResponse.next();
  } catch {
    // Invalid/expired token — clear cookie
    const response = isApiRoute(pathname)
      ? NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
      : NextResponse.redirect(new URL('/login', request.url));
    response.cookies.delete(COOKIE_NAME);
    return response;
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
