import { redirect } from 'next/navigation';
import { verifySession } from '@/lib/auth/session';
import { userRepository } from '@/db/repositories/user.repository';
import { AdminUsersSection } from '@/components/dashboard/admin-users-section';

export default async function UsersPage() {
  const session = await verifySession();
  if (!session || session.role !== 'admin') redirect('/dashboard');

  const users = await userRepository.listAll();
  const serializedUsers = users.map((u) => ({
    ...u,
    createdAt: new Date(u.createdAt).toISOString(),
    updatedAt: new Date(u.updatedAt).toISOString(),
  }));

  return <AdminUsersSection initialUsers={serializedUsers} currentUserId={session.userId} />;
}
