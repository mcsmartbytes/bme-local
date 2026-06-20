import { NextResponse } from 'next/server';
import { getRequestUser } from '@/lib/auth';

export async function getAuthenticatedUser(request: Request) {
  const user = await getRequestUser(request as import('next/server').NextRequest);
  if (!user) {
    return {
      user: null,
      error: NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 },
      ),
    };
  }
  return { user, error: null };
}