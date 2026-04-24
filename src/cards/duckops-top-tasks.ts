import { loadDuckOps } from '../api'
import type { DuckOpsStatus, DuckOpsTask } from '../types'
import { formatError, formatLoading } from './_shared'
import type { CardDefinition } from './_types'

function shortPreview(task: DuckOpsTask): string {
  return (task.summary && task.summary.length > 0 ? task.summary : task.action).slice(0, 50)
}

function format(data: unknown, error: string | null): string {
  const title = 'TOP TASKS'
  if (error) return formatError(title, error)
  if (!data) return formatLoading(title)
  const tasks = (data as DuckOpsStatus).topTasks
  if (tasks.length === 0) return [title, '', 'No urgent tasks'].join('\n')
  const lines = tasks.map((t, i) => `${i + 1}. ${shortPreview(t)}`)
  return [title, '', ...lines].join('\n')
}

function formatDetail(data: unknown, error: string | null): string {
  const title = 'TOP TASKS'
  if (error) return formatError(title, error)
  if (!data) return formatLoading(title)
  const tasks = (data as DuckOpsStatus).topTasks
  if (tasks.length === 0) return [title, '', 'No urgent tasks right now.'].join('\n')
  const lines: string[] = []
  tasks.forEach((t, i) => {
    const who = t.customerName ? t.customerName : t.id
    lines.push(`${i + 1}. [${t.type}] ${who}`)
    if (t.summary) lines.push(`   ${t.summary}`)
    lines.push('')
  })
  return [title, '', ...lines].join('\n')
}

export const duckOpsTopTasksCard: CardDefinition = {
  id: 'duckops-top-tasks',
  title: 'Top Tasks',
  pollMs: 600_000,
  load: () => loadDuckOps(),
  format,
  formatDetail,
}
