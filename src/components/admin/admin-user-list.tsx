'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, Plus } from 'lucide-react';

interface User {
  id: string;
  username: string;
  email: string;
  role: string;
  createdAt: string;
  updatedAt: string;
}

export function AdminUserList({
  initialUsers,
  currentUserId,
}: {
  initialUsers: User[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [showForm, setShowForm] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'user'>('user');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password, role }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error);
        return;
      }
      setUsers([...users, data.data]);
      setUsername('');
      setEmail('');
      setPassword('');
      setRole('user');
      setShowForm(false);
      router.refresh();
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this user?')) return;

    try {
      const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) {
        alert(data.error);
        return;
      }
      setUsers(users.filter((u) => u.id !== id));
      router.refresh();
    } catch {
      alert('Network error');
    }
  }

  const adminCount = users.filter((u) => u.role === 'admin').length;

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-white/[0.06] overflow-hidden">
        {users.map((user) => (
          <div
            key={user.id}
            className="flex items-center justify-between px-4 py-3 border-b border-white/[0.04] last:border-0"
          >
            <div className="flex items-center gap-3">
              <div>
                <span className="text-sm text-white/80">{user.username}</span>
                {user.id === currentUserId && (
                  <span className="ml-2 text-[10px] font-medium px-1.5 py-0.5 rounded bg-white/[0.06] text-white/30">
                    you
                  </span>
                )}
              </div>
              <span className="text-xs text-white/25">{user.email}</span>
              <span
                className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                  user.role === 'admin'
                    ? 'bg-amber-500/10 text-amber-400/60'
                    : 'bg-white/[0.04] text-white/25'
                }`}
              >
                {user.role}
              </span>
            </div>
            <button
              onClick={() => handleDelete(user.id)}
              disabled={
                user.id === currentUserId || (user.role === 'admin' && adminCount <= 1)
              }
              className="p-1.5 rounded text-white/20 hover:text-red-400 hover:bg-red-400/10 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
              title={
                user.id === currentUserId
                  ? 'Cannot delete yourself'
                  : user.role === 'admin' && adminCount <= 1
                    ? 'Cannot delete last admin'
                    : 'Delete user'
              }
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {showForm ? (
        <form onSubmit={handleCreate} className="space-y-3">
          {error && (
            <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">
              {error}
            </div>
          )}
          <div className="flex gap-2">
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              required
              minLength={3}
              className="flex-1 px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/20 transition-colors"
            />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              required
              className="flex-1 px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/20 transition-colors"
            />
          </div>
          <div className="flex gap-2">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password (8+ chars)"
              required
              minLength={8}
              className="flex-1 px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/20 transition-colors"
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as 'admin' | 'user')}
              className="px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-white focus:outline-none focus:border-white/20 transition-colors"
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-white text-black text-xs font-medium rounded-lg hover:bg-white/90 disabled:opacity-50 transition-all"
            >
              {loading ? 'Creating...' : 'Create User'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setError('');
              }}
              className="px-4 py-2 text-xs text-white/40 hover:text-white/60 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-1.5 text-xs text-white/30 hover:text-white/50 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add User
        </button>
      )}
    </div>
  );
}
