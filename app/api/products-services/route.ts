import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { products_services } from '@/db/schema';
import { getAuthenticatedUser } from '@/utils/apiAuth';
import { newId } from '@/lib/id';
import { eq, and, asc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { user, error: authError } = await getAuthenticatedUser(request);
  if (authError) return authError;

  const id = request.nextUrl.searchParams.get('id');

  try {
    if (id) {
      const [row] = await db.select().from(products_services)
        .where(and(eq(products_services.id, id), eq(products_services.user_id, user.id))).limit(1);
      if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json({ success: true, data: row });
    }

    const rows = await db.select().from(products_services)
      .where(and(eq(products_services.user_id, user.id), eq(products_services.is_active, true)))
      .orderBy(asc(products_services.name));

    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch products/services' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { user, error: authError } = await getAuthenticatedUser(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const { name, description, type, sku, price, cost, category_id, account_id, tax_rate, is_taxable } = body;
    if (!name || !type) return NextResponse.json({ error: 'name and type are required' }, { status: 400 });

    const [row] = await db.insert(products_services).values({
      id: newId(),
      user_id: user.id,
      name,
      description: description ?? null,
      type,
      sku: sku ?? null,
      price: price ?? 0,
      cost: cost ?? 0,
      category_id: category_id ?? null,
      account_id: account_id ?? null,
      tax_rate: tax_rate ?? 0,
      is_taxable: is_taxable ?? true,
    }).returning();

    return NextResponse.json({ success: true, data: row }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create product/service' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const { user, error: authError } = await getAuthenticatedUser(request);
  if (authError) return authError;

  try {
    const { id, ...updates } = await request.json();
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const [row] = await db.update(products_services)
      .set({ ...updates, updated_at: new Date().toISOString() })
      .where(and(eq(products_services.id, id), eq(products_services.user_id, user.id)))
      .returning();

    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true, data: row });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update product/service' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const { user, error: authError } = await getAuthenticatedUser(request);
  if (authError) return authError;

  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  await db.update(products_services)
    .set({ is_active: false, updated_at: new Date().toISOString() })
    .where(and(eq(products_services.id, id), eq(products_services.user_id, user.id)));

  return NextResponse.json({ success: true });
}