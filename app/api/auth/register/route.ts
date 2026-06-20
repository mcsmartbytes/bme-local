import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { hashPassword, generateToken, setAuthCookie } from '@/lib/auth';
import { newId } from '@/lib/id';
import { eq } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    const { email, password, full_name, business_name } = await request.json();
    if (!email || !password) {
      return NextResponse.json({ error: 'email and password required' }, { status: 400 });
    }

    const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existing) {
      return NextResponse.json({ error: 'email already registered' }, { status: 400 });
    }

    const id = newId();
    const [user] = await db.insert(users).values({
      id,
      email,
      password_hash: await hashPassword(password),
      name: full_name ?? 'Bookkeeper',
      business_name: business_name ?? null,
    }).returning();

    const token = generateToken(user.id);
    const res = NextResponse.json({ success: true, user: { id: user.id, email: user.email, name: user.name } });
    res.cookies.set(setAuthCookie(token));
    return res;
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}