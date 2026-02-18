'use client';

import { useState, FormEvent } from 'react';
import { User, Shield, Calendar, Lock } from 'lucide-react';

interface AccountSectionProps {
  username: string;
  email: string;
  role: string;
  createdAt: string;
}

export function AccountSection({ username, email, role, createdAt }: AccountSectionProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

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
            <User className="w-4 h-4 text-white/20" />
            <div className="min-w-0">
              <p className="text-[10px] text-white/25 uppercase tracking-wide">Username</p>
              <p className="text-sm text-white/70">{username}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 px-4 py-3">
            <span className="w-4 h-4 flex items-center justify-center text-white/20 text-xs">
              @
            </span>
            <div className="min-w-0">
              <p className="text-[10px] text-white/25 uppercase tracking-wide">Email</p>
              <p className="text-sm text-white/70">{email}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 px-4 py-3">
            <Shield className="w-4 h-4 text-white/20" />
            <div className="min-w-0">
              <p className="text-[10px] text-white/25 uppercase tracking-wide">Role</p>
              <p className="text-sm text-white/70 capitalize">{role}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 px-4 py-3">
            <Calendar className="w-4 h-4 text-white/20" />
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
