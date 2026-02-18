import { redirect } from 'next/navigation';
import { verifySession } from '@/lib/auth/session';
import { apiKeyRepository } from '@/db/repositories/api-key.repository';
import { ApiKeysSection } from '@/components/dashboard/api-keys-section';

export default async function ApiKeysPage() {
  const session = await verifySession();
  if (!session) redirect('/login');

  const isAdmin = session.role === 'admin';
  const keys = isAdmin
    ? await apiKeyRepository.listAll()
    : await apiKeyRepository.listByUser(session.userId);

  const serializedKeys = keys.map((k) => ({
    id: k.id,
    name: k.name,
    keyPrefix: k.keyPrefix,
    lastUsedAt: k.lastUsedAt ? new Date(k.lastUsedAt).toISOString() : null,
    revokedAt: k.revokedAt ? new Date(k.revokedAt).toISOString() : null,
    createdAt: new Date(k.createdAt).toISOString(),
  }));

  return <ApiKeysSection initialKeys={serializedKeys} isAdmin={isAdmin} />;
}
