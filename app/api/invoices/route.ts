import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { customers, invoice_items, invoices } from '@/db/schema';
import { getAuthenticatedUser } from '@/utils/apiAuth';
import { newId } from '@/lib/id';
import { eq, and, desc } from 'drizzle-orm';
import { listRows } from '@/lib/drizzle-list';

export const dynamic = 'force-dynamic';

async function invoiceWithRelations(invoiceId: string, userId: string) {
  const [inv] = await db.select().from(invoices)
    .where(and(eq(invoices.id, invoiceId), eq(invoices.user_id, userId)))
    .limit(1);
  if (!inv) return null;
  const items = await db.select().from(invoice_items).where(eq(invoice_items.invoice_id, invoiceId));
  let customer = null;
  if (inv.customer_id) {
    const [c] = await db.select({
      id: customers.id,
      name: customers.name,
      email: customers.email,
      company: customers.company,
    }).from(customers).where(eq(customers.id, inv.customer_id)).limit(1);
    customer = c ?? null;
  }
  return { ...inv, customers: customer, invoice_items: items };
}

export async function GET(request: NextRequest) {
  const { user, error: authError } = await getAuthenticatedUser(request);
  if (authError) return authError;

  const sp = request.nextUrl.searchParams;
  const invoiceId = sp.get('id');
  const status = sp.get('status');
  const customerId = sp.get('customer_id');
  const page = Math.max(1, Number(sp.get('page') || 1));
  const pageSize = Math.min(500, Math.max(1, Number(sp.get('pageSize') || 100)));

  try {
    if (invoiceId) {
      const data = await invoiceWithRelations(invoiceId, user.id);
      if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json({ success: true, data });
    }

    let where = eq(invoices.user_id, user.id);
    if (status) where = and(where, eq(invoices.status, status))!;
    if (customerId) where = and(where, eq(invoices.customer_id, customerId))!;

    const result = await listRows({
      table: invoices,
      where,
      orderBy: desc(invoices.issue_date),
      page,
      pageSize,
    });

    const rows = await Promise.all(result.rows.map(async (inv: any) => {
      let customer = null;
      if (inv.customer_id) {
        const [c] = await db.select({
          id: customers.id, name: customers.name, email: customers.email, company: customers.company,
        }).from(customers).where(eq(customers.id, inv.customer_id)).limit(1);
        customer = c ?? null;
      }
      return { ...inv, customers: customer };
    }));

    return NextResponse.json({ success: true, data: rows, page: result.page, pageSize: result.pageSize, total: result.total });
  } catch (error) {
    console.error('Error fetching invoices:', error);
    return NextResponse.json({ error: 'Failed to fetch invoices' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { user, error: authError } = await getAuthenticatedUser(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const { customer_id, invoice_number, due_date, items, tax_rate, notes, terms, issue_date, status, job_id } = body;

    if (!invoice_number || !due_date) {
      return NextResponse.json({ error: 'invoice_number and due_date are required' }, { status: 400 });
    }

    const subtotal = (items || []).reduce((sum: number, item: any) => sum + (item.quantity * item.rate), 0);
    const taxAmount = subtotal * ((tax_rate || 0) / 100);
    const total = subtotal + taxAmount;
    const invoiceId = newId();

    const [invoice] = await db.insert(invoices).values({
      id: invoiceId,
      user_id: user.id,
      customer_id: customer_id ?? null,
      job_id: job_id ?? null,
      invoice_number,
      due_date,
      issue_date: issue_date ?? new Date().toISOString().split('T')[0],
      subtotal,
      tax_rate: tax_rate ?? 0,
      tax_amount: taxAmount,
      total,
      notes: notes ?? null,
      terms: terms ?? null,
      status: status ?? 'draft',
    }).returning();

    if (items?.length) {
      await db.insert(invoice_items).values(items.map((item: any, index: number) => ({
        id: newId(),
        invoice_id: invoiceId,
        description: item.description,
        quantity: item.quantity ?? 1,
        rate: item.rate ?? 0,
        amount: (item.quantity ?? 1) * (item.rate ?? 0),
        account_id: item.account_id ?? null,
        sort_order: index,
      })));
    }

    const data = await invoiceWithRelations(invoiceId, user.id);
    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating invoice:', error);
    if (String(error?.message || '').includes('UNIQUE')) {
      return NextResponse.json({ error: 'Invoice number already exists' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to create invoice' }, { status: 500 });
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
      const subtotal = items.reduce((sum: number, item: any) => sum + (item.quantity * item.rate), 0);
      const taxAmount = subtotal * ((updates.tax_rate || 0) / 100);
      updates.subtotal = subtotal;
      updates.tax_amount = taxAmount;
      updates.total = subtotal + taxAmount;
    }

    await db.update(invoices)
      .set({ ...updates, updated_at: new Date().toISOString() })
      .where(and(eq(invoices.id, id), eq(invoices.user_id, user.id)));

    if (items) {
      await db.delete(invoice_items).where(eq(invoice_items.invoice_id, id));
      if (items.length) {
        await db.insert(invoice_items).values(items.map((item: any, index: number) => ({
          id: newId(),
          invoice_id: id,
          description: item.description,
          quantity: item.quantity ?? 1,
          rate: item.rate ?? 0,
          amount: (item.quantity ?? 1) * (item.rate ?? 0),
          account_id: item.account_id ?? null,
          sort_order: index,
        })));
      }
    }

    const data = await invoiceWithRelations(id, user.id);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update invoice' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const { user, error: authError } = await getAuthenticatedUser(request);
  if (authError) return authError;

  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  await db.delete(invoice_items).where(eq(invoice_items.invoice_id, id));
  await db.delete(invoices).where(and(eq(invoices.id, id), eq(invoices.user_id, user.id)));
  return NextResponse.json({ success: true });
}