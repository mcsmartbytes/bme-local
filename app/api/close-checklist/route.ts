import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { close_checklists } from '@/db/schema';
import { getAuthenticatedUser } from '@/utils/apiAuth';
import { getFirmByOwner } from '@/lib/firm';
import { getChecklistTemplate } from '@/lib/close-checklist-templates';
import { newId } from '@/lib/id';
import { eq, and } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { user, error: authError } = await getAuthenticatedUser(request);
  if (authError) return authError;

  const sp = request.nextUrl.searchParams;
  const client_org_id = sp.get('client_org_id');
  const period_year = parseInt(sp.get('period_year') ?? '', 10);
  const period_month = parseInt(sp.get('period_month') ?? '', 10);
  const industry_id = sp.get('industry_id') ?? 'general';

  if (!client_org_id || Number.isNaN(period_year) || Number.isNaN(period_month)) {
    return NextResponse.json({ success: false, error: 'client_org_id, period_year, period_month required' }, { status: 400 });
  }

  const firm = await getFirmByOwner(user.id);
  if (!firm) return NextResponse.json({ success: false, error: 'No firm found' }, { status: 404 });

  const [existing] = await db.select().from(close_checklists).where(and(
    eq(close_checklists.firm_id, firm.id),
    eq(close_checklists.client_org_id, client_org_id),
    eq(close_checklists.period_year, period_year),
    eq(close_checklists.period_month, period_month),
  )).limit(1);

  if (existing) {
    return NextResponse.json({
      success: true,
      data: { ...existing, items: JSON.parse(existing.items || '[]') },
    });
  }

  const items = getChecklistTemplate(industry_id);
  const [created] = await db.insert(close_checklists).values({
    id: newId(),
    firm_id: firm.id,
    client_org_id,
    period_year,
    period_month,
    industry_id,
    items: JSON.stringify(items),
  }).returning();

  return NextResponse.json({
    success: true,
    data: { ...created, items },
  });
}

export async function POST(request: NextRequest) {
  const { user, error: authError } = await getAuthenticatedUser(request);
  if (authError) return authError;

  const firm = await getFirmByOwner(user.id);
  if (!firm) return NextResponse.json({ success: false, error: 'No firm found' }, { status: 404 });

  const { client_org_id, period_year, period_month, items } = await request.json();
  if (!client_org_id || !period_year || !period_month || !Array.isArray(items)) {
    return NextResponse.json({ success: false, error: 'Invalid payload' }, { status: 400 });
  }

  const [row] = await db.update(close_checklists)
    .set({ items: JSON.stringify(items), updated_at: new Date().toISOString() })
    .where(and(
      eq(close_checklists.firm_id, firm.id),
      eq(close_checklists.client_org_id, client_org_id),
      eq(close_checklists.period_year, period_year),
      eq(close_checklists.period_month, period_month),
    ))
    .returning();

  if (!row) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  return NextResponse.json({ success: true, data: { ...row, items } });
}

export async function PATCH(request: NextRequest) {
  const { user, error: authError } = await getAuthenticatedUser(request);
  if (authError) return authError;

  const firm = await getFirmByOwner(user.id);
  if (!firm) return NextResponse.json({ success: false, error: 'No firm found' }, { status: 404 });

  const { client_org_id, period_year, period_month, signer_name, action } = await request.json();
  if (!client_org_id || !period_year || !period_month) {
    return NextResponse.json({ success: false, error: 'Invalid payload' }, { status: 400 });
  }

  const updateData = action === 'unsign'
    ? { signed_off_by: null, signer_name: null, signed_off_at: null, updated_at: new Date().toISOString() }
    : { signed_off_by: user.id, signer_name: signer_name ?? null, signed_off_at: new Date().toISOString(), updated_at: new Date().toISOString() };

  const [row] = await db.update(close_checklists)
    .set(updateData)
    .where(and(
      eq(close_checklists.firm_id, firm.id),
      eq(close_checklists.client_org_id, client_org_id),
      eq(close_checklists.period_year, period_year),
      eq(close_checklists.period_month, period_month),
    ))
    .returning();

  if (!row) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  return NextResponse.json({
    success: true,
    data: { ...row, items: JSON.parse(row.items || '[]') },
  });
}