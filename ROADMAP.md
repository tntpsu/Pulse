# Pulse — Roadmap

Living document. Captures pending user actions, queued work, and detailed
plans that are too long to keep alive in chat. Update as work moves between
sections (queued → in flight → done → delete from here, the commit log has
the history).

---

## Pending user actions (blocking work below)

These need you, not me — I cannot complete them from inside the sandbox.

| Action | Why | Command |
|---|---|---|
| Create `com.philtullai.pulse` project on Even portal + upload `pulse.ehpk` | Renamed from "Phils Home" → "Pulse" this session; package_id changed, so the next sideload is a new app, not an update of the old `philshome` slot. Old install will coexist until manually removed. | manual upload at https://hub.evenrealities.com/application |
| Upload new `lyrics-glow.ehpk` (v0.2.0) | Auto-detect mode shipped; package_id unchanged so this is a normal version bump on the existing slot | manual upload at portal |
| Append `GITHUB_TOKEN` + `GITHUB_REPOS` to `~/ai-agents/phils-bridge/.env` then restart bridge | Activates the github-prs and github-ci cards on Pulse — currently stuck on "no repos configured" | `echo "GITHUB_TOKEN=$(gh auth token)" >> ~/ai-agents/phils-bridge/.env; echo "GITHUB_REPOS=tntpsu/Pulse,tntpsu/Cue,tntpsu/Glance,tntpsu/lyrics-glow,tntpsu/av,tntpsu/duckAgent" >> ~/ai-agents/phils-bridge/.env; launchctl kickstart -k gui/$(id -u)/<bridge-launchd-label>` |
| Restart `widget_api` | Pick up the rejection-stable-key fix and the top-3-sellers field added in the duck-ops repo | `launchctl kickstart -k "gui/$(id -u)/com.philtullai.duck-ops-widget"` |
| Re-run Google OAuth | Current refresh token predates the `gmail.readonly` scope being added to `oauth_setup.py`. Without this, the Gmail card shows "unconfigured" | `python3 ~/ai-agents/phils-bridge/oauth_setup.py` then re-restart phils-bridge |
| Commit duck-ops changes | `runtime/operator_interface_contracts.py` has the rejection + top-3-sellers patch; sits alongside your in-flight `etsy_browser_batch` work | Commit when convenient |
| Decide on av PR #1 | Three commits stacked: runbook catch-up, perf-test CI skips, ground-contact attribution fix. CI re-running. Two pre-existing logic failures: `test_no_oscillation_at_q4` MPC delay-comp test still failing (left untouched — needs deeper context). | Review + merge or request changes at https://github.com/tntpsu/av/pull/1 |
| Spotify dev app (for Lyrics Glow v0.3) | Lyrics Glow v0.2 only catches Mac-side desktop music. Phone music auto-detect needs Spotify Web API + OAuth. Create dev app at https://developer.spotify.com (free, ~5 min) → paste client_id + secret + run an OAuth helper to get a refresh token. | Create app at developer.spotify.com → tell me when done |

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

## Strategic constraints (May 2026)

Hard frames that should color every "should I build X" decision. Read before browsing the queue.

### 1. phils-bridge is personal-only, not productizable

`~/ai-agents/phils-bridge/server.py` runs on Phil's Mac mini and exposes Phil's iMessages, Calendar, Tasks, Gmail, GitHub, Now Playing. **Anything depending on it is personal-use only — it cannot ship to a hub user, since each customer would need their own bridge.**

For shippable apps, use the Cue / Glance pattern: a Cloudflare Worker the user deploys with their own API keys, OR an app that talks only to public HTTPS APIs.

### 2. Don't compete with Even's first-party features

Even ships first-party Translate, Teleprompter, AI summaries/Transcribe, Calendar, Reminders, and Notifications. A third-party that is *broader* than first-party will get rolled into the OS. Win by being **more specific** — a translator for a single use-case, a teleprompter that *coaches* instead of scrolling, etc. This puts existing queued items at risk: see the Live Captions callout below.

### 3. Hub category density (May 2026)

Saturated — don't enter without a 10× differentiator: Pomodoro/focus timers (4+), Bible/devotional readers (5+), ePub readers (5+), note-taking (5+), regional transit (~7), D&D companions (3), Bluesky viewers (2).

Underserved or empty: Hearts/Spades/Euchre (no card-games beyond Solitaire/Chess), Wordle-style daily puzzle (Word Daily v0.1.0 is the seed), hands-free cooking multi-timer, real-time captioning, public-speaking coach, birdsong ID, household-sound alerts, F1 live timing.

Single-incumbent (need real differentiator): Solitaire, Chess, Minesweeper, Sliding Puzzle, Bricks, 2048-like, Anki/flashcards (×2), Tesla controls (×2), workout trackers (×2), Blackjack counter (Card Counting).

See **§ Viral concept bench (May 2026 research)** below for the ranked build list.

---

## Recently shipped (Pulse)

Latest feedback batch (commit `5912231`):
- **Weather card:** city name on top via `VITE_WEATHER_CITY` env var (changes alongside lat/lon when traveling so the header reflects the actual forecast location)
- **New `scoreboard` card:** sport picker (NBA / NFL / NHL / MLB / NCAAF / NCAAB) using ESPN's free `/scoreboard` endpoint per league; item-paginated, swipe through leagues in detail view
- **Trends card:** client-side filter strips IP-risk titles ("donald duck", "marvel", etc.) and sub-1500-score ideas before they reach the glasses. Source-pipeline improvement (in `business_operator_desk.py`) is a bigger separate project.
- **Insights card:** removed the "Unsold (Nd): X" line per feedback — wasn't actionable
- **Deploy automation scaffold:** `scripts/deploy-portal.mjs` (Playwright) + `npm run deploy:upload` / `deploy:full` scripts. Selectors are TODO comments needing one manual portal-inspection pass before it's fully autonomous. Investigated the Even Hub API first — extracted endpoints from the evenhub-cli binary, confirmed there is no public upload endpoint (CLI commands are init/login/qr/pack/self-check only), so Playwright is the practical path.

Renamed app: **Phils Home → Pulse**. `package_id` changed `com.philtullai.philshome` → `com.philtullai.pulse` (treated as a new app by Even Hub — old install will coexist until uninstalled). All cross-repo references updated and committed in Cue / Glance / lyrics-glow / duck-ops / phils-bridge.

---

## Queued — Pulse dashboard `[personal-only]`

Pulse depends on `widget_api` (Duck Ops business state) and `phils-bridge` (Calendar/Tasks/Gmail/iMessages) — both run on Phil's Mac mini. Items below are dashboard improvements for Phil's daily use, not shippable hub apps. See **§ Strategic constraints**.

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

These are NOT part of Pulse — each lives in its own repo with its own `package_id`. Listed here as related work.

### 1. Lyrics Overlay ✅ BUILT v0.2.0 (auto-detect Mac-side music)

