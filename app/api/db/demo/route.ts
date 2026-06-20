import { NextResponse } from 'next/server';
import { db } from '@/db';
import { entities } from '@/db/schema';

export async function GET() {
  try {
    const rows = await db.select({ id: entities.id, name: entities.name }).from(entities).limit(10);

    return NextResponse.json({
      success: true,
      message: 'Demo route (expand as needed)',
      entities: rows,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}