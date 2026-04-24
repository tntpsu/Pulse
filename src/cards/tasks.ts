import { completeTask, loadTasks, skipTask } from '../api'
import type { FlatTask, TasksSnapshot } from '../types'
import { formatError, formatLoading } from './_shared'
import type { CardDefinition } from './_types'

// Only show tasks from the MyJeepDuck list — that's where customer custom-build
// asks live. The other Google Tasks lists (Default, Long Reminders) aren't
// useful glance-data right now.
const TARGET_LIST = 'MyJeepDuck'

function flatten(snap: TasksSnapshot): FlatTask[] {
  const out: FlatTask[] = []
  for (const list of snap.lists) {
    if (list.title !== TARGET_LIST) continue
    for (const t of list.tasks) {
      out.push({
        listTitle: list.title,
        listId: list.id,
        taskId: t.id,
        title: t.title,
        dueLabel: t.dueLabel,
      })
    }
  }
  return out
}

function format(data: unknown, error: string | null): string {
  const title = 'DUCK TASKS'
  if (error) return formatError(title, error)
  if (!data) return formatLoading(title)
  const snap = data as TasksSnapshot
  if (snap.status !== 'ok') return [title, '', snap.note ?? snap.status].join('\n')
  const flat = flatten(snap)
  if (flat.length === 0) return [title, '', 'All clear'].join('\n')
  const lines = flat.slice(0, 4).map((t, i) => `${i + 1}. ${t.title.slice(0, 36)}`)
  return [title, '', `${flat.length} open in ${TARGET_LIST}`, ...lines].join('\n')
}

function formatDetail(data: unknown, error: string | null): string {
  const title = 'DUCK TASKS'
  if (error) return formatError(title, error)
  if (!data) return formatLoading(title)
  const snap = data as TasksSnapshot
  if (snap.status !== 'ok') {
    return [title, '', snap.note ?? snap.status, '', 'Run oauth_setup.py to authorize.'].join('\n')
  }
  const flat = flatten(snap)
  if (flat.length === 0) return [title, '', 'All caught up.'].join('\n')
  const lines = flat.slice(0, 10).map((t, i) => {
    const due = t.dueLabel ? ` (${t.dueLabel})` : ''
    return `${i + 1}. ${t.title}${due}`
  })
  return [title, '', ...lines].join('\n')
}

function formatItem(item: unknown, index: number, total: number): string {
  const t = item as FlatTask
  const due = t.dueLabel ? `Due: ${t.dueLabel}` : 'No due date'
  return [
    `DUCK TASK ${index + 1}/${total}`,
    '',
    t.title,
    '',
    due,
    '',
    'Swipe to choose COMPLETE or SKIP, ring to confirm',
  ].join('\n')
}

export const tasksCard: CardDefinition = {
  id: 'duck-tasks',
  title: 'Duck Tasks',
  pollMs: 120_000,
  load: () => loadTasks(),
  format,
  formatDetail,
  getItems: data => flatten(data as TasksSnapshot),
  formatItem,
  confirmLabel: 'COMPLETE',
  rejectLabel: 'SKIP',
  confirmPrompt: item => {
    const t = item as FlatTask
    return `COMPLETE: ${t.title}\nRing-tap again to confirm`
  },
  confirmAction: async item => {
    const t = item as FlatTask
    const result = await completeTask(t.listId, t.taskId)
    return {
      ok: result.ok,
      message: result.ok
        ? `DONE: ${t.title}`
        : `FAILED: ${result.error?.slice(0, 60) ?? 'unknown'}`,
    }
  },
  rejectPrompt: item => {
    const t = item as FlatTask
    return `SKIP: ${t.title} (hidden 7d)\nRing-tap again to confirm`
  },
  rejectAction: async item => {
    const t = item as FlatTask
    const result = await skipTask(t.taskId)
    return {
      ok: result.ok,
      message: result.ok
        ? `SKIPPED: ${t.title}`
        : `FAILED: ${result.error?.slice(0, 60) ?? 'unknown'}`,
    }
  },
}
