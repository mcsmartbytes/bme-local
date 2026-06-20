import { analyzeBmeTrends } from '@/lib/trend-analysis'

describe('trend-analysis | analyzeBmeTrends', () => {
  test('returns empty array when fewer than 2 weeks have data', () => {
    expect(analyzeBmeTrends([
      { week_start: '2026-01-06', revenue: 0, ar_total: 0, ap_total: 0 },
    ])).toEqual([])
  })

  test('detects ar_growth when receivables climb week over week', () => {
    const alerts = analyzeBmeTrends([
      { week_start: '2026-01-06', revenue: 1000, ar_total: 500, ap_total: 0 },
      { week_start: '2026-01-13', revenue: 1000, ar_total: 800, ap_total: 0 },
      { week_start: '2026-01-20', revenue: 1000, ar_total: 1200, ap_total: 0 },
      { week_start: '2026-01-27', revenue: 1000, ar_total: 1600, ap_total: 0 },
    ])

    expect(alerts.some(a => a.type === 'ar_growth')).toBe(true)
  })

  test('detects overdue_risk when AR dwarfs revenue', () => {
    const alerts = analyzeBmeTrends([
      { week_start: '2026-01-06', revenue: 100, ar_total: 100, ap_total: 0 },
      { week_start: '2026-01-13', revenue: 100, ar_total: 500, ap_total: 0 },
    ])

    expect(alerts.some(a => a.type === 'overdue_risk')).toBe(true)
  })
})