import type {
  CalendarSnapshot,
  DuckOpsStatus,
  GithubCiSnapshot,
  GithubPrsSnapshot,
  GmailUnreadSnapshot,
  MessageSummary,
  NowPlayingSnapshot,
  SportsGameSnapshot,
  TasksSnapshot,
  WeatherSnapshot,
} from './types'

const DUCK_OPS_URL = import.meta.env.VITE_DUCK_OPS_URL?.trim() ?? ''
const DUCK_OPS_APPROVE_URL = DUCK_OPS_URL.replace(/widget-status\.json$/, 'approvals/approve')
const DUCK_OPS_REJECT_URL = DUCK_OPS_URL.replace(/widget-status\.json$/, 'approvals/reject')
const BRIDGE_URL = (import.meta.env.VITE_PHILS_BRIDGE_URL?.trim() ?? '').replace(/\/$/, '')
const WEATHER_LAT = import.meta.env.VITE_WEATHER_LAT?.trim() ?? '40.4406'
const WEATHER_LON = import.meta.env.VITE_WEATHER_LON?.trim() ?? '-79.9959'

// No AbortController — the Even WebView's fetch to LAN IPs on a packaged .ehpk
// takes longer than a short client-side timeout (Duck Ops proved this by using
// no timeout at all and working fine). Let fetch take as long as it needs;
// the card's card-level poll will drop any stale in-flight result if the user
// swipes away in the meantime.
//
// Stale-data fallback: every successful response is cached per-URL. If a later
// fetch fails (transient LAN drop), we return the last good payload tagged
// with `__staleAgeMs` so cards can show "stale Xm ago" instead of an error.
interface StaleTag {
  __staleAgeMs?: number
}

const staleCache = new Map<string, { fetchedAt: number; data: unknown }>()
const STALE_FALLBACK_MAX_MS = 60 * 60 * 1000 // 1 hour

async function fetchJson<T>(url: string, _timeoutMs?: number): Promise<T> {
  const started = Date.now()
  let hostPath: string
  try {
    const u = new URL(url)
    hostPath = `${u.port}${u.pathname}`
  } catch {
    hostPath = url.slice(-40)
  }
  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
    })
    if (!response.ok) throw new Error(`HTTP ${response.status} @${hostPath}`)
    const data = (await response.json()) as T
    staleCache.set(url, { fetchedAt: Date.now(), data })
    return data
  } catch (err) {
    const cached = staleCache.get(url)
    if (cached && Date.now() - cached.fetchedAt < STALE_FALLBACK_MAX_MS) {
      const tagged = cached.data as T & StaleTag
      if (tagged && typeof tagged === 'object') {
        ;(tagged as StaleTag).__staleAgeMs = Date.now() - cached.fetchedAt
      }
      return tagged
    }
    const ms = Date.now() - started
    const name = err instanceof Error ? err.constructor.name : typeof err
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(`${name}: ${msg} @${hostPath} (${ms}ms)`)
  }
}

export function staleAgeLabel(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null
  const ageMs = (data as StaleTag).__staleAgeMs
  if (typeof ageMs !== 'number') return null
  const m = Math.round(ageMs / 60000)
  return m < 1 ? 'just now' : m < 60 ? `${m}m ago` : `${Math.round(m / 60)}h ago`
}

// Duck Ops state is one fat JSON. Cache it briefly so the 5 duck cards
// don't each refetch independently while the user is swiping around.
const DUCK_OPS_CACHE_MS = 30_000
let duckOpsCache: { fetchedAt: number; data: DuckOpsStatus } | null = null
let duckOpsInFlight: Promise<DuckOpsStatus> | null = null

