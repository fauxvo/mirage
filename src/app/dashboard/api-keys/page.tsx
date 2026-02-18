import { redirect } from 'next/navigation';
import { verifySession } from '@/lib/auth/session';
import { apiKeyRepository } from '@/db/repositories/api-key.repository';
import { ApiKeysSection } from '@/components/dashboard/api-keys-section';

export default async function ApiKeysPage() {
  const session = await verifySession();
  if (!session || session.role !== 'admin') redirect('/dashboard');

  const keys = await apiKeyRepository.listAll();
  const serializedKeys = keys.map((k) => ({
    id: k.id,
    name: k.name,
    keyPrefix: k.keyPrefix,
    revokedAt: k.revokedAt ? new Date(k.revokedAt).toISOString() : null,
    createdAt: new Date(k.createdAt).toISOString(),
  }));

  return <ApiKeysSection initialKeys={serializedKeys} />;
}
