import { NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/jwt';

export async function GET(request) {
  const user = getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }
  return NextResponse.json({ success: true, user });
} 