export async function loadDuckOps(): Promise<DuckOpsStatus> {
  const now = Date.now()
  if (duckOpsCache && now - duckOpsCache.fetchedAt < DUCK_OPS_CACHE_MS) {
    return duckOpsCache.data
  }
  if (duckOpsInFlight) return duckOpsInFlight
  duckOpsInFlight = (async () => {
    try {
      const data = await fetchJson<DuckOpsStatus>(DUCK_OPS_URL)
      duckOpsCache = { fetchedAt: Date.now(), data }
      return data
    } finally {
      duckOpsInFlight = null
    }
  })()
  return duckOpsInFlight
}

interface OpenMeteoResponse {
  current?: { temperature_2m?: number; weather_code?: number }
}

const WEATHER_CODE_LABELS: Record<number, string> = {
  0: 'Clear', 1: 'Mostly clear', 2: 'Partly cloudy', 3: 'Cloudy',
  45: 'Fog', 48: 'Fog',
  51: 'Drizzle', 53: 'Drizzle', 55: 'Drizzle',
  61: 'Rain', 63: 'Rain', 65: 'Heavy rain',
  71: 'Snow', 73: 'Snow', 75: 'Heavy snow', 77: 'Snow',
  80: 'Showers', 81: 'Showers', 82: 'Heavy showers',
  85: 'Snow showers', 86: 'Snow showers',
  95: 'Thunderstorm', 96: 'Thunderstorm', 99: 'Thunderstorm',
}

export async function loadWeather(): Promise<WeatherSnapshot> {
  // Build via URLSearchParams so commas and other reserved chars are
  // percent-encoded — iOS WKWebView's fetch is strict about this on some URLs.
  const params = new URLSearchParams({
    latitude: WEATHER_LAT,
    longitude: WEATHER_LON,
    current: 'temperature_2m,weather_code',
    temperature_unit: 'fahrenheit',
  })
  const url = `https://api.open-meteo.com/v1/forecast?${params.toString()}`
  const payload = await fetchJson<OpenMeteoResponse>(url)
  const tempF = payload.current?.temperature_2m ?? 0
  const code = payload.current?.weather_code ?? 0
  return {
    temperatureF: Math.round(tempF),
    conditionLabel: WEATHER_CODE_LABELS[code] ?? 'Unknown',
  }
}

interface EspnScoreboardResponse {
  events?: Array<{
    status?: { type?: { state?: string; description?: string } }
    date?: string
    competitions?: Array<{
      status?: {
        period?: number
        displayClock?: string
        type?: { state?: string; description?: string; shortDetail?: string }
      }
      competitors?: Array<{
        homeAway?: 'home' | 'away'
        team?: { abbreviation?: string }
        score?: string
      }>
    }>
  }>
}

function ordinalPeriod(n: number, sport: string): string {
  if (sport === 'baseball') return n >= 9 ? 'Extra' : `${n}`
  if (n === 1) return '1st'
  if (n === 2) return '2nd'
  if (n === 3) return '3rd'
  if (n === 4) return '4th'
  return 'OT'
}

