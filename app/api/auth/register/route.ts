import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { users } from '@/db/schema'
import { hashPassword } from '@/lib/auth'
import { eq } from 'drizzle-orm'

export async function POST(request: NextRequest) {
  try {
    const { email, password, full_name } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'email and password required' }, { status: 400 })
    }

    const existing = await db.select().from(users).where(eq(users.email, email)).limit(1)
    if (existing.length > 0) {
      return NextResponse.json({ error: 'user exists' }, { status: 409 })
    }

    const hash = await hashPassword(password)

    const [user] = await db.insert(users).values({
      email,
      password_hash: hash,
      full_name: full_name || 'Local User',
    }).returning()

    return NextResponse.json({ success: true, user: { id: user.id, email: user.email } })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}