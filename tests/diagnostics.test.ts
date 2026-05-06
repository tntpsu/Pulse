// Pulse v0.14 starter unit tests — first non-zero coverage on this app.
// Targets the pure-function diagnostics helpers used by Troubleshoot card.

import { describe, expect, it } from 'vitest'

// Module is module-level singleton. Each test imports fresh by reset.
async function importFresh() {
  // Vitest cache-bust by timestamp suffix import path
  const m = await import(`../src/diagnostics?nocache=${Date.now()}`)
  return m as typeof import('../src/diagnostics')
}

describe('diagnostics ring', () => {
  it('records a failure with message + url', async () => {
    const d = await importFresh()
    d.recordFetchFailure('http://example.com/foo', new Error('boom'))
    const fails = d.recentFailures()
    expect(fails.length).toBe(1)
    expect(fails[0]!.url).toBe('http://example.com/foo')
    expect(fails[0]!.message).toBe('boom')
    expect(fails[0]!.at).toBeGreaterThan(0)
  })

  it('handles non-Error thrown values', async () => {
    const d = await importFresh()
    d.recordFetchFailure('http://example.com', 'plain string')
    expect(d.recentFailures()[0]!.message).toBe('plain string')
  })

  it('preserves named errors as "Name: message"', async () => {
    const d = await importFresh()
    const err = new Error('connection refused')
    err.name = 'TypeError'
    d.recordFetchFailure('http://example.com', err)
    expect(d.recentFailures()[0]!.message).toBe('TypeError: connection refused')
  })

  it('truncates long messages to 120 chars', async () => {
    const d = await importFresh()
    const long = 'x'.repeat(500)
    d.recordFetchFailure('http://example.com', new Error(long))
    expect(d.recentFailures()[0]!.message.length).toBe(120)
  })

  it('caps the ring at 8 entries (oldest drops off)', async () => {
    const d = await importFresh()
    for (let i = 0; i < 12; i++) {
      d.recordFetchFailure(`http://example.com/${i}`, new Error(`err ${i}`))
    }
    const fails = d.recentFailures()
    expect(fails.length).toBe(8)
    // Newest first per implementation (unshift)
    expect(fails[0]!.url).toBe('http://example.com/11')
  })

  it('records HTTP status when provided', async () => {
    const d = await importFresh()
    d.recordFetchFailure('http://example.com', 'HTTP 503', 503)
    expect(d.recentFailures()[0]!.status).toBe(503)
  })
})

describe('shortHost', () => {
  it('strips https:// and path', async () => {
    const { shortHost } = await importFresh()
    expect(shortHost('https://api.example.com/v1/foo/bar')).toBe('api.example.com')
  })
  it('strips http:// too', async () => {
    const { shortHost } = await importFresh()
    expect(shortHost('http://10.168.168.105:8780/widget-status.json')).toBe('10.168.168.105:8780')
  })
  it('returns "(unset)" for empty input', async () => {
    const { shortHost } = await importFresh()
    expect(shortHost('')).toBe('(unset)')
  })
  it('truncates to 28 chars', async () => {
    const { shortHost } = await importFresh()
    expect(shortHost('https://very-long-subdomain-name.example.com').length).toBeLessThanOrEqual(28)
  })
  it('handles bare host without scheme', async () => {
    const { shortHost } = await importFresh()
    // No scheme to strip — comes through as-is up to the slice.
    expect(shortHost('localhost:8790/foo')).toBe('localhost:8790')
  })
})
