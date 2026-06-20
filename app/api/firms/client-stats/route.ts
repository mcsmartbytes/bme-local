import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { client_documents, close_checklists, firm_clients, workflow_tasks } from '@/db/schema';
import { getAuthenticatedUser } from '@/utils/apiAuth';
import { getFirmByOwner } from '@/lib/firm';
import { eq, and, ne, inArray } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { user, error: authError } = await getAuthenticatedUser(request);
  if (authError) return authError;

  const firm = await getFirmByOwner(user.id);
  if (!firm) return NextResponse.json({ success: false, error: 'No firm found' }, { status: 404 });

  const clients = await db.select({
    id: firm_clients.id,
    organization_id: firm_clients.organization_id,
  }).from(firm_clients).where(eq(firm_clients.firm_id, firm.id));

  if (clients.length === 0) {
    return NextResponse.json({ success: true, data: {} });
  }

  const orgIds = clients.map((c) => c.organization_id);
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const today = now.toISOString().split('T')[0];

  const [checklists, docs, tasks] = await Promise.all([
    db.select().from(close_checklists).where(and(
      eq(close_checklists.firm_id, firm.id),
      eq(close_checklists.period_year, year),
      eq(close_checklists.period_month, month),
      inArray(close_checklists.client_org_id, orgIds),
    )),
    db.select({ client_org_id: client_documents.client_org_id }).from(client_documents).where(and(
      eq(client_documents.firm_id, firm.id),
      inArray(client_documents.client_org_id, orgIds),
    )),
    db.select({
      client_org_id: workflow_tasks.client_org_id,
      status: workflow_tasks.status,
      due_date: workflow_tasks.due_date,
    }).from(workflow_tasks).where(and(
      eq(workflow_tasks.firm_id, firm.id),
      ne(workflow_tasks.status, 'done'),
      inArray(workflow_tasks.client_org_id, orgIds),
    )),
  ]);

  const stats: Record<string, {
    close_status: 'none' | 'open' | 'complete';
    close_pct: number;
    doc_count: number;
    open_task_count: number;
    overdue_task_count: number;
  }> = {};

  for (const client of clients) {
    const orgId = client.organization_id;
    const checklist = checklists.find((c) => c.client_org_id === orgId);
    let close_status: 'none' | 'open' | 'complete' = 'none';
    let close_pct = 0;
    if (checklist) {
      const items = JSON.parse(checklist.items || '[]') as { checked: boolean }[];
      const done = items.filter((i) => i.checked).length;
      close_pct = items.length > 0 ? Math.round((done / items.length) * 100) : 0;
      close_status = checklist.signed_off_at ? 'complete' : 'open';
    }

    const doc_count = docs.filter((d) => d.client_org_id === orgId).length;
    const clientTasks = tasks.filter((t) => t.client_org_id === orgId);

    stats[orgId] = {
      close_status,
      close_pct,
      doc_count,
      open_task_count: clientTasks.length,
      overdue_task_count: clientTasks.filter((t) => t.due_date && t.due_date < today).length,
    };
  }

  return NextResponse.json({ success: true, data: stats });
}