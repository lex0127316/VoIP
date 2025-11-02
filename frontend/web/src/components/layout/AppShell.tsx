'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { logout } from '@/lib/auth/client';
import { useSession } from '@/hooks/useSession';
import { useState, type ReactNode } from 'react';

type AppShellProps = {
  children: ReactNode;
};

type NavItem = {
  href: string;
  label: string;
  description: string;
};

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', description: 'Overview' },
  { href: '/callflow-builder', label: 'Callflow Builder', description: 'Design routing' },
  { href: '/softphone', label: 'Softphone', description: 'Live calls' },
  { href: '/analytics', label: 'Analytics', description: 'Insights' },
  { href: '/users', label: 'Users', description: 'Team access' },
];

export default function AppShell({ children }: AppShellProps): JSX.Element {
  const pathname = usePathname();
  const router = useRouter();
  const { session } = useSession();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    try {
      setIsSigningOut(true);
      await logout();
      router.replace('/login');
    } catch (error) {
      console.error('logout failed', error);
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="flex min-h-screen">
        <aside className="hidden w-64 flex-col border-r border-slate-200 bg-white p-6 md:flex">
          <div className="flex items-center justify-between">
            <span className="text-lg font-semibold">VoIP Control</span>
            <div className="h-2 w-2 rounded-full bg-emerald-500" title="Online" />
          </div>
          <p className="mt-2 text-sm text-slate-500">Manage call flows, softphone, and analytics.</p>
          <nav className="mt-8 space-y-2">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`block rounded-md px-4 py-3 text-sm transition ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <div className="font-medium">{item.label}</div>
                  <div className={isActive ? 'text-blue-100' : 'text-slate-400'}>{item.description}</div>
                </Link>
              );
            })}
          </nav>
        </aside>

        <div className="flex flex-1 flex-col">
          <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 shadow-sm">
            <div className="flex flex-col">
              <span className="text-sm uppercase tracking-wide text-slate-400">VoIP Platform</span>
              <span className="text-lg font-semibold capitalize">
                {NAV_ITEMS.find((item) => item.href === pathname)?.label ?? 'Overview'}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <div className="hidden items-center gap-3 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-sm md:flex">
                <div className="flex flex-col">
                  <span className="font-semibold">{session?.userId ?? 'Unknown user'}</span>
                  <span className="text-xs text-slate-400">Tenant {session?.tenantId ?? '-'}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleSignOut}
                disabled={isSigningOut}
                className="rounded-md border border-blue-500 bg-white px-4 py-2 text-sm font-medium text-blue-600 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSigningOut ? 'Signing out…' : 'Sign out'}
              </button>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto p-4 md:p-8">
            <div className="mx-auto w-full max-w-6xl space-y-6">{children}</div>
          </main>
        </div>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 border-t border-slate-200 bg-white px-4 py-2 shadow md:hidden">
        <div className="flex items-center justify-between text-sm font-medium text-slate-500">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-md px-2 py-1 ${isActive ? 'bg-blue-100 text-blue-600' : ''}`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}


