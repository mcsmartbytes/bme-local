import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { bookkeeper_firms } from '@/db/schema';
import { getAuthenticatedUser } from '@/utils/apiAuth';
import { getFirmByOwner } from '@/lib/firm';
import { newId } from '@/lib/id';
import { eq, and } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { user, error: authError } = await getAuthenticatedUser(request);
  if (authError) return authError;

  try {
    const firm = await getFirmByOwner(user.id);
    return NextResponse.json({ success: true, data: firm });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch firm' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { user, error: authError } = await getAuthenticatedUser(request);
  if (authError) return authError;

  try {
    const existing = await getFirmByOwner(user.id);
    if (existing) {
      return NextResponse.json({ error: 'You already have a firm' }, { status: 409 });
    }

    const body = await request.json();
    const { name, email, phone, address, city, state, zip } = body;
    if (!name) return NextResponse.json({ error: 'Firm name is required' }, { status: 400 });

    const [row] = await db.insert(bookkeeper_firms).values({
      id: newId(),
      owner_id: user.id,
      name,
      email: email ?? null,
      phone: phone ?? null,
      address: address ?? null,
      city: city ?? null,
      state: state ?? null,
      zip: zip ?? null,
    }).returning();

    return NextResponse.json({ success: true, data: row }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to create firm' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const { user, error: authError } = await getAuthenticatedUser(request);
  if (authError) return authError;

  try {
    const { id, ...updates } = await request.json();
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const [row] = await db.update(bookkeeper_firms)
      .set({ ...updates, updated_at: new Date().toISOString() })
      .where(and(eq(bookkeeper_firms.id, id), eq(bookkeeper_firms.owner_id, user.id)))
      .returning();

    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true, data: row });
  } catch {
    return NextResponse.json({ error: 'Failed to update firm' }, { status: 500 });
  }
}