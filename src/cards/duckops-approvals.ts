import { approveCandidate, loadDuckOps, rejectCandidate } from '../api'
import type { DuckOpsPendingApproval, DuckOpsStatus } from '../types'
import { formatError, formatLoading } from './_shared'
import type { CardDefinition } from './_types'

function format(data: unknown, error: string | null): string {
  const title = 'DUCK POSTS'
  if (error) return formatError(title, error)
  if (!data) return formatLoading(title)
  const list = (data as DuckOpsStatus).pendingApprovals
  if (list.length === 0) return [title, '', 'No drafts pending'].join('\n')
  const lines = list.slice(0, 3).map((a, i) => `${i + 1}. [${a.flow}] ${a.title}`)
  return [title, '', `${list.length} drafts waiting`, ...lines].join('\n')
}

function formatDetail(data: unknown, error: string | null): string {
  // Fallback if itemized rendering disabled.
  const title = 'DUCK POST APPROVALS'
  if (error) return formatError(title, error)
  if (!data) return formatLoading(title)
  const list = (data as DuckOpsStatus).pendingApprovals
  if (list.length === 0) return [title, '', 'Nothing waiting on you.'].join('\n')
  const lines = list.slice(0, 6).map((a, i) => {
    const targets = a.targets.length ? ` → ${a.targets.join(',')}` : ''
    return `${i + 1}. [${a.flow}] ${a.title}${targets}`
  })
  const more = list.length > 6 ? [`+${list.length - 6} more`] : []
  return [title, '', `${list.length} total`, ...lines, ...more].join('\n')
}

function formatItem(item: unknown, index: number, total: number): string {
  const a = item as DuckOpsPendingApproval
  const targets = a.targets.length ? a.targets.join(', ') : '-'
  const preview = a.bodyPreview ? a.bodyPreview : '(no preview)'
  return [
    `DUCK POST ${index + 1}/${total}`,
    `Flow: ${a.flow}   To: ${targets}`,
    `${a.title}`,
    '',
    preview,
    '',
    'Ring: arm APPROVE | swipe: switch to REJECT',
  ].join('\n')
}

export const duckOpsApprovalsCard: CardDefinition = {
  id: 'duckops-approvals',
  title: 'Duck Post Approvals',
  pollMs: 600_000,
  load: () => loadDuckOps(),
  format,
  formatDetail,
  getItems: data => (data as DuckOpsStatus).pendingApprovals,
  formatItem,
  confirmPrompt: item => {
    const a = item as DuckOpsPendingApproval
    return `APPROVE: ${a.title}\nRing-tap again to confirm`
  },
  confirmAction: async item => {
    const a = item as DuckOpsPendingApproval
    const result = await approveCandidate(a.artifactId)
    return {
      ok: result.ok,
      message: result.ok
        ? `APPROVED: ${a.title}`
        : `FAILED: ${result.error?.slice(0, 60) ?? 'unknown'}`,
    }
  },
  rejectPrompt: item => {
    const a = item as DuckOpsPendingApproval
    return `REJECT: ${a.title}\nRing-tap again to confirm`
  },
  rejectAction: async item => {
    const a = item as DuckOpsPendingApproval
    const result = await rejectCandidate(a.artifactId)
    return {
      ok: result.ok,
      message: result.ok
        ? `REJECTED: ${a.title}`
        : `FAILED: ${result.error?.slice(0, 60) ?? 'unknown'}`,
    }
  },
}
