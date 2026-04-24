import { loadDuckOps } from '../api'
import type { DuckOpsStatus } from '../types'
import { formatError, formatLoading } from './_shared'
import type { CardDefinition } from './_types'

// Hard cap on title length for the right-column (336px): longer strings wrap
// and push the layout around. Keep it in one place so both format and
// formatDetail agree.
const TITLE_CAP = 22

function short(title: string): string {
  return title.length > TITLE_CAP ? `${title.slice(0, TITLE_CAP - 1).trimEnd()}…` : title
}

function topSellers(w: DuckOpsStatus['weeklyInsights']): Array<{ title: string; units: number }> {
  if (w.topSellersThisWeek && w.topSellersThisWeek.length > 0) return w.topSellersThisWeek
  return w.bestSellerThisWeek ? [w.bestSellerThisWeek] : []
}

function format(data: unknown, error: string | null): string {
  const title = 'INSIGHTS'
  if (error) return formatError(title, error)
  if (!data) return formatLoading(title)
  const w = (data as DuckOpsStatus).weeklyInsights
  const sellers = topSellers(w)
  const sellerLines =
    sellers.length > 0
      ? sellers.map((s, i) => `${i + 1}. ${short(s.title)} (${s.units})`)
      : ['—']
  return [
    title,
    '',
    'Top sellers:',
    ...sellerLines,
    '',
    `Unsold (${w.unsoldInWindow.windowDays}d): ${w.unsoldInWindow.count}`,
  ].join('\n')
}

function formatDetail(data: unknown, error: string | null): string {
  const title = 'INSIGHTS'
  if (error) return formatError(title, error)
  if (!data) return formatLoading(title)
  const w = (data as DuckOpsStatus).weeklyInsights
  const lines: string[] = [title, '']

  const sellers = topSellers(w)
  lines.push('Top sellers this week:')
  if (sellers.length === 0) {
    lines.push('  —')
  } else {
    for (let i = 0; i < sellers.length; i += 1) {
      const s = sellers[i]!
      lines.push(`  ${i + 1}. ${short(s.title)}  (${s.units} units)`)
    }
  }
  lines.push('')

  lines.push(`Unsold on Etsy (${w.unsoldInWindow.windowDays}d):`)
  lines.push(`  ${w.unsoldInWindow.count} active listings`)
  if (w.unsoldInWindow.sample.length > 0) {
    for (const t of w.unsoldInWindow.sample.slice(0, 5)) {
      lines.push(`  - ${short(t)}`)
    }
  }

  return lines.join('\n')
}

export const duckOpsInsightsCard: CardDefinition = {
  id: 'duckops-insights',
  title: 'Insights',
  pollMs: 1_800_000,
  load: () => loadDuckOps(),
  format,
  formatDetail,
}
