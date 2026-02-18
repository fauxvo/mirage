import { hash } from 'bcryptjs';
import { adminUserRepository } from '@/db/repositories/admin-user.repository';

let seeded = false;

export async function ensureAdminSeeded(): Promise<void> {
  if (seeded) return;
  seeded = true;

  const count = await adminUserRepository.count();
  if (count > 0) return;

  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;

  if (!username || !password) {
    console.warn(
      '[mirage] No admin users exist and ADMIN_USERNAME/ADMIN_PASSWORD not set. ' +
        'Set these env vars to create the initial admin account.'
    );
    return;
  }

  if (password.length < 8) {
    console.warn('[mirage] ADMIN_PASSWORD must be at least 8 characters. Skipping seed.');
    return;
  }

  const passwordHash = await hash(password, 12);
  await adminUserRepository.create({ username, passwordHash });
  console.log(`[mirage] Seeded initial admin user: ${username}`);
}
