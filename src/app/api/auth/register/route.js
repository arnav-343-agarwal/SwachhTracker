import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import User from '@/lib/db/userModel';
import { signJwt } from '@/lib/auth/jwt';
import { connectToDatabase } from '@/lib/db/connection';

export async function POST(request) {
  await connectToDatabase();
  const { username, email, password, isAdmin = false } = await request.json();
  if (!username || !email || !password) {
    return NextResponse.json({ error: 'All fields are required.' }, { status: 400 });
  }
  try {
    const existing = await User.findOne({ $or: [ { email }, { username } ] });
    if (existing) {
      return NextResponse.json({ error: 'User already exists.' }, { status: 409 });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ username, email, passwordHash, isAdmin });
    const token = signJwt({ _id: user._id, username: user.username, email: user.email, isAdmin: user.isAdmin });
    const res = NextResponse.json({ success: true, user: { _id: user._id, username: user.username, email: user.email, isAdmin: user.isAdmin } });
    res.cookies.set('token', token, { httpOnly: true, path: '/', sameSite: 'lax', maxAge: 60 * 60 * 24 * 7 });
    return res;
  } catch (err) {
    return NextResponse.json({ error: 'Registration failed.' }, { status: 500 });
  }
} 