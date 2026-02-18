'use client';

import { Users } from 'lucide-react';
import { AdminUserList } from '@/components/admin/admin-user-list';

interface User {
  id: string;
  username: string;
  email: string;
  role: string;
  createdAt: string;
  updatedAt: string;
}

export function AdminUsersSection({
  initialUsers,
  currentUserId,
}: {
  initialUsers: User[];
  currentUserId: string;
}) {
  return (
    <div>
      <div className="mb-8">
        <div className="flex items-center gap-2.5 mb-1">
          <Users className="w-4 h-4 text-white/30" />
          <h1 className="text-lg font-semibold text-white/90">Users</h1>
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400/50 tracking-wide uppercase">
            Admin
          </span>
        </div>
        <p className="text-sm text-white/30">Manage user accounts and roles.</p>
      </div>

      <AdminUserList initialUsers={initialUsers} currentUserId={currentUserId} />
    </div>
  );
}
