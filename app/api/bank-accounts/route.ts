import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { accounts, bank_accounts } from '@/db/schema';
import { getAuthenticatedUser } from '@/utils/apiAuth';
import { newId } from '@/lib/id';
import { eq, and, asc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

async function enrichAccount(row: typeof bank_accounts.$inferSelect) {
  if (!row.account_id) return { ...row, accounts: null };
  const [acct] = await db.select({
    id: accounts.id,
    name: accounts.name,
    code: accounts.code,
    type: accounts.type,
  }).from(accounts).where(eq(accounts.id, row.account_id)).limit(1);
  return { ...row, accounts: acct ?? null };
}

export async function GET(request: NextRequest) {
  const { user, error: authError } = await getAuthenticatedUser(request);
  if (authError) return authError;

  const id = request.nextUrl.searchParams.get('id');

  try {
    if (id) {
      const [row] = await db.select().from(bank_accounts)
        .where(and(eq(bank_accounts.id, id), eq(bank_accounts.user_id, user.id))).limit(1);
      if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json({ success: true, data: await enrichAccount(row) });
    }

    const rows = await db.select().from(bank_accounts)
      .where(and(eq(bank_accounts.user_id, user.id), eq(bank_accounts.is_active, true)))
      .orderBy(asc(bank_accounts.name));

    const data = await Promise.all(rows.map(enrichAccount));
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch bank accounts' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { user, error: authError } = await getAuthenticatedUser(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const {
      name,
      institution,
      account_type,
      account_number_last4,
      routing_number_last4,
      current_balance,
      account_id,
    } = body;
    if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });

    const balance = current_balance ?? 0;
    const [row] = await db.insert(bank_accounts).values({
      id: newId(),
      user_id: user.id,
      name,
      institution: institution ?? null,
      account_type: account_type ?? 'checking',
      account_number_last4: account_number_last4 ?? null,
      routing_number_last4: routing_number_last4 ?? null,
      current_balance: balance,
      available_balance: balance,
      account_id: account_id ?? null,
    }).returning();

    return NextResponse.json({ success: true, data: row }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create bank account' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const { user, error: authError } = await getAuthenticatedUser(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const { id, user_id: _userId, ...updates } = body;
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const [row] = await db.update(bank_accounts)
      .set({ ...updates, updated_at: new Date().toISOString() })
      .where(and(eq(bank_accounts.id, id), eq(bank_accounts.user_id, user.id)))
      .returning();

    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true, data: row });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update bank account' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const { user, error: authError } = await getAuthenticatedUser(request);
  if (authError) return authError;

  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  try {
    await db.delete(bank_accounts)
      .where(and(eq(bank_accounts.id, id), eq(bank_accounts.user_id, user.id)));
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete bank account' }, { status: 500 });
  }
}