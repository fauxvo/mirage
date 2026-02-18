import { verifySession } from '@/lib/auth/session';
import { userRepository } from '@/db/repositories/user.repository';
import { AccountSection } from '@/components/dashboard/account-section';

export default async function AccountPage() {
  const session = await verifySession();
  if (!session) return null;

  const user = await userRepository.findById(session.userId);
  if (!user) return null;

  return (
    <AccountSection
      username={user.username}
      email={user.email}
      role={user.role}
      createdAt={new Date(user.createdAt).toISOString()}
    />
  );
}
