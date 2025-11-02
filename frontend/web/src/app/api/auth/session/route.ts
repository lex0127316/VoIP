import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import type { SessionResponse } from '@/types/auth';

export async function GET(): Promise<NextResponse<SessionResponse>> {
  const token = cookies().get('auth_token')?.value;
  const secret = process.env.JWT_SECRET;

  if (!token || !secret) {
    return NextResponse.json({ session: null });
  }

  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    return NextResponse.json({
      session: {
        userId: String(payload.sub ?? ''),
        tenantId: String((payload as Record<string, unknown>)?.tenant_id ?? ''),
        exp: Number(payload.exp ?? 0),
        iat: Number(payload.iat ?? 0),
      },
    });
  } catch (error) {
    console.warn('session token verification failed', error);
    return NextResponse.json({ session: null });
  }
}

