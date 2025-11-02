// @ts-nocheck
import '../styles/globals.css';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'VoIP Platform',
  description: 'Modern web-based VoIP platform',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-100 text-slate-900 antialiased">{children}</body>
    </html>
  );
}


