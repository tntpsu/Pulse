import './style.css'

import { loadWeather, probeServiceHealth, staleAgeLabel, type ServiceHealth } from './api'
import { CARDS, type ActionResult, type CardDefinition, type PickerOption } from './cards/index'
import {
  connectEvenRuntime,
  type DeviceStatusSnapshot,
  type InputSource,
  type UserInfoSnapshot,
} from './even'
import type { TodaySnapshot } from './cards/today'
import type { WeatherSnapshot } from './types'

const WEATHER_POLL_MS = 600_000
const HEALTH_POLL_MS = 60_000
// Tick often enough to catch the minute boundary without drift, but the
// actual BLE write only fires when the minute changes — see CLOCK paint guard.
const CLOCK_TICK_MS = 15_000
// After this long with no user input, stop polling so the firmware can sleep
// the display (no BLE writes → firmware auto-sleeps after ~15s). On any user
// event (tap/swipe/foreground) we mark active again and polling resumes.
const IDLE_THRESHOLD_MS = 90_000

let lastInteractionAt = Date.now()
function markActive(): void {
  lastInteractionAt = Date.now()
}
function isIdle(): boolean {
  return Date.now() - lastInteractionAt > IDLE_THRESHOLD_MS
}

type ViewMode = 'dashboard' | 'detail'

const root = document.querySelector<HTMLDivElement>('#app')
if (!root) throw new Error('App root missing')

root.innerHTML = `
  <main class="shell">
    <section class="panel" id="left-panel" aria-label="Left column preview">
      <p class="panel-label">Left column</p>
      <div id="left-content">--</div>
    </section>
    <section class="panel" id="right-panel" aria-label="Right card preview">
      <p class="panel-label">Card <span id="card-position">1/${CARDS.length}</span> · <span id="view-mode">dashboard</span></p>
      <div id="right-content">--</div>
    </section>
    <div class="controls">
      <button id="prev" class="button">Prev</button>
      <button id="next" class="button">Next</button>
      <button id="toggle" class="button button-secondary">Toggle detail</button>
      <button id="prev-item" class="button button-secondary">Prev item</button>
      <button id="next-item" class="button button-secondary">Next item</button>
      <button id="ring-tap" class="button button-secondary">Tap (open picker)</button>
      <button id="refresh" class="button button-secondary">Refresh card</button>
    </div>
    <p id="runtime-note" class="runtime-note">Browser preview mode.</p>
  </main>
`

const ui = {
  left: must<HTMLDivElement>('#left-content'),
  right: must<HTMLDivElement>('#right-content'),
  position: must<HTMLSpanElement>('#card-position'),
  viewMode: must<HTMLSpanElement>('#view-mode'),
  prev: must<HTMLButtonElement>('#prev'),
  next: must<HTMLButtonElement>('#next'),
  toggle: must<HTMLButtonElement>('#toggle'),
  prevItem: must<HTMLButtonElement>('#prev-item'),
  nextItem: must<HTMLButtonElement>('#next-item'),
  ringTap: must<HTMLButtonElement>('#ring-tap'),
  refresh: must<HTMLButtonElement>('#refresh'),
  note: must<HTMLParagraphElement>('#runtime-note'),
}

function must<T extends Element>(selector: string): T {
  const el = document.querySelector<T>(selector)
  if (!el) throw new Error(`Missing ${selector}`)
  return el
}

interface CardState {
  data: unknown
  error: string | null
  inFlight: boolean
}

const cardStates: Map<string, CardState> = new Map(
  CARDS.map(c => [c.id, { data: null, error: null, inFlight: false }]),
)

let weather: WeatherSnapshot | null = null
let weatherError: string | null = null
// null on startup until first probe completes; after that it reflects the
// most recent status.
let serviceHealth: ServiceHealth | null = null
// Device + user state: populated by onDeviceStatusChanged / getUserInfo after
// the bridge connects. Fallback to undefined fields → left column degrades
// gracefully (battery line + greeting are conditional on a value being set).
let deviceStatus: DeviceStatusSnapshot = {}
let userInfo: UserInfoSnapshot = {}
let currentCardIndex = 0
let viewMode: ViewMode = 'dashboard'
let currentItemIndex = 0