**Status:** sideload-ready as `lyrics-glow.ehpk` at `~/Documents/lyrics-glow/`. Auto-detect for Mac-side desktop music shipped via the existing phils-bridge `/now-playing.json` route (AppleScript polls Music + Spotify desktop apps). iPhone Spotify auto-detect deferred to v0.3 because it requires Spotify Web API OAuth.

**What's shipped (cumulative):**
- v0.1.0: scaffold + LRC parser (binary-search line picker, multi-stamp support, dedupe) + LRCLIB HTTP client + glasses 3-line karaoke window (prev / ▶ current / next / next+1) + tap-pause-resume + swipe-bias + offset slider + last-song memory + 23 vitest unit tests + 5/5 simulator smoke regression
- v0.2.0: phils-bridge polling client + auto-detect mode toggle in phone settings + track-change detection + position-anchored karaoke clock + drift-correction (re-anchor when our clock and the Mac clock diverge >2s) + 10 new vitest cases (33/33 total) + bridge route extended to return `positionMs` + `durationMs`

**Still queued for v0.3+:**
- **Spotify Web API + OAuth** so iPhone playback also auto-detects (~4h, needs you to create a Spotify dev app first)
- Musixmatch fallback for tracks LRCLIB doesn't have (~2h)

**Concept:** karaoke-through-glasses. Pulls currently-playing track + time-synced lyrics, scrolls them on the glasses in lockstep with the song.

See **§ Plan: Lyrics Overlay** below for the original build spec (now substantially realised).

### 2. Live Captions ⭐ PRIORITY 2 — RE-EVALUATE (May 2026)

**Concept:** always-on mic + real-time STT, captions ambient conversation on the glasses. Accessibility hero use case + general "I never miss what was just said" appeal.

**Why second:** highest "wow", but bigger build (~22 hours), genuine privacy considerations, ongoing per-minute STT cost. See **§ Plan: Live Captions** below.

> **⚠️ Risk added May 2026:** Even ships first-party Translate. If they add display-side captions, this app is redundant. Decision rule: ship within 4 weeks or skip. **PrepTalk Coach** (live performance coaching, see § Viral concept bench) is the recommended substitute — reuses Cue's audio pipeline and differentiates against first-party Teleprompter rather than overlapping first-party Translate.

### 3. Recipe Assistant ⭐ PRIORITY 3

**Concept:** pre-loaded recipes that scroll one step at a time, advance via head-nod (IMU). Hands-free cooking.

**Why third:** smaller audience than #1/#2, IMU gesture detection is finicky (most of the build time goes to tuning thresholds). See **§ Plan: Recipe Assistant** below.

---

## Ecosystem-aligned new app ideas (April 2026 survey)

A scan of the existing Even Hub app store + GitHub community apps + Discord/Reddit wishlists turned up clear gaps. Ranked by `viral_demo_potential × inverse_effort`:

