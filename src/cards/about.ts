import { probeServiceHealth, type ServiceHealth } from '../api'
import { formatLoading } from './_shared'
import type { CardDefinition } from './_types'

export interface AboutSnapshot {
  version: string
  bridgeUrl: string
  widgetUrl: string
  health: ServiceHealth
  bridgeError?: string
  widgetError?: string
  generatedAt: string
}

const BRIDGE_URL = (import.meta.env.VITE_PHILS_BRIDGE_URL?.trim() ?? '').replace(/\/$/, '')
const WIDGET_URL = import.meta.env.VITE_DUCK_OPS_URL?.trim() ?? ''

async function probeOne(url: string): Promise<{ ok: boolean; error?: string }> {
  if (!url) return { ok: false, error: 'url unset' }
  const ctrl = new AbortController()
  const timer = window.setTimeout(() => ctrl.abort(), 3000)
  try {
    const resp = await fetch(url, { cache: 'no-store', signal: ctrl.signal })
    if (!resp.ok) return { ok: false, error: `HTTP ${resp.status}` }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  } finally {
    window.clearTimeout(timer)
  }
}

async function load(): Promise<AboutSnapshot> {
  const widgetHealth = WIDGET_URL.replace(/widget-status\.json$/, 'healthz')
  const bridgeHealth = BRIDGE_URL ? `${BRIDGE_URL}/healthz` : ''
  const [bridgeResult, widgetResult, overall] = await Promise.all([
    probeOne(bridgeHealth),
    probeOne(widgetHealth),
    probeServiceHealth(),
  ])
  return {
    version: __APP_VERSION__,
    bridgeUrl: BRIDGE_URL || '(unset)',
    widgetUrl: WIDGET_URL || '(unset)',
    health: overall,
    bridgeError: bridgeResult.ok ? undefined : bridgeResult.error,
    widgetError: widgetResult.ok ? undefined : widgetResult.error,
    generatedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  }
}

function shortHost(url: string): string {
  if (!url || url === '(unset)') return '(unset)'
  return url.replace(/^https?:\/\//, '').replace(/\/.*$/, '').slice(0, 28)
}

function format(data: unknown, _error: string | null): string {
  if (!data) return formatLoading('ABOUT')
  const s = data as AboutSnapshot
  return [
    `ABOUT  v${s.version}`,
    '',
    `Bridge: ${s.health.bridge ? '●' : '○'} ${shortHost(s.bridgeUrl)}`,
    `Widget: ${s.health.widget ? '●' : '○'} ${shortHost(s.widgetUrl)}`,
    s.bridgeError ? `  bridge: ${s.bridgeError.slice(0, 24)}` : '',
    s.widgetError ? `  widget: ${s.widgetError.slice(0, 24)}` : '',
    '',
    `as of ${s.generatedAt}`,
  ]
    .filter(line => line !== '')
    .join('\n')
}

function formatDetail(data: unknown, _error: string | null): string {
  if (!data) return formatLoading('ABOUT')
  const s = data as AboutSnapshot
  return [
    `ABOUT — v${s.version}`,
    '',
    'Backends:',
    `  Bridge ${s.health.bridge ? '● up' : '○ down'}`,
    `    ${shortHost(s.bridgeUrl)}`,
    s.bridgeError ? `    err: ${s.bridgeError.slice(0, 40)}` : '',
    `  Widget ${s.health.widget ? '● up' : '○ down'}`,
    `    ${shortHost(s.widgetUrl)}`,
    s.widgetError ? `    err: ${s.widgetError.slice(0, 40)}` : '',
    '',
    `Probed at ${s.generatedAt}`,
  ]
    .filter(line => line !== '')
    .join('\n')
}

export const aboutCard: CardDefinition = {
  id: 'about',
  title: 'About',
  pollMs: 60_000,
  load,
  format,
  formatDetail,
}
