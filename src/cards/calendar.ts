import { loadCalendar } from '../api'
import type { CalendarSnapshot } from '../types'
import { formatError, formatLoading } from './_shared'
import type { CardDefinition } from './_types'

function format(data: unknown, error: string | null): string {
  const title = 'CALENDAR'
  if (error) return formatError(title, error)
  if (!data) return formatLoading(title)
  const snap = data as CalendarSnapshot
  if (snap.status === 'unconfigured') return [title, '', 'Bridge not set'].join('\n')
  if (snap.events.length === 0) {
    const tag = snap.status === 'mock' ? ' (mock)' : ''
    return [title + tag, '', 'No events today'].join('\n')
  }
  const lines = snap.events.slice(0, 4).map(e => `${e.startLabel} ${e.title}`)
  const tag = snap.status === 'mock' ? ' (mock)' : ''
  return [title + tag, '', ...lines].join('\n')
}

export const calendarCard: CardDefinition = {
  id: 'calendar',
  title: 'Calendar',
  pollMs: 60_000,
  load: () => loadCalendar(),
  format,
}
