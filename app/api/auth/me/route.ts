import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role } })
  } catch (err: any) {
    console.error('Error in /api/auth/me:', err)
    return NextResponse.json({ error: 'server error', details: err.message }, { status: 500 })
  }
}