| # | App | One-line | Effort | Why now |
|---|---|---|---|---|
| 1 | **Driving HUD nav** | Big arrows + distance for turn-by-turn from Mapbox/OSRM | medium (~12h) | Most-requested gap in long-term reviews (Tom's Guide, Trusted Reviews, Geeky Gadgets). 1P "Navigate" is weak; nobody has shipped a real third-party version. **Demo gold.** |
| 2 | **Flashcards / Anki-on-glasses** | Spaced-rep with "knew it / didn't" via R1 single-tap | trivial (~4h) | Recurring HN suggestion; zero shipping competition. Format perfectly matches the 576×288 display. |
| 3 | **Pomodoro / focus timer** | Glanceable countdown + smart breaks | trivial (~3h) | Gap on Hub today. The 36g all-day form factor is the perfect substrate. Different from EvenWorkout's countdown. |
| 4 | **Quick-reply notifications (Android)** | iMessage-style triage glance + R1 reply | medium (~10h) | Reviewer #1 complaint: "smart glasses that actually let me reply." Pulse only shows unread; this would *act*. Android-first because iOS APIs are restrictive. |
| 5 | **Live captions (passive)** | Always-on STT for in-person hearing assist | larger (~22h, see Plan in this doc) | Existing Live Captions plan in this roadmap; ecosystem confirms accessibility press would cover it. Cue handles coaching; this is passive. |
| 6 | **Speaker pacing coach** | Teleprompter that says "you're 2 min over, slow 8%" | small (~6h) | Adjacent to 1P Teleprompt but with feedback. R1 click for beat marks. Conference-talk hero. |
| 7 | **Sleep/meditation wind-down** | Calm-style scripted routine with timed text fades | small (~5h) | 1P Stillness is breathing-only. A scripted bedtime routine is a different surface. |
| 8 | **Doorbell / home-cam alert** | Ring/Reolink webhook → "Front door: package" | small (~5h) | Zero competition. No camera frames needed — just text alerts. |
| 9 | **Recipe step-through (hands-free)** | NYT Cooking / AllRecipes import + R1 next | small (~6h, but overlaps existing Recipe Assistant Plan in this doc) | EvenKitchen demo exists but isn't polished. Bigger competitive moat = hands-free voice "next." |
| 10 | **Long-tail sports ticker** (F1 / MMA / tennis / golf) | Live event timeline + lap-by-lap | small (~4h, parallel to Pulse scoreboard card) | Lower viral ceiling but trivial. Could be a Pulse sub-card or standalone. |

**Ones the survey says to AVOID** because they overlap our existing four apps: any dashboard/widget aggregator (Pulse), AI conversation coach (Cue), web reader (Glance), karaoke/lyrics (Lyrics Glow), now-playing display, GitHub PR view, Gmail unread.

**Platform-direction notes worth knowing:**
- Hub's roadmap is plugins → **widgets** → dashboard layouts → AI skills. Only plugins ship today; widget API is the next surface — early movers there will own real estate (per hub.evenrealities.com/docs).
- No published revenue share or installed-base numbers as of April 2026 launch. Build for portfolio/audience, not store revenue (per Virtual Reality News critique).
- Reverse-engineering track is alive (`i-soxi/even-g2-protocol`) — direct BLE bypass of Hub is technically possible if Even ever closes the gate.
- Hardware constraints worth keeping in mind: no speaker (no audio-out apps), no camera (no CV), 4-mic array is BETTER than commenters realise, R1 ring is the only reliable rich-input vector.
- **MentraOS** (mentraglass.com/os) is the cross-device alt platform some devs are hedging onto — worth a glance if you ever want one app to span multiple smart-glasses brands.

---

## Viral concept bench (May 2026 research)

Supersedes the April 2026 survey above for build-order decisions. Source: external research report `even_g2_viral_app_concepts_report.pdf` (Drive folder "Even"), filtered through § Strategic constraints and Phil's existing infra (Cue audio pipeline, Word Daily v0.1.0 already shipped).

### Ranked build order

| # | Concept | One-line | Effort | Why this slot |
|---|---|---|---|---|
| 1 | **Word Daily v0.2.0** | Streaks + share grid + leaderboard on the existing daily puzzle | Low (1-2 weeks) | Already 80% built locally. Fastest viral signal. See § 6 in standalone queue + § Plan: Word Daily v0.2.0. |
| 2 | **PrepTalk Coach** | Live private cues for pace, fillers, and timing during a talk | Med (~25h) | Reuses Cue's Worker + audio pipeline. Differentiated from first-party Teleprompter (which scrolls scripts). |
| 3 | **Kitchen Conductor** | Hands-free labeled multi-timer for cooking | Med (~15h) | Greenfield, low privacy/legal risk, easy demo. Shareable "3 dishes, 7 timers, zero burnt sides" card. |
| 4 | **CaptionCue** (live captions) | Real-time conversation captions for accessibility/travel | High (~22h) | High ceiling, but at risk from first-party Translate. Ship in 4 weeks or skip. Same scope as existing § Plan: Live Captions. |

(Additional priorities tracked in private repos — not listed here.)

### Deferred (real demand, blocking risk)

- **BirdCall HUD** — Merlin-class birdsong ID. 16kHz mic likely insufficient for BirdNET-class models; cloud inference adds latency. Spike before committing.
- **Sound Sentinel** — household sound alerts (doorbell, washer, baby cry). Liability tail if positioned as safety-critical; constrain marketing carefully.
- **PitWall F1** — live race timing. OpenF1 free tier is historical-only; live data is a legal landmine. Confirm a clean data source first.

### Dropped (do not build)

- Standalone teleprompter — first-party owns it.
- Generic audio-note search — first-party Transcribe + saturated note category.
- Stock ticker — weak virality, monochrome loses red/green, thin moat.
- Full-rules Hearts / Spades — too much hidden state for gesture input. If you re-enter this niche later, it should be **Euchre Rush** (5-card hands, autoplay) not full trick-takers.

### Concept summaries

#### PrepTalk Coach
- **Pitch:** private live coach for pace, filler words, and timing.
- **Why glasses:** speakers can't look at a phone/laptop without breaking eye contact. Glasses show one cue ("Slow down", "3 fillers", "wrap up 2 min") without interrupting.
- **Virality:** post-session scorecard — "I cut filler words by 42% in one week."
- **Kill criteria:** speakers report cues raise anxiety; filler detection breaks trust; users only use pre-talk, never as a practice streak.
- **Build leverage:** reuses Cue's Deepgram + Anthropic Worker. Effort drops because audio + transport is already solved.
- **Demand evidence:** Orai 300K+ users, 2M+ speeches analyzed; Yoodli validates real-time pacing/filler feedback.

#### Kitchen Conductor
- **Pitch:** hands-free labeled timers that keep every dish on track.
- **Why glasses:** wet/greasy/gloved hands. Phone is actively annoying in the kitchen.
- **Virality:** weekly recipe-timer templates (ramen night, Thanksgiving sides). Shareable completion card.
- **Kill criteria:** background timer alerts unreliable; users can't start a timer in <5s; feels like "just another timer."
- **Notes:** no audio output on glasses → use phone vibration/push fallback. Text-only updates, no images.
- **Demand evidence:** Timer+ 9M+ downloads, 40K App Store ratings; Reddit cooking-timer threads explicitly request voice timers.

#### CaptionCue
- **Pitch:** live captions for conversations in your line of sight.
- **Why glasses:** accessibility, travel, language learners need eye contact preserved.
- **Virality:** "Subtitles IRL" demo videos.
- **Kill criteria:** speech-to-readable-text latency >2.5s; bad WER in cafes; first-party Translate satisfies the job before launch.
- **Build leverage:** reuses Cue audio pipeline. Same scope as existing § Plan: Live Captions.
- **Demand evidence:** Google Live Transcribe 1B+ downloads, 247K reviews, 120+ languages.

#### Word Daily v0.2.0
See § 6. Word Daily in the standalone queue + § Plan: Word Daily v0.2.0 below for full detail.

---

### 5. Cue — multi-mode conversation coach ✅ BUILT v0.3.0

**Status:** sideload-ready as `cue.ehpk` at `~/Documents/Cue/`. Real STT + LLM running through the deployed personal Cloudflare Worker; mock-mode fallback for setup-free demos.

**What's shipped (cumulative):**
- v0.1.0: scaffold + 6 modes (Date / Argue calm / Sales close / Sting / Listen well / Custom) + privacy opt-in + glasses UI shell + mock-mode driver + e2e regression (4/4 passing)
- v0.2.0: Worker template (Deepgram + `/suggest` Anthropic/OpenAI bridge) + audio capture (`audioControl` → PCM frames over the SDK event bus) + transport layer + live captions + debounced LLM suggestions + mock fallback retained
- v0.2.5: chunked HTTP transport (replaces WebSocket — WKWebView blocks WS handshake) + JSDOM tests + worker integration tests + app.json lint + KNOWN_QUIRKS doc + WebKit Playwright harness for iOS-WKWebView parity
- v0.3.0: end-of-utterance detection (sentence-final punctuation OR silence-gap OR 12s max-wait, replacing the fixed-6s debounce) + sentence-aware transcript trim (replaces 1200-char tail-slice) + battery glyph in glasses header + idle auto-pause after 5 min + word-boundary line wrap on suggestions + per-mode bullet glyphs + first-word emphasis. 45 vitest tests passing.

**Pitch:** "Helps you say the right thing." Listens to a conversation via the glasses mic, surfaces 2-3 suggested responses on the display in real time. Built-in modes for date / argument / sales / sting / listen + a custom-prompt escape hatch. The app never speaks for you — it offers cues you choose to use.

**Still queued for v0.4+:**
- Worker-side dedupe of suggestions repeating the same advice
- Retry/backoff on Deepgram or LLM rate-limit
- Partial-transcript pulses if streaming-Deepgram path becomes viable on WKWebView
- Phone-side `IDLE_AUTO_PAUSE_MS` setting (currently a 5-min hardcode)

**LLM key:** worker accepts either `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` (gpt-4o-mini fallback). Anthropic isn't required — if you only have an OpenAI key (e.g. the one in `~/ai-agents/duckAgent/.env`), set just that and Cue runs fine.

See **§ Plan: Cue (multi-mode conversation coach)** below for the original build spec.

### 4. Glance — Glasses Web Reader ✅ BUILT v0.4.0

**Status:** sideload-ready. Lives at `~/Documents/Glance/`. Submission packet ready (`SUBMISSION.md`).

**What's shipped (cumulative):**
- v0.1.0: scaffold + three-layer nav + phone settings + cache + resume
- v0.2.0: Vitest unit tests (36 passing) + adapter pattern + ESPN-news adapter + Inbox + share-sheet paste
- v0.3.0: cursor-scroll list UX + state migration + friendly error messaging + simulator-automation regression test (10/10 passing)
- v0.4.0: Jina API key support + clipboard-on-focus auto-import banner + ESPN league picker + read-state tracking (✓ markers) + worker adapter + Cloudflare Worker template for auth-walled sites (`worker-template/`)

**Still queued for v0.5+:**
- iOS Shortcut for true one-tap share-sheet → Glance (currently uses clipboard-detect on app focus)
- Pocket / Readwise OAuth import
- "Show unread only" toggle in source view (read state is captured but not yet filterable)
- More ESPN leagues hot-swap (currently per-source picker on settings page; could be in-glasses)
- Per-source delete UI for cached article bodies

**Sideload path:** glance.ehpk at the repo root, upload to `https://hub.evenrealities.com/application` for the `com.philtullai.glance` project.

### 6. Word Daily ✅ BUILT v0.1.0 — v0.2.0 NEXT (May 2026 priority 1)

**Status:** sideload-ready as `word-daily.ehpk` at `~/Documents/WordDaily/`. v0.1.0 is the engine + UTC daily index + 6-guess puzzle + 200-word answer list + phone-side keyboard input + state persistence. Tests passing.

**What's shipped:**
- v0.1.0: scaffold + engine with duplicate-letter mark logic + UTC `dayIndex()` + per-day state persistence + phone-side input + glasses board renderer + 200-word curated answer list + vitest tests (engine + dayIndex stability)

**Why this is the recommended next ship (May 2026):**
- Already 80% built — fastest path to a viral signal.
- No first-party Even feature competes (unlike Live Captions / CaptionCue).
- Daily-return mechanic proven (Wordle: 4.8B plays/year per CBS).
- Discovery threshold post-publish: ≥50 unique anonIds submitting in first 48h. Below that, listing/category problem, not product.

**Queued for v0.2.0 (1-2 week build, see § Plan: Word Daily v0.2.0):**
- All-time stats (current streak, max streak, distribution histogram)
- Share grid generation (`■▣□` glyphs, monochrome-friendly) + clipboard copy
- Larger word lists (~500 curated answers + ~5000 valid guesses, MIT-licensed `dwyl/english-words` source — NOT NYT's list)
- End-of-game stats screen + midnight countdown
- Cloudflare Worker leaderboard (anon UUID, KV storage, GET /leaderboard?day=N)
- Hub listing assets (icon, 5 screenshots, description with "daily 5-letter puzzle" framing — never reference "Wordle")

**IP guardrails (load-bearing — see § Plan):**
- Game mechanics aren't copyrightable in the US. Game rules are not the risk.
- The risk is using NYT's specific curated answer list. Don't.
- Build own answer list from `dwyl/english-words` (MIT-licensed, ~370k words → filter to 5-letter common words).
- Don't use the name "Wordle" in title, description, screenshots, or tags. "Word Daily" is fine.
- Don't use 🟩🟨⬜ emoji palette (you're monochrome anyway — `■▣□` is correct).

---

# Plans (full detail)

## Plan: Image containers (Pulse)

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

## Plan: AudioControl + wake-word detection (Pulse)

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

## Plan: Glasses Web Reader (full build spec)

This is the active plan as of 2026-04-25. Maintain in lockstep as we build — when something changes during implementation, update this doc, don't let it go stale.

### 1. Product summary

A standalone Even Hub plugin (`com.philtullai.webreader`) that lets the user pick from a small list of saved websites, see the current articles on each site's homepage, and read selected articles as paginated text on the glasses. All extraction happens via `r.jina.ai` — a free public service that turns any URL into clean markdown via headless Chromium. No personal backend infrastructure required; the app is fully self-contained and shippable to any Even Hub user.

**Target user:** anyone who reads articles online and finds holding a phone for 5-10 min uncomfortable or limiting (walking, in line, cooking, watching kids).

**Value prop in one sentence:** "Read any website's articles on your smart glasses, hands-free."

### 2. Architecture overview

```
┌────────────────────────────────────────────────────────────────────────┐
│ User's phone (iOS / Android)                                           │
│                                                                        │
│ ┌────────────────────────┐         ┌─────────────────────────────────┐ │
│ │ Even Hub companion app │  hosts  │ Web Reader plugin (TS WebView)  │ │
│ │ (native iOS/Android)   │ ──────► │                                  │ │
│ └────────────────────────┘         │  - phone-side settings UI       │ │
│                                    │    (visible in companion when    │ │
│                                    │     not on glasses)              │ │
│                                    │  - reader engine                 │ │
│                                    │  - bridge.setLocalStorage        │ │
│                                    └────────────────┬─────────────────┘ │
│                                                     │                   │
│                                                     │ fetch()           │
│                                                     ▼                   │
└─────────────────────────────────────────────────────────────────────────┘
                                                      │
                                                      ▼
                            ┌──────────────────────────────────────┐
                            │  https://r.jina.ai/<any-url>         │
                            │  (free, CORS-open, headless Chromium)│
                            │  returns clean markdown              │
                            └──────────────────────────────────────┘
                                                      │
                                                      ▼
                                          ┌──────────────────────┐
                                          │  Even G2 glasses     │
                                          │  via BLE display     │
                                          └──────────────────────┘
```

No bridge service, no Mac dependency, no Tailscale required. Whole stack is plugin code + r.jina.ai.

### 3. Data model

```ts
// User-configured site they want to read from. Persisted in
// bridge.setLocalStorage('reader:sources', json).
interface Source {
  id: string         // UUID
  url: string        // homepage or section URL, e.g. "https://espn.com"
  title: string      // user-supplied display name, e.g. "ESPN"
  lastFetchedAt?: number
}

// Article extracted from a source's homepage. Lives in memory only —
// re-extracted when user re-opens the site (cached briefly).
interface Article {
  url: string        // absolute URL of the article
  title: string      // headline
}

// Body for a specific article. Cached in setLocalStorage forever
// (articles don't change after publish — re-reads are free).
interface ArticleBody {
  url: string        // key
  title: string
  body: string       // markdown text
  fetchedAt: number
}

// Plugin-level state stored across launches.
interface ReaderState {
  sources: Source[]
  // last viewed: source URL + article URL + page number, so re-launch
  // resumes where the user left off.
  resume?: { sourceId: string; articleUrl?: string; page?: number }
}
```

### 4. UX state machine

```
        ┌───────────────────────┐
        │  SOURCES              │ ← initial state on launch
        │  (list of saved sites)│
        └───────┬───────────────┘
                │ tap a source
                ▼
        ┌───────────────────────┐
        │  ARTICLE LIST         │ ← fetching the homepage via r.jina.ai
        │  (titles from site)   │   (5min cache; show "loading" if fresh)
        └───────┬───────────────┘
                │ tap an article    ← double-tap = back to SOURCES
                ▼
        ┌───────────────────────┐
        │  READER               │ ← fetching the article via r.jina.ai
        │  (paginated text)     │   (forever cache; instant on re-read)
        └───────────────────────┘   ← double-tap = back to ARTICLE LIST
                                    ← swipe ↓/↑ = next/prev page
                                    ← swipe-end = next article in list
```

Three layers, each is the same picker + paginated-text pattern we already built in Pulse. The complexity is in the extraction pipeline, not the UI.

**Phone-side settings view** (separate state, only visible when the user opens the plugin tile in the Even Hub companion before putting glasses on — this is a normal HTML page in the WebView):

```
WEB READER — sources

[x] ESPN                              ⨯
    https://espn.com

[x] Hacker News                       ⨯
    https://news.ycombinator.com

[x] NYT Tech                          ⨯
    https://nytimes.com/section/technology

Add new source:
  Title: [_____________________]
  URL:   [_____________________]
  [Add]

Reset to default sources
```

### 5. Glasses display layouts

**Sources** (entry point):
```
SOURCES                       v1.0

> ESPN
  Hacker News
  NYT Tech
  TechCrunch
  Ars Technica

[tap] open · [2x-tap] settings
```

**Article list** (after picking a source):
```
ESPN — fetched 3:42pm

> 1. Lamar Jackson sets new record
  2. Cowboys announce trade
  3. Lakers fall to Celtics 105-98
  4. Curry hits 4000th 3-pointer
  5. Yankees swept by Astros

[swipe ↓ for more · 23 total]
```

**Reader** (after picking an article):
```
LAMAR JACKSON SETS RECORD
Page 1 of 8

In a stunning performance Sunday,
Ravens quarterback Lamar Jackson
threw for 412 yards and 4
touchdowns, breaking the franchise
record set by Joe Flacco in 2014.

The Ravens (8-3) cruised to a
31-17 win over Cleveland, with
Jackson connecting on 28 of 35
attempts — his most accurate

[swipe ↓ next · ↑ prev · 2x back]
```

### 6. Implementation tasks (ordered)

| # | Task | Detail | Est |
|---|---|---|---|
| 1 | Scaffold project | `everything-evenhub:quickstart` skill. package_id `com.philtullai.webreader`. Reuse the picker / paginated-text patterns from Pulse's `even.ts` + `main.ts` | 0.5h |
| 2 | Native storage layer | Wrap `bridge.setLocalStorage` / `getLocalStorage` with typed accessors for `ReaderState` and `ArticleBody` cache. Handle JSON parse errors gracefully | 1h |
| 3 | r.jina.ai client | `fetchHomepage(url): Promise<Article[]>` and `fetchArticle(url): Promise<ArticleBody>`. Both use `https://r.jina.ai/<url>`. Parse `Title:` / `Markdown Content:` blocks from response text | 2h |
| 4 | Homepage link extractor | Parse markdown for `[title](url)` patterns. Filter heuristics: same-domain, title 25-150 chars, URL path looks article-like (filter `/login`, `/help`, `/search`, `/category`, anchor-only links, etc.). Dedupe by URL. Sort by appearance order | 2h |
| 5 | Pagination | Split markdown body into ~400-char pages on word boundaries. Don't break mid-paragraph if avoidable | 1h |
| 6 | Three-layer navigation in main.ts | Source picker → article picker → reader. Each level uses `even.openPicker` for selection. State machine for current view + back behavior | 2h |
| 7 | Phone-side settings page | HTML form rendered when WebView focus is on phone (not glasses). Add/remove source URLs, reset to defaults. Persist to localStorage on every change | 2h |
| 8 | Caching | Homepage cache 5 min in memory (re-fetch on stale); article body cache forever in setLocalStorage (re-reads are free) | 1h |
| 9 | Resume state | Persist `{sourceId, articleUrl, page}` on every page-flip. On launch, if `resume` is set, jump straight to that article + page | 1h |
| 10 | Error states | Loading indicator, "couldn't reach r.jina.ai", "site returned no articles", "rate-limit reached", paywall detection ("This article requires a subscription") | 1.5h |
| 11 | Curated default sources | Ship with: HN front page, NYT tech, NPR top stories, BBC News, Ars Technica, The Atlantic, TechCrunch, Hacker News, ESPN, NYT Cooking. Reset-to-defaults button restores | 0.5h |
| 12 | Build, pack, sideload | First end-to-end test on real glasses | 1h |

**Subtotal: 15.5 hours.**

### 7. Testing strategy

**Unit tests** (~ 2h to write, run in Vite test mode):

- `extractArticles(markdown)`: feed in canned r.jina.ai responses for ESPN, HN, NYT, a paywalled site, and a broken site. Assert link counts and ordering.
- `paginate(text, capChars)`: synthetic text of various lengths. Assert page boundaries on word breaks, no broken mid-word.
- `linkFilter(url, title, sourceDomain)`: assert that `/login`, `/help`, anchor-only, off-domain, and too-short titles are filtered.

**Integration tests** (~ 2h):

- Mock r.jina.ai responses (fixture files captured from real responses for 5 different site types). Run the full pipeline and compare paginated output against golden files. Tests: ESPN homepage → first article body → page 1, 2, last.
- Cache hit / miss behavior: first fetch hits network (mock), second within 5min returns cached, after 5min refetches.

**Manual on-glasses smoke tests** (~ 2h):

- Sideload v0.1.0 on real glasses. Run through all three layers with the curated default sources.
- Test each from the verified-working list:
  1. ESPN front page → top story → read 3 pages
  2. HN front page → top item → read article body
  3. NYT tech → an article → read until end
  4. A site that returns a paywall → confirm graceful "subscription required" message
  5. A site that returns no parseable articles → confirm graceful "couldn't extract" message
- Test resume: read 3 pages of an article, exit app, reopen → confirm pages 4 starts.
- Test rate-limit gracefully: simulate 200th request of the day, confirm fallback message.

**Edge case checklist**:
- [ ] Empty source list (just installed, no defaults yet) — show "Add a source" prompt
- [ ] Source URL is malformed — phone-side settings rejects with error
- [ ] Source URL is unreachable — show error in article-list state with retry button
- [ ] Article list comes back with 0 items — show "site returned no articles"
- [ ] Article body is shorter than 1 page — display single page, no pagination UI
- [ ] Article body is longer than 50 pages — cap at 50 with "[truncated]" footer
- [ ] User flips off glasses mid-read — pause polling, resume on put-back-on (per Pulse pattern)
- [ ] Network drops mid-fetch — show transient "couldn't load, swipe to retry"

**Skills to use during testing**:
- `everything-evenhub:simulator-automation` — automation HTTP API to inject input + capture screenshots, build regression tests for the three views
- `everything-evenhub:test-with-simulator` — dev loop without sideload cycle
- `everything-evenhub:font-measurement` — verify pagination math against actual LVGL render width

### 8. Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| r.jina.ai shuts down or pivots to paid-only | Medium | High (app dies) | (a) cache all article bodies forever locally, (b) document a fallback to readability-via-self-hosted-Worker as a v2 if needed |
| r.jina.ai 200/day rate limit hit | Low for solo, Medium for power users | Medium | Aggressive caching; "rate-limited, try again in N hours" clear UX; optional API key field in settings for users who pay Jina |
| Homepage extraction yields garbage on cluttered sites | Medium | Medium | Generic heuristics + curated default list of verified-working sites; show "couldn't extract — try a different page or section URL" |
| iOS WKWebView blocks `r.jina.ai` for some reason | Low (it's CORS-open) | High | Already verified r.jina.ai responds with CORS; whitelist `https://r.jina.ai` in app.json `permissions.network` from day 1 |
| Paywalled articles return teaser text only | High | Low | Detect known paywall sentinels ("Subscribe to continue", "This article is for subscribers") and label clearly. Don't try to bypass — that's a different app |
| Pagination breaks on languages with no spaces (CJK) | Low | Low | Default to 400 chars hard-cap; v2 if anyone complains |
| Sites change their HTML and break extraction | Medium ongoing | Low (graceful degrade) | Generic extractor not site-specific scrapers, so most changes don't break us. Worst case: a specific site stops working until we tweak heuristics |

### 9. Decisions (resolved 2026-04-25)

1. **App name: Glance.** Package ID: `com.philtullai.glance`. Repo location: `~/Documents/Glance/`.
2. **Default sources (5):** ESPN, CNN, Yahoo, Hacker News, BBC News. User can add/remove via the phone-side settings page.
3. **Article cache TTL:** 30 days, with a hard cap of 100 cached article bodies; oldest evicted when the cap is hit.
4. **Jina API key field:** deferred to v2. The free 200/day tier covers a single user comfortably.
5. **Authentication for paywalled / login-walled sites (e.g. bwi.rivals.com):** out of scope for v1. Plan for a v1.5 personal Cloudflare Worker that handles user-specific authenticated sites separately. Public-only v1 ships first.
6. **Other v2 deferrals (explicit):** voice commands, OAuth (Pocket/Readwise), iOS Share Sheet integration, site-specific scrapers, Tailscale anything. v1 is minimal.

### 10. Effort summary

- Build: ~15.5 hours
- Testing (unit + integration + manual): ~6 hours
- Polish + edge cases: ~2 hours
- Documentation (README, demo gif, Hub submission): ~2 hours

**Total: ~25 hours, distributable across 3-4 work sessions.**

### 11. Skills to invoke during build

In order of expected use:
- `everything-evenhub:quickstart` — scaffold the new project
- `everything-evenhub:cli-reference` — `evenhub pack` reminders
- `everything-evenhub:glasses-ui` — text container layout, single-container vs two-column for reader vs source-list
- `everything-evenhub:font-measurement` — precise pagination width for 400-char target
- `everything-evenhub:handle-input` — picker / swipe / double-tap conventions
- `everything-evenhub:test-with-simulator` — dev loop
- `everything-evenhub:simulator-automation` — automated regression tests
- `everything-evenhub:build-and-deploy` — final packaging + Hub submission checklist
- `everything-evenhub:design-guidelines` — Unicode/typography sanity check before ship

### 12. Definition of done for v1

- [ ] All 12 implementation tasks complete
- [ ] All unit + integration tests pass
- [ ] Manual smoke test passes on real glasses for the 5 verified-working sites
- [ ] Edge case checklist all green
- [ ] README written (architecture, configuration, "why this exists")
- [ ] `.ehpk` packaged with version 1.0.0
- [ ] Submitted to Even Hub catalog (or held in draft pending user review)
- [ ] Demo screenshot/gif captured for the listing

---

## Plan: Cue (multi-mode conversation coach)

This is the active build plan as of 2026-04-25. Maintain in lockstep as we build.

### 1. Product summary

A standalone Even Hub plugin (`com.philtullai.cue`) that captures the conversation around you via the glasses mic, transcribes it via cloud STT, and surfaces 2-3 suggested responses on the glasses display. The user picks a **mode** (Date / Argue calm / Sales close / Sting / Listen well / Custom) which configures the LLM's tone and intent. Suggestions appear reactively (after the other person stops speaking) and proactively (when you ring-tap to ask for fresh topics — useful when the conversation stalls).

**Target user:** anyone who wants in-the-moment language help in a conversation — dating, difficult conversations, sales, cross-cultural interactions, ESL speakers.

**Tagline:** "Helps you say the right thing."

**The app never speaks for you** — it offers cues. You glance, pick (or don't), say it in your own voice. That's the line between "coach" (acceptable) and "puppet" (uncanny / unethical). All copy and UX decisions reinforce this.

### 2. Modes (v1)

| Mode | System-prompt intent | Reactive | Proactive |
|---|---|---|---|
| **Date** | Curious, warm, asks questions, surfaces topics that don't repeat | Yes, every ~10s of new speech | Yes, ring-tap on silence > 5s suggests fresh topics avoiding what's been discussed |
| **Argue calm** | Validates, deescalates, reflects back. Detects "always/never" framing. | Yes | No |
| **Sales close** | Tracks objections raised, suggests handlers. Avoids re-pitching covered ground. | Yes | No |
| **Sting** | Sharp witty comebacks. Banter / low-stakes. | Yes | No |
| **Listen well** | Reflective listening prompts ("what I hear is…", "tell me more about…"). For tense conversations where you need to slow down. | Yes | No |
| **Custom** | User's own system prompt from phone settings. Power-user escape hatch. | Yes | Optional based on prompt |

### 3. Architecture

```
┌──────────────────────────────────────────────────────────────┐
│ Even Hub plugin (TS WebView on phone)                        │
│  - mode picker / mic toggle / privacy indicator              │
│  - glasses UI: rolling transcript + suggestions block        │
│  - audioControl(true) → captures PCM via SDK                 │
│  - PCM chunks → Cue Worker (WebSocket)                       │
└────────────────┬─────────────────────────────────────────────┘
                 │ WebSocket (audio in)
                 │ HTTP (suggestion requests)
                 ▼
┌──────────────────────────────────────────────────────────────┐
│ Personal Cue Cloudflare Worker (user-deployed, free tier)    │
│  - WebSocket to Deepgram streaming STT                       │
│  - Rolling 3-min transcript buffer                           │
│  - On trigger: POST {mode, transcript} → Anthropic / OpenAI  │
│  - Returns 2-3 suggestions (≤ 12 words each)                 │
└──────────────────────────────────────────────────────────────┘
                 │
                 ▼
        Cloud STT + Cloud LLM
        (Deepgram, Anthropic Claude Haiku / OpenAI 4o-mini)
```

**Key infrastructure decision**: same pattern as Glance's worker adapter — user deploys their own Cloudflare Worker with their own Deepgram + Anthropic API keys. Glance proved this pattern works for shippable Hub apps that need server-side processing without the developer paying for everyone.

### 4. Glasses display layout

```
DATE MODE                       ●     ← mic-on indicator (always visible)

(the latest 2-3 lines of what
 SHE just said, scrolling)

────────────────────────────────────
1. "What got you into that?"
2. "I love that — tell me more
    about how you started."
3. "Were you always interested,
    or did it sneak up on you?"

[ring 2x] new topics  [tap] mode
```

Top half: rolling caption window. Bottom half: 1-3 suggestions, numbered. Suggestions update every ~10s while she's speaking. Hint footer.

### 5. Phone-side settings UI

- Mode picker (radio buttons + Custom prompt textarea)
- Worker URL + bearer token (same as Glance's worker source)
- Deepgram API key (set as Worker env var, not entered here)
- Anthropic / OpenAI API key (set as Worker env var)
- **Privacy / consent disclosure** (modal on first launch, requires explicit accept)
- Mic-on default: OFF — user must opt in on each session

### 6. Privacy & legal (real, not boilerplate)

**Recording someone without consent is illegal in many jurisdictions.** US states split:
- One-party consent (most states): the wearer alone can consent — legally fine
- Two-party / all-party consent (CA, FL, IL, MD, MA, MT, NH, PA, WA): everyone in the conversation must know

App design has to make this obvious:
1. **Mic indicator always visible** when hot — never hidden, even on cycle
2. **Default OFF** at every install, every relaunch
3. **Explicit opt-in modal** on first session: "Cue will record audio to suggest responses. You are responsible for ensuring this is legal where you are. Tap I UNDERSTAND to continue."
4. **Distinct visual cue** when actively transcribing (not just when mic is technically open)
5. **No persistence** of audio — PCM streams to STT and is dropped, transcripts kept ≤ 3 min in Worker memory then garbage-collected
6. **No analytics** that include transcript content

This is a real feature, not lip service. Trust is the entire product.

### 7. Implementation tasks (ordered)

| # | Task | Detail | Est |
|---|---|---|---|
| 1 | Scaffold project | quickstart skill. `com.philtullai.cue` at `~/Documents/Cue/`. Reuse Glance patterns (Vite + TS + Vitest + e2e regression script) | 0.5h |
| 2 | Mode system | `src/modes.ts` — registry of { id, label, systemPrompt, reactive, proactive }. 6 built-in modes + custom | 1h |
| 3 | Privacy/opt-in flow | Phone-side modal on first launch, persisted "agreed:v1" flag. Modal text from § 6 | 1h |
| 4 | Glasses UI shell | Mode picker on glasses (cycle via tap), mic indicator, rolling caption area, suggestions area | 4h |
| 5 | Mic capture | Wrap `audioControl(true)`, ring buffer 5s, chunk 250ms PCM → emit | 2h |
| 6 | Worker scaffold | `worker-template/` — Deepgram WS + Anthropic POST. Cribbed from Glance worker template | 4h |
| 7 | WebSocket protocol | Plugin ↔ Worker: audio frames in, transcript+suggestions out (SSE or polling) | 3h |
| 8 | LLM integration | Per-mode system prompts, transcript context window, dedupe past suggestions | 3h |
| 9 | Mock mode for testing | Hardcoded suggestions on timer — works without API keys, lets user demo UX immediately | 1h |
| 10 | Mode-cycle gesture | Tap on glasses cycles modes; ring-tap requests fresh suggestions; double-tap exits | 1h |
| 11 | Tests | Unit: mode registry, suggestion-ring eviction, transcript buffer. e2e: mock-mode regression | 3h |
| 12 | Build/pack/sideload + Worker deploy guide | First end-to-end test on real glasses with real API keys | 2h |

**Subtotal: ~25 hours.** Comparable to the Live Captions plan; Cue is essentially the same infra plus a mode/LLM layer.

### 8. v1 ship strategy (multi-version)

- **v0.1.0** ✅ — Scaffold + mode picker + mic indicator + privacy opt-in + **mock mode** (timer-driven hardcoded suggestions). User can sideload, see the UX, no API keys needed. *Shipped.*
- **v0.2.0** ✅ — Real STT via Worker → Deepgram **AND** Real LLM via Worker → Anthropic Claude Haiku (collapsed v0.2 + v0.3 into one ship since the Worker is the same artifact). Mock fallback preserved. *Shipped.*
- **v0.3.0** — End-of-utterance detection, smarter transcript trim, battery indicator, per-mode UI polish.
- **v0.4.0** — Auto-pause-after-idle, additional mode hardening, edge cases.

This way the user gets a sideload-able artifact at each step instead of waiting for the full 25h build.

### 9. Risks (honest)

| Risk | Mitigation |
|---|---|
| Legal — recording without consent | Privacy section above; default-off; explicit opt-in; visible mic indicator |
| Latency — 1-3s from speech end to suggestion appearing feels lag | Streaming STT instead of batch (Deepgram interim transcripts); LLM stub generation as soon as silence detected; Anthropic Haiku is the fastest cloud LLM (~400ms typical) |
| Cost — STT $0.0043/min + LLM ~$0.001/suggestion. Heavy use ~$2-3/day | Per-user Worker with their API keys — they pay their own bill. Free Deepgram trial $200 credit covers months for one user |
| Battery — continuous mic + WebSocket → heavy drain | Default-off mic; auto-pause after N min idle; "session" model where user explicitly enables for a defined period |
| LLM hallucination — suggestion gets the social context wrong | Lower-stakes if user just glances and decides not to use it; never auto-speaks. Custom mode lets users tune their own prompts |
| Worker dependency — same pattern as Glance, same risk profile | Mock mode lets them try without committing |
| The "manipulation" frame — coach vs. puppet | UX never speaks; suggestions are options not commands; copy reinforces "say it in your own voice" |

### 10. Testing strategy

**Unit (Vitest):**
- Mode registry: every mode has required fields
- Suggestion buffer: dedupes past suggestions, evicts at cap
- Transcript ring buffer: appends, evicts at 3 min, retrieves window

**Integration:**
- Mock-mode path: timer fires → suggestion appears in transcript area
- Worker handshake: WebSocket open + auth + ack
- LLM round-trip: canned transcript + system prompt → returns 1-3 suggestions

**Manual on-glasses:**
- Real conversation on each mode
- Privacy: mic indicator visible mirror test
- Battery: 30-min session battery drop measurement

**e2e (regression):**
- Same simulator-automation script pattern as Glance
- State signals: `[cue:state] mode=X mic=on/off transcribing=true/false`

### 11. Skills to invoke

`everything-evenhub:quickstart` (scaffold) → `everything-evenhub:device-features` (audioControl docs) → `everything-evenhub:handle-input` → `everything-evenhub:glasses-ui` → `everything-evenhub:simulator-automation` (regression) → `everything-evenhub:build-and-deploy`

### 12. Definition of done for v1.0 (after the version sequence above)

- [ ] All 6 built-in modes ship working
- [ ] Custom-mode prompt editable in phone settings
- [ ] Worker template + deploy guide tested by user
- [ ] Privacy modal tested + persisted-agreement working
- [ ] Mic indicator always visible when hot, default-off on launch
- [ ] Mock mode usable without any API keys
- [ ] e2e regression script: 100% pass against simulator
- [ ] Battery measurement documented in README
- [ ] Sideload-tested on real glasses for ≥ 30 min real conversation

---

## Plan: Word Daily v0.2.0

This is the active build plan as of 2026-05-03. Maintain in lockstep as we build.

### 1. Product summary

`com.philtullai.worddaily` — daily 5-letter word puzzle. v0.1.0 ships the engine + glasses board + phone keyboard + state persistence. v0.2.0 adds the **viral mechanics**: streak tracking, distribution histogram, monochrome share grid with clipboard copy, larger word lists, end-of-game stats screen, and a Cloudflare Worker leaderboard.

**Goal:** ship the daily-return + shareability layer in 2 weeks. Single .ehpk update + one Cloudflare Worker.

**Out of scope (v0.3+):** voice input (phone keyboard is the right call), hard mode after 7-day streak, push notifications on midnight rollover, language localization.

### 2. Stats schema

New file `src/stats.ts`:

```ts
export interface AllTimeStats {
  played: number
  won: number
  currentStreak: number
  maxStreak: number
  lastDayIndex: number
  distribution: [number, number, number, number, number, number]  // wins by attempt count 1..6
}
```

Storage key: `word-daily:stats:v1` (separate from per-day state at `word-daily:state:v1:<dayIdx>`). On every game completion, `applyResult(stats, dayIdx, attempts, won)` and persist. Idempotency guard: same `dayIdx` applied twice does not double-count.

### 3. Share grid

New file `src/share.ts`. Generates monochrome share text:

```
Word Daily #421 4/6
■ ▣ □ □ □
■ ■ ▣ □ □
■ ▣ ■ ▣ □
■ ■ ■ ■ ■
hub.evenrealities.com
```

Glyph mapping: `■` correct, `▣` present, `□` absent. End-of-game phone screen shows a SHARE button calling `navigator.clipboard.writeText(...)`. Glasses don't share — phone does.

### 4. Word lists (IP-clean)

Split `src/words.ts` into:
- `src/answers.ts` — ~500 curated daily-suitable answers. Built from `dwyl/english-words` (MIT-licensed, ~370k words) filtered to: 5-letter, common (top frequency band per Google Web 1T or similar permissive corpus), no plurals/past-tense/proper-nouns/profanity. **Do not seed from NYT's list.**
- `src/valid-guesses.ts` — ~5000 common 5-letter words from the same source (any tense, no proper nouns).

Engine accepts a guess if it's in either list. Bundle size check: 5k × 6 bytes ≈ 30KB ungzipped → ~10KB gzipped.

### 5. End-of-game UX

Glasses (when `status !== 'playing'`):

```
WORD DAILY  Day #421
Solved 4/6!

[6-row board]

Streak: 12   Max: 18
Played: 24   Won: 21 (88%)

Next puzzle in 14:32:08
```

Phone-side: same stats block + ASCII histogram (`▏▎▍▌▋▊▉█`) + SHARE button. Re-render countdown every minute via `setInterval`.

### 6. Leaderboard backend

New Cloudflare Worker: `word-daily-api`. Routes:
- `POST /v1/result` — body `{dayIndex, attempts, won, anonId}` → write to KV under `day:${dayIndex}:${anonId}`.
- `GET /v1/leaderboard?day=N` — aggregate `day:N:*` (cache 60s) → return `{totalPlayers, distribution, medianAttempts}`.

KV free tier: 100k reads/day. Aggregate-with-cache stays under quota. No auth — anon ID is UUIDv4 generated client-side, stored in `word-daily:anon-id`. v1 accepts that scoreboard is gameable; v0.3 adds HMAC if anyone bothers.

Wire in `src/leaderboard.ts`:
- `postResult(dayIdx, attempts, won)` — fire-and-forget but await for consistency.
- `fetchLeaderboard(dayIdx)` — non-blocking; render local stats first, patch worldwide stats when they arrive.

`KNOWN_QUIRKS.md` entry: Worker URL must be HTTPS; Even Hub WebView blocks plain HTTP fetch.

### 7. Hub listing

Run `/fill-store-listing /Users/philtullai/Documents/WordDaily`. Write `store-listing.json`:
- Category: Games & Tools
- Tagline (≤40 char): "The daily 5-letter puzzle, on glass."
- Description hooks: "New puzzle every day at midnight UTC", "Track your streak", "Share your solve grid"
- Tags: `daily`, `puzzle`, `word-game`, `streak` — **NOT** `wordle`
- Icon: 5×5 letter-grid pattern in pixel-grid editor (auto-icon path)

Five 576×288 screenshots in `store-assets/`:
1. Mid-game board (3 guesses in)
2. Win screen with streak
3. Share grid being copied
4. Stats panel + distribution histogram
5. Leaderboard "1,247 solvers today"

### 8. Implementation steps (10 working days)

| Day | Deliverable |
|---|---|
| 1 | `src/stats.ts` + `tests/stats.test.ts` (streak, max, distribution, idempotency) |
| 2 | `src/share.ts` + clipboard wiring + tests |
| 3 | `src/answers.ts` + `src/valid-guesses.ts` from dwyl/english-words; engine accepts both |
| 4 | End-of-game glasses + phone screens; midnight countdown |
| 5 | Bump to v0.2.0; `npm run deploy`; `npm run hub:upload`; `/fill-store-listing` (manual Select Build click) |
| 6 | Cloudflare Worker scaffold; KV binding; routes + cache |
| 7 | Glasses → Worker wiring (`src/leaderboard.ts`); anon-ID generation |
| 8 | Listing polish: icon, screenshots, description; v0.2.1 if any post-day-5 fixes |
| 9 | Soft launch — post once on Discord/Reddit. Watch first-48h funnel |
| 10 | Retro. ≥50 unique anonIds = format works → v0.3 plan. <10 = discovery problem, iterate listing |

### 9. Risks

| Risk | Mitigation |
|---|---|
| Bundle size after 5k word list | Pack as `\n`-separated string + `Set` lookup if inline array bloats |
| Worker latency on game-end | Render local stats first, patch worldwide stats when fetch resolves |
| `navigator.clipboard.writeText` fails on iOS WebKit | Test day 2; fall back to hidden-textarea + `execCommand('copy')` |
| Hub review delay | Bake 2 days buffer; if review takes longer, day 9 launch slips |
| Bot/gameable leaderboard | Accepted for v1; HMAC signing in v0.3 if worth it |
| NYT DMCA | IP guardrails in § 4 + listing copy in § 7 |

### 10. Skills to invoke

`everything-evenhub:glasses-ui` (text containers, layout) → `everything-evenhub:font-measurement` (board column widths) → `everything-evenhub:simulator-automation` (regression screenshots) → `everything-evenhub:build-and-deploy` → `/fill-store-listing` (listing assets) → `/ship-app` (full release pipeline)

### 11. Definition of done for v0.2.0

- [ ] Stats schema persisted across days, streak math correct
- [ ] Share grid generates correctly for all win/loss combinations; clipboard copy verified on iOS WebKit
- [ ] Answer list ≥ 500 words, valid-guesses list ≥ 5000, both built from dwyl/english-words
- [ ] End-of-game screen renders on both glasses and phone with countdown to next puzzle
- [ ] Worker deployed; ≥1 result posted from real device; leaderboard fetch returns aggregate
- [ ] Hub listing has 5 screenshots, icon, tagline, description following IP guardrails
- [ ] v0.2.x ehpk uploaded and approved; one external user has solved a puzzle
- [ ] First-48h funnel measured; retro completed; v0.3 priority decided

---

## How to update this file

- Move items between sections (queued → in flight → done) as work happens
- When a plan ships, delete it from this file (commit log has the history)
- New plans go under either "Pulse dashboard" (if they extend this app) or "Standalone Even Hub apps" (separate repo)
- "Pending user actions" should empty out as you complete them — don't let it stale
