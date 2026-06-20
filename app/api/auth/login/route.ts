import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { users } from '@/db/schema'
import { verifyPassword, generateToken, setAuthCookie } from '@/lib/auth'
import { eq } from 'drizzle-orm'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'email and password required' }, { status: 400 })
    }

    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1)
    if (!user) {
      return NextResponse.json({ error: 'invalid credentials' }, { status: 401 })
    }

    const ok = await verifyPassword(password, user.password_hash)
    if (!ok) {
      return NextResponse.json({ error: 'invalid credentials' }, { status: 401 })
    }

    const token = generateToken(user.id, user.role)
    const cookie = setAuthCookie(token)

    const res = NextResponse.json({ success: true, user: { id: user.id, email: user.email, full_name: user.full_name } })
    res.cookies.set(cookie)

    return res
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}