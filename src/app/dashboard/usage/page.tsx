import { redirect } from 'next/navigation';
import { verifySession } from '@/lib/auth/session';
import { AdminUsageSection } from '@/components/dashboard/admin-usage-section';

export default async function UsagePage() {
  const session = await verifySession();
  if (!session || session.role !== 'admin') redirect('/dashboard');

  return <AdminUsageSection />;
}
