import { approveCandidate, loadDuckOps, rejectCandidate } from '../api'
import type { DuckOpsPendingApproval, DuckOpsStatus } from '../types'
import { formatError, formatLoading } from './_shared'
import type { CardDefinition, PickerOption } from './_types'

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
  ].join('\n')
}

function approvalActions(item: unknown): PickerOption[] {
  const a = item as DuckOpsPendingApproval
  const shortTitle = a.title.length > 40 ? `${a.title.slice(0, 40)}...` : a.title
  return [
    {
      // DRY RUN intentionally listed FIRST to nudge the user to preview before
      // firing. No undo because it's read-only: nothing to reverse.
      label: 'DRY RUN',
      run: async () => {
        const r = await approveCandidate(a.artifactId, { dryRun: true })
        return {
          ok: r.ok,
          message: r.ok
            ? `DRY RUN OK: ${shortTitle}\n(no email sent)`
            : `DRY RUN FAILED: ${r.error?.slice(0, 60) ?? 'unknown'}`,
        }
      },
    },
    {
      // No undo on live approve — the outbound email has already sent by the
      // time this resolves. The DRY RUN option above exists to compensate.
      label: 'APPROVE',
      run: async () => {
        const r = await approveCandidate(a.artifactId)
        return {
          ok: r.ok,
          message: r.ok
            ? `APPROVED: ${shortTitle}`
            : `FAILED: ${r.error?.slice(0, 60) ?? 'unknown'}`,
        }
      },
    },
    {
      label: 'REJECT',
      run: async () => {
        const r = await rejectCandidate(a.artifactId)
        return {
          ok: r.ok,
          message: r.ok
            ? `REJECTED: ${shortTitle}`
            : `FAILED: ${r.error?.slice(0, 60) ?? 'unknown'}`,
        }
      },
    },
  ]
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
  getActions: approvalActions,
}
