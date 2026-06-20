import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { customers, estimate_items, estimates, invoice_items, invoices } from '@/db/schema';
import { getAuthenticatedUser } from '@/utils/apiAuth';
import { newId } from '@/lib/id';
import { eq, and, desc } from 'drizzle-orm';
import { listRows } from '@/lib/drizzle-list';

export const dynamic = 'force-dynamic';

async function estimateWithRelations(estimateId: string, userId: string) {
  const [est] = await db.select().from(estimates)
    .where(and(eq(estimates.id, estimateId), eq(estimates.user_id, userId))).limit(1);
  if (!est) return null;

  const items = await db.select().from(estimate_items)
    .where(eq(estimate_items.estimate_id, estimateId))
    .orderBy(estimate_items.sort_order);

  let customer = null;
  if (est.customer_id) {
    const [c] = await db.select({
      id: customers.id, name: customers.name, email: customers.email, company: customers.company,
    }).from(customers).where(eq(customers.id, est.customer_id)).limit(1);
    customer = c ?? null;
  }

  return { ...est, customers: customer, estimate_items: items };
}

export async function GET(request: NextRequest) {
  const { user, error: authError } = await getAuthenticatedUser(request);
  if (authError) return authError;

  const sp = request.nextUrl.searchParams;
  const estimateId = sp.get('id');
  const customerId = sp.get('customer_id');
  const status = sp.get('status');
  const page = Math.max(1, Number(sp.get('page') || 1));
  const pageSize = Math.min(500, Math.max(1, Number(sp.get('pageSize') || 100)));

  try {
    if (estimateId) {
      const data = await estimateWithRelations(estimateId, user.id);
      if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json({ success: true, data });
    }

    let where = eq(estimates.user_id, user.id);
    if (customerId) where = and(where, eq(estimates.customer_id, customerId))!;
    if (status) where = and(where, eq(estimates.status, status))!;

    const result = await listRows({
      table: estimates,
      where,
      orderBy: desc(estimates.issue_date),
      page,
      pageSize,
    });

    const rows = await Promise.all((result.rows as (typeof estimates.$inferSelect)[]).map(async (est) => {
      let customer = null;
      if (est.customer_id) {
        const [c] = await db.select({
          id: customers.id, name: customers.name, email: customers.email, company: customers.company,
        }).from(customers).where(eq(customers.id, est.customer_id)).limit(1);
        customer = c ?? null;
      }
      return { ...est, customers: customer };
    }));

    return NextResponse.json({ success: true, data: rows, page: result.page, pageSize: result.pageSize, total: result.total });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch estimates' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { user, error: authError } = await getAuthenticatedUser(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const {
      customer_id, estimate_number, issue_date, expiry_date,
      items, tax_rate, notes, terms, convert_to_invoice,
    } = body;

    if (convert_to_invoice && body.estimate_id) {
      return convertEstimateToInvoice(user.id, body.estimate_id);
    }

    if (!customer_id || !estimate_number || !issue_date || !expiry_date) {
      return NextResponse.json({ error: 'customer_id, estimate_number, issue_date, and expiry_date are required' }, { status: 400 });
    }

    const subtotal = (items || []).reduce((sum: number, item: { quantity?: number; rate?: number }) =>
      sum + ((item.quantity ?? 1) * (item.rate ?? 0)), 0);
    const taxAmount = subtotal * ((tax_rate ?? 0) / 100);
    const total = subtotal + taxAmount;
    const estimateId = newId();

    await db.insert(estimates).values({
      id: estimateId,
      user_id: user.id,
      customer_id,
      estimate_number,
      issue_date,
      expiry_date,
      subtotal,
      tax_amount: taxAmount,
      total,
      notes: notes ?? null,
      terms: terms ?? null,
      status: 'draft',
    });

    if (items?.length) {
      await db.insert(estimate_items).values(items.map((item: {
        description: string; quantity?: number; rate?: number; product_service_id?: string;
      }, index: number) => ({
        id: newId(),
        estimate_id: estimateId,
        description: item.description,
        quantity: item.quantity ?? 1,
        rate: item.rate ?? 0,
        amount: (item.quantity ?? 1) * (item.rate ?? 0),
        product_service_id: item.product_service_id ?? null,
        sort_order: index,
      })));
    }

    const data = await estimateWithRelations(estimateId, user.id);
    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    console.error('Error creating estimate:', error);
    return NextResponse.json({ error: 'Failed to create estimate' }, { status: 500 });
  }
}

