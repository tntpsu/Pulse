export interface ActionResult {
  ok: boolean
  message: string
}

export interface CardDefinition {
  id: string
  title: string
  pollMs: number
  load: () => Promise<unknown>
  format: (data: unknown, error: string | null) => string
  formatDetail?: (data: unknown, error: string | null) => string
  // Item-paginated detail: when present, detail mode pages through items
  // via swipes, and ring-tap (after a confirm tap) calls confirmAction.
  getItems?: (data: unknown) => unknown[]
  formatItem?: (item: unknown, index: number, total: number) => string
  confirmAction?: (item: unknown) => Promise<ActionResult>
  confirmPrompt?: (item: unknown) => string
  // Optional secondary action — when set, a swipe while ARMED switches the
  // staged action between approve and reject; second ring-tap executes it.
  rejectAction?: (item: unknown) => Promise<ActionResult>
  rejectPrompt?: (item: unknown) => string
  // Display labels for the dual-action selector (defaults: APPROVE / REJECT).
  // Tasks override these to "COMPLETE" / "SKIP".
  confirmLabel?: string
  rejectLabel?: string
}
