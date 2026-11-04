// @vitest-environment jsdom
// A malformed menu makes the firmware reject the whole page, so the menu
// spec is checked against the SDK's own validator before it can ship.

import { describe, expect, it } from 'vitest'
import {
  MenuContainerProperty,
  MenuItemProperty,
  TextContainerProperty,
  isMenuNameWithinLimit,
  isValidMenuItemID,
  validateEvenHubPageContainerMenu,
} from '@evenrealities/even_hub_sdk'
import { PULSE_MENU } from '../src/menu'

describe('PULSE_MENU', () => {
  it('passes the SDK page-menu validator', () => {
    const page = {
      containerTotalNum: 1,
      textObject: [new TextContainerProperty({ containerID: 1, containerName: 'x', content: '' })],
      menuObject: new MenuContainerProperty({
        menuItems: PULSE_MENU.map(m => new MenuItemProperty({ itemName: m.label, itemID: m.id })),
      }),
    }
    const result = validateEvenHubPageContainerMenu(page)
    expect(result).toEqual({ valid: true })
  })

  it('keeps every item within firmware limits', () => {
    expect(PULSE_MENU.length).toBeLessThanOrEqual(10)
    const ids = new Set<number>()
    for (const m of PULSE_MENU) {
      expect(isValidMenuItemID(m.id)).toBe(true)
      expect(isMenuNameWithinLimit(m.label)).toBe(true)
      expect(ids.has(m.id)).toBe(false)
      ids.add(m.id)
    }
  })

  it('has no exit or close item, which store submission forbids', () => {
    for (const m of PULSE_MENU) expect(m.label).not.toMatch(/exit|close|quit/i)
  })
})
