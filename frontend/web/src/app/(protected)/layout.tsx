import type { ReactNode } from 'react';
import AppShell from '@/components/layout/AppShell';
import { SessionProvider } from '@/hooks/useSession';

export default function ProtectedLayout({ children }: { children: ReactNode }): JSX.Element {
  return (
    <SessionProvider>
      <AppShell>{children}</AppShell>
    </SessionProvider>
  );
}


