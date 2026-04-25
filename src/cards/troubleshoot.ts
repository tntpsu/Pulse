import { probeServiceHealth, type ServiceHealth } from '../api'
import { recentFailures, shortHost, type FetchFailure } from '../diagnostics'
import { formatLoading } from './_shared'
import type { CardDefinition } from './_types'

export interface TroubleshootSnapshot {
  version: string
  origin: string
  protocol: string
  userAgent: string
  bridgeUrl: string
  widgetUrl: string
  health: ServiceHealth
  bridgeError?: string
  bridgeMs?: number
  widgetError?: string
  widgetMs?: number
  recentFailures: FetchFailure[]
  generatedAt: string
}

const BRIDGE_URL = (import.meta.env.VITE_PHILS_BRIDGE_URL?.trim() ?? '').replace(/\/$/, '')
const WIDGET_URL = import.meta.env.VITE_DUCK_OPS_URL?.trim() ?? ''

async function probeOne(url: string): Promise<{ ok: boolean; error?: string; ms: number }> {
  const started = Date.now()
  if (!url) return { ok: false, error: 'url unset', ms: 0 }
  const ctrl = new AbortController()
  const timer = window.setTimeout(() => ctrl.abort(), 4000)
  try {
    const resp = await fetch(url, { cache: 'no-store', signal: ctrl.signal })
    const ms = Date.now() - started
    if (!resp.ok) return { ok: false, error: `HTTP ${resp.status}`, ms }
    return { ok: true, ms }
  } catch (err) {
    const ms = Date.now() - started
    const name = err instanceof Error ? err.constructor.name : typeof err
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, error: `${name}: ${msg.slice(0, 60)}`, ms }
  } finally {
    window.clearTimeout(timer)
  }
}

async function load(): Promise<TroubleshootSnapshot> {
  const widgetHealth = WIDGET_URL.replace(/widget-status\.json$/, 'healthz')
  const bridgeHealth = BRIDGE_URL ? `${BRIDGE_URL}/healthz` : ''
  const [bridgeRes, widgetRes, overall] = await Promise.all([
    probeOne(bridgeHealth),
    probeOne(widgetHealth),
    probeServiceHealth(),
  ])
  return {
    version: __APP_VERSION__,
    origin: typeof window !== 'undefined' ? window.location.origin : '(no window)',
    protocol: typeof window !== 'undefined' ? window.location.protocol : '?',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '(no nav)',
    bridgeUrl: BRIDGE_URL || '(unset)',
    widgetUrl: WIDGET_URL || '(unset)',
    health: overall,
    bridgeError: bridgeRes.error,
    bridgeMs: bridgeRes.ms,
    widgetError: widgetRes.error,
    widgetMs: widgetRes.ms,
    recentFailures: recentFailures(),
    generatedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  }
}

function ago(at: number): string {
  const s = Math.round((Date.now() - at) / 1000)
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.round(s / 60)}m`
  return `${Math.round(s / 3600)}h`
}

function format(data: unknown, _error: string | null): string {
  if (!data) return formatLoading('TROUBLESHOOT')
  const s = data as TroubleshootSnapshot
  const lines: string[] = [
    `TROUBLESHOOT v${s.version}`,
    '',
    `Bridge ${s.health.bridge ? '●' : '○'} ${s.bridgeMs}ms`,
    s.bridgeError ? `  ${s.bridgeError.slice(0, 28)}` : '',
    `Widget ${s.health.widget ? '●' : '○'} ${s.widgetMs}ms`,
    s.widgetError ? `  ${s.widgetError.slice(0, 28)}` : '',
    '',
    `${s.recentFailures.length} recent fails`,
  ]
  return lines.filter(l => l !== '').join('\n')
}

function formatDetail(data: unknown, _error: string | null): string {
  if (!data) return formatLoading('TROUBLESHOOT')
  const s = data as TroubleshootSnapshot
  const ua = s.userAgent.slice(0, 60)
  const lines: string[] = [
    `TROUBLESHOOT v${s.version}`,
    '',
    `Origin: ${s.protocol}//`,
    `  ${shortHost(s.origin)}`,
    '',
    `Bridge ${s.health.bridge ? '●' : '○'}  ${s.bridgeMs}ms`,
    `  ${shortHost(s.bridgeUrl)}`,
    s.bridgeError ? `  err: ${s.bridgeError.slice(0, 44)}` : '',
    `Widget ${s.health.widget ? '●' : '○'}  ${s.widgetMs}ms`,
    `  ${shortHost(s.widgetUrl)}`,
    s.widgetError ? `  err: ${s.widgetError.slice(0, 44)}` : '',
    '',
    'Recent failures:',
  ]
  if (s.recentFailures.length === 0) {
    lines.push('  (none)')
  } else {
    for (const f of s.recentFailures.slice(0, 4)) {
      lines.push(`  ${ago(f.at)} ${shortHost(f.url)}`)
      lines.push(`    ${f.message.slice(0, 40)}`)
    }
  }
  lines.push('')
  lines.push(`UA: ${ua}`)
  lines.push(`probed at ${s.generatedAt}`)
  return lines.filter(l => l !== '').join('\n')
}

export const troubleshootCard: CardDefinition = {
  id: 'troubleshoot',
  title: 'Troubleshoot',
  hidden: true, // only reachable from the card-selector modal
  pollMs: 30_000,
  load,
  format,
  formatDetail,
}
