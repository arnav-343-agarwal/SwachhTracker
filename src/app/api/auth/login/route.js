import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import User from '@/lib/db/userModel';
import { signJwt } from '@/lib/auth/jwt';
import { connectToDatabase } from '@/lib/db/connection';

export async function POST(request) {
  await connectToDatabase();
  const { email, username, password } = await request.json();
  if ((!email && !username) || !password) {
    return NextResponse.json({ error: 'Email/username and password required.' }, { status: 400 });
  }
  try {
    const user = await User.findOne(email ? { email } : { username });
    if (!user) {
      return NextResponse.json({ error: 'Invalid credentials.' }, { status: 401 });
    }
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: 'Invalid credentials.' }, { status: 401 });
    }
    const token = signJwt({ _id: user._id, username: user.username, email: user.email, isAdmin: user.isAdmin });
    const res = NextResponse.json({ success: true, user: { _id: user._id, username: user.username, email: user.email, isAdmin: user.isAdmin } });
    res.cookies.set('token', token, { httpOnly: true, path: '/', sameSite: 'lax', maxAge: 60 * 60 * 24 * 7 });
    return res;
  } catch (err) {
    return NextResponse.json({ error: 'Login failed.' }, { status: 500 });
  }
} 