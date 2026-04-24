import { loadGithubCi } from '../api'
import type { GithubCiSnapshot } from '../types'
import { formatError, formatLoading } from './_shared'
import type { CardDefinition } from './_types'

function symbol(c: string): string {
  if (c === 'success') return 'OK'
  if (c === 'failure') return 'X '
  if (c === 'in_progress') return '..'
  return '? '
}

function format(data: unknown, error: string | null): string {
  const title = 'CI'
  if (error) return formatError(title, error)
  if (!data) return formatLoading(title)
  const s = data as GithubCiSnapshot
  if (s.status !== 'ok') return [title, '', s.note ?? s.status].join('\n')
  if (s.repos.length === 0) return [title, '', 'No repos configured'].join('\n')
  const lines = s.repos.map(r => `${symbol(r.conclusion)} ${r.repo.split('/').pop()}`)
  return [title, '', ...lines].join('\n')
}

function formatDetail(data: unknown, error: string | null): string {
  const title = 'CI STATUS'
  if (error) return formatError(title, error)
  if (!data) return formatLoading(title)
  const s = data as GithubCiSnapshot
  if (s.status !== 'ok') return [title, '', s.note ?? s.status].join('\n')
  if (s.repos.length === 0) return [title, '', 'No repos configured'].join('\n')
  const lines = s.repos.map(
    r => `${r.repo}\n  ${r.conclusion} on ${r.branch ?? '?'} (${r.workflow ?? 'workflow'})`,
  )
  return [title, '', ...lines].join('\n')
}

export const githubCiCard: CardDefinition = {
  id: 'github-ci',
  title: 'CI',
  pollMs: 60_000,
  load: () => loadGithubCi(),
  format,
  formatDetail,
}
