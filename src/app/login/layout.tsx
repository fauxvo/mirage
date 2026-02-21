import { redirect } from 'next/navigation';
import { verifySession } from '@/lib/auth/session';

export default async function LoginLayout({ children }: { children: React.ReactNode }) {
  const session = await verifySession();
  if (session) {
    redirect('/dashboard');
  }
  return <>{children}</>;
}
