'use client';

import { Key } from 'lucide-react';
import { ApiKeyList } from '@/components/admin/api-key-list';

interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export function ApiKeysSection({
  initialKeys,
  isAdmin,
}: {
  initialKeys: ApiKey[];
  isAdmin: boolean;
}) {
  return (
    <div>
      <div className="mb-8">
        <div className="flex items-center gap-2.5 mb-1">
          <Key className="w-4 h-4 text-white/30" />
          <h1 className="text-lg font-semibold text-white/90">API Keys</h1>
        </div>
        <p className="text-sm text-white/30">
          {isAdmin
            ? 'Manage all API keys for programmatic session creation and management.'
            : 'Manage your API keys for programmatic session creation.'}
        </p>
      </div>

      <ApiKeyList
        initialKeys={initialKeys}
        apiEndpoint={isAdmin ? '/api/admin/api-keys' : '/api/keys'}
      />
    </div>
  );
}
