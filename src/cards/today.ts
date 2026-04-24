import {
  loadCalendar,
  loadDuckOps,
  loadGithubCi,
  loadGithubPrs,
  loadGmailUnread,
  loadTasks,
} from '../api'
import type {
  CalendarSnapshot,
  DuckOpsStatus,
  GithubCiSnapshot,
  GithubPrsSnapshot,
  GmailUnreadSnapshot,
  TasksSnapshot,
} from '../types'
import { formatError, formatLoading } from './_shared'
import type { CardDefinition } from './_types'

// Only surface tasks from MyJeepDuck — mirrors the tasks card's TARGET_LIST.
const TARGET_LIST = 'MyJeepDuck'

export interface TodaySnapshot {
  approvals: number | null
  tasks: number | null
  stuck: number | null
  prs: number | null
  ciFailing: number | null
  unread: number | null
  nextEvent: { startLabel: string; title: string } | null
}

function countTasks(snap: TasksSnapshot): number {
  if (snap.status !== 'ok') return 0
  return snap.lists
    .filter(l => l.title === TARGET_LIST)
    .reduce((sum, l) => sum + l.tasks.length, 0)
}

function countFailingCi(snap: GithubCiSnapshot): number {
  if (snap.status !== 'ok') return 0
  return snap.repos.filter(r => r.conclusion && r.conclusion !== 'success').length
}

function countPrs(snap: GithubPrsSnapshot): number {
  if (snap.status !== 'ok') return 0
  return snap.prs.length
}

function pickNextEvent(snap: CalendarSnapshot): { startLabel: string; title: string } | null {
  if (snap.status !== 'ok') return null
  const first = snap.events[0]
  return first ? { startLabel: first.startLabel, title: first.title } : null
}

async function load(): Promise<TodaySnapshot> {
  const [duckOps, tasks, prs, ci, gmail, calendar] = await Promise.allSettled([
    loadDuckOps(),
    loadTasks(),
    loadGithubPrs(),
    loadGithubCi(),
    loadGmailUnread(),
    loadCalendar(),
  ])
  return {
    approvals:
      duckOps.status === 'fulfilled'
        ? (duckOps.value as DuckOpsStatus).pendingApprovals.length
        : null,
    tasks: tasks.status === 'fulfilled' ? countTasks(tasks.value as TasksSnapshot) : null,
    stuck:
      duckOps.status === 'fulfilled'
        ? (duckOps.value as DuckOpsStatus).shipmentsStuck?.count ?? 0
        : null,
    prs: prs.status === 'fulfilled' ? countPrs(prs.value as GithubPrsSnapshot) : null,
    ciFailing:
      ci.status === 'fulfilled' ? countFailingCi(ci.value as GithubCiSnapshot) : null,
    unread:
      gmail.status === 'fulfilled'
        ? (gmail.value as GmailUnreadSnapshot).unreadCount
        : null,
    nextEvent:
      calendar.status === 'fulfilled' ? pickNextEvent(calendar.value as CalendarSnapshot) : null,
  }
}

function fmtCount(n: number | null): string {
  if (n === null) return ' —'
  return n.toString().padStart(2, ' ')
}

function format(data: unknown, error: string | null): string {
  const title = 'TODAY'
  if (error) return formatError(title, error)
  if (!data) return formatLoading(title)
  const s = data as TodaySnapshot
  const rows = [
    `Approvals  ${fmtCount(s.approvals)}`,
    `Tasks      ${fmtCount(s.tasks)}`,
    `Stuck      ${fmtCount(s.stuck)}`,
    `PRs        ${fmtCount(s.prs)}`,
    `CI fail    ${fmtCount(s.ciFailing)}`,
    `Unread     ${fmtCount(s.unread)}`,
  ]
  const next = s.nextEvent
    ? ['', 'Next:', `${s.nextEvent.startLabel} ${s.nextEvent.title.slice(0, 24)}`]
    : []
  return [title, '', ...rows, ...next].join('\n')
}

function formatDetail(data: unknown, error: string | null): string {
  // Detail view adds a bit more context when expanded.
  const title = 'TODAY — DETAIL'
  if (error) return formatError(title, error)
  if (!data) return formatLoading(title)
  const s = data as TodaySnapshot
  const rows = [
    `Approvals      ${fmtCount(s.approvals)}`,
    `Open tasks     ${fmtCount(s.tasks)}`,
    `Stuck ships    ${fmtCount(s.stuck)}`,
    `PRs to review  ${fmtCount(s.prs)}`,
    `CI failing     ${fmtCount(s.ciFailing)}`,
    `Unread mail    ${fmtCount(s.unread)}`,
  ]
  const next = s.nextEvent
    ? ['', 'Next event:', `${s.nextEvent.startLabel}`, s.nextEvent.title]
    : ['', 'No upcoming event']
  return [title, '', ...rows, ...next].join('\n')
}

export const todayCard: CardDefinition = {
  id: 'today',
  title: 'Today',
  pollMs: 180_000,
  load,
  format,
  formatDetail,
}