function formatStartsAt(iso: string | undefined): string | null {
  if (!iso) return null
  try {
    return new Date(iso).toLocaleString([], {
      weekday: 'short',
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return null
  }
}

export interface EspnTeamConfig {
  league: string // e.g., "hockey/nhl"
  team: string // e.g., "PIT"
  sport: 'hockey' | 'football' | 'baseball'
  teamId: number // ESPN numeric team id, used for /news?team=<id>
}

export interface EspnArticle {
  headline: string
  description?: string
  published?: string
}

interface EspnNewsResponse {
  articles?: Array<{
    headline?: string
    description?: string
    published?: string
  }>
}

const ESPN_NEWS_CACHE_MS = 5 * 60_000
const espnNewsCache = new Map<string, { fetchedAt: number; data: EspnArticle | null }>()

export interface EspnScheduleSummary {
  last: {
    opponentAbbrev: string | null
    homeAway: 'home' | 'away' | null
    scoreSelf: number | null
    scoreOpponent: number | null
    resultLabel: string | null
    dateLabel: string | null
  } | null
  next: {
    opponentAbbrev: string | null
    homeAway: 'home' | 'away' | null
    startsAtLabel: string | null
  } | null
}

interface EspnScheduleResponse {
  events?: Array<{
    date?: string
    competitions?: Array<{
      status?: { type?: { state?: string; shortDetail?: string } }
      competitors?: Array<{
        homeAway?: 'home' | 'away'
        team?: { id?: string; abbreviation?: string }
        score?: string | { value?: number; displayValue?: string }
      }>
    }>
  }>
}

const SCHEDULE_CACHE_MS = 60_000
const espnScheduleCache = new Map<string, { fetchedAt: number; data: EspnScheduleSummary }>()

function scoreNumber(score: unknown): number | null {
  if (typeof score === 'number') return score
  if (typeof score === 'string') {
    const n = Number(score)
    return Number.isNaN(n) ? null : n
  }
  if (score && typeof score === 'object') {
    const v = (score as { value?: unknown }).value
    if (typeof v === 'number') return v
    if (typeof v === 'string') {
      const n = Number(v)
      return Number.isNaN(n) ? null : n
    }
  }
  return null
}

export async function loadEspnTeamSchedule(cfg: EspnTeamConfig): Promise<EspnScheduleSummary> {
  const key = `${cfg.league}:${cfg.teamId}`
  const cached = espnScheduleCache.get(key)
  if (cached && Date.now() - cached.fetchedAt < SCHEDULE_CACHE_MS) return cached.data
  const url = `https://site.api.espn.com/apis/site/v2/sports/${cfg.league}/teams/${cfg.teamId}/schedule`
  const payload = await fetchJson<EspnScheduleResponse>(url)
  const events = payload.events ?? []
  const now = Date.now()
  let lastIdx = -1
  let nextIdx = -1
  let lastTs = -Infinity
  let nextTs = Infinity
  events.forEach((e, i) => {
    const t = e.date ? Date.parse(e.date) : NaN
    if (Number.isNaN(t)) return
    if (t < now && t > lastTs) {
      lastTs = t
      lastIdx = i
    } else if (t >= now && t < nextTs) {
      nextTs = t
      nextIdx = i
    }
  })

  const target = String(cfg.teamId)
  type ScheduleEvent = NonNullable<EspnScheduleResponse['events']>[number]
  function summarize(e: ScheduleEvent) {
    const comp = (e.competitions ?? [])[0]
    const competitors = comp?.competitors ?? []
    const self = competitors.find(c => String(c.team?.id ?? '') === target)
    const other = competitors.find(c => c !== self)
    return {
      self,
      other,
      shortDetail: comp?.status?.type?.shortDetail ?? null,
    }
  }

  const summary: EspnScheduleSummary = { last: null, next: null }
  if (lastIdx >= 0) {
    const e = events[lastIdx]!
    const { self, other, shortDetail } = summarize(e)
    summary.last = {
      opponentAbbrev: other?.team?.abbreviation ?? null,
      homeAway: self?.homeAway ?? null,
      scoreSelf: scoreNumber(self?.score),
      scoreOpponent: scoreNumber(other?.score),
      resultLabel: shortDetail,
      dateLabel: e.date
        ? new Date(e.date).toLocaleDateString([], { month: 'short', day: 'numeric' })
        : null,
    }
  }
  if (nextIdx >= 0) {
    const e = events[nextIdx]!
    const { self, other } = summarize(e)
    summary.next = {
      opponentAbbrev: other?.team?.abbreviation ?? null,
      homeAway: self?.homeAway ?? null,
      startsAtLabel: e.date
        ? new Date(e.date).toLocaleString([], {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          })
        : null,
    }
  }
  espnScheduleCache.set(key, { fetchedAt: Date.now(), data: summary })
  return summary
}

export async function loadEspnTeamNews(cfg: EspnTeamConfig): Promise<EspnArticle | null> {
  const key = `${cfg.league}:${cfg.teamId}`
  const cached = espnNewsCache.get(key)
  if (cached && Date.now() - cached.fetchedAt < ESPN_NEWS_CACHE_MS) return cached.data
  const url = `https://site.api.espn.com/apis/site/v2/sports/${cfg.league}/news?team=${cfg.teamId}&limit=1`
  const payload = await fetchJson<EspnNewsResponse>(url)
  const first = payload.articles?.[0]
  const article: EspnArticle | null = first?.headline
    ? {
        headline: first.headline,
        description: first.description,
        published: first.published,
      }
    : null
  espnNewsCache.set(key, { fetchedAt: Date.now(), data: article })
  return article
}

export async function loadEspnGame(cfg: EspnTeamConfig): Promise<SportsGameSnapshot> {
  const url = `https://site.api.espn.com/apis/site/v2/sports/${cfg.league}/scoreboard`
  const payload = await fetchJson<EspnScoreboardResponse>(url)
  const target = cfg.team.toUpperCase()
  const event = (payload.events ?? []).find(e =>
    (e.competitions ?? []).some(c =>
      (c.competitors ?? []).some(
        team => (team.team?.abbreviation ?? '').toUpperCase() === target,
      ),
    ),
  )
  if (!event) {
    return {
      state: 'none',
      opponentAbbrev: null,
      homeAway: null,
      scoreSelf: null,
      scoreOpponent: null,
      period: null,
      clock: null,
      startsAtLabel: null,
      resultLabel: null,
    }
  }
  const comp = event.competitions?.[0]
  const competitors = comp?.competitors ?? []
  const self = competitors.find(c => (c.team?.abbreviation ?? '').toUpperCase() === target)
  const other = competitors.find(c => c !== self)
  const stateRaw = (comp?.status?.type?.state ?? event.status?.type?.state ?? 'pre').toLowerCase()
  const state: SportsGameSnapshot['state'] =
    stateRaw === 'in' ? 'in' : stateRaw === 'post' ? 'post' : 'pre'
  const period = comp?.status?.period ? ordinalPeriod(comp.status.period, cfg.sport) : null
  return {
    state,
    opponentAbbrev: other?.team?.abbreviation ?? null,
    homeAway: self?.homeAway ?? null,
    scoreSelf: self?.score !== undefined ? Number(self.score) : null,
    scoreOpponent: other?.score !== undefined ? Number(other.score) : null,
    period,
    clock: comp?.status?.displayClock ?? null,
    startsAtLabel: formatStartsAt(event.date),
    resultLabel: comp?.status?.type?.shortDetail ?? null,
  }
}

export async function loadCalendar(): Promise<CalendarSnapshot> {
  if (!BRIDGE_URL) return { events: [], status: 'unconfigured' }
  return fetchJson<CalendarSnapshot>(`${BRIDGE_URL}/calendar.json`)
}

export async function loadMessages(): Promise<MessageSummary> {
  if (!BRIDGE_URL) return { unreadCount: 0, lastSenders: [], status: 'unconfigured' }
  return fetchJson<MessageSummary>(`${BRIDGE_URL}/messages.json`)
}

export async function loadGithubPrs(): Promise<GithubPrsSnapshot> {
  if (!BRIDGE_URL) return { status: 'unconfigured', prs: [], note: 'bridge not set' }
  return fetchJson<GithubPrsSnapshot>(`${BRIDGE_URL}/github/prs.json`, 8000)
}

export async function loadGithubCi(): Promise<GithubCiSnapshot> {
  if (!BRIDGE_URL) return { status: 'unconfigured', repos: [], note: 'bridge not set' }
  return fetchJson<GithubCiSnapshot>(`${BRIDGE_URL}/github/ci.json`, 8000)
}

export async function loadTasks(): Promise<TasksSnapshot> {
  if (!BRIDGE_URL) return { status: 'unconfigured', lists: [], note: 'bridge not set' }
  return fetchJson<TasksSnapshot>(`${BRIDGE_URL}/tasks/all.json`, 10_000)
}

export interface CompleteTaskResult {
  ok: boolean
  error?: string
  id?: string
  title?: string
}

export async function loadGmailUnread(): Promise<GmailUnreadSnapshot> {
  if (!BRIDGE_URL)
    return { status: 'unconfigured', unreadCount: 0, items: [], note: 'bridge not set' }
  return fetchJson<GmailUnreadSnapshot>(`${BRIDGE_URL}/gmail/unread.json`, 8000)
}

export async function loadNowPlaying(): Promise<NowPlayingSnapshot> {
  if (!BRIDGE_URL) return { status: 'ok', playing: false }
  return fetchJson<NowPlayingSnapshot>(`${BRIDGE_URL}/now-playing.json`, 4000)
}

export interface SkipTaskResult {
  ok: boolean
  error?: string
  id?: string
  until?: string
}

export async function skipTask(taskId: string): Promise<SkipTaskResult> {
  if (!BRIDGE_URL) return { ok: false, error: 'bridge not set' }
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), 8000)
  try {
    const response = await fetch(`${BRIDGE_URL}/tasks/skip`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ taskId, confirm: true }),
      signal: controller.signal,
    })
    return (await response.json()) as SkipTaskResult
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  } finally {
    window.clearTimeout(timer)
  }
}

