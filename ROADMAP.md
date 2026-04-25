# Phils Home — Roadmap

Living document. Captures pending user actions, queued work, and detailed
plans that are too long to keep alive in chat. Update as work moves between
sections (queued → in flight → done → delete from here, the commit log has
the history).

---

## Pending user actions (blocking work below)

These need you, not me — I cannot complete them from inside the sandbox.

| Action | Why | Command |
|---|---|---|
| Restart `widget_api` | Pick up the rejection-stable-key fix and the top-3-sellers field added in the duck-ops repo | `launchctl kickstart -k "gui/$(id -u)/com.philtullai.duck-ops-widget"` |
| Re-run Google OAuth | Current refresh token predates the `gmail.readonly` scope being added to `oauth_setup.py`. Without this, the Gmail card shows "unconfigured" | `python3 ~/ai-agents/phils-bridge/oauth_setup.py` then re-restart phils-bridge |
| Commit duck-ops changes | `runtime/operator_interface_contracts.py` has the rejection + top-3-sellers patch; sits alongside your in-flight `etsy_browser_batch` work | Commit when convenient |

---

## Investigated and parked

### ESPN full article body

**Status:** not feasible without significant infrastructure investment.

**Findings:**
- ESPN's free `news` endpoint returns only `description` (1-2 sentence summary)
- ESPN article pages on espn.com are JavaScript-rendered SPAs — static HTML has no body content (verified: only 4 `<p>` tags total in a sample story page)
- ESPN RSS feeds carry the same short `<description>` only — no `<content:encoded>` with full body
- A stdlib HTML scraper attempt was written and tested; failed for the obvious reason

**Realistic paths forward (none cheap):**
- **Headless browser server-side** (Playwright / Selenium): adds ~250MB chromium binary + 1-3s per fetch + maintenance burden. Only worth it if multiple cards need it
- **Diffbot or similar paid extraction API**: ~$300/mo entry, gold-standard quality, no infrastructure
- **NewsAPI / Bing News**: free tiers are too thin (~100 req/day) for daily use

**Decision:** keep showing summaries with `(summary)` label and a `full: <url>` line so the user can finish reading on their phone. Revisit if image containers (below) ship and we want a "rich content viewer" pattern.

---

## Queued — Phils Home dashboard

Ordered by my recommendation. Pick whichever you want when ready.

### 1. Image containers (`updateImageRawData`) — RECOMMENDED NEXT

Highest visual leverage of any unused SDK feature. See **§ Plan: Image containers** below.

**One-line reason to do it:** approval cards with the actual duck artwork thumbnail beat title-only previews dramatically; same pipeline unlocks team logos on sports, dithered photos elsewhere.

**Effort:** ~3.5–4 hours.

### 2. `audioControl` + wake-word detection — DEFERRED

Technically possible. See **§ Plan: AudioControl + wake-word** below for what it would actually take.

**Why deferred:** ~6–8 hours of build + ongoing per-minute STT cost + meaningful battery drain + privacy considerations. The picker modal already gives near-hands-free usage. Revisit only if voice control becomes necessary (e.g. while cooking, driving).

---

## Queued — Standalone Even Hub apps (separate repos)

These are NOT part of Phils Home — each lives in its own repo with its own `package_id`. Listed here as related work.

### 1. Lyrics Overlay ⭐ PRIORITY 1

**Concept:** karaoke-through-glasses. Pulls currently-playing track + time-synced lyrics, scrolls them on the glasses in lockstep with the song.

**Why first:** fits the "viral demo" target perfectly (TikTok-able), modest effort (~15 hours), no recurring cost concerns beyond Spotify free tier, no privacy controversy. See **§ Plan: Lyrics Overlay** below.

### 2. Live Captions ⭐ PRIORITY 2

**Concept:** always-on mic + real-time STT, captions ambient conversation on the glasses. Accessibility hero use case + general "I never miss what was just said" appeal.

**Why second:** highest "wow", but bigger build (~22 hours), genuine privacy considerations, ongoing per-minute STT cost. See **§ Plan: Live Captions** below.

### 3. Recipe Assistant ⭐ PRIORITY 3

**Concept:** pre-loaded recipes that scroll one step at a time, advance via head-nod (IMU). Hands-free cooking.

**Why third:** smaller audience than #1/#2, IMU gesture detection is finicky (most of the build time goes to tuning thresholds). See **§ Plan: Recipe Assistant** below.

