import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { cookies } from 'next/headers'
import type { NextRequest } from 'next/server'
import { db } from '@/db'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'

const JWT_SECRET = process.env.JWT_SECRET || 'bme-local-dev-secret-change-in-production'
const COOKIE_NAME = 'bme_auth'

export const hashPassword = (p: string) => bcrypt.hash(p, 12)
export const verifyPassword = (p: string, h: string) => bcrypt.compare(p, h)

export function generateToken(userId: number, role: string) {
  return jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: '7d' })
}

export function verifyToken(token: string): { userId: number; role: string } | null {
  try { return jwt.verify(token, JWT_SECRET) as { userId: number; role: string } }
  catch { return null }
}

export async function getCurrentUser() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value
    if (!token) return null
    const payload = verifyToken(token)
    if (!payload || payload.userId == null) return null
    const userId = Number(payload.userId)
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
    return user ?? null
  } catch (err) {
    console.error('getCurrentUser error:', err)
    return null
  }
}

// For API routes called by mobile (Bearer token) or web (cookie)
export async function getRequestUser(req: NextRequest) {
  const cookieToken = req.cookies.get(COOKIE_NAME)?.value
  const bearerToken = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? null
  const token = cookieToken ?? bearerToken
  if (!token) return null
  const payload = verifyToken(token)
  if (!payload) return null
  const [user] = await db.select().from(users).where(eq(users.id, payload.userId)).limit(1)
  return user ?? null
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
  }
}

export function clearAuthCookie() {
  return { name: COOKIE_NAME, value: '', maxAge: 0, path: '/' }
}