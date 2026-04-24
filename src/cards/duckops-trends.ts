import { loadDuckOps } from '../api'
import type { DuckOpsStatus } from '../types'
import { formatError, formatLoading } from './_shared'
import type { CardDefinition } from './_types'

function format(data: unknown, error: string | null): string {
  const title = 'NEW TREND IDEAS'
  if (error) return formatError(title, error)
  if (!data) return formatLoading(title)
  const ideas = (data as DuckOpsStatus).trendIdeas
  if (ideas.length === 0) return [title, '', 'No new gaps — caught up'].join('\n')
  const lines = ideas.slice(0, 4).map((t, i) => `${i + 1}. ${t.title}`)
  return [title, '', 'Not in catalog:', ...lines].join('\n')
}

function formatDetail(data: unknown, error: string | null): string {
  const title = 'NEW TREND IDEAS'
  if (error) return formatError(title, error)
  if (!data) return formatLoading(title)
  const ideas = (data as DuckOpsStatus).trendIdeas
  if (ideas.length === 0) return [title, '', 'No catalog gaps right now.'].join('\n')
  const lines = ideas.map((t, i) => {
    const tag = t.status === 'partial' ? ' (partial)' : ' (new)'
    return `${i + 1}. ${t.title}${tag}\n   trend score: ${Math.round(t.score)}`
  })
  return [
    title,
    '',
    'Trends NOT yet covered by your catalog:',
    '',
    ...lines,
  ].join('\n')
}

export const duckOpsTrendsCard: CardDefinition = {
  id: 'duckops-trends',
  title: 'Trends',
  pollMs: 1_800_000,
  load: () => loadDuckOps(),
  format,
  formatDetail,
}
