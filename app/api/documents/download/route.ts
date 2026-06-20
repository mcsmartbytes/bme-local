import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { db } from '@/db';
import { client_documents } from '@/db/schema';
import { getAuthenticatedUser } from '@/utils/apiAuth';
import { getFirmByOwner } from '@/lib/firm';
import { eq, and } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { user, error: authError } = await getAuthenticatedUser(request);
  if (authError) return authError;

  const firm = await getFirmByOwner(user.id);
  if (!firm) return NextResponse.json({ error: 'No firm found' }, { status: 404 });

  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const [doc] = await db.select().from(client_documents)
    .where(and(eq(client_documents.id, id), eq(client_documents.firm_id, firm.id))).limit(1);
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const absPath = path.join(process.cwd(), doc.file_path);
  if (!fs.existsSync(absPath)) return NextResponse.json({ error: 'File missing on disk' }, { status: 404 });

  const buffer = fs.readFileSync(absPath);
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': doc.mime_type || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${doc.file_name}"`,
    },
  });
}