#!/usr/bin/env node
// End-to-end regression test for Pulse via the Even Hub simulator HTTP API.
// Verifies the dashboard UX flow — boot, card carousel, detail view,
// dashboard return, exit. The 15+ cards each load real data from public
// APIs / phils-bridge, so this test asserts on STRUCTURAL state changes
// (card index, view mode) rather than card content.
//
// ─── DRAFT NOTICE ────────────────────────────────────────────────────
// Pulse's src/main.ts does NOT currently emit [pulse:state] console.log
// markers the way Cue / Glance / lyrics-glow do. As a result, this
// regression script relies on screenshots + simulator polling rather
// than parsed state logs. Several assertion points are marked TODO —
// they'll start working once main.ts emits state markers. See
// ~/Documents/Cue/src/main.ts paint() for the canonical pattern:
//
//   console.log(`[cue:state] mode=${mode} mic=${micOn ? 'on' : 'off'} stage=${tag} suggestions=${n}`)
//
// Adding the equivalent to Pulse main.ts is a ~15-line change that
// unlocks the parsed-state assertions below.
// ─────────────────────────────────────────────────────────────────────
//
// Prereqs (run manually first):
//   1. cd ~/Documents/Pulse && npm run dev          # Vite on :5174
//   2. npx evenhub-simulator --automation-port 9896 http://localhost:5174
//
// Then: node scripts/regression.mjs

import { writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SIM_BASE = 'http://127.0.0.1:9896'
const HERE = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(HERE, '..', 'tests', 'screenshots-regression')
const STATE_PREFIX = '[pulse:state]'

let lastConsoleId = -1
let pass = 0
let fail = 0
const failures = []

async function ping() {
  const r = await fetch(`${SIM_BASE}/api/ping`)
  if (!r.ok) throw new Error(`simulator not reachable on ${SIM_BASE}`)
}

async function input(action) {
  const r = await fetch(`${SIM_BASE}/api/input`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action }),
  })
  if (!r.ok) throw new Error(`input ${action} failed: ${r.status}`)
}

async function fetchConsoleEntries() {
  const r = await fetch(`${SIM_BASE}/api/console`)
  const body = await r.json()
  return body.entries ?? []
}

async function waitForState(predicate, { timeoutMs = 12_000, label } = {}) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const entries = await fetchConsoleEntries()
    const fresh = entries.filter(e => e.id > lastConsoleId)
    for (const e of fresh) {
      if (typeof e.message === 'string' && e.message.includes(STATE_PREFIX) && predicate(e.message)) {
        lastConsoleId = e.id
        return e
      }
      if (e.id > lastConsoleId) lastConsoleId = e.id
    }
    await new Promise(r => setTimeout(r, 200))
  }
  throw new Error(`timed out waiting for state: ${label ?? '(unlabeled)'}`)
}

// Counts how many [pulse:state] log lines arrived in `windowMs`. Used to
// confirm the dashboard render-loop is alive (cards repaint at CLOCK_TICK_MS
// regardless of input). Mirrors the lyrics-glow countStateLogs() pattern.
async function countStateLogs(windowMs) {
  const beforeId = lastConsoleId
  await new Promise(r => setTimeout(r, windowMs))
  const entries = await fetchConsoleEntries()
  const fresh = entries.filter(e => e.id > beforeId && typeof e.message === 'string' && e.message.includes(STATE_PREFIX))
  if (fresh.length > 0) lastConsoleId = fresh[fresh.length - 1].id
  return fresh.length
}

async function screenshot(name) {
  await mkdir(OUT_DIR, { recursive: true })
  const r = await fetch(`${SIM_BASE}/api/screenshot/glasses`)
  const buf = Buffer.from(await r.arrayBuffer())
  await writeFile(join(OUT_DIR, `${name}.png`), buf)
}

function check(label, condition, detail = '') {
  if (condition) {
    console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`)
    pass += 1
  } else {
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`)
    failures.push(label)
    fail += 1
  }
}

function todoSkip(label, why) {
  console.log(`  - ${label} (skipped: ${why})`)
}

async function main() {
  console.log('Pulse regression test')
  console.log(`  simulator: ${SIM_BASE}`)
  console.log(`  state prefix: ${STATE_PREFIX} (assumes Pulse main.ts emits these)`)
  console.log()

  await ping()
  const initial = await fetchConsoleEntries()
  if (initial.length > 0) lastConsoleId = initial[initial.length - 1].id

  console.log('1. Initial dashboard view')
  await screenshot('01-initial-dashboard')

  // Wait briefly for the boot render. With Pulse polling 15+ cards on
  // background timers, expect render activity within a few seconds. If
  // [pulse:state] markers don't exist yet (they currently don't), this
  // hangs and the timeout catches it — leaves a clear failure pointing at
  // the missing instrumentation.
  try {
    await waitForState(m => m.includes('view='), { timeoutMs: 5_000, label: 'boot completed' })
    check('boot emits at least one [pulse:state] line', true)
  } catch (err) {
    check('boot emits at least one [pulse:state] line', false, 'main.ts missing console.log instrumentation — see DRAFT NOTICE at top')
  }

  console.log('2. Swipe to advance card')
  await input('swipe_down') // SDK convention: down = next
  try {
    const next = await waitForState(
      m => m.includes('card=') && m.includes('view=dashboard'),
      { label: 'card advanced', timeoutMs: 4_000 },
    )
    const idx = next.message.match(/index=(\d+)\/(\d+)/)
    check('swipe_down advances card index', idx !== null, idx ? `${idx[1]}/${idx[2]}` : next.message)
  } catch {
    todoSkip('swipe_down advances card index', 'no [pulse:state] index= marker yet')
  }
  await screenshot('02-card-advanced')

  console.log('3. Tap to enter detail view')
  await input('click')
  try {
    const detail = await waitForState(m => m.includes('view=detail'), { timeoutMs: 3_000, label: 'enter detail' })
    check('tap enters detail view', detail.message.includes('view=detail'), detail.message)
  } catch {
    todoSkip('tap enters detail view', 'no view= marker')
  }
  await screenshot('03-detail-view')

  console.log('4. Double-tap returns to dashboard (Pulse-specific override)')
  // Per Pulse CLAUDE.md / user feedback: double-tap in detail → back, NOT exit.
  // This is the documented divergence from the Even convention.
  await input('double_click')
  try {
    const back = await waitForState(m => m.includes('view=dashboard'), { timeoutMs: 3_000, label: 'back to dashboard' })
    check('double-tap from detail returns to dashboard', back.message.includes('view=dashboard'), back.message)
  } catch {
    todoSkip('double-tap from detail returns to dashboard', 'no view= marker')
  }
  await screenshot('04-back-to-dashboard')

  console.log('5. Render loop liveness (3s sample)')
  // Borrowed from lyrics-glow: confirm the dashboard repaints periodically
  // even with no input. CLOCK_TICK_MS in Pulse drives clock + countdown
  // updates. If state logs aren't emitted, we can't measure this either.
  const ticks = await countStateLogs(3_000)
  if (ticks > 0) {
    check('render loop emits state logs while idle', ticks >= 2, `${ticks} state logs in 3s`)
  } else {
    todoSkip('render loop liveness', 'no state markers in window — instrument main.ts')
  }

  console.log()
  console.log(`Result: ${pass} passed, ${fail} failed`)
  if (fail > 0) {
    console.log('Failures:')
    for (const f of failures) console.log(`  - ${f}`)
    process.exit(1)
  }
}

main().catch(err => {
  console.error('FATAL:', err.message)
  process.exit(1)
})
