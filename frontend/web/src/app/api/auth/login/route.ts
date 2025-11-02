import { createHash, randomUUID } from 'crypto';
import { SignJWT } from 'jose';
import { NextRequest, NextResponse } from 'next/server';

type LoginBody = {
  email?: string;
  password?: string;
};

type AuthPayload = {
  sub: string;
  tenant_id: string;
  iat: number;
  exp: number;
  nonce: string;
};

function deriveUserId(email: string): string {
  return createHash('sha256')
    .update(email)
    .digest('hex')
    .slice(0, 32)
    .replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5');
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = (await request.json()) as LoginBody;
  const email = body.email?.trim();
  const password = body.password ?? '';

  if (!email || !password) {
    return NextResponse.json({ error: 'Missing credentials' }, { status: 400 });
  }

  const demoPassword =
    process.env.DEMO_PASSWORD ?? (process.env.NODE_ENV === 'development' ? 'changeme' : undefined);

  if (!demoPassword) {
    return NextResponse.json({ error: 'DEMO_PASSWORD not configured' }, { status: 500 });
  }

  if (process.env.NODE_ENV !== 'development' && password !== demoPassword) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'JWT secret not configured' }, { status: 500 });
  }

  const now = Math.floor(Date.now() / 1000);
  const payload: AuthPayload = {
    sub: deriveUserId(email),
    tenant_id: process.env.DEMO_TENANT_ID ?? '00000000-0000-0000-0000-000000000001',
    iat: now,
    exp: now + 60 * 60 * 8,
    nonce: randomUUID(),
  };

  const jwt = await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .sign(new TextEncoder().encode(secret));

  const response = NextResponse.json({ ok: true });
  response.cookies.set('auth_token', jwt, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 8,
  });

  return response;
}

