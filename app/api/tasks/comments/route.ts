import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { task_comments, workflow_tasks } from '@/db/schema';
import { getAuthenticatedUser } from '@/utils/apiAuth';
import { getFirmByOwner } from '@/lib/firm';
import { newId } from '@/lib/id';
import { eq, and, asc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { user, error: authError } = await getAuthenticatedUser(request);
  if (authError) return authError;

  const firm = await getFirmByOwner(user.id);
  if (!firm) return NextResponse.json({ success: false, error: 'No firm found' }, { status: 404 });

  const taskId = request.nextUrl.searchParams.get('task_id');
  if (!taskId) return NextResponse.json({ success: false, error: 'task_id required' }, { status: 400 });

  const [task] = await db.select().from(workflow_tasks)
    .where(and(eq(workflow_tasks.id, taskId), eq(workflow_tasks.firm_id, firm.id))).limit(1);
  if (!task) return NextResponse.json({ success: false, error: 'Task not found' }, { status: 404 });

  const rows = await db.select().from(task_comments)
    .where(eq(task_comments.task_id, taskId))
    .orderBy(asc(task_comments.created_at));

  return NextResponse.json({ success: true, data: rows });
}

export async function POST(request: NextRequest) {
  const { user, error: authError } = await getAuthenticatedUser(request);
  if (authError) return authError;

  const firm = await getFirmByOwner(user.id);
  if (!firm) return NextResponse.json({ success: false, error: 'No firm found' }, { status: 404 });

  const { task_id, body, user_name } = await request.json();
  if (!task_id || !body?.trim()) {
    return NextResponse.json({ success: false, error: 'task_id and body required' }, { status: 400 });
  }

  const [task] = await db.select().from(workflow_tasks)
    .where(and(eq(workflow_tasks.id, task_id), eq(workflow_tasks.firm_id, firm.id))).limit(1);
  if (!task) return NextResponse.json({ success: false, error: 'Task not found' }, { status: 404 });

  const [row] = await db.insert(task_comments).values({
    id: newId(),
    task_id,
    user_id: user.id,
    user_name: user_name ?? user.name ?? null,
    body: body.trim(),
  }).returning();

  return NextResponse.json({ success: true, data: row }, { status: 201 });
}