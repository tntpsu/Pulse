// Contextual menu (tap-and-hold on the glasses). Every entry is a one-shot
// command, so labels read as verbs. No exit item: the root-page double-tap
// contract stays the only way out, as store submission requires.

export interface MenuSpec {
  id: number
  label: string
}

export const MENU_JUMP = 1
export const MENU_REFRESH = 2

export const PULSE_MENU: readonly MenuSpec[] = [
  { id: MENU_JUMP, label: 'Jump to card' },
  { id: MENU_REFRESH, label: 'Refresh card' },
]
