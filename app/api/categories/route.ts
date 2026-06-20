import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { categories } from '@/db/schema';
import { getAuthenticatedUser } from '@/utils/apiAuth';
import { newId } from '@/lib/id';
import { eq, and, asc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { user, error: authError } = await getAuthenticatedUser(request);
  if (authError) return authError;

  const sp = request.nextUrl.searchParams;
  const categoryId = sp.get('id');
  const categoryType = sp.get('type');

  try {
    if (categoryId) {
      const [row] = await db.select().from(categories)
        .where(and(eq(categories.id, categoryId), eq(categories.user_id, user.id))).limit(1);
      if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json({ success: true, data: row });
    }

    let where = and(eq(categories.user_id, user.id), eq(categories.is_active, true))!;
    if (categoryType) where = and(where, eq(categories.type, categoryType))!;

    const rows = await db.select().from(categories).where(where).orderBy(asc(categories.name));
    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { user, error: authError } = await getAuthenticatedUser(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const { name, type, icon, color, tax_deductible, irs_category, description } = body;
    if (!name || !type) return NextResponse.json({ error: 'name and type are required' }, { status: 400 });

    const [row] = await db.insert(categories).values({
      id: newId(),
      user_id: user.id,
      name,
      type,
      icon: icon ?? null,
      color: color ?? null,
      tax_deductible: tax_deductible ?? false,
      irs_category: irs_category ?? null,
      description: description ?? null,
    }).returning();

    return NextResponse.json({ success: true, data: row }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create category' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const { user, error: authError } = await getAuthenticatedUser(request);
  if (authError) return authError;

  try {
    const { id, ...updates } = await request.json();
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const [row] = await db.update(categories)
      .set({ ...updates, updated_at: new Date().toISOString() })
      .where(and(eq(categories.id, id), eq(categories.user_id, user.id)))
      .returning();

    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true, data: row });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update category' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const { user, error: authError } = await getAuthenticatedUser(request);
  if (authError) return authError;

  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  await db.update(categories)
    .set({ is_active: false, updated_at: new Date().toISOString() })
    .where(and(eq(categories.id, id), eq(categories.user_id, user.id)));

  return NextResponse.json({ success: true });
}