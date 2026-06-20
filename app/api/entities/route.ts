import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { entities, organizations } from '@/db/schema';
import { getAuthenticatedUser } from '@/utils/apiAuth';
import { getFirmByOwner } from '@/lib/firm';
import { newId } from '@/lib/id';
import { eq, and, asc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

async function userCanAccessOrg(userId: string, organizationId: string) {
  const [org] = await db.select().from(organizations).where(eq(organizations.id, organizationId)).limit(1);
  if (!org) return false;
  if (org.created_by === userId) return true;
  if (org.firm_id) {
    const firm = await getFirmByOwner(userId);
    return firm?.id === org.firm_id;
  }
  return false;
}

export async function GET(request: NextRequest) {
  const { user, error: authError } = await getAuthenticatedUser(request);
  if (authError) return authError;

  const organizationId = request.nextUrl.searchParams.get('organization_id');
  if (!organizationId) {
    return NextResponse.json({ error: 'organization_id is required' }, { status: 400 });
  }

  try {
    if (!(await userCanAccessOrg(user.id, organizationId))) {
      return NextResponse.json({ error: 'No access to this organization' }, { status: 403 });
    }

    const rows = await db.select().from(entities)
      .where(and(eq(entities.organization_id, organizationId), eq(entities.is_active, true)))
      .orderBy(asc(entities.name));

    return NextResponse.json({ success: true, data: rows });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch entities' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { user, error: authError } = await getAuthenticatedUser(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const {
      organization_id,
      name,
      legal_name,
      entity_type,
      tax_id,
      email,
      phone,
      address,
      city,
      state,
      zip,
    } = body;

    if (!organization_id || !name) {
      return NextResponse.json({ error: 'organization_id and name are required' }, { status: 400 });
    }

    if (!(await userCanAccessOrg(user.id, organization_id))) {
      return NextResponse.json({ error: 'No access to this organization' }, { status: 403 });
    }

    const [row] = await db.insert(entities).values({
      id: newId(),
      organization_id,
      name,
      legal_name: legal_name ?? null,
      entity_type: entity_type ?? 'company',
      tax_id: tax_id ?? null,
      email: email ?? null,
      phone: phone ?? null,
      address: address ?? null,
      city: city ?? null,
      state: state ?? null,
      zip: zip ?? null,
    }).returning();

    return NextResponse.json({ success: true, data: row }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to create entity' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const { user, error: authError } = await getAuthenticatedUser(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const { id, organization_id, ...updates } = body;
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const [existing] = await db.select().from(entities).where(eq(entities.id, id)).limit(1);
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const orgId = organization_id || existing.organization_id;
    if (!(await userCanAccessOrg(user.id, orgId))) {
      return NextResponse.json({ error: 'No access' }, { status: 403 });
    }

    const [row] = await db.update(entities)
      .set({ ...updates, updated_at: new Date().toISOString() })
      .where(eq(entities.id, id))
      .returning();

    return NextResponse.json({ success: true, data: row });
  } catch {
    return NextResponse.json({ error: 'Failed to update entity' }, { status: 500 });
  }
}