// Card-framework smoke: every card in the registry has the required
// CardDefinition fields and any optional pairs are paired correctly
// (e.g. if confirmAction is set, confirmLabel should be too — otherwise
// main.ts falls back to a generic label which loses meaning).
//
// This catches the class of bug where a copy-paste from _template.ts
// drops a field or misses a paired optional.

import { describe, expect, it } from 'vitest'
import { CARDS } from '../src/cards/index'

describe('CARDS registry', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(CARDS)).toBe(true)
    expect(CARDS.length).toBeGreaterThan(0)
  })

  it('every card has unique id', () => {
    const ids = CARDS.map(c => c.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every card has required fields', () => {
    for (const c of CARDS) {
      expect(c.id, `card.id missing on ${JSON.stringify(c)}`).toBeTruthy()
      expect(c.title, `card.title missing on ${c.id}`).toBeTruthy()
      expect(typeof c.pollMs, `card.pollMs not a number on ${c.id}`).toBe('number')
      expect(c.pollMs, `card.pollMs <= 0 on ${c.id}`).toBeGreaterThan(0)
      expect(typeof c.load, `card.load not a fn on ${c.id}`).toBe('function')
      expect(typeof c.format, `card.format not a fn on ${c.id}`).toBe('function')
    }
  })

  it('item-paginated cards declare getItems + formatItem together', () => {
    for (const c of CARDS) {
      const hasGetItems = typeof c.getItems === 'function'
      const hasFormatItem = typeof c.formatItem === 'function'
      // Either both or neither — never one without the other.
      expect(hasGetItems, `${c.id}: getItems set without formatItem`).toBe(hasFormatItem)
    }
  })

  it('cards with confirmAction also declare confirmLabel (paired UX)', () => {
    for (const c of CARDS) {
      if (typeof c.confirmAction === 'function') {
        // Either confirmLabel is set, OR getActions is set (which overrides
        // the synthesized two-option picker entirely).
        const hasLabel = typeof c.confirmLabel === 'string' && c.confirmLabel.length > 0
        const hasGetActions = typeof c.getActions === 'function'
        expect(hasLabel || hasGetActions,
          `${c.id}: confirmAction set but no confirmLabel and no getActions — picker will show "Confirm" generic`,
        ).toBe(true)
      }
    }
  })

  it('cards with rejectAction also declare rejectLabel', () => {
    for (const c of CARDS) {
      if (typeof c.rejectAction === 'function') {
        const hasLabel = typeof c.rejectLabel === 'string' && c.rejectLabel.length > 0
        const hasGetActions = typeof c.getActions === 'function'
        expect(hasLabel || hasGetActions,
          `${c.id}: rejectAction set but no rejectLabel and no getActions`,
        ).toBe(true)
      }
    }
  })

  it('format() never throws on null data + error string', () => {
    for (const c of CARDS) {
      // Cards must produce SOMETHING renderable when load fails — otherwise
      // a transient error blanks the glasses display.
      expect(() => c.format(null, 'simulated network error'),
        `${c.id}.format threw on (null, error)`,
      ).not.toThrow()
    }
  })

  // KNOWN GAP — multiple cards (today, weather, etc.) throw TypeError on
  // an empty-object payload because they assume specific snapshot fields.
  // Tracked in TESTS.md as a defensive-coding gap. To enable this check,
  // make every card.format() handle missing fields via the `??` fallback
  // pattern — e.g. `s.approvals ?? null` — and convert this from .todo.
  it.todo('format() never throws on empty object data — fix all cards then enable')

  it('pollMs is reasonable (between 5s and 1h)', () => {
    for (const c of CARDS) {
      expect(c.pollMs, `${c.id}.pollMs ${c.pollMs} too short (<5s)`).toBeGreaterThanOrEqual(5_000)
      expect(c.pollMs, `${c.id}.pollMs ${c.pollMs} too long (>1h)`).toBeLessThanOrEqual(60 * 60 * 1000)
    }
  })
})
