import { redirect } from 'next/navigation';
import { verifySession } from '@/lib/auth/session';
import { ensureAdminSeeded } from '@/lib/auth/seed';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await ensureAdminSeeded();
  const session = await verifySession();

  if (!session) {
    redirect('/login?redirect=/dashboard');
  }

  return (
    <DashboardShell username={session.username} role={session.role} userId={session.userId}>
      {children}
    </DashboardShell>
  );
}