async function convertEstimateToInvoice(userId: string, estimateId: string) {
  const est = await estimateWithRelations(estimateId, userId);
  if (!est) return NextResponse.json({ error: 'Estimate not found' }, { status: 404 });
  if (est.status === 'converted') {
    return NextResponse.json({ error: 'Estimate already converted' }, { status: 400 });
  }

  const invoiceId = newId();
  const invoiceNumber = `INV-${est.estimate_number.replace(/^EST-?/i, '')}`;
  const dueDate = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];

  await db.insert(invoices).values({
    id: invoiceId,
    user_id: userId,
    customer_id: est.customer_id,
    estimate_id: estimateId,
    invoice_number: invoiceNumber,
    issue_date: new Date().toISOString().split('T')[0],
    due_date: dueDate,
    subtotal: est.subtotal ?? 0,
    tax_amount: est.tax_amount ?? 0,
    total: est.total ?? 0,
    notes: est.notes,
    terms: est.terms,
    status: 'draft',
  });

  const items = est.estimate_items ?? [];
  if (items.length) {
    await db.insert(invoice_items).values(items.map((item, index) => ({
      id: newId(),
      invoice_id: invoiceId,
      product_service_id: item.product_service_id,
      description: item.description,
      quantity: item.quantity ?? 1,
      rate: item.rate ?? 0,
      amount: item.amount ?? 0,
      sort_order: index,
    })));
  }

  await db.update(estimates)
    .set({ status: 'converted', converted_invoice_id: invoiceId, updated_at: new Date().toISOString() })
    .where(and(eq(estimates.id, estimateId), eq(estimates.user_id, userId)));

  return NextResponse.json({ success: true, data: { invoice_id: invoiceId } }, { status: 201 });
}

export async function PUT(request: NextRequest) {
  const { user, error: authError } = await getAuthenticatedUser(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const { id, items, ...updates } = body;
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    if (items) {
      const subtotal = items.reduce((sum: number, item: { quantity?: number; rate?: number }) =>
        sum + ((item.quantity ?? 1) * (item.rate ?? 0)), 0);
      const taxRate = updates.tax_rate ?? 0;
      updates.subtotal = subtotal;
      updates.tax_amount = subtotal * (taxRate / 100);
      updates.total = subtotal + updates.tax_amount;
    }

    await db.update(estimates)
      .set({ ...updates, updated_at: new Date().toISOString() })
      .where(and(eq(estimates.id, id), eq(estimates.user_id, user.id)));

    if (items) {
      await db.delete(estimate_items).where(eq(estimate_items.estimate_id, id));
      if (items.length) {
        await db.insert(estimate_items).values(items.map((item: {
          description: string; quantity?: number; rate?: number; product_service_id?: string;
        }, index: number) => ({
          id: newId(),
          estimate_id: id,
          description: item.description,
          quantity: item.quantity ?? 1,
          rate: item.rate ?? 0,
          amount: (item.quantity ?? 1) * (item.rate ?? 0),
          product_service_id: item.product_service_id ?? null,
          sort_order: index,
        })));
      }
    }

    const data = await estimateWithRelations(id, user.id);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update estimate' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const { user, error: authError } = await getAuthenticatedUser(request);
  if (authError) return authError;

  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  await db.delete(estimate_items).where(eq(estimate_items.estimate_id, id));
  await db.delete(estimates).where(and(eq(estimates.id, id), eq(estimates.user_id, user.id)));
  return NextResponse.json({ success: true });
}