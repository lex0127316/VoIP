'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { login } from '@/lib/auth/client';

export default function LoginPage(): JSX.Element {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState('admin@example.com');
  const [password, setPassword] = useState('changeme');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await login({ email, password });
      const redirectTo = params.get('redirect') ?? '/dashboard';
      router.replace(redirectTo);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication failed';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6">
      <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/60 p-8 shadow-2xl shadow-slate-900/50 backdrop-blur">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-widest text-sky-400">VoIP Ops Center</p>
          <h1 className="text-2xl font-semibold text-white">Sign in to continue</h1>
          <p className="text-sm text-slate-400">Use your platform credentials. Tokens are issued via JWT and stored in an HTTP-only cookie.</p>
        </div>

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <label className="flex flex-col text-sm text-slate-200">
            Email
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              autoComplete="email"
              required
              className="mt-2 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white shadow-inner focus:border-sky-500 focus:outline-none"
            />
          </label>
          <label className="flex flex-col text-sm text-slate-200">
            Password
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              autoComplete="current-password"
              required
              className="mt-2 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white shadow-inner focus:border-sky-500 focus:outline-none"
            />
          </label>
          {error && <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</div>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-sky-500 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="mt-6 text-xs text-slate-500">
          Looking for API access? Authenticate with OAuth via the Rust API service and exchange the JWT with the signaling
          gateway for WebRTC sessions.
        </p>
      </div>
    </main>
  );
}

