import { nanoid } from 'nanoid';
import { hash } from 'bcryptjs';
import { userRepository } from '@/db/repositories/user.repository';

let seedPromise: Promise<void> | null = null;

/**
 * Ensures the initial admin user is created. Safe to call from multiple
 * code paths concurrently — all callers share a single execution via
 * promise singleton. On error the singleton resets so the next call retries.
 *
 * Note: always resolves (never rejects). Errors are logged and swallowed
 * so callers don't need try/catch — this is best-effort seeding.
 */
export function ensureAdminSeeded(): Promise<void> {
  if (!seedPromise) {
    seedPromise = doSeed().catch((err) => {
      // Reset so subsequent calls retry instead of returning the rejected promise
      seedPromise = null;
      console.error('[mirage] Admin seed failed:', err);
    });
  }
  return seedPromise;
}

async function doSeed(): Promise<void> {
  const adminCount = await userRepository.countAdmins();
  if (adminCount > 0) {
    console.log(`[mirage] Admin account exists (${adminCount} admin(s) found). Skipping seed.`);
    return;
  }

  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD;
  const email = process.env.ADMIN_EMAIL;

  if (!password || !email) {
    console.warn(
      '[mirage] No admin users exist and ADMIN_PASSWORD/ADMIN_EMAIL not set. ' +
        'Set these env vars to create the initial admin account.' +
        ` (ADMIN_EMAIL=${email ? 'set' : 'MISSING'}, ADMIN_PASSWORD=${password ? 'set' : 'MISSING'})`
    );
    return;
  }

  if (password.length < 8) {
    console.warn('[mirage] ADMIN_PASSWORD must be at least 8 characters. Skipping seed.');
    return;
  }

  console.log(`[mirage] No admin users found. Seeding admin account: ${username} (${email})`);
  const passwordHash = await hash(password, 12);
  await userRepository.create({
    id: nanoid(16),
    username,
    email,
    passwordHash,
    role: 'admin',
  });
  console.log(`[mirage] Seeded initial admin user: ${username}`);
}
