# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Phils Home** — a 15-card dashboard plugin for Even Realities G2 smart glasses. Replaces the Even home screen for the user: a Today aggregate glance card, sports scores, Duck Ops business status, Google Tasks, GitHub PRs / CI, Gmail, Now Playing, Calendar, Messages. Tap to expand to detail; swipe for carousel navigation; tap on an actionable item in detail view to open a full-screen action picker (approve / reject / dry-run / complete / skip / etc.), and list-tap the chosen option to execute it. Ring-double-tap in dashboard opens the card-selector modal for jumping anywhere in the carousel without swiping through every card.

## Commands

```bash
npm run dev              # Vite dev server on :5174 (host 0.0.0.0 for LAN)
npm run build            # tsc + vite build → dist/
npm run pack             # evenhub pack app.json dist -o phils-home.ehpk
npm run deploy           # build + pack in one step (preferred)
npx evenhub qr --url http://<mac-lan-ip>:5174   # hot-reload loop on glasses
```

Upload the `.ehpk` manually to the `com.philtullai.philshome` project at `https://hub.evenrealities.com/application` — no CLI upload exists.

## Architecture: the three-bucket data model

When adding a data source, classify it FIRST:

1. **Public web APIs** (ESPN, open-meteo, etc.) → `fetch()` directly from `src/api.ts`. No new server needed.
2. **Per-app private data** → the app that owns the state also owns its endpoint. **Duck Ops data lives at `~/ai-agents/duck-ops/runtime/widget_api.py` on :8780.** Do not mirror it into this repo — extend the widget_api there.
3. **General Mac/phone data with no natural home** (iMessages, Google Calendar/Tasks/Gmail, GitHub API, Now Playing) → add a route to `~/ai-agents/phils-bridge/server.py` on :8790.

Rationale: single auth/CORS surface per service, per-repo ownership of app-specific state, easier future migration to Tailscale. See memory file `project_glasses_data_architecture.md` for the full architectural decision record.

## Card contract

Every card is a `CardDefinition` from `src/cards/_types.ts`. Minimal card:

```ts
{ id, title, pollMs,
  load(): Promise<unknown>,
  format(data, error): string,            // dashboard view, dense
  formatDetail?(data, error): string }    // full-screen detail view
```

Item-paginated cards (Approvals, Tasks) also provide:

```ts
  getItems(data): unknown[],
  formatItem(item, index, total): string,
  // Simple two-option picker: main.ts synthesizes [confirmLabel, rejectLabel]
  // from these fields. Use for cards that just have APPROVE/REJECT or similar.
  confirmAction?(item): Promise<ActionResult>,
  rejectAction?(item): Promise<ActionResult>,
  confirmLabel?: string,
  rejectLabel?: string,
  // For richer flows (3+ options, undo, read-only preview), declare getActions
  // directly. Takes precedence over confirmAction/rejectAction.
  getActions?(item): PickerOption[]
```

`PickerOption` is `{ label: string; run: () => Promise<ActionResult>; undo?: () => Promise<ActionResult> }`. If a chosen option has `undo`, the app flashes a 3-second UNDO prompt after success; a tap during that window fires the undo closure. Used by Tasks for `un-complete` / `un-skip`. Not used by Approvals APPROVE (email irreversible); the `DRY RUN` option exists as the preview-first alternative.

**To add a new card**: copy `src/cards/_template.ts` → `src/cards/<id>.ts`, implement, add one import + one entry to the `CARDS` array in `src/cards/index.ts` (order in that array = carousel order). `_template.ts` documents every option.

Shared helpers live in `src/cards/_shared.ts` (formatError/formatLoading) and `src/cards/_sports.ts` (ESPN card factory).

The **Today** card (`src/cards/today.ts`) is the first card in the carousel and aggregates counts from other data sources. The left column's attention-badges line reads from Today's loaded state (`cardStates.get('today').data`) — Today must have loaded once before badges appear. Keep the Today snapshot shape stable; `formatAttentionBadges` in `main.ts` reads it by field.

## Gesture contract

The G2 temple + optional R1 ring give us 6 usable inputs. Current assignments:

| Gesture | Action |
|---|---|
| Single tap (dashboard) | Enter detail view for the current card |
| Single tap (detail, non-actionable item) | Back to dashboard |
| Single tap (detail, actionable item) | **Open the action picker modal** (full-screen list of card-declared options) |
| Single tap (while UNDO window is open) | Fire the undo closure of the last action |
| Double tap (detail, EITHER source) | Back to dashboard. Overrides the Even "glasses-double-tap = exit" convention because the user prefers not to lose their place when reading a card. Exit is still reachable from dashboard via glasses-2-tap. |
| Glasses double tap (dashboard) | System exit dialog |
| Ring double tap (dashboard) | **Open the card-selector modal** (jump to any card in the carousel) |
| Swipe up/down (dashboard) | Prev/next card |
| Swipe up/down (detail, item-paginated card) | Prev/next item within card |
| Swipe up/down (detail, non-paginated) | Prev/next card |
| Picker: list-tap an option | Execute the chosen action, flash result (with optional UNDO window), return to dashboard |
| Picker: double-tap | Cancel picker (stay in detail view / same card) |

Ring-tap and glasses-tap are treated identically for the single-tap primary action; source only matters for the double-tap (ring-double = back/card-selector, glasses-double = exit).

