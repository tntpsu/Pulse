#!/usr/bin/env node
// Integration test against the real backends Pulse depends on. Catches
// schema drift, dead routes, missing endpoints — the kind of bug that
// fires "card shows 'unconfigured'" on glasses without any signal that
// the backend changed under us.
//
// Reads endpoint URLs from `.env.local` so this works from a fresh
// clone without per-developer config. Skips checks if a URL isn't set
// (CI would set them via secrets).
//
// Run:
//   node scripts/test-backends.mjs

import { existsSync, readFileSync } from 'node:fs'

function loadDotEnv(path) {
  if (!existsSync(path)) return {}
  const env = {}
  for (const line of readFileSync(path, 'utf-8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (m) env[m[1]] = m[2].trim()
  }
  return env
}

const env = { ...process.env, ...loadDotEnv('.env.local') }
const PASS = []
const FAIL = []
const SKIPPED = []
function ok(name, detail = '') { console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ''}`); PASS.push(name) }
function fail(name, detail) { console.log(`  ✗ ${name} — ${detail}`); FAIL.push({ name, detail }) }
function skip(name, why) { console.log(`  - ${name} (skipped: ${why})`); SKIPPED.push(name) }

async function probe(label, url, opts = {}) {
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), opts.timeout ?? 8_000)
    const res = await fetch(url, { signal: ctrl.signal })
    clearTimeout(timer)
    if (!res.ok) {
      fail(label, `HTTP ${res.status}`)
      return null
    }
    if (opts.json) {
      const body = await res.json()
      return { res, body }
    }
    const text = await res.text()
    return { res, text }
  } catch (err) {
    fail(label, err instanceof Error ? err.message : String(err))
    return null
  }
}

console.log('Pulse backend integration tests')
console.log()

// 1. Duck Ops widget_api
{
  const url = env.VITE_DUCK_OPS_URL
  if (!url) {
    skip('widget_api: VITE_DUCK_OPS_URL not set in .env.local')
  } else {
    const r = await probe('widget_api reachable', url, { json: true })
    if (r) {
      // Spot-check the shape — widget_api should return at least `packing` or `weeklyInsights`.
      const keys = Object.keys(r.body ?? {})
      if (keys.length === 0) fail('widget_api shape', 'empty response')
      else ok('widget_api reachable', `${keys.length} top-level keys`)
    }
  }
}

// 2. phils-bridge core endpoints
{
  const base = env.VITE_PHILS_BRIDGE_URL
  if (!base) {
    skip('phils-bridge: VITE_PHILS_BRIDGE_URL not set in .env.local')
  } else {
    for (const path of ['/healthz', '/calendar.json', '/messages.json', '/now-playing.json', '/gmail/unread.json']) {
      const r = await probe(`phils-bridge ${path}`, `${base}${path}`, { json: true })
      if (r) ok(`phils-bridge ${path}`, `keys=${Object.keys(r.body ?? {}).slice(0, 4).join(',')}`)
    }
  }
}

// 3. open-meteo (public)
{
  const lat = env.VITE_WEATHER_LAT || '40.4406'
  const lon = env.VITE_WEATHER_LON || '-79.9959'
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m`
  const r = await probe('open-meteo forecast', url, { json: true })
  if (r) {
    if (typeof r.body?.current?.temperature_2m !== 'number') {
      fail('open-meteo shape', 'no current.temperature_2m')
    } else {
      ok('open-meteo forecast', `${r.body.current.temperature_2m}°C now`)
    }
  }
}

// 4. ESPN scoreboards (public, used by both per-team sports + new scoreboard card)
{
  for (const league of ['football/nfl', 'basketball/nba']) {
    const url = `https://site.api.espn.com/apis/site/v2/sports/${league}/scoreboard`
    const r = await probe(`ESPN ${league} scoreboard`, url, { json: true })
    if (r) {
      const events = r.body?.events
      if (!Array.isArray(events)) fail(`ESPN ${league} shape`, 'events not array')
      else ok(`ESPN ${league} scoreboard`, `${events.length} events today`)
    }
  }
}

console.log()
console.log(`Result: ${PASS.length} passed, ${FAIL.length} failed, ${SKIPPED.length} skipped`)
if (FAIL.length > 0) {
  console.log('Failures:')
  for (const f of FAIL) console.log(`  - ${f.name}: ${f.detail}`)
  process.exit(1)
}
