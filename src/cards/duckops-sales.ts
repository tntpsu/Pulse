import { loadDuckOps } from '../api'
import type { DuckOpsSalesTrends, DuckOpsStatus } from '../types'
import { formatError, formatLoading } from './_shared'
import type { CardDefinition } from './_types'

const ZERO_TRENDS: DuckOpsSalesTrends = {
  todayUnits: 0, todayOrders: 0,
  yesterdayUnits: 0, yesterdayOrders: 0,
  wtdUnits: 0, wtdOrders: 0,
  wtdLastWeekUnits: 0, wtdLastWeekOrders: 0,
  mtdUnits: 0, mtdOrders: 0,
  mtdLastMonthUnits: 0, mtdLastMonthOrders: 0,
  source: 'etsy',
}

function pct(current: number, prior: number): string {
  if (prior <= 0) return current > 0 ? '+new' : 'flat'
  const change = ((current - prior) / prior) * 100
  const rounded = Math.round(change)
  if (rounded === 0) return 'flat'
  return rounded > 0 ? `+${rounded}%` : `${rounded}%`
}

function format(data: unknown, error: string | null): string {
  const title = 'DUCK SALES'
  if (error) return formatError(title, error)
  if (!data) return formatLoading(title)
  const t = (data as DuckOpsStatus).salesTrends ?? ZERO_TRENDS
  return [
    title,
    '',
    `Today:  ${t.todayUnits}u  /  ${t.todayOrders} ord`,
    `Yest:   ${t.yesterdayUnits}u  /  ${t.yesterdayOrders} ord`,
    `WoW:    ${pct(t.wtdUnits, t.wtdLastWeekUnits)}  (units WTD)`,
    `MoM:    ${pct(t.mtdUnits, t.mtdLastMonthUnits)}  (units MTD)`,
  ].join('\n')
}

function formatDetail(data: unknown, error: string | null): string {
  const title = 'DUCK SALES (Etsy)'
  if (error) return formatError(title, error)
  if (!data) return formatLoading(title)
  const t = (data as DuckOpsStatus).salesTrends ?? ZERO_TRENDS
  return [
    title,
    '',
    `Today:      ${t.todayUnits}u  /  ${t.todayOrders} ord`,
    `Yesterday:  ${t.yesterdayUnits}u  /  ${t.yesterdayOrders} ord`,
    '',
    'Week-to-date:',
    `  This: ${t.wtdUnits}u (${t.wtdOrders} ord)`,
    `  Last: ${t.wtdLastWeekUnits}u (${t.wtdLastWeekOrders} ord)`,
    `  WoW:  ${pct(t.wtdUnits, t.wtdLastWeekUnits)}`,
    '',
    'Month-to-date:',
    `  This: ${t.mtdUnits}u (${t.mtdOrders} ord)`,
    `  Last: ${t.mtdLastMonthUnits}u (${t.mtdLastMonthOrders} ord)`,
    `  MoM:  ${pct(t.mtdUnits, t.mtdLastMonthUnits)}`,
  ].join('\n')
}

export const duckOpsSalesCard: CardDefinition = {
  id: 'duckops-sales',
  title: 'Duck Sales',
  pollMs: 600_000,
  load: () => loadDuckOps(),
  format,
  formatDetail,
}
