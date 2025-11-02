'use client';

import type { Session } from '@/types/auth';

type Credentials = {
  email: string;
  password: string;
};

async function parseJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text) {
    return {} as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch (error) {
    throw new Error('Failed to parse server response');
  }
}

function buildError(res: Response, body?: { error?: string }): Error {
  const message = body?.error ?? `Request failed with status ${res.status}`;
  return new Error(message);
}

export async function login(credentials: Credentials): Promise<void> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(credentials),
  });

  if (!res.ok) {
    const body = await parseJson<{ error?: string }>(res);
    throw buildError(res, body);
  }
}

export async function logout(): Promise<void> {
  const res = await fetch('/api/auth/logout', { method: 'POST' });
  if (!res.ok) {
    const body = await parseJson<{ error?: string }>(res);
    throw buildError(res, body);
  }
}

export async function fetchSession(): Promise<Session | null> {
  const res = await fetch('/api/auth/session', { cache: 'no-store' });
  if (!res.ok) {
    return null;
  }

  const body = await parseJson<{ session: Session | null }>(res);
  return body.session ?? null;
}

export async function fetchAuthToken(): Promise<string | null> {
  const res = await fetch('/api/auth/token', { cache: 'no-store' });
  if (!res.ok) {
    return null;
  }

  const body = await parseJson<{ token?: string }>(res);
  return body.token ?? null;
}


