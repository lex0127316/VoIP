// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import { createHash } from 'crypto';

type Body = {
  email?: string;
  password?: string;
};

export async function POST(req: NextRequest) {
  const { email, password } = (await req.json()) as Body;
  if (!email || !password) {
    return NextResponse.json({ error: 'Missing credentials' }, { status: 400 });
  }

  // DEV: accept any credentials; in production call Rust API to validate
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  const encoder = new TextEncoder();
  const now = Math.floor(Date.now() / 1000);
  const iat = now;
  const exp = now + 60 * 60 * 8; // 8h

  // demo UUIDs stable per email hash (not secure)
  const userId = createHash('sha256').
    update(email).
    digest('hex').
    slice(0, 32).
    replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5');
  const tenantId = '00000000-0000-0000-0000-000000000001';

  const jwt = await new SignJWT({ sub: userId, tenant_id: tenantId, iat, exp })
    .setProtectedHeader({ alg: 'HS256' })
    .sign(encoder.encode(secret));

  const res = NextResponse.json({ ok: true });
  res.cookies.set('auth_token', jwt, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 8,
  });
  return res;
}


