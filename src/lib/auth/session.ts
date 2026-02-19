import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { cache } from 'react';

const COOKIE_NAME = 'mirage-session';
const EXPIRY_SECONDS = 24 * 60 * 60; // 24 hours

export interface SessionPayload {
  userId: string;
  username: string;
  role: 'admin' | 'user';
  exp: number;
}

export function getSecret(): Uint8Array {
  const secret =
    process.env.JWT_SECRET || process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD;
  if (!secret) throw new Error('JWT_SECRET (or ADMIN_SESSION_SECRET / ADMIN_PASSWORD) must be set');
  return new TextEncoder().encode(secret);
}

export async function encrypt(payload: {
  userId: string;
  username: string;
  role: 'admin' | 'user';
}): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${EXPIRY_SECONDS}s`)
    .sign(getSecret());
}

export async function decrypt(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function createSession(
  userId: string,
  username: string,
  role: 'admin' | 'user'
): Promise<string> {
  const token = await encrypt({ userId, username, role });
  const cookieStore = await cookies();
  const raw = process.env.SECURE_COOKIES;
  const secure =
    raw !== undefined && raw !== ''
      ? raw.toLowerCase() !== 'false'
      : process.env.NODE_ENV === 'production';

  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    maxAge: EXPIRY_SECONDS,
    path: '/',
  });
  return token;
}

export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export const verifySession = cache(async (): Promise<SessionPayload | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return decrypt(token);
});
