// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

export async function GET(req: NextRequest) {
  const token = req.cookies.get('auth_token')?.value;
  if (!token) return NextResponse.json({ session: null });
  const secret = process.env.JWT_SECRET;
  if (!secret) return NextResponse.json({ session: null });
  try {
    const decoder = new TextEncoder();
    const { payload } = await jwtVerify(token, decoder.encode(secret));
    return NextResponse.json({
      session: {
        userId: payload.sub,
        tenantId: (payload as any).tenant_id,
        exp: payload.exp,
        iat: payload.iat,
      },
    });
  } catch {
    return NextResponse.json({ session: null });
  }
}


