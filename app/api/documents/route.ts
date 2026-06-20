import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { db } from '@/db';
import { client_documents } from '@/db/schema';
import { getAuthenticatedUser } from '@/utils/apiAuth';
import { getFirmByOwner } from '@/lib/firm';
import { newId } from '@/lib/id';
import { eq, and, desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

const DOCS_ROOT = path.join(process.cwd(), 'data', 'documents');
const ALLOWED_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];
const MAX_SIZE = 25 * 1024 * 1024;

export async function GET(request: NextRequest) {
  const { user, error: authError } = await getAuthenticatedUser(request);
  if (authError) return authError;

  const firm = await getFirmByOwner(user.id);
  if (!firm) return NextResponse.json({ success: false, error: 'No firm found' }, { status: 404 });

  const sp = request.nextUrl.searchParams;
  const client_org_id = sp.get('client_org_id');
  const period_year = sp.get('period_year');
  const period_month = sp.get('period_month');

  if (!client_org_id) {
    return NextResponse.json({ success: false, error: 'client_org_id required' }, { status: 400 });
  }

  let where = and(
    eq(client_documents.firm_id, firm.id),
    eq(client_documents.client_org_id, client_org_id),
  )!;
  if (period_year) where = and(where, eq(client_documents.period_year, parseInt(period_year, 10)))!;
  if (period_month) where = and(where, eq(client_documents.period_month, parseInt(period_month, 10)))!;

  const rows = await db.select().from(client_documents)
    .where(where)
    .orderBy(desc(client_documents.created_at));

  const withUrls = rows.map((doc) => ({
    ...doc,
    download_url: `/api/documents/download?id=${doc.id}`,
  }));

  return NextResponse.json({ success: true, data: withUrls });
}

export async function POST(request: NextRequest) {
  const { user, error: authError } = await getAuthenticatedUser(request);
  if (authError) return authError;

  const firm = await getFirmByOwner(user.id);
  if (!firm) return NextResponse.json({ success: false, error: 'No firm found' }, { status: 404 });

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const client_org_id = formData.get('client_org_id') as string | null;
  const doc_type = (formData.get('doc_type') as string) || 'other';
  const period_year = formData.get('period_year') ? parseInt(formData.get('period_year') as string, 10) : null;
  const period_month = formData.get('period_month') ? parseInt(formData.get('period_month') as string, 10) : null;
  const notes = (formData.get('notes') as string) || null;
  const uploader_name = (formData.get('uploader_name') as string) || null;

  if (!file) return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
  if (!client_org_id) return NextResponse.json({ success: false, error: 'client_org_id required' }, { status: 400 });
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ success: false, error: 'File type not allowed' }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ success: false, error: 'File too large (max 25 MB)' }, { status: 400 });
  }

  const ext = file.name.split('.').pop() ?? 'bin';
  const fileId = newId();
  const dir = path.join(DOCS_ROOT, firm.id, client_org_id);
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, `${fileId}.${ext}`);
  const bytes = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(filePath, bytes);

  const [row] = await db.insert(client_documents).values({
    id: fileId,
    firm_id: firm.id,
    client_org_id,
    file_name: file.name,
    file_path: path.relative(process.cwd(), filePath),
    mime_type: file.type,
    file_size: file.size,
    doc_type,
    period_year,
    period_month,
    notes,
    uploader_name,
    uploaded_by: user.id,
  }).returning();

  return NextResponse.json({
    success: true,
    data: { ...row, download_url: `/api/documents/download?id=${row.id}` },
  }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const { user, error: authError } = await getAuthenticatedUser(request);
  if (authError) return authError;

  const firm = await getFirmByOwner(user.id);
  if (!firm) return NextResponse.json({ success: false, error: 'No firm found' }, { status: 404 });

  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ success: false, error: 'id required' }, { status: 400 });

  const [doc] = await db.select().from(client_documents)
    .where(and(eq(client_documents.id, id), eq(client_documents.firm_id, firm.id))).limit(1);
  if (!doc) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });

  const absPath = path.join(process.cwd(), doc.file_path);
  if (fs.existsSync(absPath)) fs.unlinkSync(absPath);
  await db.delete(client_documents).where(eq(client_documents.id, id));

  return NextResponse.json({ success: true });
}