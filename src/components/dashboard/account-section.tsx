'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { User, Shield, Calendar, Lock, Pencil, Check, X } from 'lucide-react';

interface AccountSectionProps {
  username: string;
  email: string;
  role: string;
  createdAt: string;
}

export function AccountSection({ username, email, role, createdAt }: AccountSectionProps) {
  const router = useRouter();

  // Username editing
  const [editingUsername, setEditingUsername] = useState(false);
  const [newUsername, setNewUsername] = useState(username);
  const [usernameError, setUsernameError] = useState('');
  const [usernameLoading, setUsernameLoading] = useState(false);

  // Password change
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleUsernameSubmit() {
    const trimmed = newUsername.trim();
    if (trimmed === username) {
      setEditingUsername(false);
      return;
    }

    setUsernameError('');
    setUsernameLoading(true);
    try {
      const res = await fetch('/api/auth/username', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: trimmed }),
      });
      const data = await res.json();
      if (!data.success) {
        setUsernameError(data.error);
        return;
      }
      setEditingUsername(false);
      router.refresh();
    } catch {
      setUsernameError('Network error');
    } finally {
      setUsernameLoading(false);
    }
  }

  function handleUsernameCancel() {
    setEditingUsername(false);
    setNewUsername(username);
    setUsernameError('');
  }

  async function handlePasswordChange(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error);
        return;
      }
      setSuccess('Password updated successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }

  const formattedDate = new Date(createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-lg font-semibold text-white/90 mb-1">Account</h1>
        <p className="text-sm text-white/30">Your profile and security settings.</p>
      </div>

      {/* Profile info */}
      <div className="rounded-lg border border-white/[0.06] overflow-hidden mb-8">
        <div className="px-4 py-3 border-b border-white/[0.04]">
          <h2 className="text-xs font-medium tracking-wide uppercase text-white/40">Profile</h2>
        </div>
        <div className="divide-y divide-white/[0.04]">
          <div className="flex items-center gap-3 px-4 py-3">
            <User className="w-4 h-4 text-white/20 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] text-white/25 uppercase tracking-wide">Username</p>
              {editingUsername ? (
                <div className="mt-1">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newUsername}
                      onChange={(e) => {
                        setNewUsername(e.target.value);
                        setUsernameError('');
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleUsernameSubmit();
                        if (e.key === 'Escape') handleUsernameCancel();
                      }}
                      disabled={usernameLoading}
                      autoFocus
                      className="w-full max-w-[200px] px-2 py-1 bg-white/[0.04] border border-white/[0.12] rounded text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/25 transition-colors"
                    />
                    <button
                      onClick={handleUsernameSubmit}
                      disabled={usernameLoading}
                      className="p-1 rounded text-emerald-400/70 hover:text-emerald-400 hover:bg-white/[0.04] transition-colors disabled:opacity-50"
                      title="Save"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={handleUsernameCancel}
                      disabled={usernameLoading}
                      className="p-1 rounded text-white/30 hover:text-white/60 hover:bg-white/[0.04] transition-colors"
                      title="Cancel"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {usernameError && (
                    <p className="mt-1 text-[10px] text-red-400">{usernameError}</p>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <p className="text-sm text-white/70">{username}</p>
                  <button
                    onClick={() => setEditingUsername(true)}
                    className="p-1 rounded text-white/20 hover:text-white/50 hover:bg-white/[0.04] transition-colors"
                    title="Edit username"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 px-4 py-3">
            <span className="w-4 h-4 flex items-center justify-center text-white/20 text-xs shrink-0">
              @
            </span>
            <div className="min-w-0">
              <p className="text-[10px] text-white/25 uppercase tracking-wide">Email</p>
              <p className="text-sm text-white/70">{email}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 px-4 py-3">
            <Shield className="w-4 h-4 text-white/20 shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] text-white/25 uppercase tracking-wide">Role</p>
              <p className="text-sm text-white/70 capitalize">{role}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 px-4 py-3">
            <Calendar className="w-4 h-4 text-white/20 shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] text-white/25 uppercase tracking-wide">Member since</p>
              <p className="text-sm text-white/70">{formattedDate}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Password change */}
      <div className="rounded-lg border border-white/[0.06] overflow-hidden">
        <div className="px-4 py-3 border-b border-white/[0.04] flex items-center gap-2">
          <Lock className="w-3.5 h-3.5 text-white/25" />
          <h2 className="text-xs font-medium tracking-wide uppercase text-white/40">
            Change Password
          </h2>
        </div>
        <form onSubmit={handlePasswordChange} className="p-4 space-y-3">
          {error && (
            <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">
              {error}
            </div>
          )}
          {success && (
            <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400">
              {success}
            </div>
          )}
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Current password"
            required
            className="w-full px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/20 transition-colors"
          />
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="New password (8+ characters)"
            required
            minLength={8}
            className="w-full px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/20 transition-colors"
          />
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm new password"
            required
            minLength={8}
            className="w-full px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/20 transition-colors"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-white text-black text-xs font-medium rounded-lg hover:bg-white/90 disabled:opacity-50 transition-all"
          >
            {loading ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
