import { loadDuckOps } from '../api'
import type { DuckOpsStatus } from '../types'
import { formatError, formatLoading } from './_shared'
import type { CardDefinition } from './_types'

function format(data: unknown, error: string | null): string {
  const title = 'STUCK SHIP'
  if (error) return formatError(title, error)
  if (!data) return formatLoading(title)
  const s = (data as DuckOpsStatus).shipmentsStuck
  if (s.count === 0) {
    return [title, '', s.note ? `(${s.note})` : 'None stuck >5 days'].join('\n')
  }
  const lines = s.samples.map(x => `${x.daysStuck}d - ${x.tracking} (${x.buyer})`)
  return [title, '', `Total: ${s.count}`, ...lines].join('\n')
}

function formatDetail(data: unknown, error: string | null): string {
  const title = 'STUCK SHIPMENTS'
  if (error) return formatError(title, error)
  if (!data) return formatLoading(title)
  const s = (data as DuckOpsStatus).shipmentsStuck
  if (s.count === 0) {
    return [title, '', 'No shipments stuck >5 days.', s.note ? `Note: ${s.note}` : '']
      .filter(Boolean)
      .join('\n')
  }
  const lines = s.samples.map(x => `- ${x.tracking} (${x.buyer}) stuck ${x.daysStuck}d`)
  return [title, '', `Total stuck: ${s.count}`, 'Worst offenders:', ...lines].join('\n')
}

export const duckOpsStuckCard: CardDefinition = {
  id: 'duckops-stuck',
  title: 'Stuck Ships',
  pollMs: 600_000,
  load: () => loadDuckOps(),
  format,
  formatDetail,
}
