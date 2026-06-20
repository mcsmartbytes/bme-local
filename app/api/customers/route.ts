import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { customers } from '@/db/schema';
import { getAuthenticatedUser } from '@/utils/apiAuth';
import { newId } from '@/lib/id';
import { eq, and, asc } from 'drizzle-orm';
import { listRows } from '@/lib/drizzle-list';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { user, error: authError } = await getAuthenticatedUser(request);
  if (authError) return authError;

  const searchParams = request.nextUrl.searchParams;
  const customerId = searchParams.get('id');
  const page = Math.max(1, Number(searchParams.get('page') || 1));
  const pageSize = Math.min(500, Math.max(1, Number(searchParams.get('pageSize') || 100)));

  try {
    if (customerId) {
      const [row] = await db.select().from(customers)
        .where(and(eq(customers.id, customerId), eq(customers.user_id, user.id)))
        .limit(1);
      if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json({ success: true, data: row });
    }

    const result = await listRows({
      table: customers,
      where: and(eq(customers.user_id, user.id), eq(customers.is_active, true)),
      orderBy: asc(customers.name),
      page,
      pageSize,
    });

    return NextResponse.json({
      success: true,
      data: result.rows,
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
    });
  } catch (error) {
    console.error('Error fetching customers:', error);
    return NextResponse.json({ error: 'Failed to fetch customers' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { user, error: authError } = await getAuthenticatedUser(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const { name, email, phone, company, address, city, state, zip, country, notes } = body;
    if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });

    const id = newId();
    const [row] = await db.insert(customers).values({
      id,
      user_id: user.id,
      name,
      email: email ?? null,
      phone: phone ?? null,
      company: company ?? null,
      address: address ?? null,
      city: city ?? null,
      state: state ?? null,
      zip: zip ?? null,
      country: country ?? 'United States',
      notes: notes ?? null,
    }).returning();

    return NextResponse.json({ success: true, data: row }, { status: 201 });
  } catch (error) {
    console.error('Error creating customer:', error);
    return NextResponse.json({ error: 'Failed to create customer' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const { user, error: authError } = await getAuthenticatedUser(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const { id, ...updates } = body;
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const [row] = await db.update(customers)
      .set({ ...updates, updated_at: new Date().toISOString() })
      .where(and(eq(customers.id, id), eq(customers.user_id, user.id)))
      .returning();

    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true, data: row });
  } catch (error) {
    console.error('Error updating customer:', error);
    return NextResponse.json({ error: 'Failed to update customer' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const { user, error: authError } = await getAuthenticatedUser(request);
  if (authError) return authError;

  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  try {
    await db.update(customers)
      .set({ is_active: false, updated_at: new Date().toISOString() })
      .where(and(eq(customers.id, id), eq(customers.user_id, user.id)));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting customer:', error);
    return NextResponse.json({ error: 'Failed to delete customer' }, { status: 500 });
  }
}