export interface BmeSnapshot {
  week_start: string
  revenue: number
  ar_total: number
  ap_total: number
}

export type AlertType = 'ar_growth' | 'overdue_risk' | 'cash_projection' | 'margin_concern'
export type AlertSeverity = 'warning' | 'critical'

export interface TrendAlert {
  type: AlertType
  severity: AlertSeverity
  numbers: Record<string, number>
  root_cause: string
}

function avg(arr: number[]): number {
  if (!arr.length) return 0
  return arr.reduce((s, v) => s + v, 0) / arr.length
}

function growthPct(prev: number, curr: number): number {
  if (prev === 0) return 0
  return ((curr - prev) / prev) * 100
}

export function analyzeBmeTrends(snapshots: BmeSnapshot[]): TrendAlert[] {
  const withData = snapshots.filter(s => s.revenue > 0 || s.ar_total > 0)
  if (withData.length < 2) return []

  const sorted = [...snapshots].sort((a, b) => a.week_start.localeCompare(b.week_start))
  const alerts: TrendAlert[] = []

  const last4 = sorted.slice(-4)
  if (last4.length >= 2) {
    const arGrowths: number[] = []
    for (let i = 1; i < last4.length; i++) {
      arGrowths.push(growthPct(last4[i-1].ar_total, last4[i].ar_total))
    }
    const avgArGrowth = avg(arGrowths)
    if (avgArGrowth > 5) {
      alerts.push({
        type: 'ar_growth',
        severity: avgArGrowth > 15 ? 'critical' : 'warning',
        numbers: {
          ar_growth_pct: Math.round(avgArGrowth * 10) / 10,
          weeks_analyzed: last4.length,
          current_ar: last4[last4.length-1].ar_total,
        },
        root_cause: 'Accounts receivable growing faster than revenue.',
      })
    }
  }

  // Simple cash projection example
  const last = sorted[sorted.length-1]
  if (last && last.ar_total > last.revenue * 2) {
    alerts.push({
      type: 'overdue_risk',
      severity: 'warning',
      numbers: { ar_vs_revenue: Math.round((last.ar_total / (last.revenue || 1)) * 100) },
      root_cause: 'AR significantly exceeds recent revenue — collection risk.',
    })
  }

  return alerts
}