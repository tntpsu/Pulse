import { completeTask, loadTasks, skipTask, uncompleteTask, unskipTask } from '../api'
import type { FlatTask, TasksSnapshot } from '../types'
import { formatError, formatLoading } from './_shared'
import type { CardDefinition, PickerOption } from './_types'

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
  ].join('\n')
}

function taskActions(item: unknown): PickerOption[] {
  const t = item as FlatTask
  const shortTitle = t.title.length > 40 ? `${t.title.slice(0, 40)}...` : t.title
  return [
    {
      label: 'COMPLETE',
      run: async () => {
        const r = await completeTask(t.listId, t.taskId)
        return {
          ok: r.ok,
          message: r.ok ? `DONE: ${shortTitle}` : `FAILED: ${r.error?.slice(0, 60) ?? 'unknown'}`,
        }
      },
      undo: async () => {
        const r = await uncompleteTask(t.listId, t.taskId)
        return {
          ok: r.ok,
          message: r.ok ? shortTitle : r.error?.slice(0, 60) ?? 'unknown',
        }
      },
    },
    {
      label: 'SKIP 7 DAYS',
      run: async () => {
        const r = await skipTask(t.taskId)
        return {
          ok: r.ok,
          message: r.ok ? `SKIPPED 7d: ${shortTitle}` : `FAILED: ${r.error?.slice(0, 60) ?? 'unknown'}`,
        }
      },
      undo: async () => {
        const r = await unskipTask(t.taskId)
        return {
          ok: r.ok,
          message: r.ok ? shortTitle : r.error?.slice(0, 60) ?? 'unknown',
        }
      },
    },
    {
      label: 'SHOW LIST',
      run: async () => ({
        ok: true,
        message: `List: ${t.listTitle}\n(use phone Tasks app to edit)`,
      }),
    },
  ]
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
  getActions: taskActions,
}
