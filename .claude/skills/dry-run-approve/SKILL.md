---
name: dry-run-approve
description: Safely test the /approvals/approve endpoint for a specific publish candidate without actually sending the SMTP email or triggering a publish. Use when verifying the MJD email format or confirming an artifactId resolves correctly.
allowed-tools: [Bash]
argument-hint: [artifactId OR flow-name for auto-pick]
---

# dry-run-approve

Calls `POST /approvals/approve` on widget_api with `{dryRun: true}` to verify:

1. The `artifactId` resolves to a real draft publish candidate.
2. The MJD email subject/body that WOULD be sent matches what `watch_publish_idle.py` expects (`is_mjd` + `is_reply` + `FLOW:`/`RUN:`/`ACTION:` markers, body containing `publish`).

Never sends an actual email. Never triggers a publish. Safe to run repeatedly.

## Arguments

`$ARGUMENTS` can be either:
- **A full artifactId** — e.g. `publish::jeepfact::2026-04-08::jeep-fact-wednesday` → tested directly.
- **A flow name alone** — e.g. `jeepfact`, `meme`, `newduck` → picks the newest draft with that flow.
- **Empty** → picks the newest draft from any flow.

## Steps

### 1. Resolve the artifactId

If `$ARGUMENTS` contains `::`, treat it as a full artifactId. Otherwise, query `/widget-status.json` and pick from `pendingApprovals`:

```bash
curl -s http://127.0.0.1:8780/widget-status.json \
  | python3 -c "
import sys, json
data = json.load(sys.stdin)
pending = data.get('pendingApprovals', [])
flow = '$ARGUMENTS'.strip() or None
if flow:
    pending = [p for p in pending if p['flow'].lower() == flow.lower()]
if not pending:
    print('NO_MATCH')
else:
    print(pending[0]['artifactId'])
"
```

If the output is `NO_MATCH`, report that the flow didn't match any pending draft and list the available flows from the full pending list. Stop.

### 2. Call the endpoint

With the resolved artifactId:

```bash
curl -s -X POST http://127.0.0.1:8780/approvals/approve \
  -H "Content-Type: application/json" \
  -d "{\"artifactId\":\"<resolved-id>\",\"dryRun\":true}" \
  | python3 -m json.tool
```

### 3. Sanity-check the output

The response MUST have:
- `ok: true`
- `dryRun: true`
- `subject` starting with `Re: MJD: [` and containing ` | FLOW:`, ` | RUN:`, ` | ACTION:publish`
- `to` set to a real email

Walk through each check and print `OK` or `FAIL: <reason>` for each. If all pass, print:

```
Format verified. Real approval (confirm:true) would land in the Publish folder within ~10s.
```

If any fail, print which check failed + the raw response.

### 4. Don't

- Never send `confirm: true` from this skill — that's a real send with real downstream effects.
- Never mutate state files or email.

## Task

Dry-run approve with arguments: $ARGUMENTS
