import { NextRequest, NextResponse } from 'next/server';
import { decrypt } from '@/lib/auth/session';

const COOKIE_NAME = 'mirage-admin-session';

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow login page and API auth routes
  if (pathname === '/admin/login' || pathname.startsWith('/api/admin/auth/')) {
    return NextResponse.next();
  }

  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.redirect(new URL('/admin/login', request.url));
  }

  const session = await decrypt(token);
  if (!session) {
    const response = NextResponse.redirect(new URL('/admin/login', request.url));
    response.cookies.delete(COOKIE_NAME);
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path((?!auth/).*)'],
};
