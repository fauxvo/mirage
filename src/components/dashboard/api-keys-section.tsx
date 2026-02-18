'use client';

import { Key } from 'lucide-react';
import { ApiKeyList } from '@/components/admin/api-key-list';

interface ApiKey {
  id: number;
  name: string;
  keyPrefix: string;
  revokedAt: string | null;
  createdAt: string;
}

export function ApiKeysSection({ initialKeys }: { initialKeys: ApiKey[] }) {
  return (
    <div>
      <div className="mb-8">
        <div className="flex items-center gap-2.5 mb-1">
          <Key className="w-4 h-4 text-white/30" />
          <h1 className="text-lg font-semibold text-white/90">API Keys</h1>
        </div>
        <p className="text-sm text-white/30">
          Manage API keys for programmatic session creation and management.
        </p>
      </div>

      <ApiKeyList initialKeys={initialKeys} />
    </div>
  );
}
