import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { organizations } from '@/db/schema';
import { getAuthenticatedUser } from '@/utils/apiAuth';
import { newId } from '@/lib/id';
import { eq, and } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { user, error: authError } = await getAuthenticatedUser(request);
  if (authError) return authError;

  try {
    const rows = await db.select().from(organizations)
      .where(eq(organizations.created_by, user.id));
    return NextResponse.json({ success: true, data: rows });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch organizations' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { user, error: authError } = await getAuthenticatedUser(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const { name, industry_id, multi_entity, multi_location } = body;
    if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });

    const [row] = await db.insert(organizations).values({
      id: newId(),
      name,
      created_by: user.id,
      industry_id: industry_id ?? null,
      multi_entity: multi_entity ?? false,
      multi_location: multi_location ?? false,
    }).returning();

    return NextResponse.json({ success: true, data: row }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to create organization' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const { user, error: authError } = await getAuthenticatedUser(request);
  if (authError) return authError;

  try {
    const { id, ...updates } = await request.json();
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const [row] = await db.update(organizations)
      .set({ ...updates, updated_at: new Date().toISOString() })
      .where(and(eq(organizations.id, id), eq(organizations.created_by, user.id)))
      .returning();

    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true, data: row });
  } catch {
    return NextResponse.json({ error: 'Failed to update organization' }, { status: 500 });
  }
}