import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    app: 'books-made-easy-local',
    timestamp: new Date().toISOString(),
  });
}