---

# Plans (full detail)

## Plan: Image containers (Phils Home)

### Concept
Use the SDK's `updateImageRawData` to render 4-bit greyscale bitmap images on the glasses. Highest-value first integration: thumbnail of the duck artwork on the Approvals card detail view (way better decision signal than a title string).

### Quality design
- Layout: in detail mode for an actionable card with an image, left text 240px (clock/badges), right top 128×128 image, right bottom 336×160 text.
- Modes that don't need an image keep the current text-only layout.
- 4-bit greyscale on photos is harsh; Floyd-Steinberg dithering compensates.

### Architecture
1. **Pixel pipeline** (`src/cards/_image.ts`, new file): `fetchImageAsGray4(url, w, h): Promise<number[]>`. Steps: `fetch()` → `<img>` decode → offscreen canvas resize → `getImageData()` → grayscale (`0.299R + 0.587G + 0.114B`) → 4-bit quantize → 2-pixels-per-byte pack. Floyd-Steinberg dither (~30 lines) for photo realism.
2. **Layout extension** (`src/even.ts`): support an image container alongside the two text containers. Detail-enter rebuilds the page; rebuild-back-on-detail-exit. SDK supports up to 4 image containers, max 288×144.
3. **CardDefinition contract**: add `getImage?(item): Promise<{ url: string; w: 128; h: 128 } | null>`. Approvals card returns the artwork URL.
4. **widget_api**: add `previewImageUrl` to each `pendingApprovals` entry (~20 lines Python).
5. **Send pipeline**: wrap `bridge.updateImageRawData` in the existing `enqueue()` so it serializes against text writes (concurrent text+image writes crash the BLE link per SDK docs).
6. **Caching**: fetch+dither once per artifact_id, cache in module Map.

### Risks
- 4-bit greyscale on duck photos with white feathers = harsh contrast. Dithering is essential.
- BLE bandwidth: ~24KB per image. Don't update on every refresh — only on approval-list change.
- Page rebuild on detail-enter has a brief flicker (current text-only flow uses upgrade, not rebuild).

### Tradeoffs
- Going visual is a one-way door — text-only is much simpler. Once we have images, every new card author asks "where's mine?".
- Dithering adds ~30 lines of code and ~10ms per image. Worth it for photos.

### Implementation steps
1. Pixel pipeline + dither (~80 lines, 1.5h)
2. Layout extension in even.ts (~60 lines, 1h)
3. CardDefinition contract addition (~15 lines, 15min)
4. widget_api `previewImageUrl` field (~20 lines, 15min)
5. Caching + perf testing (30min)

**Total: ~3.5–4 hours**

### Testing
- Unit: pixel pipeline pure-function tests on synthetic input
- Integration: mock the artwork URL fetch, verify the rendered byte array matches a known-good golden
- Manual on-glasses: cycle through 5 representative duck photos, eyeball legibility
- Skill: `everything-evenhub:simulator-automation` to take screenshots of the picker for regression

### Skills to invoke
`everything-evenhub:glasses-ui` (containers) → `everything-evenhub:design-guidelines` (image specs) → `everything-evenhub:simulator-automation` (screenshots) → `everything-evenhub:build-and-deploy` (ship)

---

## Plan: AudioControl + wake-word detection (Phils Home)

### Concept
Always-on mic, local wake-word detector ("hey home"), cloud STT after the wake-word fires, command routing into the existing picker actions. "Approve duck", "next card", "today".

### Feasibility
**Yes** — SDK exposes `audioControl(true)` plus continuous PCM via `event.audioEvent.audioPcm` (Uint8Array). No documented sample rate (industry-standard guess: 16kHz mono 16-bit; verify empirically). SDK does NOT provide wake-word, VAD, or STT — those are entirely on you.

### Architecture
**Layer 1 — capture** (`src/audio.ts`): subscribe to `event.audioEvent`, ring buffer last ~2s of PCM, pass each chunk to wake-word detector.

**Layer 2 — wake-word detector**:
- **Picovoice Porcupine** (recommended): commercial wake-word engine, runs as ~80KB WASM module in the browser. Free tier: 3 users, custom keywords. Free tier requires showing their attribution; paid is $29/mo per 100 active users.
- Alternatives: TensorFlow.js with Google's "speech-commands" model (free, fixed 18-keyword set) or roll-your-own with Mycroft Precise (open source, requires you to train on hundreds of recordings).

