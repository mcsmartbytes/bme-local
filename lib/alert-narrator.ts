import type { TrendAlert } from './trend-analysis'
import { runSLM } from './slm-client'

const PROMPTS: Record<string, (n: Record<string, number>) => string> = {
  ar_growth: n =>
    `You are a bookkeeping advisor. Write a short plain-English alert: AR has grown ${n.ar_growth_pct}% over ${n.weeks_analyzed} weeks and is now at ${n.current_ar}. Explain the pattern, risk, and one immediate action in 2-3 sentences.`,

  overdue_risk: n =>
    `You are a bookkeeping advisor. Write a short alert: AR is ${n.ar_vs_revenue}% of recent revenue. Give the implication for cash and one recommendation in 2 sentences.`,

  cash_projection: n =>
    `Cash flow concern based on current trends. Summarize impact and recommended check in 2-3 plain sentences.`,

  margin_concern: n =>
    `Margin or profitability concern detected. State the pattern and first thing to review in plain English, 2-3 sentences.`,
}

function fallbackBody(alert: TrendAlert): string {
  const nums = Object.entries(alert.numbers).map(([k, v]) => `${k}: ${v}`).join(', ')
  return `${alert.root_cause} (${nums})`
}

export async function narrateBmeAlert(alert: TrendAlert): Promise<string> {
  const buildPrompt = PROMPTS[alert.type]
  if (!buildPrompt) return fallbackBody(alert)

  const result = await runSLM({ prompt: buildPrompt(alert.numbers) })
  const body = result.text?.trim()
  return body ? body : fallbackBody(alert)
}