// Persist the last-viewed card so OS-kills / relaunches don't dump the user
// back on card 0. We persist by card ID (not index) because the CARDS array
// may reorder across updates. Reads/writes go through the SDK's native
// companion-app storage (more durable than browser localStorage on iOS); a
// browser-localStorage path is kept for the dev-server preview where there's
// no bridge.
const PERSIST_KEY = 'phils-home:state:v1'
async function loadPersistedState(): Promise<{ cardId?: string }> {
  try {
    const raw = even
      ? await even.getStorage(PERSIST_KEY)
      : window.localStorage.getItem(PERSIST_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as { cardId?: string }
  } catch {
    return {}
  }
}
function persistState(): void {
  const value = JSON.stringify({ cardId: CARDS[currentCardIndex]?.id })
  if (even) {
    void even.setStorage(PERSIST_KEY, value)
  } else {
    try {
      window.localStorage.setItem(PERSIST_KEY, value)
    } catch {
      // Quota or disabled storage — silent, not worth disrupting UX.
    }
  }
}
let transientMessage: string | null = null
let transientTimer: number | null = null
// Guards re-entrant picker opens from rapid taps while the modal is resolving.
let pickerOpen = false

// Window during which a tap after a successful action triggers the undo.
const UNDO_WINDOW_MS = 3000
let pendingUndo: { undo: () => Promise<ActionResult>; expiresAt: number } | null = null

function pickerOptionsFor(card: CardDefinition, item: unknown): PickerOption[] {
  if (card.getActions) return card.getActions(item)
  // Fallback: synthesize a two-option picker from confirmAction / rejectAction.
  const opts: PickerOption[] = []
  if (card.confirmAction) {
    const action = card.confirmAction
    opts.push({ label: card.confirmLabel ?? 'APPROVE', run: () => action(item) })
  }
  if (card.rejectAction) {
    const action = card.rejectAction
    opts.push({ label: card.rejectLabel ?? 'REJECT', run: () => action(item) })
  }
  return opts
}

function pickerHeaderFor(
  card: CardDefinition,
  item: unknown,
  index: number,
  total: number,
): string {
  if (card.formatItem) {
    const firstLine = card.formatItem(item, index, total).split('\n')[0] ?? ''
    if (firstLine) return firstLine
  }
  return card.title
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`
}

function formatLeft(): string {
  const now = new Date()
  const hours = now.getHours()
  const minutes = pad2(now.getMinutes())
  const period = hours >= 12 ? 'PM' : 'AM'
  const h12 = hours % 12 === 0 ? 12 : hours % 12
  const dateLine = now.toLocaleDateString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
  const tempLine = weather
    ? `${weather.temperatureF}F  ${weather.conditionLabel}`
    : weatherError
      ? `weather: ${weatherError.slice(0, 30)}`
      : 'weather: ...'
  const badges = formatAttentionBadges()
  const health = formatServiceHealth()
  const device = formatDeviceLine()
  const greeting = formatGreeting()
  const lines = [`${h12}:${minutes} ${period}`, dateLine]
  if (greeting) lines.push(greeting)
  lines.push('', tempLine)
  if (device) lines.push(device)
  if (badges) lines.push('', badges)
  if (health) lines.push('', health)
  return lines.join('\n')
}

// Symbol legend — kept here so future readers see what each glyph means:
//   ★ approvals · ■ tasks · ▼ stuck shipments · ▶ PRs to review
//   ● unread mail · ! CI failing
// All symbols are from the design-guidelines verified-safe set so they
// render reliably on the G2 LVGL firmware font.
function formatAttentionBadges(): string {
  const todayState = cardStates.get('today')
  const data = todayState?.data as TodaySnapshot | null
  if (!data) return ''
  const pairs: string[] = []
  if (data.approvals && data.approvals > 0) pairs.push(`★${data.approvals}`)
  if (data.tasks && data.tasks > 0) pairs.push(`■${data.tasks}`)
  if (data.stuck && data.stuck > 0) pairs.push(`▼${data.stuck}`)
  if (data.prs && data.prs > 0) pairs.push(`▶${data.prs}`)
  if (data.unread && data.unread > 0) pairs.push(`●${data.unread}`)
  if (data.ciFailing && data.ciFailing > 0) pairs.push(`!CI`)
  if (pairs.length === 0) return ''
  // Fit ~3 per line on the 240px left column.
  const lines: string[] = []
  for (let i = 0; i < pairs.length; i += 3) {
    lines.push(pairs.slice(i, i + 3).join(' '))
  }
  return lines.join('\n')
}

// Health icons for the two backend services. ● = healthy, ○ = unreachable.
function formatServiceHealth(): string {
  if (!serviceHealth) return 'bridge ·  widget ·'
  const b = serviceHealth.bridge ? '●' : '○'
  const w = serviceHealth.widget ? '●' : '○'
  return `bridge ${b}  widget ${w}`
}

// Battery + wearing state from onDeviceStatusChanged. Renders nothing until
// we've seen a real, non-zero battery reading — the firmware appears to send
// an initial zeroed payload (batteryLevel=0, isWearing=false) on first
// connect, which would otherwise show " ▁ 0% ! ZZZ" while the user is
// actively wearing the glasses. ZZZ also gated on a real reading.
function formatDeviceLine(): string {
  const { batteryLevel, isCharging, isWearing } = deviceStatus
  if (batteryLevel === undefined || batteryLevel <= 0) return ''
  const bar = batteryGlyph(batteryLevel)
  const charge = isCharging ? '+' : ' '
  const lowFlag = batteryLevel <= 20 ? ' !' : ''
  // ZZZ only when we have a real battery (proxy for "real status payload")
  // AND wearing is explicitly false — initial false-default doesn't count.
  const wearFlag = isWearing === false ? '  ZZZ' : ''
  return `${charge}${bar} ${batteryLevel}%${lowFlag}${wearFlag}`
}

function batteryGlyph(level: number): string {
  if (level >= 88) return '█'
  if (level >= 75) return '▇'
  if (level >= 62) return '▆'
  if (level >= 50) return '▅'
  if (level >= 37) return '▄'
  if (level >= 25) return '▃'
  if (level >= 12) return '▂'
  return '▁'
}

// Personalized greeting on the left column. Skips silently if we don't have
// the user's name yet (or they're in a region where Even doesn't expose one).
function formatGreeting(): string {
  const first = userInfo.name?.trim().split(/\s+/)[0]
  if (!first) return ''
  const h = new Date().getHours()
  const part = h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening'
  return `hi ${first} — ${part}`
}

function currentCard(): CardDefinition {
  return CARDS[currentCardIndex]!
}

function currentItems(card: CardDefinition): unknown[] | null {
  if (!card.getItems) return null
  const state = cardStates.get(card.id)
  if (!state || !state.data) return null
  const items = card.getItems(state.data)
  return Array.isArray(items) ? items : null
}

function clampItemIndex(): void {
  const card = currentCard()
  const items = currentItems(card)
  if (!items || items.length === 0) {
    currentItemIndex = 0
    return
  }
  if (currentItemIndex >= items.length) currentItemIndex = items.length - 1
  if (currentItemIndex < 0) currentItemIndex = 0
}

function formatCardOutput(): string {
  if (transientMessage) return transientMessage
  const card = currentCard()
  const state = cardStates.get(card.id)!
  if (viewMode === 'detail') {
    const items = currentItems(card)
    if (items && items.length > 0 && card.formatItem) {
      clampItemIndex()
      const item = items[currentItemIndex]!
      const base = card.formatItem(item, currentItemIndex, items.length)
      const options = pickerOptionsFor(card, item)
      if (options.length > 0) {
        // Vertical list reads better than slash-separated, especially for long
        // labels like article headlines. Cap each label to one line.
        const trunc = (l: string) => (l.length > 32 ? `${l.slice(0, 31)}…` : l)
        const labelsBlock = options.map(o => `  ${trunc(o.label)}`).join('\n')
        return `${base}\n\n[tap]\n${labelsBlock}`
      }
      return base
    }
    if (card.formatDetail) return card.formatDetail(state.data, state.error)
    return card.format(state.data, state.error)
  }
  return card.format(state.data, state.error)
}

async function paint(): Promise<void> {
  let cardText = formatCardOutput()
  const card = currentCard()
  const state = cardStates.get(card.id)
  const stale = state ? staleAgeLabel(state.data) : null
  if (stale && !transientMessage) {
    cardText = `(stale ${stale})\n${cardText}`
  }
  const leftText = formatLeft()
  ui.right.textContent = cardText
  ui.left.textContent = leftText
  ui.position.textContent = `${currentCardIndex + 1}/${CARDS.length}`
  ui.viewMode.textContent = viewMode
  // Dual-column layout: left stays visible in both modes; right changes.
  await even?.render(leftText, cardText)
}

async function fetchCard(card: CardDefinition): Promise<void> {
  const state = cardStates.get(card.id)!
  if (state.inFlight) return
  state.inFlight = true
  try {
    state.data = await card.load()
    state.error = null
  } catch (err) {
    state.error = err instanceof Error ? err.message : String(err)
  } finally {
    state.inFlight = false
  }
}

async function refreshActiveCard(): Promise<void> {
  const card = currentCard()
  await fetchCard(card)
  await paint()
}

// Re-fetches the Today card's aggregated counts so the left-column attention
// badges and the dashboard glance card reflect the latest state. Called after
// any picker action succeeds, since the active card alone won't update the
// cross-card counts the badges read from.
async function refreshTodayCard(): Promise<void> {
  const todayCard = CARDS.find(c => c.id === 'today')
  if (!todayCard) return
  if (currentCard().id === todayCard.id) return // already covered by refreshActiveCard
  await fetchCard(todayCard)
  if (viewMode === 'dashboard') await paint()
}

let activePollTimer: number | null = null

function startActiveCardPoll(): void {
  if (activePollTimer !== null) {
    window.clearInterval(activePollTimer)
    activePollTimer = null
  }
  const card = currentCard()
  activePollTimer = window.setInterval(() => {
    // Stop polling when idle so the firmware's display-sleep can kick in.
    // User interaction wakes us back up via markActive().
    if (isIdle()) return
    // Also pause when the user isn't wearing the glasses — no point burning
    // BLE bandwidth and phone CPU on data nobody can see.
    if (deviceStatus.isWearing === false) return
    void (async () => {
      await fetchCard(card)
      if (currentCard().id === card.id) await paint()
    })()
  }, card.pollMs)
}

async function changeCard(delta: number): Promise<void> {
  // Hidden cards (e.g. Troubleshoot) live in the array for the card-selector
  // modal but the swipe-carousel skips them. Walk in `delta` direction until
  // a visible card is found; bail if none exist (defensive — shouldn't happen).
  let next = currentCardIndex
  for (let step = 0; step < CARDS.length; step += 1) {
    next = (next + delta + CARDS.length) % CARDS.length
    if (!CARDS[next]?.hidden) break
  }
  if (next === currentCardIndex) return
  await jumpToCard(next)
}

// Shared by swipe navigation and the card-selector modal.
async function jumpToCard(next: number): Promise<void> {
  markActive()
  currentCardIndex = next
  currentItemIndex = 0
  transientMessage = null
  viewMode = 'dashboard'
  persistState()
  await paint()
  startActiveCardPoll()
  const state = cardStates.get(currentCard().id)!
  if (!state.data && !state.inFlight) void refreshActiveCard()
}

async function openCardSelector(): Promise<void> {
  if (!even || pickerOpen) return
  pickerOpen = true
  try {
    // Prefix the current card with "> " so the user sees where they are.
    const labels = CARDS.map((c, i) => (i === currentCardIndex ? `> ${c.title}` : c.title))
    // Header includes the running app version so the user can confirm at a
    // glance that the install actually picked up the latest .ehpk.
    const pickedIndex = await even.openPicker(`Jump to card · v${__APP_VERSION__}`, labels)
    if (pickedIndex === null) return // cancelled
    if (pickedIndex === currentCardIndex) return
    await jumpToCard(pickedIndex)
  } finally {
    pickerOpen = false
  }
}

async function changeItem(delta: number): Promise<void> {
  const card = currentCard()
  const items = currentItems(card)
  if (!items || items.length === 0) return
  markActive()
  currentItemIndex = (currentItemIndex + delta + items.length) % items.length
  await paint()
}

async function toggleViewMode(): Promise<void> {
  markActive()
  viewMode = viewMode === 'dashboard' ? 'detail' : 'dashboard'
  await paint()
}

async function flashTransient(text: string, durationMs: number): Promise<void> {
  if (transientTimer !== null) window.clearTimeout(transientTimer)
  transientMessage = text
  await paint()
  transientTimer = window.setTimeout(() => {
    transientTimer = null
    if (transientMessage === text) {
      transientMessage = null
      void paint()
    }
  }, durationMs)
}

async function handlePrimaryTap(): Promise<void> {
  markActive()
  // Tap-to-dismiss: when a long-form transient is showing (e.g. a sports
  // article body), a tap dismisses it without re-opening the picker.
  // Undo window takes precedence (handled below).
  if (transientMessage !== null && !pendingUndo) {
    if (transientTimer !== null) {
      window.clearTimeout(transientTimer)
      transientTimer = null
    }
    transientMessage = null
    await paint()
    return
  }
  // If an undo window is open, consume the tap as "undo" rather than opening
  // the picker again. Only taps within the window count.
  if (pendingUndo && Date.now() < pendingUndo.expiresAt) {
    const { undo } = pendingUndo
    pendingUndo = null
    transientMessage = 'Undoing...'
    await paint()
    const result = await undo()
    transientMessage = null
    await flashTransient(
      result.ok ? `UNDONE: ${result.message}` : `Undo failed: ${result.message}`,
      2000,
    )
    await refreshActiveCard()
    return
  }

  const card = currentCard()
  // Dashboard → detail.
  if (viewMode === 'dashboard') {
    viewMode = 'detail'
    await paint()
    return
  }
  // Detail: if the current item is actionable, open the picker; else toggle back.
  const items = currentItems(card)
  const item = items && items.length > 0 ? items[currentItemIndex] : undefined
  const options = item !== undefined ? pickerOptionsFor(card, item) : []
  const itemActionable = options.length > 0 && !!card.formatItem && item !== undefined
  if (!itemActionable) {
    viewMode = 'dashboard'
    await paint()
    return
  }
  if (!even) {
    // Browser preview has no modal surface — fall back to toggle so clicking
    // the preview "tap" button at least does something navigable.
    viewMode = 'dashboard'
    await paint()
    return
  }
  if (pickerOpen) return
  pickerOpen = true
  try {
    const header = pickerHeaderFor(card, item!, currentItemIndex, items!.length)
    const pickedIndex = await even.openPicker(header, options.map(o => o.label))
    if (pickedIndex === null) return // double-tap cancel — leave detail state intact
    const chosen = options[pickedIndex]
    if (!chosen) return
    await flashTransient(`${chosen.label}...`, 800)
    const result = await chosen.run()
    transientMessage = null
    if (!result.ok) {
      await flashTransient(result.message, 2500)
      return
    }
    if (chosen.undo) {
      // Post-action undo window: show the success + UNDO hint for the window
      // duration; a tap during that time fires the undo closure above.
      pendingUndo = { undo: chosen.undo, expiresAt: Date.now() + UNDO_WINDOW_MS }
      transientMessage = `${result.message}\n[tap] UNDO`
      await paint()
      await new Promise(resolve => window.setTimeout(resolve, UNDO_WINDOW_MS))
      if (pendingUndo) {
        pendingUndo = null
        transientMessage = null
        await fetchCard(card)
        void refreshTodayCard()
        currentItemIndex = 0
        viewMode = 'dashboard'
        await paint()
      }
      // If pendingUndo is null, the tap handler already took over.
    } else {
      // Longer flash for multi-paragraph content (e.g. sports article body);
      // a tap dismisses it early.
      const flashMs = result.message.length > 80 ? 30_000 : 1500
      await flashTransient(result.message, flashMs)
      // Only return to dashboard for short success flashes. Long-form reads
      // stay on the current card so a tap-to-dismiss leaves the user where
      // they were.
      if (flashMs === 1500) {
        await fetchCard(card)
        void refreshTodayCard()
        currentItemIndex = 0
        viewMode = 'dashboard'
        await paint()
      }
    }
  } finally {
    pickerOpen = false
  }
}

async function refreshWeather(): Promise<void> {
  try {
    weather = await loadWeather()
    weatherError = null
  } catch (err) {
    weatherError = err instanceof Error ? err.message : String(err)
  }
  if (viewMode === 'dashboard') await paint()
}

async function refreshServiceHealth(): Promise<void> {
  try {
    serviceHealth = await probeServiceHealth()
  } catch {
    serviceHealth = { bridge: false, widget: false }
  }
  if (viewMode === 'dashboard') await paint()
}

ui.prev.addEventListener('click', () => void changeCard(-1))
ui.next.addEventListener('click', () => void changeCard(+1))
ui.toggle.addEventListener('click', () => void toggleViewMode())
ui.prevItem.addEventListener('click', () => void changeItem(-1))
ui.nextItem.addEventListener('click', () => void changeItem(+1))
ui.ringTap.addEventListener('click', () => void handlePrimaryTap())
ui.refresh.addEventListener('click', () => void refreshActiveCard())

// Connect the glasses runtime FIRST so `paint()` can safely read `even`.
// `paint()` runs before this would put `even` in the temporal dead zone,
// which broke the packaged .ehpk (fine in Vite dev but fatal on install).
const initialLeft = formatLeft()
const initialRight = formatCardOutput()
const even = await connectEvenRuntime(initialLeft, initialRight)

// Restore the last-viewed card from native storage now that the bridge is
// available. Done before initial paint so the user sees the right card on
// first frame instead of card-0-then-flash.
const persisted = await loadPersistedState()
if (persisted.cardId) {
  const idx = CARDS.findIndex(c => c.id === persisted.cardId)
  if (idx >= 0) currentCardIndex = idx
}

// Pull the user's display name once for the greeting line (best-effort).
if (even) {
  void even.getUserInfo().then(info => {
    userInfo = info
    if (viewMode === 'dashboard') void paint()
  })
}

await paint()
void refreshWeather()
void refreshServiceHealth()
void refreshActiveCard()

// Only paint on the clock tick if the displayed minute actually changed.
// Otherwise we'd needlessly re-render and keep the display awake forever
// (the firmware sleeps the display after ~15s of no updates — that's fine).
let lastRenderedMinute = new Date().getMinutes()
window.setInterval(() => {
  const m = new Date().getMinutes()
  if (m !== lastRenderedMinute) {
    lastRenderedMinute = m
    if (viewMode === 'dashboard') void paint()
  }
}, CLOCK_TICK_MS)
window.setInterval(() => void refreshWeather(), WEATHER_POLL_MS)
window.setInterval(() => void refreshServiceHealth(), HEALTH_POLL_MS)

if (even) {
  ui.note.textContent =
    'Glasses connected. Tap = enter detail, or open action picker on an actionable item. Swipe = nav/paginate. Glasses 2-tap = exit app. Ring 2-tap = back to dashboard.'
  even.onTap((_source: InputSource) => {
    void handlePrimaryTap()
  })
  even.onSwipe(dir => {
    const card = currentCard()
    const items = currentItems(card)
    if (viewMode === 'detail' && items && items.length > 1 && card.formatItem) {
      void changeItem(dir === 'down' ? +1 : -1)
      return
    }
    void changeCard(dir === 'down' ? +1 : -1)
  })
  even.onDoubleTap(source => {
    // While a long-form transient is showing (e.g. an article body), any
    // double-tap dismisses it — not what feels right is for glasses-2-tap
    // to exit the app mid-read. Single-tap already dismisses; this just
    // matches the same intent for double-tap.
    if (transientMessage !== null && !pendingUndo) {
      if (transientTimer !== null) {
        window.clearTimeout(transientTimer)
        transientTimer = null
      }
      transientMessage = null
      void paint()
      return
    }
    // Both ring AND glasses double-tap in detail → back to dashboard.
    // Even convention says glasses-double-tap should always exit, but the
    // user explicitly preferred "back" here so they don't lose their place
    // when reading a card. Exit is still available from dashboard view.
    if (viewMode === 'detail') {
      viewMode = 'dashboard'
      void paint()
      return
    }
    // In dashboard mode: ring → card-selector, glasses → exit app.
    if (source === 'ring') {
      void openCardSelector()
      return
    }
    void even.exitApp()
  })
  even.onForeground(() => {
    markActive()
    void refreshWeather()
    void refreshServiceHealth()
    void refreshActiveCard()
  })
  even.onDeviceStatus(status => {
    const prev = deviceStatus
    deviceStatus = status
    // Only re-paint on MEANINGFUL state changes — battery percent and
    // charging-state ticks fire every few seconds on real glasses, and
    // each paint() issues a textContainerUpgrade BLE write which the
    // firmware sees as "the app is still active, keep the display lit".
    // Without this guard the display never sleeps.
    const wearingFlipped = prev.isWearing !== status.isWearing
    const chargingFlipped = prev.isCharging !== status.isCharging
    // Bucket battery into 10% steps so a typical hourly drain triggers
    // at most ~10 repaints instead of one per percent.
    const prevBucket =
      prev.batteryLevel === undefined ? -1 : Math.floor(prev.batteryLevel / 10)
    const nowBucket =
      status.batteryLevel === undefined ? -1 : Math.floor(status.batteryLevel / 10)
    const batteryStepped = prevBucket !== nowBucket
    // Put-them-on transition (false → true) is a perfect refresh trigger:
    // user just engaged, push the freshest data they should see first.
    if (prev.isWearing === false && status.isWearing === true) {
      markActive()
      void refreshActiveCard()
      void refreshServiceHealth()
    }
    if (
      (wearingFlipped || chargingFlipped || batteryStepped) &&
      viewMode === 'dashboard'
    ) {
      void paint()
    }
  })
  // Honor launch source: when the user opened us via the GLASSES menu, jump
  // straight to the Today summary (index 0). When opened from the phone-app
  // menu, leave them on whatever card they last viewed (already restored
  // from persisted state above).
  let launchHandled = false
  even.onLaunchSource(kind => {
    if (launchHandled) return
    launchHandled = true
    if (kind === 'glasses-menu' && currentCardIndex !== 0) {
      void jumpToCard(0)
    }
  })
  startActiveCardPoll()
} else {
  ui.note.textContent = 'Running outside the Even runtime. Browser preview only.'
}
