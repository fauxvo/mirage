import { nanoid } from 'nanoid';
import { hash } from 'bcryptjs';
import { userRepository } from '@/db/repositories/user.repository';

let seeded = false;

export async function ensureAdminSeeded(): Promise<void> {
  if (seeded) return;

  try {
    const adminCount = await userRepository.countAdmins();
    if (adminCount > 0) {
      console.log(`[mirage] Admin account exists (${adminCount} admin(s) found). Skipping seed.`);
      seeded = true;
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
      seeded = true;
      return;
    }

    if (password.length < 8) {
      console.warn(
        `[mirage] ADMIN_PASSWORD must be at least 8 characters (got ${password.length}). Skipping seed.`
      );
      seeded = true;
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
    seeded = true;
  } catch (err) {
    // Don't set seeded=true on error so it can retry next request
    console.error('[mirage] Admin seed failed:', err);
  }
}
