import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { categories, expenses } from '@/db/schema';
import { getAuthenticatedUser } from '@/utils/apiAuth';
import { newId } from '@/lib/id';
import { eq, and, desc, gte, lte } from 'drizzle-orm';
import { listRows } from '@/lib/drizzle-list';

export const dynamic = 'force-dynamic';

async function enrichExpense(row: typeof expenses.$inferSelect) {
  let category = null;
  if (row.category_id) {
    const [cat] = await db.select({
      name: categories.name,
      icon: categories.icon,
      color: categories.color,
    }).from(categories).where(eq(categories.id, row.category_id)).limit(1);
    category = cat ?? null;
  }
  return { ...row, categories: category };
}

export async function GET(request: NextRequest) {
  const { user, error: authError } = await getAuthenticatedUser(request);
  if (authError) return authError;

  const sp = request.nextUrl.searchParams;
  const expenseId = sp.get('id');
  const startDate = sp.get('start_date');
  const endDate = sp.get('end_date');
  const categoryId = sp.get('category_id');
  const page = Math.max(1, Number(sp.get('page') || 1));
  const pageSize = Math.min(500, Math.max(1, Number(sp.get('pageSize') || 100)));

  try {
    if (expenseId) {
      const [row] = await db.select().from(expenses)
        .where(and(eq(expenses.id, expenseId), eq(expenses.user_id, user.id))).limit(1);
      if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json({ success: true, data: await enrichExpense(row) });
    }

    let where = eq(expenses.user_id, user.id);
    if (startDate) where = and(where, gte(expenses.date, startDate))!;
    if (endDate) where = and(where, lte(expenses.date, endDate))!;
    if (categoryId) where = and(where, eq(expenses.category_id, categoryId))!;

    const result = await listRows({
      table: expenses,
      where,
      orderBy: desc(expenses.date),
      page,
      pageSize,
    });

    const data = await Promise.all(
      (result.rows as typeof expenses.$inferSelect[]).map(enrichExpense),
    );

    return NextResponse.json({
      success: true,
      data,
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch expenses' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { user, error: authError } = await getAuthenticatedUser(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const {
      vendor,
      description,
      amount,
      date,
      category_id,
      job_id,
      is_business,
      payment_method,
      receipt_url,
      po_number,
      notes,
    } = body;

    if (!description || amount == null || !date) {
      return NextResponse.json({ error: 'description, amount, and date are required' }, { status: 400 });
    }

    const [row] = await db.insert(expenses).values({
      id: newId(),
      user_id: user.id,
      vendor: vendor ?? null,
      description,
      amount: Number(amount),
      date,
      category_id: category_id ?? null,
      job_id: job_id ?? null,
      is_business: is_business ?? true,
      payment_method: payment_method ?? null,
      receipt_url: receipt_url ?? null,
      po_number: po_number ?? null,
      notes: notes ?? null,
    }).returning();

    return NextResponse.json({ success: true, data: row }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create expense' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const { user, error: authError } = await getAuthenticatedUser(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const { id, user_id: _userId, ...updates } = body;
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const [row] = await db.update(expenses)
      .set({ ...updates, updated_at: new Date().toISOString() })
      .where(and(eq(expenses.id, id), eq(expenses.user_id, user.id)))
      .returning();

    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true, data: row });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update expense' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const { user, error: authError } = await getAuthenticatedUser(request);
  if (authError) return authError;

  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  try {
    await db.delete(expenses)
      .where(and(eq(expenses.id, id), eq(expenses.user_id, user.id)));
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete expense' }, { status: 500 });
  }
}