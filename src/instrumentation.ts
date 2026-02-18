export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { ensureAdminSeeded } = await import('@/lib/auth/seed');
    await ensureAdminSeeded();
  }
}
