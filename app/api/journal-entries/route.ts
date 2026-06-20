import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { journal_entries, journal_entry_lines, accounts } from '@/db/schema';
import { getAuthenticatedUser } from '@/utils/apiAuth';
import { newId } from '@/lib/id';
import { eq, and, desc, asc } from 'drizzle-orm';
import { listRows } from '@/lib/drizzle-list';

export const dynamic = 'force-dynamic';

async function entryWithLines(entryId: string, userId: string) {
  const [entry] = await db.select().from(journal_entries)
    .where(and(eq(journal_entries.id, entryId), eq(journal_entries.user_id, userId))).limit(1);
  if (!entry) return null;

  const lines = await db.select().from(journal_entry_lines)
    .where(eq(journal_entry_lines.journal_entry_id, entryId))
    .orderBy(asc(journal_entry_lines.sort_order));

  const enriched = await Promise.all(lines.map(async (line) => {
    const [acct] = await db.select({ code: accounts.code, name: accounts.name, type: accounts.type })
      .from(accounts).where(eq(accounts.id, line.account_id)).limit(1);
    return { ...line, accounts: acct ?? null };
  }));

  return { ...entry, journal_entry_lines: enriched };
}

export async function GET(request: NextRequest) {
  const { user, error: authError } = await getAuthenticatedUser(request);
  if (authError) return authError;

  const sp = request.nextUrl.searchParams;
  const entryId = sp.get('id');
  const page = Math.max(1, Number(sp.get('page') || 1));
  const pageSize = Math.min(500, Math.max(1, Number(sp.get('pageSize') || 100)));

  try {
    if (entryId) {
      const data = await entryWithLines(entryId, user.id);
      if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json({ success: true, data });
    }

    const result = await listRows({
      table: journal_entries,
      where: eq(journal_entries.user_id, user.id),
      orderBy: desc(journal_entries.entry_date),
      page,
      pageSize,
    });

    return NextResponse.json({
      success: true,
      data: result.rows,
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch journal entries' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { user, error: authError } = await getAuthenticatedUser(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const { entry_number, entry_date, description, status, lines } = body;

    if (!entry_number || !entry_date || !description) {
      return NextResponse.json({ error: 'entry_number, entry_date, and description are required' }, { status: 400 });
    }

    const validLines = (lines || []).filter((l: { account_id?: string; debit?: number; credit?: number }) =>
      l.account_id && ((l.debit ?? 0) > 0 || (l.credit ?? 0) > 0));

    const totalDebits = validLines.reduce((s: number, l: { debit?: number }) => s + (l.debit ?? 0), 0);
    const totalCredits = validLines.reduce((s: number, l: { credit?: number }) => s + (l.credit ?? 0), 0);

    if (status === 'posted' && Math.abs(totalDebits - totalCredits) >= 0.01) {
      return NextResponse.json({ error: 'Debits and credits must balance to post' }, { status: 400 });
    }

    const entryId = newId();
    await db.insert(journal_entries).values({
      id: entryId,
      user_id: user.id,
      entry_number,
      entry_date,
      description,
      status: status ?? 'draft',
      total_debits: totalDebits,
      total_credits: totalCredits,
    });

    if (validLines.length) {
      await db.insert(journal_entry_lines).values(validLines.map((line: {
        account_id: string; description?: string; debit?: number; credit?: number;
      }, index: number) => ({
        id: newId(),
        journal_entry_id: entryId,
        account_id: line.account_id,
        description: line.description ?? null,
        debit: line.debit ?? 0,
        credit: line.credit ?? 0,
        sort_order: index,
      })));
    }

    const data = await entryWithLines(entryId, user.id);
    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    console.error('Error creating journal entry:', error);
    return NextResponse.json({ error: 'Failed to create journal entry' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const { user, error: authError } = await getAuthenticatedUser(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const { id, status, ...updates } = body;
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const [existing] = await db.select().from(journal_entries)
      .where(and(eq(journal_entries.id, id), eq(journal_entries.user_id, user.id))).limit(1);
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    if (status === 'posted') {
      if (Math.abs((existing.total_debits ?? 0) - (existing.total_credits ?? 0)) >= 0.01) {
        return NextResponse.json({ error: 'Cannot post: entry is out of balance' }, { status: 400 });
      }
    }

    await db.update(journal_entries)
      .set({ ...updates, ...(status && { status }), updated_at: new Date().toISOString() })
      .where(and(eq(journal_entries.id, id), eq(journal_entries.user_id, user.id)));

    const data = await entryWithLines(id, user.id);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update journal entry' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const { user, error: authError } = await getAuthenticatedUser(request);
  if (authError) return authError;

  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const [existing] = await db.select().from(journal_entries)
    .where(and(eq(journal_entries.id, id), eq(journal_entries.user_id, user.id))).limit(1);
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (existing.status === 'posted') {
    return NextResponse.json({ error: 'Cannot delete posted entries' }, { status: 400 });
  }

  await db.delete(journal_entry_lines).where(eq(journal_entry_lines.journal_entry_id, id));
  await db.delete(journal_entries).where(and(eq(journal_entries.id, id), eq(journal_entries.user_id, user.id)));
  return NextResponse.json({ success: true });
}