import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { payments, invoices, bills } from '@/db/schema';
import { getAuthenticatedUser } from '@/utils/apiAuth';
import { newId } from '@/lib/id';
import { eq, and, desc } from 'drizzle-orm';
import { listRows } from '@/lib/drizzle-list';

export const dynamic = 'force-dynamic';

async function enrichPayment(row: typeof payments.$inferSelect) {
  let invoiceRel = null;
  let billRel = null;
  if (row.invoice_id) {
    const [inv] = await db.select({ id: invoices.id, invoice_number: invoices.invoice_number })
      .from(invoices).where(eq(invoices.id, row.invoice_id)).limit(1);
    invoiceRel = inv ?? null;
  }
  if (row.bill_id) {
    const [b] = await db.select({ id: bills.id, bill_number: bills.bill_number })
      .from(bills).where(eq(bills.id, row.bill_id)).limit(1);
    billRel = b ?? null;
  }
  return { ...row, invoices: invoiceRel, bills: billRel };
}

export async function GET(request: NextRequest) {
  const { user, error: authError } = await getAuthenticatedUser(request);
  if (authError) return authError;

  const sp = request.nextUrl.searchParams;
  const paymentId = sp.get('id');
  const type = sp.get('type');
  const billId = sp.get('bill_id');
  const invoiceId = sp.get('invoice_id');
  const page = Math.max(1, Number(sp.get('page') || 1));
  const pageSize = Math.min(500, Math.max(1, Number(sp.get('pageSize') || 100)));

  try {
    if (paymentId) {
      const [row] = await db.select().from(payments)
        .where(and(eq(payments.id, paymentId), eq(payments.user_id, user.id))).limit(1);
      if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json({ success: true, data: await enrichPayment(row) });
    }

    let where = eq(payments.user_id, user.id);
    if (type) where = and(where, eq(payments.type, type))!;
    if (billId) where = and(where, eq(payments.bill_id, billId))!;
    if (invoiceId) where = and(where, eq(payments.invoice_id, invoiceId))!;

    const result = await listRows({
      table: payments,
      where,
      orderBy: desc(payments.payment_date),
      page,
      pageSize,
    });

    const rows = await Promise.all(
      (result.rows as (typeof payments.$inferSelect)[]).map(enrichPayment),
    );
    return NextResponse.json({
      success: true,
      data: rows,
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
    });
  } catch (error) {
    console.error('Error fetching payments:', error);
    return NextResponse.json({ error: 'Failed to fetch payments' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { user, error: authError } = await getAuthenticatedUser(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const {
      payment_number, type, bill_id, invoice_id,
      amount, payment_date, payment_method, reference, notes,
    } = body;

    if (!amount || !payment_date || !payment_method || !type) {
      return NextResponse.json(
        { error: 'amount, payment_date, payment_method, and type are required' },
        { status: 400 },
      );
    }

    let finalPaymentNumber = payment_number;
    if (!finalPaymentNumber) {
      const existing = await db.select({ id: payments.id }).from(payments)
        .where(eq(payments.user_id, user.id));
      finalPaymentNumber = `PMT-${String(existing.length + 1).padStart(4, '0')}`;
    }

    const paymentId = newId();
    const [payment] = await db.insert(payments).values({
      id: paymentId,
      user_id: user.id,
      payment_number: finalPaymentNumber,
      type,
      bill_id: bill_id ?? null,
      invoice_id: invoice_id ?? null,
      amount,
      payment_date,
      payment_method,
      reference: reference ?? null,
      notes: notes ?? null,
    }).returning();

    if (bill_id && type === 'made') {
      const [bill] = await db.select().from(bills)
        .where(and(eq(bills.id, bill_id), eq(bills.user_id, user.id))).limit(1);
      if (bill) {
        const newAmountPaid = (bill.amount_paid || 0) + amount;
        const newStatus = newAmountPaid >= (bill.total ?? 0) ? 'paid' : 'unpaid';
        await db.update(bills)
          .set({ amount_paid: newAmountPaid, status: newStatus, updated_at: new Date().toISOString() })
          .where(and(eq(bills.id, bill_id), eq(bills.user_id, user.id)));
      }
    }

    if (invoice_id && type === 'received') {
      const [invoice] = await db.select().from(invoices)
        .where(and(eq(invoices.id, invoice_id), eq(invoices.user_id, user.id))).limit(1);
      if (invoice) {
        const newAmountPaid = (invoice.amount_paid || 0) + amount;
        const newStatus = newAmountPaid >= (invoice.total ?? 0) ? 'paid' : 'sent';
        await db.update(invoices)
          .set({ amount_paid: newAmountPaid, status: newStatus, updated_at: new Date().toISOString() })
          .where(and(eq(invoices.id, invoice_id), eq(invoices.user_id, user.id)));
      }
    }

    return NextResponse.json({ success: true, data: payment }, { status: 201 });
  } catch (error) {
    console.error('Error creating payment:', error);
    return NextResponse.json({ error: 'Failed to create payment' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const { user, error: authError } = await getAuthenticatedUser(request);
  if (authError) return authError;

  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  try {
    const [pmt] = await db.select().from(payments)
      .where(and(eq(payments.id, id), eq(payments.user_id, user.id))).limit(1);
    if (!pmt) return NextResponse.json({ error: 'Payment not found' }, { status: 404 });

    if (pmt.bill_id && pmt.type === 'made') {
      const [bill] = await db.select().from(bills)
        .where(and(eq(bills.id, pmt.bill_id), eq(bills.user_id, user.id))).limit(1);
      if (bill) {
        const newAmountPaid = Math.max(0, (bill.amount_paid || 0) - pmt.amount);
        await db.update(bills)
          .set({ amount_paid: newAmountPaid, status: 'unpaid', updated_at: new Date().toISOString() })
          .where(and(eq(bills.id, pmt.bill_id), eq(bills.user_id, user.id)));
      }
    }

    if (pmt.invoice_id && pmt.type === 'received') {
      const [invoice] = await db.select().from(invoices)
        .where(and(eq(invoices.id, pmt.invoice_id), eq(invoices.user_id, user.id))).limit(1);
      if (invoice) {
        const newAmountPaid = Math.max(0, (invoice.amount_paid || 0) - pmt.amount);
        await db.update(invoices)
          .set({ amount_paid: newAmountPaid, status: 'sent', updated_at: new Date().toISOString() })
          .where(and(eq(invoices.id, pmt.invoice_id), eq(invoices.user_id, user.id)));
      }
    }

    await db.delete(payments).where(and(eq(payments.id, id), eq(payments.user_id, user.id)));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting payment:', error);
    return NextResponse.json({ error: 'Failed to delete payment' }, { status: 500 });
  }
}