Ring vs glasses is distinguished by `event.sysEvent.eventSource` (`TOUCH_EVENT_FROM_RING = 2`, glasses = 1 or 3). See `src/even.ts:classifySource`.

**Display sleep** — there's no formal documentation of the firmware's display-sleep behavior (the "~15s no-update" rule used to be folklore in the comments and didn't match observed reality). What we DO know empirically:

- Each `textContainerUpgrade` BLE write is read by the firmware as "the app is active, keep the display lit". Frequent writes = display never sleeps.
- `onDeviceStatusChanged` fires more often than expected on real glasses (battery percent, charging, connection-keepalive). If you call `paint()` unconditionally inside that callback, the display stays lit forever — see `main.ts` device-status handler for the bucket+flip dedupe pattern. This was the root cause of v0.10.x display-stays-on bug.
- Card polling intervals (60s+ for the shortest card) and the 60s service-health probe are too infrequent to keep the display continuously lit on their own.

## Running services (all on Mac mini at 10.168.168.105)

| Service | Port | Where | Purpose |
|---|---|---|---|
| widget_api | 8780 | `~/ai-agents/duck-ops/runtime/widget_api.py` | Duck Ops read + `POST /approvals/approve` |
| phils-bridge | 8790 | `~/ai-agents/phils-bridge/server.py` | Calendar, Tasks, Gmail, GitHub, Now Playing, iMessages. Write routes: `POST /tasks/complete`, `POST /tasks/skip`, `POST /tasks/uncomplete` (undo complete), `POST /tasks/unskip` (undo skip). |
| Vite dev | 5174 | this repo | Hot-reload dev |

**All LAN-only, no auth.** Before ANY non-LAN exposure (Tailscale, tunnel, public deploy): add bearer-token auth to the POST endpoints. User explicitly chose this trust model — see memory `feedback_duckops_widget_auth`.

## Auth and credentials state

- **Google OAuth** — refresh token at `~/ai-agents/phils-bridge/.env`, scopes: `tasks` + `calendar.readonly` + `gmail.readonly`. Re-run `python3 ~/ai-agents/phils-bridge/oauth_setup.py` if revoked or new scope needed.
- **SMTP** (for approval emails) — read from `~/ai-agents/duckAgent/.env` by widget_api.py. Already working.
- **GitHub PAT** — set `GITHUB_TOKEN` + `GITHUB_REPOS=owner/repo,...` env vars on phils-bridge start; otherwise PR/CI cards show "unconfigured".
- **iMessages (Full Disk Access)** — the Python interpreter that runs phils-bridge needs FDA granted in System Settings → Privacy & Security. Binary path: `/opt/homebrew/Cellar/python@3.14/3.14.3_1/Frameworks/Python.framework/Versions/3.14/bin/python3.14`.

## Important conventions (don't break these)

- **Serialize all bridge writes.** The SDK docs warn that concurrent `textContainerUpgrade` calls crash the BLE link. `src/even.ts` uses an `enqueue()` mutex — all renders go through it.
- **SDK is v0.0.10.** `setBackgroundState` / `onBackgroundRestore` documented in the plugin's `background-state` skill do NOT exist in this version. Re-fetch on `FOREGROUND_ENTER_EVENT` instead.
- **One active card polls.** `startActiveCardPoll()` restarts the per-card timer on card change; swiping away stops the previous card's polling.
- **Cache shared data sources.** `loadDuckOps()` caches for 30s so the 6+ Duck Ops cards don't each hit `/widget-status.json` on swipe.
- **Update `app.json` `permissions.network.whitelist`** when you add a new host. Packaged `.ehpk` blocks non-whitelisted fetches.
- **Approvals safety.** `POST /approvals/approve` requires `{confirm: true}` or `{dryRun: true}` in body — this prevents accidental LAN requests from triggering real publishes. The picker modal on glasses is the user-side half of the safety: a single tap opens the picker, the list-tap selects the action, and double-tap-cancel dismisses without firing anything.

## How to add common things

| Task | Where |
|---|---|
| New card | Copy `src/cards/_template.ts`, register in `src/cards/index.ts`. Also see `/new-card` skill. |
| New phils-bridge route | Add handler + route in `~/ai-agents/phils-bridge/server.py`. Update route list in `/` root handler. |
| New widget_api field | Add helper in `~/ai-agents/duck-ops/runtime/widget_api.py`, include in `build_widget_status()`. Update types in `src/types.ts`. |
| New env var | Add to `vite-env.d.ts`'s `ImportMetaEnv`, `.env.local`, and `app.json` permissions if it's a URL. |
| Restart both backend services | See `/restart-services` skill. |
| Dry-run test an approval | See `/dry-run-approve` skill. |

## Roadmap

`ROADMAP.md` (in this repo) tracks pending user actions, queued work, and detailed plans for unstarted features (image containers, audio + wake-word, plus three standalone apps: lyrics overlay, live captions, recipe assistant). Check it before starting a new direction.

## Memory cross-references

Key memory files that apply here (in `~/.claude/projects/-Users-philtullai-Documents-even/memory/`):
- `project_glasses_data_architecture.md` — three-bucket rule + Duck Ops update cadence
- `project_phils_home_data_setup.md` — services, OAuth state, Google Tasks list names
- `feedback_duckops_widget_auth.md` — LAN-only trust decision, auth gate before any wider exposure
