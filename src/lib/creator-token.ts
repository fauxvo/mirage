import { nanoid } from 'nanoid';

export function generateSessionId(): string {
  return nanoid(12);
}

export function generateAdminToken(): string {
  return nanoid(32);
}

export function validateAdminToken(provided: string | null, expected: string): boolean {
  if (!provided) return false;
  return provided === expected;
}
