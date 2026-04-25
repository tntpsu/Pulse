---
name: restart-services
description: Kill and restart the two backend services (widget_api on :8780 and phils-bridge on :8790). Use when picking up config changes, verifying services are alive, or recovering from a wedged state.
allowed-tools: [Bash]
argument-hint: [widget-api | phils-bridge | all (default)]
---

# restart-services

Cleanly restarts the Python HTTP services Pulse depends on:

- `widget_api` — `~/ai-agents/duck-ops/runtime/widget_api.py` on port 8780 (Duck Ops read + approvals write + reject)
- `phils-bridge` — `~/ai-agents/phils-bridge/server.py` on port 8790 (Calendar, Tasks, Gmail, GitHub, Now Playing, iMessages)

**Both are managed by launchd** via:
- `~/Library/LaunchAgents/com.philtullai.duck-ops-widget.plist`
- `~/Library/LaunchAgents/com.philtullai.phils-bridge.plist`

`launchctl kickstart -k` does an atomic kill-and-respawn — no port race, no dangling nohup processes. Do not start these services any other way.

## Arguments

`$ARGUMENTS` picks which to restart:
- `widget-api` — only widget_api (port 8780)
- `phils-bridge` — only phils-bridge (port 8790)
- `all`, empty, or anything else — both (default)

## Steps

### 1. Interpret arguments

Normalize `$ARGUMENTS` (lowercase, trim). Map to: `widget`, `bridge`, or `both` (default). Anything ambiguous → `both`.

### 2. Kill any stray non-launchd processes first

Any leftover `nohup`'d copies will hold the port and make launchd's respawn crash-loop. Always flush them first:

```bash
pkill -f widget_api.py; pkill -f phils-bridge/server.py 2>/dev/null || true
```

Then give launchd a moment to notice the port is free before kickstart.

### 3. Kickstart each selected service

**widget_api:**
```bash
launchctl kickstart -k "gui/$(id -u)/com.philtullai.duck-ops-widget"
```

**phils-bridge:**
```bash
launchctl kickstart -k "gui/$(id -u)/com.philtullai.phils-bridge"
```

`-k` kills the running instance first if any, then respawns. Don't use `unload`/`load` — that's heavier than needed and can leave the service stopped if the plist has a syntax error.

### 4. Verify each

Sleep 2 seconds, then:

- widget_api: `curl -s http://127.0.0.1:8780/widget-status.json | python3 -c "import sys,json; d=json.load(sys.stdin); print('widget_api OK:', d.get('ducksToPackToday'), 'to pack')"`
- phils-bridge: `curl -s http://127.0.0.1:8790/ | python3 -c "import sys,json; d=json.load(sys.stdin); print('phils-bridge OK:', len(d.get('routes', [])), 'routes')"`

If a verify curl fails, check `~/Library/Logs/duck-ops-widget.err.log` or `~/Library/Logs/phils-bridge.err.log` — launchd writes crash tracebacks there.

### 5. Report

Print a one-line summary for each: "OK"/"FAILED" + any relevant metric (pack count, route count).

## First-time setup (only once per machine)

If the launchd labels aren't registered yet, bootstrap them first:

```bash
launchctl bootstrap "gui/$(id -u)" ~/Library/LaunchAgents/com.philtullai.duck-ops-widget.plist
launchctl bootstrap "gui/$(id -u)" ~/Library/LaunchAgents/com.philtullai.phils-bridge.plist
```

Check with `launchctl list | grep philtullai` — both labels should appear.

## Environment notes

- Both plists set `KeepAlive.Crashed=true` so crashes auto-respawn after a 10-second throttle.
- Logs: `~/Library/Logs/duck-ops-widget{,.err}.log`, `~/Library/Logs/phils-bridge{,.err}.log`
- Widget_api reads `~/ai-agents/duckAgent/.env` for SMTP creds (for approvals).
- Phils-bridge reads `~/ai-agents/phils-bridge/.env` for Google refresh token, falls back to `~/ai-agents/duckAgent/.env`.
- `GITHUB_TOKEN` / `GITHUB_REPOS` env vars, if set, enable the GitHub routes.
- iMessages needs FDA granted to the Python interp in System Settings.

## Don't

- Start these services with `nohup` or `python3 ... &` — that bypasses launchd and causes the port-race bug.
- Use `killall python3` — there may be unrelated Python processes.
- Skip the verify step — a silently-dead service is worse than no service.
- Use `launchctl unload` / `launchctl load` when you just mean to restart; use `kickstart -k`.

## Task

Restart: $ARGUMENTS
