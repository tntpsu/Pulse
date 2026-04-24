import { loadDuckOps } from '../api'
import type { DuckOpsStatus } from '../types'
import { formatError, formatLoading } from './_shared'
import type { CardDefinition } from './_types'

function shipByLabel(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function format(data: unknown, error: string | null): string {
  const title = 'PACK QUEUE'
  if (error) return formatError(title, error)
  if (!data) return formatLoading(title)
  const p = (data as DuckOpsStatus).packing
  const items = p.packItems ?? []
  const totalUnits = items.reduce((sum, i) => sum + i.qty, 0)
  const lines: string[] = [
    title,
    '',
    `${totalUnits}u across ${items.length} titles`,
    `Etsy: ${p.etsy}u  /  Shopify: ${p.shopify}u`,
  ]
  // Show the next 3 ship-by groups so the dashboard surfaces urgency.
  const withDate = items.filter(i => i.shipBy)
  if (withDate.length > 0) {
    lines.push('', 'Next out:')
    for (const i of withDate.slice(0, 3)) {
      const t = i.title.length > 22 ? i.title.slice(0, 20) + '..' : i.title
      lines.push(`  ${shipByLabel(i.shipBy)}  ${i.qty}× ${t}`)
    }
  }
  return lines.join('\n')
}

function formatDetail(data: unknown, error: string | null): string {
  const title = 'PACK QUEUE'
  if (error) return formatError(title, error)
  if (!data) return formatLoading(title)
  const p = (data as DuckOpsStatus).packing
  const items = p.packItems ?? []
  if (items.length === 0) return [title, '', 'Nothing to pack.'].join('\n')
  const total = items.reduce((sum, i) => sum + i.qty, 0)
  const lines = items.map(i => {
    const date = shipByLabel(i.shipBy)
    const dateCol = (date || '------').padEnd(6)
    const t = i.title.length > 26 ? i.title.slice(0, 24) + '..' : i.title
    return `${dateCol}  ${String(i.qty).padStart(3)}  ${t}`
  })
  return [title, '', `${total}u total · sorted by ship-by`, '', ...lines].join('\n')
}

export const duckOpsPackQueueCard: CardDefinition = {
  id: 'duckops-pack-queue',
  title: 'Pack Queue',
  pollMs: 600_000,
  load: () => loadDuckOps(),
  format,
  formatDetail,
}
