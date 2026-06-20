import { NextResponse } from 'next/server';
import { db } from '@/db';
import { invoices, operationSnapshots, smartAlerts } from '@/db/schema';
import { analyzeBmeTrends } from '@/lib/trend-analysis';
import { narrateBmeAlert } from '@/lib/alert-narrator';
import { eq, gte } from 'drizzle-orm';

function toWeekStart(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
}

export async function POST() {
  try {
    // Aggregate recent invoices into weekly snapshots (very simplified for BME local)
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 16 * 7);
    const cutoffStr = cutoff.toISOString().split('T')[0];

    const recent = await db
      .select({
        issue_date: invoices.issue_date,
        total: invoices.total,
        status: invoices.status,
      })
      .from(invoices)
      .where(gte(invoices.issue_date, cutoffStr));

    const byWeek = new Map<string, { revenue: number; ar: number }>();

    for (const inv of recent) {
      if (!inv.issue_date) continue;
      const ws = toWeekStart(inv.issue_date);
      const existing = byWeek.get(ws) ?? { revenue: 0, ar: 0 };
      const amt = inv.total ?? 0;
      if (inv.status === 'sent' || inv.status === 'overdue') {
        existing.ar += amt;
      } else {
        existing.revenue += amt;
      }
      byWeek.set(ws, existing);
    }

    // Upsert snapshots
    for (const [weekStart, data] of byWeek) {
      await db.insert(operationSnapshots).values({
        week_start: weekStart,
        revenue: data.revenue,
        ar_total: data.ar,
      }).onConflictDoNothing();
    }

    const snapshots = await db.select().from(operationSnapshots).orderBy(operationSnapshots.week_start);

    const trendAlerts = analyzeBmeTrends(snapshots as any);

    const stored = [];
    for (const alert of trendAlerts) {
      const body = await narrateBmeAlert(alert as any);

      const [row] = await db.insert(smartAlerts).values({
        type: alert.type,
        severity: alert.severity,
        headline: alert.root_cause,
        body,
        data_json: JSON.stringify(alert.numbers),
      }).returning();

      stored.push(row);
    }

    return NextResponse.json({
      snapshots_built: byWeek.size,
      alerts_generated: stored.length,
      alerts: stored,
    });
  } catch (err: any) {
    console.error('analyze error', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}