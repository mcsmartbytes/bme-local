import { NextResponse } from 'next/server';
import { seedBmeDatabase } from '@/lib/seed-bme';

export async function GET() {
  try {
    const result = await seedBmeDatabase();
    return NextResponse.json(result);
  } catch (err: any) {
    console.error('DB init error:', err);
    return NextResponse.json({
      error: String(err),
      hint: 'Run `npx drizzle-kit push` to create tables before calling this.',
    }, { status: 500 });
  }
}