**Layer 3 — STT after wake-word fires**:
- Capture next ~3s of PCM
- Bridge proxies to a streaming cloud STT (OpenAI Whisper API ~$0.006/min, AssemblyAI realtime, or Deepgram)
- Bridge route: `POST /stt` (audio in, transcript out)

**Layer 4 — command dispatch** (`src/voice.ts`): map transcript → action (`/next/` → `changeCard(+1)`, `/approve/` + `/duck/` → APPROVE picker option, etc.).

### Risks
- **PCM format unverified**: if not 16kHz/16-bit/mono, the rest of the plan still works but format adjustments needed.
- **Bundle size**: Porcupine WASM bumps bundle from 105KB to ~190KB (gzip ~70KB). Probably fine but noticeable.
- **Battery drain**: continuous mic + BLE + WebSocket is the heaviest single drain you can add. Real-world headache.
- **Privacy**: continuous mic is a meaningful escalation. Add a clear visual indicator when mic is hot (e.g. `🎙` glyph or `●` on the left column) — non-negotiable for trust.
- **Network dependency**: STT requires phils-bridge → internet. Need a graceful fallback to local-only command vocab.

### Tradeoffs
- Porcupine paid tier vs. free with attribution
- Cloud STT vs. local Whisper-tiny WASM (huge bundle, slow on phone CPU; cloud wins for v1)
- Always-on vs. push-to-talk (always-on is the value prop; PTT negates ambient use case)

