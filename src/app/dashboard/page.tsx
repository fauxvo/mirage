import { verifySession } from '@/lib/auth/session';
import { SetsSection } from '@/components/dashboard/sets-section';

export default async function DashboardPage() {
  const session = await verifySession();
  return <SetsSection username={session?.username ?? ''} />;
}
