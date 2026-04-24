import './style.css'

import { loadWeather, staleAgeLabel } from './api'
import { CARDS, type CardDefinition } from './cards/index'
import { connectEvenRuntime, type InputSource } from './even'
import type { WeatherSnapshot } from './types'

const WEATHER_POLL_MS = 600_000
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
      <button id="ring-tap" class="button button-secondary">Ring tap (arm/confirm)</button>
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
let currentCardIndex = 0
let viewMode: ViewMode = 'dashboard'
let currentItemIndex = 0
let transientMessage: string | null = null
let transientTimer: number | null = null

type ArmedAction = 'approve' | 'reject'
interface ArmedState {
  artifactKey: string
  expiresAt: number
  action: ArmedAction
}

const ARM_WINDOW_MS = 3000

let armed: ArmedState | null = null
let armDisarmTimer: number | null = null
let actionFocus: 'none' | ArmedAction = 'none'

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
  return [`${h12}:${minutes} ${period}`, dateLine, '', tempLine].join('\n')
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

function isActionableCard(card: CardDefinition): boolean {
  return !!card.confirmAction || !!card.rejectAction
}

function isDualActionCard(card: CardDefinition): boolean {
  return !!card.confirmAction && !!card.rejectAction
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
      if (isActionableCard(card)) {
        const confirmLabel = card.confirmLabel ?? 'APPROVE'
        const rejectLabel = card.rejectLabel ?? 'REJECT'
        const itemKey = JSON.stringify(item)
        const isArmed = !!armed && armed.artifactKey === itemKey
        let hint: string
        if (isArmed) {
          const armedLabel = armed!.action === 'reject' ? rejectLabel : confirmLabel
          hint = `[ring] CONFIRM ${armedLabel}`
        } else if (isDualActionCard(card)) {
          const a = actionFocus === 'approve' ? `>${confirmLabel}<` : confirmLabel
          const b = actionFocus === 'reject' ? `>${rejectLabel}<` : rejectLabel
          hint = `[swipe] ${a} | ${b}`
        } else {
          hint = `[ring] ${confirmLabel}`
        }
        return `${base}\n\n${hint}`
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
    void (async () => {
      await fetchCard(card)
      if (currentCard().id === card.id) await paint()
    })()
  }, card.pollMs)
}

