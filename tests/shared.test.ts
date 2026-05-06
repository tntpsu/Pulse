import { describe, expect, it } from 'vitest'
import { formatError, formatLoading } from '../src/cards/_shared'

describe('formatLoading', () => {
  it('puts title on top, "Loading..." below', () => {
    expect(formatLoading('WEATHER')).toBe('WEATHER\n\nLoading...')
  })
  it('preserves whitespace in title', () => {
    expect(formatLoading('NOW PLAYING')).toBe('NOW PLAYING\n\nLoading...')
  })
})

describe('formatError', () => {
  it('puts title on top, error prefixed with "! "', () => {
    expect(formatError('GMAIL', 'auth failed')).toBe('GMAIL\n\n! auth failed')
  })
  it('truncates long errors to 80 chars', () => {
    const long = 'x'.repeat(200)
    const out = formatError('TASKS', long)
    // Format is "TASKS\n\n! " + truncated(80)
    expect(out.length).toBe('TASKS\n\n! '.length + 80)
  })
  it('handles empty error string', () => {
    expect(formatError('TODAY', '')).toBe('TODAY\n\n! ')
  })
})
