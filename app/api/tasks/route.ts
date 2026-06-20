import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { task_comments, workflow_tasks } from '@/db/schema';
import { getAuthenticatedUser } from '@/utils/apiAuth';
import { getFirmByOwner } from '@/lib/firm';
import { newId } from '@/lib/id';
import { eq, and, asc, count } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { user, error: authError } = await getAuthenticatedUser(request);
  if (authError) return authError;

  const firm = await getFirmByOwner(user.id);
  if (!firm) return NextResponse.json({ success: false, error: 'No firm found' }, { status: 404 });

  const sp = request.nextUrl.searchParams;
  const client_org_id = sp.get('client_org_id');
  const mine = sp.get('mine') === 'true';
  const status = sp.get('status');

  let where = eq(workflow_tasks.firm_id, firm.id);
  if (client_org_id) where = and(where, eq(workflow_tasks.client_org_id, client_org_id))!;
  if (mine) where = and(where, eq(workflow_tasks.assigned_to, user.id))!;
  if (status) where = and(where, eq(workflow_tasks.status, status))!;

  const rows = await db.select().from(workflow_tasks)
    .where(where)
    .orderBy(asc(workflow_tasks.due_date));

  const enriched = await Promise.all(rows.map(async (task) => {
    const [{ c }] = await db.select({ c: count() }).from(task_comments)
      .where(eq(task_comments.task_id, task.id));
    return { ...task, comment_count: Number(c) };
  }));

  return NextResponse.json({ success: true, data: enriched });
}

export async function POST(request: NextRequest) {
  const { user, error: authError } = await getAuthenticatedUser(request);
  if (authError) return authError;

  const firm = await getFirmByOwner(user.id);
  if (!firm) return NextResponse.json({ success: false, error: 'No firm found' }, { status: 404 });

  const body = await request.json();
  const {
    title, description, client_org_id, assigned_to, assigned_to_name,
    due_date, priority, period_year, period_month, created_by_name,
  } = body;

  if (!title?.trim()) return NextResponse.json({ success: false, error: 'title required' }, { status: 400 });

  const [row] = await db.insert(workflow_tasks).values({
    id: newId(),
    firm_id: firm.id,
    title: title.trim(),
    description: description ?? null,
    client_org_id: client_org_id ?? null,
    assigned_to: assigned_to ?? null,
    assigned_to_name: assigned_to_name ?? null,
    due_date: due_date ?? null,
    priority: priority ?? 'medium',
    period_year: period_year ?? null,
    period_month: period_month ?? null,
    created_by: user.id,
    created_by_name: created_by_name ?? null,
  }).returning();

  return NextResponse.json({ success: true, data: row }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const { user, error: authError } = await getAuthenticatedUser(request);
  if (authError) return authError;

  const firm = await getFirmByOwner(user.id);
  if (!firm) return NextResponse.json({ success: false, error: 'No firm found' }, { status: 404 });

  const body = await request.json();
  const { id, ...fields } = body;
  if (!id) return NextResponse.json({ success: false, error: 'id required' }, { status: 400 });

  const allowed = ['title', 'description', 'status', 'priority', 'due_date',
    'assigned_to', 'assigned_to_name', 'period_year', 'period_month'];
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const key of allowed) {
    if (key in fields) update[key] = fields[key];
  }
  if (fields.status === 'done' && !fields.completed_at) {
    update.completed_at = new Date().toISOString();
  } else if (fields.status && fields.status !== 'done') {
    update.completed_at = null;
  }

  const [row] = await db.update(workflow_tasks)
    .set(update)
    .where(and(eq(workflow_tasks.id, id), eq(workflow_tasks.firm_id, firm.id)))
    .returning();

  if (!row) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  return NextResponse.json({ success: true, data: row });
}

export async function DELETE(request: NextRequest) {
  const { user, error: authError } = await getAuthenticatedUser(request);
  if (authError) return authError;

  const firm = await getFirmByOwner(user.id);
  if (!firm) return NextResponse.json({ success: false, error: 'No firm found' }, { status: 404 });

  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ success: false, error: 'id required' }, { status: 400 });

  await db.delete(workflow_tasks)
    .where(and(eq(workflow_tasks.id, id), eq(workflow_tasks.firm_id, firm.id)));

  return NextResponse.json({ success: true });
}