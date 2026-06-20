import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

const JWT_SECRET = process.env.JWT_SECRET || 'bme-local-dev-secret-change-in-production';
const COOKIE_NAME = 'bme_auth';

export type AuthUser = {
  id: string;
  email: string;
  name: string | null;
  business_name: string | null;
};

export const hashPassword = (p: string) => bcrypt.hash(p, 12);
export const verifyPassword = (p: string, h: string) => bcrypt.compare(p, h);

export function generateToken(userId: string) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): { userId: string } | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: string };
    if (!payload?.userId) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) return null;
    const payload = verifyToken(token);
    if (!payload) return null;
    const [user] = await db.select({
      id: users.id,
      email: users.email,
      name: users.name,
      business_name: users.business_name,
    }).from(users).where(eq(users.id, payload.userId)).limit(1);
    return user ?? null;
  } catch (err) {
    console.error('getCurrentUser error:', err);
    return null;
  }
}

export async function getRequestUser(req: NextRequest): Promise<AuthUser | null> {
  const cookieToken = req.cookies.get(COOKIE_NAME)?.value;
  const bearerToken = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? null;
  const token = cookieToken ?? bearerToken;
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload) return null;
  const [user] = await db.select({
    id: users.id,
    email: users.email,
    name: users.name,
    business_name: users.business_name,
  }).from(users).where(eq(users.id, payload.userId)).limit(1);
  return user ?? null;
}

export function setAuthCookie(token: string) {
  return {
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  };
}

export function clearAuthCookie() {
  return { name: COOKIE_NAME, value: '', maxAge: 0, path: '/' };
}