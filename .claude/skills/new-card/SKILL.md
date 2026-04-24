---
name: new-card
description: Scaffold a new PhilsHome card from the template, set up types and a loader stub, and register it in the card carousel. Use when adding any new card to the G2 glasses dashboard.
allowed-tools: [Read, Edit, Write, Bash, Grep]
argument-hint: [card-id] [optional short description]
---

# new-card

Scaffolds a new card for the PhilsHome glasses dashboard at `~/Documents/PhilsHome/` following the existing template pattern. Cards are the atomic UI unit — one per data source, shown one-at-a-time on the right side of the G2 display.

## What this does

1. Parses `$ARGUMENTS` into a `card-id` (slug, e.g. `weather-hourly`) and optional description.
2. Copies `src/cards/_template.ts` → `src/cards/<card-id>.ts` and rewrites placeholders.
3. Adds the import + registry entry to `src/cards/index.ts`.
4. Reminds the user of the next steps (implement `load()`, wire any new bridge route, update `app.json` network whitelist if calling a new host, run `npm run deploy`).

## Card-id conventions

- Lowercase, hyphens-only. No spaces, no underscores, no capitals.
- Semantic prefix for grouped cards: `duckops-*` (Duck Ops), `sports-*` if we ever add a helper that doesn't fit the existing sports factory, etc. For one-off cards, just a plain slug (e.g. `weather`, `gmail`).
- The id must be unique across `src/cards/`.

## Steps

### 1. Parse arguments

Split `$ARGUMENTS` on whitespace. First token is the card-id. Remaining tokens form the description (optional — used only in the export name comment).

Slugify the id if needed: lowercase, replace spaces/underscores with `-`, strip non-`[a-z0-9-]`. If the user gave no arguments, prompt them to pass a card-id and stop.

### 2. Derive names

From `card-id`:
- Filename: `src/cards/<card-id>.ts`
- Export const name: camelCase + `Card` suffix (`new-card` → `newCardCard`, `weather-hourly` → `weatherHourlyCard`)
- Display title: Title Case of the id (the user can tweak afterward)

### 3. Refuse to clobber

If `src/cards/<card-id>.ts` already exists, stop and report it — don't overwrite.

### 4. Copy the template

Read `src/cards/_template.ts`. Write a new file to `src/cards/<card-id>.ts` with the following rewrites:

- Rename `exampleCard` → `<camelCase>Card`
- Replace the `id: 'example'` value with the slug
- Replace `title: 'Example'` with the Title Case display name
- Replace `'EXAMPLE'` (the dashboard title string) with an uppercase label (max ~10 chars to fit)
- Update the `ExampleSnapshot` interface name and `loadExample()` function name consistently
- Strip the commented-out item-paginated block at the bottom unless the card obviously needs it (the user can add it later by pattern-matching against `duckops-approvals.ts` or `tasks.ts`).

### 5. Register in the carousel

Read `src/cards/index.ts`. Add:
- An import statement for the new card (alphabetized with existing imports)
- An entry in the `CARDS` array at the END (user reorders later by editing the array)

### 6. Report next steps

Print, verbatim:

```
New card scaffolded at src/cards/<card-id>.ts and registered in src/cards/index.ts.

Next steps (in order):
  1. Implement load() — wire it to a public API or a bridge route
  2. If calling a new host, add it to app.json's permissions.network.whitelist
  3. If it needs a new bridge route, add that to ~/ai-agents/phils-bridge/server.py
  4. If it's item-paginated (swipe through items in detail mode), pattern-match
     against src/cards/duckops-approvals.ts or src/cards/tasks.ts
  5. Run 'npm run deploy' to build + pack, then upload the .ehpk
```

### 7. Do NOT

- Run `npm run deploy` yourself — the user will do it when the code is ready
- Add a ringAction unless explicitly asked — item-pagination and ring-actions are opt-in per card
- Implement `load()` without a data source confirmed by the user

## Task

Scaffold a new card using arguments: $ARGUMENTS
