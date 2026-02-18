import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ensureAdminSeeded } from '@/lib/auth/seed';
import { verifySession } from '@/lib/auth/session';
import { AdminLogoutButton } from '@/components/admin/admin-logout-button';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await ensureAdminSeeded();
  const session = await verifySession();

  if (!session) {
    redirect('/login?redirect=/admin');
  }

  if (session.role !== 'admin') {
    redirect('/');
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <main className="flex-1 max-w-4xl w-full mx-auto px-6 py-8">{children}</main>
      <footer className="border-t border-white/[0.06]">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <Link href="/" className="text-white/30 hover:text-white/50 transition-colors">
              Mirage
            </Link>
            <span className="text-white/15">/</span>
            <Link href="/admin" className="text-white/70 font-medium">
              Admin
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs text-white/30">{session.username}</span>
            <AdminLogoutButton />
          </div>
        </div>
      </footer>
    </div>
  );
}
