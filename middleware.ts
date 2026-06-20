import { NextRequest, NextResponse } from 'next/server';

export const PUBLIC = [
  '/login',
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/logout',
  '/api/health',
  '/api/db/init',
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some(p => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next();
  }

  const cookieToken = req.cookies.get('bme_auth')?.value;
  const bearerToken = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? null;
  const token = cookieToken ?? bearerToken;

  if (!token) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', req.url));
  }

  return NextResponse.next();
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };