import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

type TokenResponse = {
  token: string | null;
};

export async function GET(): Promise<NextResponse<TokenResponse>> {
  const token = cookies().get('auth_token')?.value;
  const secret = process.env.JWT_SECRET;

  if (!token || !secret) {
    return NextResponse.json({ token: null }, { status: 401 });
  }

  try {
    await jwtVerify(token, new TextEncoder().encode(secret));
    return NextResponse.json({ token });
  } catch (error) {
    console.warn('token lookup failed', error);
    return NextResponse.json({ token: null }, { status: 401 });
  }
}


