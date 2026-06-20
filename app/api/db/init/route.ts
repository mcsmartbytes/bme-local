import { NextResponse } from 'next/server';
import { db } from '@/db';
import { users, entities, customers, invoices } from '@/db/schema';
import { hashPassword } from '@/lib/auth';
import { eq } from 'drizzle-orm';

// Seed demo data for local BME. 
// Run `npx drizzle-kit push` first to create tables.
// Then visit /api/db/init
// DB file is data/local.db (in subdir to prevent watcher spam from DB writes)
export async function GET() {
  try {
    const existing = await db.select({ id: users.id }).from(users).limit(1);
    if (existing.length > 0) {
      return NextResponse.json({ message: 'Already initialized — skipping seed.' });
    }

    const adminEmail = process.env.ADMIN_EMAIL ?? 'bookkeeper@local';
    const adminPassword = process.env.ADMIN_PASSWORD ?? 'change-me-now';
    const hash = await hashPassword(adminPassword);

    await db.insert(users).values({
      email: adminEmail,
      password_hash: hash,
      full_name: 'Local Bookkeeper',
      role: 'bookkeeper',
    });

    const [ent] = await db.insert(entities).values({
      name: 'Demo Business',
      type: 'business',
    }).returning();

    await db.insert(customers).values({
      entity_id: ent.id,
      name: 'Acme Corp',
      email: 'billing@acme.example',
    });

    const [cust] = await db.select().from(customers).where(eq(customers.entity_id, ent.id)).limit(1);

    // Seed invoices across several weeks so intelligence/analyze has trend data
    const weeksAgo = (n: number) => {
      const d = new Date();
      d.setDate(d.getDate() - n * 7);
      return d.toISOString().split('T')[0];
    };

    const seedInvoices = [
      { num: 'INV-001', weeks: 12, total: 800, status: 'paid' },
      { num: 'INV-002', weeks: 8, total: 950, status: 'paid' },
      { num: 'INV-003', weeks: 6, total: 1100, status: 'sent' },
      { num: 'INV-004', weeks: 4, total: 1400, status: 'sent' },
      { num: 'INV-005', weeks: 2, total: 1800, status: 'overdue' },
      { num: 'INV-006', weeks: 1, total: 2200, status: 'overdue' },
      { num: 'INV-007', weeks: 0, total: 2500, status: 'sent' },
    ] as const;

    for (const inv of seedInvoices) {
      await db.insert(invoices).values({
        entity_id: ent.id,
        customer_id: cust?.id,
        invoice_number: inv.num,
        issue_date: weeksAgo(inv.weeks),
        total: inv.total,
        status: inv.status,
      });
    }

    return NextResponse.json({
      ok: true,
      message: `Database seeded. Admin login: ${adminEmail}`,
      warning: process.env.ADMIN_PASSWORD ? undefined : 'Using default password — set ADMIN_PASSWORD env var.',
    });
  } catch (err: any) {
    console.error('DB init error:', err);
    return NextResponse.json({
      error: String(err),
      hint: 'Run `npx drizzle-kit push` (or generate + migrate) to create tables before calling this.',
    }, { status: 500 });
  }
}