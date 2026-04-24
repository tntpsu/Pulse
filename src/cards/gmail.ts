import { loadGmailUnread } from '../api'
import type { GmailUnreadSnapshot } from '../types'
import { formatError, formatLoading } from './_shared'
import type { CardDefinition } from './_types'

function format(data: unknown, error: string | null): string {
  const title = 'GMAIL'
  if (error) return formatError(title, error)
  if (!data) return formatLoading(title)
  const snap = data as GmailUnreadSnapshot
  if (snap.status !== 'ok') return [title, '', snap.note ?? snap.status].join('\n')
  if (snap.unreadCount === 0) return [title, '', 'Inbox zero'].join('\n')
  const lines = snap.items.slice(0, 3).map(m => `- ${m.from}: ${m.subject}`)
  return [title, '', `${snap.unreadCount} unread`, ...lines].join('\n')
}

function formatDetail(data: unknown, error: string | null): string {
  const title = 'GMAIL - UNREAD'
  if (error) return formatError(title, error)
  if (!data) return formatLoading(title)
  const snap = data as GmailUnreadSnapshot
  if (snap.status !== 'ok') return [title, '', snap.note ?? snap.status].join('\n')
  if (snap.unreadCount === 0) return [title, '', 'No unread messages in inbox.'].join('\n')
  const lines = snap.items.map(m => `${m.from}\n  ${m.subject}`)
  return [title, '', `${snap.unreadCount} total unread`, '', ...lines].join('\n')
}

export const gmailCard: CardDefinition = {
  id: 'gmail',
  title: 'Gmail',
  pollMs: 120_000,
  load: () => loadGmailUnread(),
  format,
  formatDetail,
}