export async function completeTask(
  listId: string,
  taskId: string,
): Promise<CompleteTaskResult> {
  if (!BRIDGE_URL) return { ok: false, error: 'bridge not set' }
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), 8000)
  try {
    const response = await fetch(`${BRIDGE_URL}/tasks/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ listId, taskId, confirm: true }),
      signal: controller.signal,
    })
    return (await response.json()) as CompleteTaskResult
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  } finally {
    window.clearTimeout(timer)
  }
}

export async function uncompleteTask(
  listId: string,
  taskId: string,
): Promise<CompleteTaskResult> {
  if (!BRIDGE_URL) return { ok: false, error: 'bridge not set' }
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), 8000)
  try {
    const response = await fetch(`${BRIDGE_URL}/tasks/uncomplete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ listId, taskId, confirm: true }),
      signal: controller.signal,
    })
    return (await response.json()) as CompleteTaskResult
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  } finally {
    window.clearTimeout(timer)
  }
}

export async function unskipTask(taskId: string): Promise<SkipTaskResult> {
  if (!BRIDGE_URL) return { ok: false, error: 'bridge not set' }
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), 8000)
  try {
    const response = await fetch(`${BRIDGE_URL}/tasks/unskip`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ taskId, confirm: true }),
      signal: controller.signal,
    })
    return (await response.json()) as SkipTaskResult
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  } finally {
    window.clearTimeout(timer)
  }
}

