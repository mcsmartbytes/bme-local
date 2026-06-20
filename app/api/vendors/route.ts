import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { vendors } from '@/db/schema';
import { getAuthenticatedUser } from '@/utils/apiAuth';
import { newId } from '@/lib/id';
import { eq, and, asc } from 'drizzle-orm';
import { listRows } from '@/lib/drizzle-list';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { user, error: authError } = await getAuthenticatedUser(request);
  if (authError) return authError;

  const vendorId = request.nextUrl.searchParams.get('id');
  const page = Math.max(1, Number(request.nextUrl.searchParams.get('page') || 1));
  const pageSize = Math.min(500, Math.max(1, Number(request.nextUrl.searchParams.get('pageSize') || 100)));

  try {
    if (vendorId) {
      const [row] = await db.select().from(vendors)
        .where(and(eq(vendors.id, vendorId), eq(vendors.user_id, user.id)))
        .limit(1);
      if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json({ success: true, data: row });
    }

    const result = await listRows({
      table: vendors,
      where: and(eq(vendors.user_id, user.id), eq(vendors.is_active, true)),
      orderBy: asc(vendors.name),
      page,
      pageSize,
    });

    return NextResponse.json({ success: true, data: result.rows, page: result.page, pageSize: result.pageSize, total: result.total });
  } catch (error) {
    console.error('Error fetching vendors:', error);
    return NextResponse.json({ error: 'Failed to fetch vendors' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { user, error: authError } = await getAuthenticatedUser(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const { name, email, phone, company, address, city, state, zip, country, notes, tax_id } = body;
    if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });

    const [row] = await db.insert(vendors).values({
      id: newId(),
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
      tax_id: tax_id ?? null,
    }).returning();

    return NextResponse.json({ success: true, data: row }, { status: 201 });
  } catch (error) {
    console.error('Error creating vendor:', error);
    return NextResponse.json({ error: 'Failed to create vendor' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const { user, error: authError } = await getAuthenticatedUser(request);
  if (authError) return authError;

  try {
    const { id, ...updates } = await request.json();
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const [row] = await db.update(vendors)
      .set({ ...updates, updated_at: new Date().toISOString() })
      .where(and(eq(vendors.id, id), eq(vendors.user_id, user.id)))
      .returning();

    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true, data: row });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update vendor' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const { user, error: authError } = await getAuthenticatedUser(request);
  if (authError) return authError;

  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  await db.update(vendors)
    .set({ is_active: false, updated_at: new Date().toISOString() })
    .where(and(eq(vendors.id, id), eq(vendors.user_id, user.id)));

  return NextResponse.json({ success: true });
}