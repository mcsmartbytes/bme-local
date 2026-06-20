import { NextResponse } from 'next/server';
import { db } from '@/db';
import { entities } from '@/db/schema';

export async function GET() {
  try {
    // Example: list or create a demo entity
    const result = await db.insert(entities).values({ name: 'Demo Local Entity' }).returning().catch(() => null);

    return NextResponse.json({
      success: true,
      message: 'Demo route (expand as needed)',
      inserted: result,
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}