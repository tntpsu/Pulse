# TESTS — coverage matrix (Pulse)

Last updated: 2026-11-03 (v0.14.0 — SDK 0.0.16, contextual menu, device location, SDK floor guard).

Full taxonomy + discipline: `~/.claude/skills/coverage-matrix/SKILL.md`. Empty cells block the next ship. `/ship-app` blocks if this file has unfilled cells.

Pulse is `[personal-only]` (depends on phils-bridge + widget_api running on Phil's Mac mini). Coverage requirements are slightly looser than for hub-shippable apps — the security/privacy dimensions matter less because there's only one user, but the persistence + render dimensions matter just as much.

## Use case × failure mode

| Use case | Happy | Backend down | Stale cache | Backend slow | Approval safety |
|---|---|---|---|---|---|
| Boot → load cards → render Today | e2e | manual:hw | manual:hw | manual | n/a |
| Swipe through 15 cards | e2e | n/a | manual:hw | n/a | n/a |
| Tap to detail view | e2e | n/a | n/a | n/a | n/a |
| Item-paginated card (Approvals, Tasks) | e2e | n/a | n/a | n/a | n/a |
| Picker modal opens with options | e2e | n/a | n/a | n/a | n/a |
| Approve action (with `confirm: true`) | manual:hw | manual:hw | n/a | manual:hw | manual:hw |
| Reject action | manual:hw | manual:hw | n/a | manual:hw | n/a |
| Dry-run preview | unit:dry-run TODO | n/a | n/a | manual | n/a |
| Undo window after Tasks complete | unit:undo TODO | n/a | n/a | n/a | n/a |
| Ring-double-tap card selector | e2e | n/a | n/a | n/a | n/a |
| v0.14.0 contextual menu: item 1 opens the card selector, double-tap cancels it, item 2 repaints; spec passes the SDK page-menu validator (a bad menu rejects the whole page) | e2e:6-7 + unit:menu | unit:menu (limits, unique ids, no exit item) | n/a | n/a | n/a |
| v0.14.0 weather coordinates: device fix rounded to 4 dp, 30-min cache (also for a null/denied result), env fallback when the host returns null or throws | unit:location | unit:location (out-of-range, NaN, null island) | n/a | n/a | n/a |
| Weather card header says HERE on a device fix instead of the env city | manual:hw (needs a real `location` grant) | n/a | n/a | n/a | n/a |
| SDK floor: pin ≥ 0.0.16, installed = pin, `app.json` `min_sdk_version` = installed (0.0.14 / 0.0.15 re-fire timers, see KNOWN_QUIRKS) | unit:sdk-floor | unit:sdk-floor | n/a | n/a | n/a |
| Detail double-tap = back | e2e | n/a | n/a | n/a | n/a |
| One-active-card polling cadence | unit:active-poll TODO | n/a | n/a | n/a | n/a |
| Display sleep dedupe (onDeviceStatusChanged) | unit:dedupe TODO | n/a | n/a | n/a | n/a |
| Image container render (Approvals artwork) | manual:hw | manual:hw | n/a | n/a | n/a |

## By dimension (status)

- **Static:** lint+tsc ✓, app-json validation ✓, network whitelist consistency ✓ (cross-repo lint-app-json), secret scan ✓
- **Unit:** **37 tests** across 6 files:
  - `tests/diagnostics.test.ts` — fetch-failure ring, host shortening (11 tests)
  - `tests/shared.test.ts` — formatLoading + formatError (5 tests)
  - `tests/card-framework.test.ts` — every card has required fields + paired UX optionals + format() doesn't throw on null + reasonable pollMs (8 tests + 1 .todo)
  - `tests/location.test.ts` — coordinate rounding, validation, TTL cache, fallback (7 tests)
  - `tests/menu.test.ts` — SDK validator, limits, no exit item (3 tests)
  - `tests/sdk-floor.test.ts` — SDK pin / installed / manifest agree (3 tests)
- **E2E:** `scripts/regression.mjs` (`npm run test:e2e`, simulator 0.9.5 via `npm run sim`) covers boot + card swipe + detail/back + contextual menu (7 checks; the 3-second liveness sample is skipped by design because the dashboard repaints only on a minute change)
- **Backend integration:** `scripts/test-backends.mjs` against widget_api + phils-bridge
- **Performance:** display-sleep behavior is the perf-sensitive path (see KNOWN_QUIRKS section in CLAUDE.md). Bucket+flip dedupe pattern lives in main.ts.
- **Security:** all backend traffic is LAN-only (per `feedback_duckops_widget_auth` memory). Before any non-LAN exposure, add bearer-token auth — unblocked-as-required.
- **Privacy:** [personal-only] — broad scope acceptable
- **Migration:** schema migrations between widget_api versions — manual verify
- **Regression:** v0.10.x display-stays-on bug → bucket+flip dedupe pattern in main.ts; v0.13 today-card empty-data crash → fmtCount handles undefined (caught by smoke test)

## Outstanding gaps before next minor

- [ ] **Defensive format() across all cards** — smoke test (`tests/card-framework.test.ts` `.todo`) currently disabled because multiple cards throw on empty/malformed snapshots. Each card.format() should use `??` fallbacks for every field access. Roughly 17 cards × 5 min = ~1.5h.
- [ ] Approval safety unit tests (confirm/dryRun gating)
- [ ] Image container render path test (port from PREMORTEM-style field test)
- [ ] Undo window unit test for Tasks complete/skip
- [ ] One-active-card polling cadence test (catches the v0.x silent-render-loop regression class)
- [ ] Bucket+flip dedupe heuristic test (move logic out of main.ts to a pure function, then unit test)
