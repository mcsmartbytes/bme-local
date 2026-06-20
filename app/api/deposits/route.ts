import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { bank_accounts, customers, deposit_items, deposits, invoices, payments } from '@/db/schema';
import { getAuthenticatedUser } from '@/utils/apiAuth';
import { newId } from '@/lib/id';
import { eq, and, desc, isNull } from 'drizzle-orm';
import { listRows } from '@/lib/drizzle-list';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { user, error: authError } = await getAuthenticatedUser(request);
  if (authError) return authError;

  const sp = request.nextUrl.searchParams;
  const depositId = sp.get('id');
  const undeposited = sp.get('undeposited');
  const page = Math.max(1, Number(sp.get('page') || 1));
  const pageSize = Math.min(500, Math.max(1, Number(sp.get('pageSize') || 100)));

  try {
    if (undeposited === 'true') {
      const rows = await db.select().from(payments)
        .where(and(
          eq(payments.user_id, user.id),
          eq(payments.type, 'received'),
          isNull(payments.deposit_id),
        ))
        .orderBy(desc(payments.payment_date));

      const enriched = await Promise.all(rows.map(async (pmt) => {
        let invoiceRel = null;
        let customerRel = null;
        if (pmt.invoice_id) {
          const [inv] = await db.select({
            id: invoices.id, invoice_number: invoices.invoice_number, total: invoices.total, customer_id: invoices.customer_id,
          }).from(invoices).where(eq(invoices.id, pmt.invoice_id)).limit(1);
          if (inv) {
            invoiceRel = { id: inv.id, invoice_number: inv.invoice_number, total: inv.total };
            if (inv.customer_id) {
              const [c] = await db.select({ id: customers.id, name: customers.name })
                .from(customers).where(eq(customers.id, inv.customer_id)).limit(1);
              customerRel = c ?? null;
            }
          }
        }
        return { ...pmt, invoices: invoiceRel, customers: customerRel };
      }));

      return NextResponse.json({ success: true, data: enriched });
    }

    if (depositId) {
      const [dep] = await db.select().from(deposits)
        .where(and(eq(deposits.id, depositId), eq(deposits.user_id, user.id))).limit(1);
      if (!dep) return NextResponse.json({ error: 'Not found' }, { status: 404 });

      let bankAccount = null;
      if (dep.bank_account_id) {
        const [ba] = await db.select({ id: bank_accounts.id, name: bank_accounts.name, institution: bank_accounts.institution })
          .from(bank_accounts).where(eq(bank_accounts.id, dep.bank_account_id)).limit(1);
        bankAccount = ba ?? null;
      }

      const items = await db.select().from(deposit_items).where(eq(deposit_items.deposit_id, depositId));
      return NextResponse.json({ success: true, data: { ...dep, bank_accounts: bankAccount, deposit_items: items } });
    }

    const result = await listRows({
      table: deposits,
      where: eq(deposits.user_id, user.id),
      orderBy: desc(deposits.deposit_date),
      page,
      pageSize,
    });

    return NextResponse.json({ success: true, data: result.rows, page: result.page, pageSize: result.pageSize, total: result.total });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch deposits' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { user, error: authError } = await getAuthenticatedUser(request);
  if (authError) return authError;

  try {
    const { bank_account_id, deposit_date, memo, payment_ids } = await request.json();
    if (!payment_ids?.length) {
      return NextResponse.json({ error: 'payment_ids required' }, { status: 400 });
    }

    const selected = await db.select().from(payments)
      .where(and(
        eq(payments.user_id, user.id),
        eq(payments.type, 'received'),
        isNull(payments.deposit_id),
      ));

    const valid = selected.filter(p => payment_ids.includes(p.id));
    if (!valid.length) {
      return NextResponse.json({ error: 'No valid undeposited payments found' }, { status: 400 });
    }

    const total = valid.reduce((sum, p) => sum + p.amount, 0);
    const existing = await db.select({ id: deposits.id }).from(deposits).where(eq(deposits.user_id, user.id));
    const depositNumber = `DEP-${String(existing.length + 1).padStart(4, '0')}`;
    const depositId = newId();

    const [deposit] = await db.insert(deposits).values({
      id: depositId,
      user_id: user.id,
      bank_account_id: bank_account_id ?? null,
      deposit_number: depositNumber,
      deposit_date: deposit_date ?? new Date().toISOString().split('T')[0],
      total,
      memo: memo ?? null,
      status: bank_account_id ? 'deposited' : 'pending',
    }).returning();

    await db.insert(deposit_items).values(valid.map((p, index) => ({
      id: newId(),
      deposit_id: depositId,
      payment_id: p.id,
      description: p.reference || `Payment ${index + 1}`,
      amount: p.amount,
      sort_order: index,
    })));

    for (const p of valid) {
      await db.update(payments)
        .set({ deposit_id: depositId, updated_at: new Date().toISOString() })
        .where(and(eq(payments.id, p.id), eq(payments.user_id, user.id)));
    }

    if (bank_account_id) {
      const [acct] = await db.select().from(bank_accounts)
        .where(and(eq(bank_accounts.id, bank_account_id), eq(bank_accounts.user_id, user.id))).limit(1);
      if (acct) {
        await db.update(bank_accounts)
          .set({
            current_balance: (acct.current_balance ?? 0) + total,
            updated_at: new Date().toISOString(),
          })
          .where(eq(bank_accounts.id, bank_account_id));
      }
    }

    return NextResponse.json({ success: true, data: deposit }, { status: 201 });
  } catch (error) {
    console.error('Error creating deposit:', error);
    return NextResponse.json({ error: 'Failed to create deposit' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const { user, error: authError } = await getAuthenticatedUser(request);
  if (authError) return authError;

  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  await db.update(payments)
    .set({ deposit_id: null, updated_at: new Date().toISOString() })
    .where(and(eq(payments.deposit_id, id), eq(payments.user_id, user.id)));

  await db.delete(deposit_items).where(eq(deposit_items.deposit_id, id));
  await db.delete(deposits).where(and(eq(deposits.id, id), eq(deposits.user_id, user.id)));
  return NextResponse.json({ success: true });
}