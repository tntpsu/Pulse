import { loadGithubPrs } from '../api'
import type { GithubPrsSnapshot } from '../types'
import { formatError, formatLoading } from './_shared'
import type { CardDefinition } from './_types'

function format(data: unknown, error: string | null): string {
  const title = 'PR REVIEW'
  if (error) return formatError(title, error)
  if (!data) return formatLoading(title)
  const s = data as GithubPrsSnapshot
  if (s.status !== 'ok') return [title, '', s.note ?? s.status].join('\n')
  if (s.prs.length === 0) return [title, '', 'Inbox zero'].join('\n')
  const lines = s.prs.slice(0, 4).map(p => `${p.repo}#${p.number}`)
  return [title, '', `${s.prs.length} waiting`, ...lines].join('\n')
}

function formatDetail(data: unknown, error: string | null): string {
  const title = 'PRs WAITING REVIEW'
  if (error) return formatError(title, error)
  if (!data) return formatLoading(title)
  const s = data as GithubPrsSnapshot
  if (s.status !== 'ok') return [title, '', s.note ?? s.status].join('\n')
  if (s.prs.length === 0) return [title, '', 'No PRs awaiting your review.'].join('\n')
  const lines = s.prs.map(p => `${p.repo}#${p.number}\n  ${p.title}\n  by ${p.author}`)
  return [title, '', `${s.prs.length} waiting on you:`, ...lines].join('\n')
}

export const githubPrsCard: CardDefinition = {
  id: 'github-prs',
  title: 'PRs',
  pollMs: 60_000,
  load: () => loadGithubPrs(),
  format,
  formatDetail,
}