### Implementation steps
1. Ring buffer + audio plumbing (~100 lines, 1.5h)
2. Wake-word integration with Porcupine (~80 lines + their console: 30min keyword training): 2h
3. Bridge `/stt` proxy to OpenAI Whisper (~40 lines Python + OPENAI_API_KEY env): 1h
4. Command dispatcher (~60 lines): 1h
5. App.json permission `g2-microphone`: 5min
6. Testing on real glasses (simulator likely doesn't pipe a real mic): 1-2h debugging

**Total: ~6–8 hours, plus ongoing $0.006/min STT cost when active.**

### Testing
- Unit: command-string-to-action mapping, ring buffer correctness
- Integration: pre-recorded "hey home next card" audio piped through the chain, verify the action fires
- Manual on-glasses: 3 scenarios — quiet office, noisy cafe, with music in background
- Privacy / trust audit: mirror test confirming the mic indicator is visible

### Skills to invoke
`everything-evenhub:device-features` (mic capture) → `everything-evenhub:handle-input` → `everything-evenhub:simulator-automation` → `everything-evenhub:build-and-deploy`

---

## Plan: Lyrics Overlay (standalone app)

### Concept
Pulls currently-playing Spotify track + time-synced lyrics, scrolls them on the glasses line-by-line in lockstep with the song.

### Quality design

**Display layout**:
```
NOW PLAYING
Bohemian Rhapsody — Queen
═════════════════════════════════
       Mama, just killed a man
   > Put a gun against his head        ← current line, > cursor
        Pulled my trigger, now
        he's dead
  ▌▌  ──●─────────  1:42                ← transport + scrub bar
```

Three-line lyrics window (prev/current/next) gives context without overwhelming.

**Gestures**:
| Gesture | Action |
|---|---|
| Single tap | Toggle compact (current line only) ↔ expanded (prev/cur/next/+1) |
| Swipe up/down | Manually skip line backward/forward (override sync) |
| Ring 2-tap | Re-anchor to live position |
| Glasses 2-tap | Exit |

**Edge cases**: no track playing → "Nothing playing" + clock; no lyrics found → track-meta-only fallback; time drift → re-anchor on track change + manual offset slider in phone-side config.

### Architecture
**Phone-side bridge** (recommend NEW `~/ai-agents/lyrics-bridge/server.py` on :8791 — isolation from the personal phils-bridge since this would be shipped publicly):
- Routes: `GET /now-playing.json`, `GET /lyrics.json?track=&artist=&title=`
- Lyrics sources: Musixmatch (paid API, $0/mo dev tier with rate limits) primary, LRCLIB (free, community LRC files, less coverage) secondary
- Spotify OAuth one-time browser auth (scope: `user-read-currently-playing`), refresh token in `.env`

**Glasses-side renderer**:
- Single full-screen text container (no two-column split — lyrics need full width)
- Re-render every 250ms while flowing (faster than dashboard's 10s heartbeat — needs to feel snappy)
- Use `textContainerUpgrade` for flicker-free updates
- Lyric line index = binary search on timestamps against `(now - track_started_at + elapsed_at_query)`

**Sync strategy**: pull `/now-playing.json` every 5s for track changes + position drift; locally advance line counter between polls; if drift > 2s, force re-fetch + re-anchor.

### Risks
- **Lyrics availability**: Musixmatch covers ~3M tracks but obscure/new songs miss. Mitigate with two-source stitching.
- **Spotify rate limits**: 100 req/min free tier — fine for one user, problematic at scale. Move to per-user OAuth (each user auths their own Spotify) — solves rate limits and privacy.
- **Time sync precision**: BLE round-trip + WebView render adds ~200-500ms latency. Without a manual offset slider in phone config, lyrics will lag noticeably.
- **Apple Music**: no public API equivalent. Spotify-only v1 is honest.

### Tradeoffs
- Polling vs. websocket: Spotify offers neither push nor websockets for currently-playing; polling is the only option. 5s interval is the sweet spot.
- Three-line vs. full-screen scroll: full would show ~10 lines of context but feel cluttered. Three-line is closer to a karaoke-machine experience.
- Local timing vs. always-fetch: hybrid (local advance + 5s drift correction) is the right balance.

### Implementation steps
1. Scaffold via `everything-evenhub:quickstart` — `lyrics-glow`, `com.philtullai.lyricsglow` (1.5h with Spotify OAuth setup script)
2. Lyrics-bridge with Musixmatch + LRCLIB stitching (~250 lines Python, 4h)
3. Glasses app: scaffold + 2 loaders + line-binary-search (~400 lines TS, 6h)
4. Native bridge storage for "last track id" so re-launch resumes mid-line (15min)
5. Polish: dim previous/next via blank padding, transport bar from `█▇▆▅▄▃▂▁` set (2h)
6. App.json: `permissions.network.whitelist` = `[mac-lan-ip:8791, api.spotify.com]`

**Total: ~15–16 hours, distributable across 2 sessions.**

### Testing
- Unit: lyric-line binary search on synthetic timestamps
- Integration: mock both endpoints, scrub a song programmatically, screenshot the simulator at 5s intervals via the automation HTTP API, eyeball line transitions
- Manual on-glasses: 3 representative songs (short pop, long ballad, dense rap). Tune offset slider for default lag compensation
- Failure mode: simulate Wi-Fi drop mid-song → confirm "(network)" indicator instead of crash

### Skills to invoke
`everything-evenhub:quickstart` → `everything-evenhub:glasses-ui` (single text container) → `everything-evenhub:font-measurement` (precise text wrapping for the 3-line window) → `everything-evenhub:handle-input` (swipe/tap routing) → `everything-evenhub:test-with-simulator` → `everything-evenhub:simulator-automation` → `everything-evenhub:build-and-deploy`

---

## Plan: Live Captions (standalone app)

### Concept
Always-on mic + real-time STT. Captions ambient conversation on the glasses. Massive accessibility audience + general "I never miss what was just said" appeal.

### Quality design

**Display layout**:
```
LIVE CAPTIONS                  ●     ← mic-on indicator (always visible when hot)

She said:                            ← speaker label (when diarization stable)
> Yeah I think Q3 numbers are       ← current chunk, > cursor
   going to be tight, but if         ← continuation
   we close the Anderson deal

him:                                 ← previous speaker
   That's a big if.

[2 prior turns ↑ swipe to scroll]
```

Rolling 3-second window of most recent caption + scrollable backlog.

**Gestures**:
| Gesture | Action |
|---|---|
| Single tap | Toggle compact (1 line) ↔ expanded (3 turns) |
| Swipe up | Scroll to older turns |
| Swipe down | Scroll to newer / re-anchor live |
| Ring 2-tap | Toggle mic on/off (privacy escape hatch) |
| Glasses 2-tap | Exit |

**Edge cases**: silence > 30s → "(silence)" indicator, mic stays on but display dims; network drop → "(offline)" + queue audio for retry; user says "captions off" → graceful pause + persist preference; speaker overlap → no diarization, just transcribe.

### Architecture
**Bridge** (extend phils-bridge OR new `captions-bridge:8792`):
- New route: `POST /stt/stream` — receives chunked audio (multipart or websocket), returns SSE stream of partial + final transcripts
- Backend: **Deepgram streaming WebSocket** (~$0.004/min, sub-second latency, diarization built-in) or AssemblyAI realtime
- API key in `.env`; never expose client-side

**Glasses-side**:
- Subscribe to `audioControl(true)` → continuous PCM stream
- 5s ring buffer
- Open WebSocket to `bridge:8792/stt/stream`, push 250ms chunks
- Receive partial (in-progress) + final (settled) transcripts
- Render: current partial as live line, finals append to backlog

**Privacy/trust layer (essential)**:
- Mic indicator ALWAYS visible when hot (never hide it)
- Default state on launch: mic OFF (user must explicitly enable)
- Persist mic preference per session via native storage
- Phone-side opt-in screen with data-handling disclosure on first launch

### Risks
- **Privacy/legal**: recording someone without their knowledge is illegal in many US states (one-party-consent vs. all-party-consent jurisdictions). Disclaimer alone isn't enough — mic indicator must be visible AND obvious to the wearer (and ideally to others, but glasses don't really support that without a hardware LED).
- **Battery drain**: continuous mic + BLE upstream + WebSocket downstream. Probably 2-3x normal app drain.
- **STT cost**: $0.004/min × 60min × 8h = ~$2/day per power user. Free tier won't cover heavy use; need per-user API keys or paid model.
- **Latency**: target ≤1s. Streaming STT averages 300-800ms; WebView + BLE adds 200-500ms. Borderline acceptable.
- **Background limits**: probably mic stops when app backgrounded — needs verification, may force users to keep this app foregrounded.

### Tradeoffs
- Cloud STT (Deepgram, quality + diarization) vs. on-device (Whisper-tiny WASM, privacy + offline + zero per-min, but huge bundle and slow). Cloud wins for v1.
- Always-on (the value prop) vs. push-to-talk (negates ambient use). Accept always-on with explicit opt-in.
- Diarization on/off: speaker labels need 2+ speakers + 5s+ each to stabilize. Misattribution worse than no label. Default off, opt-in.

### Implementation steps
1. Scaffold + `g2-microphone` permission with detailed `desc` (30min)
2. Mic capture + ring buffer (~120 lines, 1.5h)
3. Bridge `/stt/stream` WebSocket proxy to Deepgram (~200 lines Python, 4h)
4. Caption renderer + scroll state (~300 lines, 5h)
5. Privacy/opt-in flow + phone-side config screen (~150 lines, 4h)
6. Persistence (mic-was-on, scroll position) (15min)
7. Testing + battery measurement (4h)

**Total: ~20–22 hours, plus ongoing $/min STT cost.**

### Testing
- Unit: ring buffer, chunk encoding (PCM → bytes → WebSocket frames)
- Integration: pre-recorded conversation audio → pump through chunker → assert transcripts arrive in order with reasonable latency. Use Deepgram's pre-recorded mode for offline tests so we don't burn live STT credits per run
- Manual on-glasses: quiet office (one speaker), noisy cafe (multiple), rapid back-and-forth meeting. Measure latency, accuracy, mic-indicator visibility
- Privacy/trust audit: mirror test for mic indicator; off-by-default behavior on fresh install
- Battery: 1 hour with mic hot, measure phone + glasses drop, document expected drain in app description

### Skills to invoke
`everything-evenhub:quickstart` → `everything-evenhub:device-features` (mic, audioControl) → `everything-evenhub:handle-input` → `everything-evenhub:glasses-ui` → `everything-evenhub:font-measurement` → `everything-evenhub:test-with-simulator` (verify simulator handles audio input) → `everything-evenhub:build-and-deploy`

---

## Plan: Recipe Assistant (standalone app)

### Concept
Pre-loaded recipes that scroll one step at a time on the glasses; advance with head-nod (IMU) or ring-tap so your hands stay in the dough.

### Quality design

**Display layout**:
```
PASTA CARBONARA
Step 3 of 8

Slowly add the egg-cheese
mixture to the pasta, tossing
constantly to prevent the eggs
from scrambling.

12 min total · 4 min remaining
─────────────────●──────  3/8
```

Single full-screen step view. Generous text since cooking is read-glanceably.

**Gestures**:
| Gesture | Action |
|---|---|
| Head nod (IMU) | Advance to next step |
| Head shake (IMU) | Go to previous step |
| Single tap | Same as nod |
| Swipe up/down | Manual prev/next |
| Ring 2-tap | Open recipe-picker modal |
| Glasses 2-tap | Exit |

**Edge cases**: no recipe loaded → recipe picker auto-opens on launch; step has timer ("simmer 5 min") → countdown rendered, alert when done; lost track → ring-double-tap re-shows step picker for jump-to-step.

### Architecture
**Phone-side**: recipes in iCloud Drive folder OR LAN HTTP service for posting from phone. Schema: `{ title, totalTime, servings, ingredients[], steps: [{ text, timerSeconds? }] }`. Recommended: phone-side config lets user paste a URL to any recipe site → bridge scrapes via the unofficial `recipe-scrapers` Python lib (~200 sites supported).

**Bridge**: new `recipe-bridge:8793` (or route on phils-bridge — separate when shipping). Routes: `GET /recipes.json` (list), `GET /recipes/{id}.json` (one), `POST /recipes/scrape?url=` (one-time import).

**Glasses-side**:
- Single full-screen text container
- IMU control: subscribe via `imuControl(true, 100)` (10Hz). Detect "nod" (negative pitch then positive pitch) and "shake" (positive yaw then negative yaw) via simple sign-change counting on a 1s window
- Per-step timer: when current step has `timerSeconds`, start local countdown, render in real time

### Risks
- **IMU gesture recognition is finicky**: head-mounted IMU is way noisier than wrist-mounted. False positives (looking down at cutting board = looks like a nod). Mitigate with tunable sensitivity slider, fallback to single-tap, "deadzone" period after each detected gesture.
- **Recipe-scrapers fragility**: relies on each site's HTML structure; sites change. Need fallback to manual JSON entry.
- **Cookbook copyright**: scraping a third-party recipe is legally gray for shipping. For personal use it's fine. For app-store listing, disclaim "user-supplied URLs only, we don't host recipes".
- **Timer notifications**: how to know "simmer for 5 minutes" is up while chopping? Phone vibration / auditory alert / push notification — each is a separate integration.

### Tradeoffs
- IMU-only vs. tap+IMU: IMU is the cool factor but unreliable. Always-allow-tap is the safety net. Don't make IMU mandatory.
- Phone-side scrape vs. user-paste-JSON: scrape is way better UX but adds backend fragility. Both as fallback layers.
- Single-recipe vs. shipped-cookbook: 5-10 baked-in starter recipes makes first-launch instant; pure-import is a worse onboarding.

### Implementation steps
1. Scaffold (30min)
2. Bridge with `recipe-scrapers` integration (~150 lines Python, 3h)
3. Phone-side import UI (HTML form: paste URL → import) (~2h)
4. Glasses renderer + step navigation + progress bar (4h)
5. IMU gesture detector + tuning (5h — tuning is most of the time)
6. Timer system + notification integration (3h)
7. Built-in starter cookbook (10 recipes hardcoded) (1h)
8. Testing (3h)

**Total: ~22 hours.**

### Testing
- Unit: gesture detector on synthetic IMU streams (recorded "nod" / "shake" / "ambient" data)
- Integration: simulate IMU events via simulator's HTTP automation port
- Manual on-glasses: cook 2 actual recipes end-to-end. Track false positives / missed nods. Tune sensitivity
- Timer accuracy: test timed steps under foreground + brief backgrounding (checking texts) — confirm countdown survives
- Recipe import: scrape 10 recipes from 5 different sites; verify all import cleanly. Handle failures gracefully

### Skills to invoke
`everything-evenhub:quickstart` → `everything-evenhub:device-features` (IMU) → `everything-evenhub:handle-input` → `everything-evenhub:glasses-ui` → `everything-evenhub:font-measurement` → `everything-evenhub:simulator-automation` (IMU-event injection for testing) → `everything-evenhub:build-and-deploy`

---

## How to update this file

- Move items between sections (queued → in flight → done) as work happens
- When a plan ships, delete it from this file (commit log has the history)
- New plans go under either "Phils Home dashboard" (if they extend this app) or "Standalone Even Hub apps" (separate repo)
- "Pending user actions" should empty out as you complete them — don't let it stale
