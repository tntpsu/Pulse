import { loadDuckOps } from '../api'
import type { DuckOpsStatus } from '../types'
import { formatError, formatLoading } from './_shared'
import type { CardDefinition } from './_types'

function format(data: unknown, error: string | null): string {
  const title = 'INSIGHTS'
  if (error) return formatError(title, error)
  if (!data) return formatLoading(title)
  const w = (data as DuckOpsStatus).weeklyInsights
  const seller = w.bestSellerThisWeek
    ? `Top: ${w.bestSellerThisWeek.title} (${w.bestSellerThisWeek.units})`
    : 'Top: —'
  return [
    title,
    '',
    seller,
    `Unsold (Etsy ${w.unsoldInWindow.windowDays}d): ${w.unsoldInWindow.count}`,
  ].join('\n')
}

function formatDetail(data: unknown, error: string | null): string {
  const title = 'INSIGHTS'
  if (error) return formatError(title, error)
  if (!data) return formatLoading(title)
  const w = (data as DuckOpsStatus).weeklyInsights
  const lines: string[] = [title, '']

  if (w.bestSellerThisWeek) {
    lines.push('Best seller this week:')
    lines.push(`  ${w.bestSellerThisWeek.title}`)
    lines.push(`  ${w.bestSellerThisWeek.units} units`)
    lines.push('')
  } else {
    lines.push('Best seller this week:  —', '')
  }

  lines.push(`Unsold on Etsy (${w.unsoldInWindow.windowDays}d):`)
  lines.push(`  ${w.unsoldInWindow.count} active listings`)
  if (w.unsoldInWindow.sample.length > 0) {
    for (const t of w.unsoldInWindow.sample.slice(0, 5)) {
      lines.push(`  - ${t}`)
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
