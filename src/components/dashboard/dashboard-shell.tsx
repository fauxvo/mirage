'use client';

import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Layers,
  Key,
  Settings,
  Users,
  BarChart3,
  LogOut,
  ChevronLeft,
  Menu,
  X,
} from 'lucide-react';
import { useState } from 'react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'My Sets', href: '/dashboard', icon: Layers },
  { label: 'API Keys', href: '/dashboard/api-keys', icon: Key, adminOnly: true },
  { label: 'Account', href: '/dashboard/account', icon: Settings },
  { label: 'Users', href: '/dashboard/users', icon: Users, adminOnly: true },
  { label: 'Usage', href: '/dashboard/usage', icon: BarChart3, adminOnly: true },
];

export function DashboardShell({
  children,
  username,
  role,
  userId: _userId,
}: {
  children: React.ReactNode;
  username: string;
  role: string;
  userId: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isAdmin = role === 'admin';

  const visibleItems = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  function isActive(href: string) {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(href);
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Mobile header */}
      <div className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
        <Link href="/" className="text-sm font-semibold text-white/70">
          Mirage
        </Link>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-1.5 rounded text-white/40 hover:text-white/60 transition-colors"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile nav overlay */}
      {mobileOpen && (
        <div className="lg:hidden border-b border-white/[0.06] bg-black">
          <nav className="px-4 py-3 space-y-1">
            {visibleItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive(item.href)
                    ? 'text-white/90 bg-white/[0.06]'
                    : 'text-white/35 hover:text-white/60 hover:bg-white/[0.03]'
                }`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      )}

      <div className="flex">
        {/* Sidebar — desktop */}
        <aside className="hidden lg:flex flex-col w-56 min-h-screen border-r border-white/[0.06] sticky top-0">
          {/* Logo */}
          <div className="px-5 py-5 border-b border-white/[0.04]">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-white/40 hover:text-white/60 transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span className="text-xs">Back to Mirage</span>
            </Link>
          </div>

          {/* Nav */}
          <nav className="flex-1 px-3 py-4 space-y-0.5">
            {visibleItems.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${
                    active
                      ? 'text-white/90 bg-white/[0.06]'
                      : 'text-white/35 hover:text-white/55 hover:bg-white/[0.03]'
                  }`}
                >
                  <item.icon className={`w-4 h-4 ${active ? 'text-white/60' : ''}`} />
                  {item.label}
                  {item.adminOnly && (
                    <span className="ml-auto text-[9px] font-medium tracking-wide uppercase text-amber-400/40">
                      admin
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* User footer */}
          <div className="px-4 py-4 border-t border-white/[0.04]">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-xs text-white/60 truncate">{username}</p>
                <p className="text-[10px] text-white/20 mt-0.5">
                  {role === 'admin' ? 'Administrator' : 'User'}
                </p>
              </div>
              <button
                onClick={handleLogout}
                className="p-1.5 rounded text-white/20 hover:text-white/50 hover:bg-white/[0.04] transition-colors"
                title="Sign out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0">
          <div className="max-w-4xl mx-auto px-6 py-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
