import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { accounts } from '@/db/schema';
import { getAuthenticatedUser } from '@/utils/apiAuth';
import { newId } from '@/lib/id';
import { eq, and, asc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { user, error: authError } = await getAuthenticatedUser(request);
  if (authError) return authError;

  const sp = request.nextUrl.searchParams;
  const accountId = sp.get('id');
  const accountType = sp.get('type');

  try {
    if (accountId) {
      const [row] = await db.select().from(accounts)
        .where(and(eq(accounts.id, accountId), eq(accounts.user_id, user.id))).limit(1);
      if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json({ success: true, data: row });
    }

    let rows = await db.select().from(accounts)
      .where(and(eq(accounts.user_id, user.id), eq(accounts.is_active, true)))
      .orderBy(asc(accounts.code));

    if (accountType) rows = rows.filter(r => r.type === accountType);

    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { user, error: authError } = await getAuthenticatedUser(request);
  if (authError) return authError;

  const body = await request.json();
  const { code, name, type, subtype, description, normal_balance, help_text } = body;
  const validTypes = ['asset', 'liability', 'equity', 'income', 'expense'];
  if (!validTypes.includes(type)) {
    return NextResponse.json({ error: 'Invalid account type' }, { status: 400 });
  }

  const autoNormalBalance = ['asset', 'expense'].includes(type) ? 'debit' : 'credit';

  const [row] = await db.insert(accounts).values({
    id: newId(),
    user_id: user.id,
    code,
    name,
    type,
    subtype: subtype ?? null,
    description: description ?? null,
    normal_balance: normal_balance ?? autoNormalBalance,
    help_text: help_text ?? null,
  }).returning();

  return NextResponse.json({ success: true, data: row }, { status: 201 });
}

export async function PUT(request: NextRequest) {
  const { user, error: authError } = await getAuthenticatedUser(request);
  if (authError) return authError;

  try {
    const { id, code, name, type, subtype, description, normal_balance, help_text } = await request.json();
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const validTypes = ['asset', 'liability', 'equity', 'income', 'expense'];
    if (type && !validTypes.includes(type)) {
      return NextResponse.json({ error: 'Invalid account type' }, { status: 400 });
    }

    const [row] = await db.update(accounts)
      .set({
        ...(code !== undefined && { code }),
        ...(name !== undefined && { name }),
        ...(type !== undefined && { type }),
        ...(subtype !== undefined && { subtype }),
        ...(description !== undefined && { description }),
        ...(normal_balance !== undefined && { normal_balance }),
        ...(help_text !== undefined && { help_text }),
        updated_at: new Date().toISOString(),
      })
      .where(and(eq(accounts.id, id), eq(accounts.user_id, user.id)))
      .returning();

    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true, data: row });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('UNIQUE') || message.includes('unique')) {
      return NextResponse.json({ error: 'An account with this code already exists.' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to update account' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const { user, error: authError } = await getAuthenticatedUser(request);
  if (authError) return authError;

  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  await db.update(accounts)
    .set({ is_active: false, updated_at: new Date().toISOString() })
    .where(and(eq(accounts.id, id), eq(accounts.user_id, user.id)));

  return NextResponse.json({ success: true });
}