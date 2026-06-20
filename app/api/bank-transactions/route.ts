import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { bank_accounts, bank_transactions, categories } from '@/db/schema';
import { getAuthenticatedUser } from '@/utils/apiAuth';
import { newId } from '@/lib/id';
import { eq, and, desc, gte, lte } from 'drizzle-orm';
import { listRows } from '@/lib/drizzle-list';

export const dynamic = 'force-dynamic';

async function enrichTransaction(row: typeof bank_transactions.$inferSelect) {
  const [bankAccount] = await db.select({ id: bank_accounts.id, name: bank_accounts.name, institution: bank_accounts.institution })
    .from(bank_accounts).where(eq(bank_accounts.id, row.bank_account_id)).limit(1);

  let category = null;
  if (row.category_id) {
    const [cat] = await db.select({ id: categories.id, name: categories.name })
      .from(categories).where(eq(categories.id, row.category_id)).limit(1);
    category = cat ?? null;
  }

  return { ...row, bank_accounts: bankAccount ?? null, categories: category };
}

export async function GET(request: NextRequest) {
  const { user, error: authError } = await getAuthenticatedUser(request);
  if (authError) return authError;

  const sp = request.nextUrl.searchParams;
  const txnId = sp.get('id');
  const bankAccountId = sp.get('bank_account_id');
  const status = sp.get('status');
  const startDate = sp.get('start_date');
  const endDate = sp.get('end_date');
  const reconciliationId = sp.get('reconciliation_id');
  const page = Math.max(1, Number(sp.get('page') || 1));
  const pageSize = Math.min(500, Math.max(1, Number(sp.get('pageSize') || 100)));

  try {
    if (txnId) {
      const [row] = await db.select().from(bank_transactions)
        .where(and(eq(bank_transactions.id, txnId), eq(bank_transactions.user_id, user.id))).limit(1);
      if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json({ success: true, data: await enrichTransaction(row) });
    }

    let where = eq(bank_transactions.user_id, user.id);
    if (bankAccountId) where = and(where, eq(bank_transactions.bank_account_id, bankAccountId))!;
    if (status) where = and(where, eq(bank_transactions.status, status))!;
    if (startDate) where = and(where, gte(bank_transactions.date, startDate))!;
    if (endDate) where = and(where, lte(bank_transactions.date, endDate))!;
    if (reconciliationId) where = and(where, eq(bank_transactions.reconciliation_id, reconciliationId))!;

    const result = await listRows({
      table: bank_transactions,
      where,
      orderBy: desc(bank_transactions.date),
      page,
      pageSize,
    });

    const data = await Promise.all(
      (result.rows as typeof bank_transactions.$inferSelect[]).map(enrichTransaction),
    );

    return NextResponse.json({
      success: true,
      data,
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch bank transactions' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { user, error: authError } = await getAuthenticatedUser(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const {
      bank_account_id,
      date,
      description,
      amount,
      type,
      category_id,
      payee,
      reference,
      check_number,
      memo,
    } = body;

    if (!bank_account_id || !date || !description || amount == null) {
      return NextResponse.json({ error: 'bank_account_id, date, description, and amount are required' }, { status: 400 });
    }

    const txnType = type || (amount < 0 ? 'debit' : 'credit');
    const absAmount = Math.abs(Number(amount));

    const [row] = await db.insert(bank_transactions).values({
      id: newId(),
      user_id: user.id,
      bank_account_id,
      date,
      description,
      amount: absAmount,
      type: txnType,
      category_id: category_id ?? null,
      payee: payee ?? null,
      reference: reference ?? null,
      check_number: check_number ?? null,
      memo: memo ?? null,
      status: 'unreviewed',
    }).returning();

    const balanceChange = txnType === 'credit' ? absAmount : -absAmount;
    const [account] = await db.select({ current_balance: bank_accounts.current_balance })
      .from(bank_accounts)
      .where(and(eq(bank_accounts.id, bank_account_id), eq(bank_accounts.user_id, user.id)))
      .limit(1);

    if (account) {
      await db.update(bank_accounts)
        .set({
          current_balance: (Number(account.current_balance) || 0) + balanceChange,
          updated_at: new Date().toISOString(),
        })
        .where(eq(bank_accounts.id, bank_account_id));
    }

    return NextResponse.json({ success: true, data: row }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create bank transaction' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const { user, error: authError } = await getAuthenticatedUser(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const { id, user_id: _userId, ...updates } = body;
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const [row] = await db.update(bank_transactions)
      .set({ ...updates, updated_at: new Date().toISOString() })
      .where(and(eq(bank_transactions.id, id), eq(bank_transactions.user_id, user.id)))
      .returning();

    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true, data: row });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update bank transaction' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const { user, error: authError } = await getAuthenticatedUser(request);
  if (authError) return authError;

  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  try {
    await db.delete(bank_transactions)
      .where(and(eq(bank_transactions.id, id), eq(bank_transactions.user_id, user.id)));
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete bank transaction' }, { status: 500 });
  }
}