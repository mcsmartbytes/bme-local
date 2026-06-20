import { NextResponse } from 'next/server'
import { clearAuthCookie } from '@/lib/auth'

export async function POST() {
  const cookie = clearAuthCookie()
  const res = NextResponse.json({ success: true })
  res.cookies.set(cookie)
  return res
}