import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { bills, bill_items, vendors } from '@/db/schema';
import { getAuthenticatedUser } from '@/utils/apiAuth';
import { newId } from '@/lib/id';
import { eq, and, desc } from 'drizzle-orm';
import { listRows } from '@/lib/drizzle-list';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { user, error: authError } = await getAuthenticatedUser(request);
  if (authError) return authError;

  const sp = request.nextUrl.searchParams;
  const billId = sp.get('id');
  const vendorIdFilter = sp.get('vendor_id');
  const page = Math.max(1, Number(sp.get('page') || 1));
  const pageSize = Math.min(500, Math.max(1, Number(sp.get('pageSize') || 100)));

  try {
    if (billId) {
      const [bill] = await db.select().from(bills)
        .where(and(eq(bills.id, billId), eq(bills.user_id, user.id))).limit(1);
      if (!bill) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      const items = await db.select().from(bill_items).where(eq(bill_items.bill_id, billId));
      let vendor = null;
      if (bill.vendor_id) {
        const [v] = await db.select({
          id: vendors.id, name: vendors.name, email: vendors.email, company: vendors.company,
        }).from(vendors).where(eq(vendors.id, bill.vendor_id)).limit(1);
        vendor = v ?? null;
      }
      return NextResponse.json({ success: true, data: { ...bill, vendors: vendor, bill_items: items } });
    }

    let where = eq(bills.user_id, user.id);
    if (vendorIdFilter) where = and(where, eq(bills.vendor_id, vendorIdFilter))!;

    const result = await listRows({
      table: bills,
      where,
      orderBy: desc(bills.bill_date),
      page,
      pageSize,
    });

    return NextResponse.json({ success: true, data: result.rows, page: result.page, pageSize: result.pageSize, total: result.total });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch bills' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { user, error: authError } = await getAuthenticatedUser(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const { vendor_id, bill_number, due_date, bill_date, items, notes, description, status, category } = body;
    if (!due_date) return NextResponse.json({ error: 'due_date is required' }, { status: 400 });

    const subtotal = (items || []).reduce((sum: number, item: any) => sum + (item.quantity * item.rate), 0);
    const billId = newId();

    const [bill] = await db.insert(bills).values({
      id: billId,
      user_id: user.id,
      vendor_id: vendor_id ?? null,
      bill_number: bill_number ?? null,
      due_date,
      bill_date: bill_date ?? new Date().toISOString().split('T')[0],
      subtotal,
      total: subtotal,
      notes: notes ?? null,
      description: description ?? null,
      category: category ?? null,
      status: status ?? 'draft',
    }).returning();

    if (items?.length) {
      await db.insert(bill_items).values(items.map((item: any, index: number) => ({
        id: newId(),
        bill_id: billId,
        description: item.description,
        quantity: item.quantity ?? 1,
        rate: item.rate ?? 0,
        amount: (item.quantity ?? 1) * (item.rate ?? 0),
        sort_order: index,
      })));
    }

    const itemsRows = await db.select().from(bill_items).where(eq(bill_items.bill_id, billId));
    return NextResponse.json({ success: true, data: { ...bill, bill_items: itemsRows } }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create bill' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const { user, error: authError } = await getAuthenticatedUser(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const { id, items, ...updates } = body;
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    if (items) {
      const subtotal = items.reduce((sum: number, item: any) => sum + ((item.quantity ?? 1) * (item.rate ?? 0)), 0);
      updates.subtotal = subtotal;
      updates.total = subtotal;
    }

    await db.update(bills)
      .set({ ...updates, updated_at: new Date().toISOString() })
      .where(and(eq(bills.id, id), eq(bills.user_id, user.id)));

    if (items) {
      await db.delete(bill_items).where(eq(bill_items.bill_id, id));
      if (items.length) {
        await db.insert(bill_items).values(items.map((item: any, index: number) => ({
          id: newId(),
          bill_id: id,
          description: item.description,
          quantity: item.quantity ?? 1,
          rate: item.rate ?? 0,
          amount: (item.quantity ?? 1) * (item.rate ?? 0),
          sort_order: index,
        })));
      }
    }

    const [bill] = await db.select().from(bills)
      .where(and(eq(bills.id, id), eq(bills.user_id, user.id))).limit(1);
    if (!bill) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const itemsRows = await db.select().from(bill_items).where(eq(bill_items.bill_id, id));
    return NextResponse.json({ success: true, data: { ...bill, bill_items: itemsRows } });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update bill' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const { user, error: authError } = await getAuthenticatedUser(request);
  if (authError) return authError;

  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  await db.delete(bill_items).where(eq(bill_items.bill_id, id));
  await db.delete(bills).where(and(eq(bills.id, id), eq(bills.user_id, user.id)));
  return NextResponse.json({ success: true });
}