async function changeCard(delta: number): Promise<void> {
  const next = (currentCardIndex + delta + CARDS.length) % CARDS.length
  if (next === currentCardIndex) return
  markActive()
  currentCardIndex = next
  currentItemIndex = 0
  armed = null
  actionFocus = 'none'
  transientMessage = null
  await paint()
  startActiveCardPoll()
  const state = cardStates.get(currentCard().id)!
  if (!state.data && !state.inFlight) void refreshActiveCard()
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
  armed = null
  actionFocus = 'none'
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

async function handleRingTap(): Promise<void> {
  markActive()
  const card = currentCard()
  const items = currentItems(card)
  const isActionable =
    viewMode === 'detail' &&
    (!!card.confirmAction || !!card.rejectAction) &&
    !!card.formatItem &&
    !!items &&
    items.length > 0
  // Non-actionable ring taps fall back to toggling detail mode so the ring
  // has parity with the glasses tap for navigation.
  if (!isActionable) {
    await toggleViewMode()
    return
  }
  const item = items![currentItemIndex]
  if (item === undefined) {
    await toggleViewMode()
    return
  }
  const itemKey = JSON.stringify(item)
  const now = Date.now()

  // Second tap within window on same item → execute the staged action.
  if (armed && armed.artifactKey === itemKey && now < armed.expiresAt) {
    const stagedAction = armed.action
    armed = null
    const action = stagedAction === 'reject' ? card.rejectAction : card.confirmAction
    if (!action) {
      await flashTransient('No action available', 1500)
      return
    }
    await flashTransient(stagedAction === 'reject' ? 'Rejecting...' : 'Sending...', 800)
    const result = await action(item)
    transientMessage = null
    if (result.ok) {
      await flashTransient(result.message, 1500)
      await fetchCard(card)
      currentItemIndex = 0
      actionFocus = 'none'
      viewMode = 'dashboard'
      await paint()
    } else {
      await flashTransient(result.message, 2500)
    }
    return
  }

  // For dual-action cards, the user MUST explicitly select via swipe first —
  // ring tap with no focus arms nothing (prevents the "auto-approve" surprise).
  if (isDualActionCard(card)) {
    if (actionFocus === 'none') {
      const a = card.confirmLabel ?? 'APPROVE'
      const b = card.rejectLabel ?? 'REJECT'
      await flashTransient(`Swipe to choose ${a} or ${b}`, 1500)
      return
    }
    if (armDisarmTimer !== null) window.clearTimeout(armDisarmTimer)
    armed = { artifactKey: itemKey, expiresAt: now + ARM_WINDOW_MS, action: actionFocus }
    await paint()
    armDisarmTimer = window.setTimeout(() => {
      armDisarmTimer = null
      if (armed && armed.expiresAt <= Date.now()) {
        armed = null
        void paint()
      }
    }, ARM_WINDOW_MS + 100)
    return
  }

  // Single-action cards: ring tap arms the only available action.
  const defaultAction: ArmedAction = card.confirmAction ? 'approve' : 'reject'
  if (armDisarmTimer !== null) window.clearTimeout(armDisarmTimer)
  armed = { artifactKey: itemKey, expiresAt: now + ARM_WINDOW_MS, action: defaultAction }
  await paint()
  armDisarmTimer = window.setTimeout(() => {
    armDisarmTimer = null
    if (armed && armed.expiresAt <= Date.now()) {
      armed = null
      void paint()
    }
  }, ARM_WINDOW_MS + 100)
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

ui.prev.addEventListener('click', () => void changeCard(-1))
ui.next.addEventListener('click', () => void changeCard(+1))
ui.toggle.addEventListener('click', () => void toggleViewMode())
ui.prevItem.addEventListener('click', () => void changeItem(-1))
ui.nextItem.addEventListener('click', () => void changeItem(+1))
ui.ringTap.addEventListener('click', () => void handleRingTap())
ui.refresh.addEventListener('click', () => void refreshActiveCard())

// Connect the glasses runtime FIRST so `paint()` can safely read `even`.
// `paint()` runs before this would put `even` in the temporal dead zone,
// which broke the packaged .ehpk (fine in Vite dev but fatal on install).
const initialLeft = formatLeft()
const initialRight = formatCardOutput()
const even = await connectEvenRuntime(initialLeft, initialRight)

await paint()
void refreshWeather()
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

if (even) {
  ui.note.textContent =
    'Glasses connected. Tap = expand/collapse (ring = action on actionable cards); swipe = nav; glasses 2-tap = exit app; ring 2-tap = back to dashboard.'
  even.onTap((source: InputSource) => {
    if (source === 'ring') {
      void handleRingTap()
      return
    }
    void toggleViewMode()
  })
  even.onSwipe(dir => {
    const card = currentCard()
    const items = currentItems(card)
    // Dual-action card: swipe cycles through item-content → APPROVE → REJECT
    // → next item. This is what makes the action picker feel like a cursor.
    if (
      viewMode === 'detail' &&
      isDualActionCard(card) &&
      items &&
      items.length > 0 &&
      card.formatItem
    ) {
      markActive()
      armed = null
      if (dir === 'down') {
        if (actionFocus === 'none') actionFocus = 'approve'
        else if (actionFocus === 'approve') actionFocus = 'reject'
        else {
          actionFocus = 'none'
          void changeItem(+1)
          return
        }
      } else {
        if (actionFocus === 'reject') actionFocus = 'approve'
        else if (actionFocus === 'approve') actionFocus = 'none'
        else {
          actionFocus = 'none'
          void changeItem(-1)
          return
        }
      }
      void paint()
      return
    }
    if (viewMode === 'detail' && items && items.length > 1 && card.formatItem) {
      void changeItem(dir === 'down' ? +1 : -1)
      return
    }
    void changeCard(dir === 'down' ? +1 : -1)
  })
  even.onDoubleTap(source => {
    // Ring 2-tap in detail → non-destructive "back to dashboard"
    if (source === 'ring' && viewMode === 'detail') {
      viewMode = 'dashboard'
      armed = null
      actionFocus = 'none'
      void paint()
      return
    }
    // Everything else (glasses 2-tap, or ring 2-tap in dashboard) → exit app
    void even.exitApp()
  })
  even.onForeground(() => {
    markActive()
    void refreshWeather()
    void refreshActiveCard()
  })
  startActiveCardPoll()
} else {
  ui.note.textContent = 'Running outside the Even runtime. Browser preview only.'
}
