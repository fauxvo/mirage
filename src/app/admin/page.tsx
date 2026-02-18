import { adminUserRepository } from '@/db/repositories/admin-user.repository';
import { apiKeyRepository } from '@/db/repositories/api-key.repository';
import { verifySession } from '@/lib/auth/session';
import { AdminUserList } from '@/components/admin/admin-user-list';
import { ApiKeyList } from '@/components/admin/api-key-list';

export default async function AdminDashboardPage() {
  const session = await verifySession();
  const [users, keys] = await Promise.all([
    adminUserRepository.listAll(),
    apiKeyRepository.listAll(),
  ]);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-lg font-semibold text-white/90 mb-1">Admin Dashboard</h1>
        <p className="text-sm text-white/30">Manage users and API keys for your Mirage instance.</p>
      </div>

      <section>
        <h2 className="text-sm font-medium text-white/60 mb-4">Admin Users</h2>
        <AdminUserList
          initialUsers={JSON.parse(JSON.stringify(users))}
          currentUserId={session!.userId}
        />
      </section>

      <section>
        <h2 className="text-sm font-medium text-white/60 mb-4">API Keys</h2>
        <ApiKeyList initialKeys={JSON.parse(JSON.stringify(keys))} />
      </section>
    </div>
  );
}