export interface ApproveResult {
  ok: boolean
  error?: string
  subject?: string
  flow?: string
  runId?: string
  dryRun?: boolean
}

export interface RejectResult {
  ok: boolean
  error?: string
  artifactId?: string
  alreadyRejected?: boolean
}

export async function rejectCandidate(artifactId: string): Promise<RejectResult> {
  if (!DUCK_OPS_REJECT_URL) return { ok: false, error: 'duck-ops url not set' }
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), 8000)
  try {
    const response = await fetch(DUCK_OPS_REJECT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ artifactId, confirm: true }),
      signal: controller.signal,
    })
    return (await response.json()) as RejectResult
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  } finally {
    window.clearTimeout(timer)
  }
}

export async function approveCandidate(
  artifactId: string,
  options: { dryRun?: boolean } = {},
): Promise<ApproveResult> {
  if (!DUCK_OPS_APPROVE_URL) return { ok: false, error: 'duck-ops url not set' }
  const body: Record<string, unknown> = { artifactId }
  if (options.dryRun) body.dryRun = true
  else body.confirm = true
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), 8000)
  try {
    const response = await fetch(DUCK_OPS_APPROVE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    const json = (await response.json()) as ApproveResult
    return json
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  } finally {
    window.clearTimeout(timer)
  }
}
