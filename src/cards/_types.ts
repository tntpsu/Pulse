export interface ActionResult {
  ok: boolean
  message: string
}

// Picker option surfaced in the full-screen action modal. `run` is a zero-arg
// closure so cards can capture the item they know about. `undo` is optional;
// when present, the app flashes an UNDO prompt for UNDO_WINDOW_MS after a
// successful run and calls `undo()` if the user taps within that window.
export interface PickerOption {
  label: string
  run: () => Promise<ActionResult>
  undo?: () => Promise<ActionResult>
}

export interface CardDefinition {
  id: string
  title: string
  pollMs: number
  load: () => Promise<unknown>
  format: (data: unknown, error: string | null) => string
  formatDetail?: (data: unknown, error: string | null) => string
  // Item-paginated detail: when present, detail mode pages through items
  // via swipes and tap on an actionable item opens the picker modal.
  getItems?: (data: unknown) => unknown[]
  formatItem?: (item: unknown, index: number, total: number) => string
  // Simple actions: main.ts synthesizes a two-option picker (confirm / reject).
  // For richer flows (3+ options, undo, etc.) implement getActions instead.
  confirmAction?: (item: unknown) => Promise<ActionResult>
  confirmPrompt?: (item: unknown) => string
  rejectAction?: (item: unknown) => Promise<ActionResult>
  rejectPrompt?: (item: unknown) => string
  confirmLabel?: string
  rejectLabel?: string
  // Override the synthesized two-option picker with a fully custom action list.
  // When present, confirmAction / rejectAction are ignored.
  getActions?: (item: unknown) => PickerOption[]
}
