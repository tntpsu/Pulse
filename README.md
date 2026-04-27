# Pulse

> **Your dashboard, on your face.**

A 15+ card glanceable dashboard for Even Realities G2 smart glasses. Replaces the Even home screen with a swipe-through carousel of cards that pull from public APIs (weather, sports), your AI agents (Duck Ops business state), and your personal services (Google Tasks, GitHub PRs, Gmail unread, Now Playing).

## Status: v0.13.0

What's shipped (cumulative):
- v0.1.0 → v0.13.0 cards: Today aggregate, weather, scoreboard (NFL / NBA / MLB), Duck Ops pack queue + post-agent + custom builds + customer replies, Google Tasks (3 lists), GitHub PRs, GitHub CI, Gmail unread, Now Playing, Calendar agenda, iMessage unread, Troubleshoot.
- Action picker — tap on actionable item in detail view → modal of choices (approve / reject / dry-run / complete / skip / etc); list-tap executes.
- Card-selector modal — ring-double-tap from dashboard jumps anywhere in the carousel without swiping through every card.
- Phils Home → Pulse rename complete (April 2026); package_id now `com.philtullai.pulse`.
- v0.13.0 (this rev): `[pulse:state]` instrumentation added so `scripts/regression.mjs` can latch onto state transitions; `even.setStorage` failures now surface instead of being swallowed silently.

## How it works

Three views:
1. **Dashboard** — left column shows the constant frame (clock, weather, service health). Right column cycles through one card at a time. Swipe up/down to change cards. Ring double-tap from dashboard opens the card picker.
2. **Detail** — tap a card from dashboard → expanded view with more text + actionable items. Swipe to paginate within the card's items. Tap an item → action picker.
3. **Action picker** — modal list of possible actions for the selected item. List-tap commits.

Glasses gestures:
| Gesture | Action |
|---|---|
| Swipe up/down (dashboard) | Change card |
| Tap (dashboard) | Enter detail view OR open action picker on actionable items |
| Swipe up/down (detail) | Paginate within card OR change card |
| Double-tap (detail) | Back to dashboard (override of Even convention; exit only from dashboard root) |
| Glasses double-tap (dashboard) | Exit app |
| Ring double-tap (dashboard) | Open card-selector modal |

## Architecture: the three-bucket data model

When adding a new data source, classify it FIRST:

1. **Public web APIs** (ESPN, open-meteo, etc.) → `fetch()` directly from `src/api.ts`. No new server needed.
2. **Per-app private data** → the app that owns the state owns its endpoint. **Duck Ops data lives at `~/ai-agents/duck-ops/runtime/widget_api.py` on :8780.** Don't mirror it here — extend the widget_api.
3. **General Mac/phone data with no natural home** (iMessages, Google Calendar/Tasks/Gmail, GitHub API, Now Playing) → add a route to `~/ai-agents/phils-bridge/server.py` on :8790.

Rationale: single auth/CORS surface per service, per-repo ownership of app-specific state, easier future migration to Tailscale.

## Card contract

Every card is a `CardDefinition` from `src/cards/_types.ts`:

```ts
{ id, title, pollMs,
  load(): Promise<unknown>,
  format(data, error): string,            // dashboard view, dense
  formatDetail?(data, error): string,     // expanded view
  formatItem?(item): string,              // single item in paginated detail
  actionsForItem?(item): Action[] }       // optional action picker
```

Per-card adapter modules live in `src/cards/<name>.ts`. Add a card by writing one + registering it in `src/cards/index.ts`.

## Development

```bash
npm install
npm run dev              # Vite on :5174
npm run build            # tsc + vite build
npm run pack             # evenhub pack → pulse.ehpk
npm run deploy           # build + pack
npm run hub:upload       # if available; otherwise upload manually
npm run test             # vitest (currently scaffold; add tests as cards stabilize)
npm run test:e2e         # simulator regression (needs npm run dev + simulator running)
npm run test:backends    # live integration tests against bridge + public APIs
npx evenhub qr --url http://<lan-ip>:5174   # QR for real-glasses hot reload
```

## Source files

| File | Purpose |
|---|---|
| `src/main.ts` | Entry, state machine, view-mode transitions, action-picker modal |
| `src/even.ts` | Glasses bridge wrapper (dual text containers — left frame + right card) |
| `src/api.ts` | Public-API + bridge fetch helpers (open-meteo, ESPN, phils-bridge, Duck Ops) |
| `src/diagnostics.ts` | Recent-failures ring buffer for the Troubleshoot card |
| `src/types.ts` | Shared TypeScript shapes |
| `src/cards/` | One module per card type (today, sports, weather, duck-ops, github, gmail, ...) |

## Privacy

Pulse is a personal dashboard. The `.ehpk` only knows your Tailscale IP + LAN IP for the local services. Public APIs (open-meteo, ESPN) are unauthenticated. No analytics, no telemetry.

## Roadmap

Full plan in `~/Documents/Pulse/ROADMAP.md`. Highlights for v0.14+:
- Image containers (`updateImageRawData`) for visual cards (weather glyph, team logos, calendar mini-view)
- `audioControl` + wake-word detection (parked — see ROADMAP)
- Pomodoro / focus card (universally relevant, glanceable, no backend)
