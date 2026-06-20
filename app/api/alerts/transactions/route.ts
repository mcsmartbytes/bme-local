import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { bank_transactions, expenses, transaction_alerts } from '@/db/schema';
import { getAuthenticatedUser } from '@/utils/apiAuth';
import { newId } from '@/lib/id';
import { eq, and, gte, desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

const LARGE_AMOUNT = 1000;
const ROUND_THRESHOLD = 500;

export async function GET(request: NextRequest) {
  const { user, error: authError } = await getAuthenticatedUser(request);
  if (authError) return authError;

  const status = request.nextUrl.searchParams.get('status') ?? 'open';
  let where = eq(transaction_alerts.user_id, user.id);
  if (status !== 'all') where = and(where, eq(transaction_alerts.status, status))!;

  const rows = await db.select().from(transaction_alerts)
    .where(where)
    .orderBy(desc(transaction_alerts.created_at))
    .limit(100);

  return NextResponse.json({ success: true, data: rows });
}

export async function POST(request: NextRequest) {
  const { user, error: authError } = await getAuthenticatedUser(request);
  if (authError) return authError;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);
  const cutoffStr = cutoff.toISOString().split('T')[0];

  const [bankTxns, expenseRows] = await Promise.all([
    db.select().from(bank_transactions).where(and(
      eq(bank_transactions.user_id, user.id),
      gte(bank_transactions.date, cutoffStr),
    )),
    db.select().from(expenses).where(and(
      eq(expenses.user_id, user.id),
      gte(expenses.date, cutoffStr),
    )),
  ]);

  const inserted: string[] = [];

  for (const txn of bankTxns) {
    const amt = Number(txn.amount);
    if (amt >= LARGE_AMOUNT) {
      const id = newId();
      await db.insert(transaction_alerts).values({
        id,
        user_id: user.id,
        alert_type: 'large_transaction',
        severity: 'warning',
        headline: `Large bank transaction: ${txn.description}`,
        body: `$${amt.toFixed(2)} on ${txn.date}`,
        ref_type: 'bank_transaction',
        ref_id: txn.id,
      });
      inserted.push(id);
    }
    if (amt >= ROUND_THRESHOLD && amt % 100 === 0) {
      const id = newId();
      await db.insert(transaction_alerts).values({
        id,
        user_id: user.id,
        alert_type: 'round_amount',
        severity: 'info',
        headline: `Round-dollar transaction: ${txn.description}`,
        body: `$${amt.toFixed(2)} on ${txn.date}`,
        ref_type: 'bank_transaction',
        ref_id: txn.id,
      });
      inserted.push(id);
    }
  }

  for (const exp of expenseRows) {
    const amt = Number(exp.amount);
    if (amt >= LARGE_AMOUNT) {
      const id = newId();
      await db.insert(transaction_alerts).values({
        id,
        user_id: user.id,
        alert_type: 'large_expense',
        severity: 'warning',
        headline: `Large expense: ${exp.description}`,
        body: `$${amt.toFixed(2)} on ${exp.date}`,
        ref_type: 'expense',
        ref_id: exp.id,
      });
      inserted.push(id);
    }
  }

  return NextResponse.json({ success: true, data: { inserted: inserted.length } });
}

export async function PATCH(request: NextRequest) {
  const { user, error: authError } = await getAuthenticatedUser(request);
  if (authError) return authError;

  const { id, status } = await request.json();
  if (!id || !status) return NextResponse.json({ success: false, error: 'id and status required' }, { status: 400 });

  const [row] = await db.update(transaction_alerts)
    .set({ status })
    .where(and(eq(transaction_alerts.id, id), eq(transaction_alerts.user_id, user.id)))
    .returning();

  if (!row) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  return NextResponse.json({ success: true, data: row });
}