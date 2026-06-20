import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { customers, vendors, invoices, bills } from '@/db/schema';
import { getAuthenticatedUser } from '@/utils/apiAuth';
import { eq, and, inArray, lt, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { user, error: authError } = await getAuthenticatedUser(request);
  if (authError) return authError;

  const userId = user.id;
  const today = new Date().toISOString().split('T')[0];

  try {
    const allInvoices = await db.select().from(invoices).where(eq(invoices.user_id, userId));
    const allBills = await db.select().from(bills).where(eq(bills.user_id, userId));

    const paidInvoices = allInvoices.filter(i => i.status === 'paid');
    const openInvoices = allInvoices.filter(i => i.status === 'sent' || i.status === 'overdue');
    const openBills = allBills.filter(b => b.status === 'unpaid' || b.status === 'overdue');

    const totalRevenue = paidInvoices.reduce((s, i) => s + Number(i.total ?? 0), 0);
    const outstandingReceivables = openInvoices.reduce((s, i) => s + Number(i.total ?? 0) - Number(i.amount_paid ?? 0), 0);
    const outstandingPayables = openBills.reduce((s, b) => s + Number(b.total ?? 0) - Number(b.amount_paid ?? 0), 0);

    const [{ c: customersCount }] = await db.select({ c: sql<number>`count(*)` }).from(customers)
      .where(and(eq(customers.user_id, userId), eq(customers.is_active, true)));
    const [{ c: vendorsCount }] = await db.select({ c: sql<number>`count(*)` }).from(vendors)
      .where(and(eq(vendors.user_id, userId), eq(vendors.is_active, true)));

    const invoicesDue = openInvoices.filter(i => i.due_date && i.due_date < today).length;
    const billsDue = openBills.filter(b => b.due_date && b.due_date < today).length;

    const recentInvoices = [...allInvoices]
      .sort((a, b) => (b.issue_date || '').localeCompare(a.issue_date || ''))
      .slice(0, 5)
      .map(i => ({
        id: i.id,
        type: 'invoice' as const,
        description: `Invoice ${i.invoice_number}`,
        amount: i.total,
        date: i.issue_date,
      }));

    return NextResponse.json({
      success: true,
      data: {
        stats: {
          totalRevenue,
          outstandingReceivables,
          outstandingPayables,
          customersCount: Number(customersCount),
          vendorsCount: Number(vendorsCount),
          invoicesDue,
          billsDue,
        },
        recentActivity: recentInvoices,
        companyName: user.business_name || user.name || 'Your Business',
      },
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    return NextResponse.json({ error: 'Failed to load dashboard' }, { status: 500 });
  }
}