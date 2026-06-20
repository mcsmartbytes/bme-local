import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { entities, firm_clients, organizations } from '@/db/schema';
import { getAuthenticatedUser } from '@/utils/apiAuth';
import { getFirmByOwner } from '@/lib/firm';
import { newId } from '@/lib/id';
import { eq, and, desc, count } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { user, error: authError } = await getAuthenticatedUser(request);
  if (authError) return authError;

  try {
    const firm = await getFirmByOwner(user.id);
    if (!firm) return NextResponse.json({ error: 'No firm found' }, { status: 404 });

    const clients = await db.select().from(firm_clients)
      .where(eq(firm_clients.firm_id, firm.id))
      .orderBy(desc(firm_clients.added_at));

    const enriched = await Promise.all(clients.map(async (client) => {
      const [org] = await db.select({
        id: organizations.id,
        name: organizations.name,
        industry_id: organizations.industry_id,
        multi_entity: organizations.multi_entity,
        multi_location: organizations.multi_location,
      }).from(organizations).where(eq(organizations.id, client.organization_id)).limit(1);

      const [{ c: entityCount }] = await db.select({ c: count() }).from(entities)
        .where(and(eq(entities.organization_id, client.organization_id), eq(entities.is_active, true)));

      return {
        ...client,
        organizations: org ?? null,
        entity_count: Number(entityCount),
      };
    }));

    return NextResponse.json({ success: true, data: enriched });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch clients' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { user, error: authError } = await getAuthenticatedUser(request);
  if (authError) return authError;

  try {
    const firm = await getFirmByOwner(user.id);
    if (!firm) return NextResponse.json({ error: 'No firm found' }, { status: 404 });

    const body = await request.json();
    const { name, industry_id, tax_id, email, phone, address, city, state, zip, notes } = body;
    if (!name) return NextResponse.json({ error: 'Client name is required' }, { status: 400 });

    const orgId = newId();
    const entityId = newId();

    await db.insert(organizations).values({
      id: orgId,
      name,
      created_by: user.id,
      firm_id: firm.id,
      industry_id: industry_id ?? 'general',
    });

    await db.insert(entities).values({
      id: entityId,
      organization_id: orgId,
      name,
      entity_type: 'company',
      tax_id: tax_id ?? null,
      email: email ?? null,
      phone: phone ?? null,
      address: address ?? null,
      city: city ?? null,
      state: state ?? null,
      zip: zip ?? null,
    });

    const [client] = await db.insert(firm_clients).values({
      id: newId(),
      firm_id: firm.id,
      organization_id: orgId,
      status: 'onboarding',
      notes: notes ?? null,
    }).returning();

    const [org] = await db.select({
      id: organizations.id,
      name: organizations.name,
      industry_id: organizations.industry_id,
      multi_entity: organizations.multi_entity,
      multi_location: organizations.multi_location,
    }).from(organizations).where(eq(organizations.id, orgId)).limit(1);

    return NextResponse.json({
      success: true,
      data: { ...client, organizations: org, entity_count: 1 },
    }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to add client' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const { user, error: authError } = await getAuthenticatedUser(request);
  if (authError) return authError;

  try {
    const firm = await getFirmByOwner(user.id);
    if (!firm) return NextResponse.json({ error: 'No firm found' }, { status: 404 });

    const { id, status, notes } = await request.json();
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const [row] = await db.update(firm_clients)
      .set({ status: status ?? undefined, notes: notes ?? undefined })
      .where(and(eq(firm_clients.id, id), eq(firm_clients.firm_id, firm.id)))
      .returning();

    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true, data: row });
  } catch {
    return NextResponse.json({ error: 'Failed to update client' }, { status: 500 });
  }
}