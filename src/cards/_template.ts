/**
 * Card template — copy this file, rename, register in ./index.ts.
 *
 * Every card is a small object implementing the CardDefinition contract:
 *
 *   - id / title / pollMs           — required identity and auto-refresh cadence
 *   - load()                        — fetches whatever data the card needs
 *   - format(data, error)           — SHORT render for the dashboard (right column)
 *   - formatDetail?(data, error)    — FULL render when user taps to expand
 *
 *   Optional — for item-paginated cards (approval queues, task lists, etc.):
 *   - getItems(data)                — returns the array to page through
 *   - formatItem(item, i, total)    — renders ONE item in detail mode
 *   - confirmPrompt(item)           — first line after ring-tap "ARM"
 *   - confirmAction(item)           — runs on second ring-tap. Returns
 *                                     { ok, message } — message is shown
 *                                     briefly on glasses after.
 *
 * Gesture contract (same across all cards, don't change):
 *   - Glasses tap       = toggle dashboard ↔ detail
 *   - Double-tap        = exit the app (system dialog)
 *   - Swipe up/down     = prev/next card in dashboard, prev/next ITEM when in
 *                         detail mode for an item-paginated card
 *   - Ring tap          = primary action on current item (arm + confirm flow)
 *
 * Keep format() strings dense — the dashboard right column is ~336 px wide
 * and ~10 lines tall. Detail renders to full 576x288. See glasses-ui skill
 * for layout/container rules.
 */

// This file is a REFERENCE, not a live card. Nothing imports it.
// To add a new card: copy the shape below, rename, register in ./index.ts.
//
// The snippet is a TypeScript comment block on purpose — it avoids a dead
// export that would bloat the carousel registry by accident.
//
// import { formatError, formatLoading } from './_shared'
// import type { CardDefinition } from './_types'
//
// interface ExampleSnapshot {
//   status: 'ok' | 'error' | 'unconfigured'
//   value?: number
//   items?: Array<{ id: string; title: string }>
//   note?: string
// }
//
// async function loadExample(): Promise<ExampleSnapshot> {
//   // fetch / api-call goes here
//   return { status: 'ok', value: 42 }
// }
//
// function format(data: unknown, error: string | null): string {
//   const title = 'EXAMPLE'
//   if (error) return formatError(title, error)
//   if (!data) return formatLoading(title)
//   const snap = data as ExampleSnapshot
//   if (snap.status !== 'ok') return [title, '', snap.note ?? snap.status].join('\n')
//   return [title, '', `Value: ${snap.value}`].join('\n')
// }
//
// function formatDetail(data: unknown, error: string | null): string {
//   const title = 'EXAMPLE'
//   if (error) return formatError(title, error)
//   if (!data) return formatLoading(title)
//   const snap = data as ExampleSnapshot
//   return [
//     title, '',
//     `Status: ${snap.status}`,
//     `Value:  ${snap.value}`,
//   ].join('\n')
// }
//
// export const exampleCard: CardDefinition = {
//   id: 'example',
//   title: 'Example',
//   pollMs: 60_000,
//   load: loadExample,
//   format,
//   formatDetail,
// }
//
// For item-paginated + ring-tap action, also add:
//   getItems:    data => (data as ExampleSnapshot).items ?? [],
//   formatItem:  (item, i, total) => `ITEM ${i + 1}/${total}\n${(item as any).title}`,
//   confirmPrompt: item => `Act on "${(item as any).title}"?`,
//   confirmAction: async item => ({ ok: true, message: 'done' }),

export {} // keep the file importable as a module if tooling asks
