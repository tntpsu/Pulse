#!/usr/bin/env node
// Playwright-driven .ehpk upload to https://hub.evenrealities.com/application.
//
// Why this exists: the Even Hub developer portal has no public upload API
// (the evenhub CLI only exposes init/login/qr/pack/self-check; the portal's
// SPA POSTs to an undocumented endpoint). This script automates the
// click-through flow so `npm run deploy` can build → pack → upload in one go.
//
// First-time setup:
//   npm install --save-dev playwright
//   npx playwright install chromium                   # ~150 MB one-time download
//
// Credentials (one of):
//   1. Env: EVEN_PORTAL_EMAIL=you@example.com EVEN_PORTAL_PASSWORD=xxx node scripts/deploy-portal.mjs
//   2. .env.deploy file (gitignored) with the same vars
//   3. --headed mode (default below) — login manually once; storageState.json
//      caches the session for subsequent runs
//
// Usage:
//   node scripts/deploy-portal.mjs                    # uploads ./pulse.ehpk
//   node scripts/deploy-portal.mjs path/to/x.ehpk     # explicit file
//   node scripts/deploy-portal.mjs --headless         # CI-friendly (after first login)
//
// IMPORTANT — selector audit: the SPA's DOM changes occasionally. Each
// `await page.click(...)` / `await page.fill(...)` below is annotated with a
// `// SELECTOR:` comment showing what to inspect if it stops working. Run
// once with --headed and update selectors via DevTools as needed.

import { chromium } from 'playwright'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { config as loadDotenv } from 'dotenv'

const PORTAL_BASE = 'https://hub.evenrealities.com'
const APP_PACKAGE_ID = 'com.philtullai.pulse'
const STORAGE_STATE = '.even-portal-session.json' // gitignored — keep your cookies here
const DEFAULT_EHPK = 'pulse.ehpk'

// Pull credentials from env first, then .env.deploy (if present).
if (existsSync('.env.deploy')) loadDotenv({ path: '.env.deploy' })

const args = process.argv.slice(2)
const headless = args.includes('--headless')
const ehpkArg = args.find(a => a.endsWith('.ehpk'))
const ehpkPath = resolve(ehpkArg ?? DEFAULT_EHPK)

if (!existsSync(ehpkPath)) {
  console.error(`✗ .ehpk not found: ${ehpkPath}`)
  console.error('  Run `npm run deploy` first, or pass an explicit path.')
  process.exit(1)
}

const email = process.env.EVEN_PORTAL_EMAIL
const password = process.env.EVEN_PORTAL_PASSWORD

async function main() {
  console.log(`→ Uploading ${ehpkPath} to ${PORTAL_BASE}/application/${APP_PACKAGE_ID}`)
  const browser = await chromium.launch({ headless })
  const context = existsSync(STORAGE_STATE)
    ? await browser.newContext({ storageState: STORAGE_STATE })
    : await browser.newContext()
  const page = await context.newPage()

  // 1. Land on portal — if not logged in, we'll get bounced to /login.
  await page.goto(`${PORTAL_BASE}/application/${APP_PACKAGE_ID}`, { waitUntil: 'networkidle' })

  if (page.url().includes('/login') || page.url().endsWith('/')) {
    if (!email || !password) {
      console.log('  No saved session and no EVEN_PORTAL_EMAIL/PASSWORD env — login manually in the open window, then press Enter.')
      if (headless) {
        console.error('✗ --headless cannot be used for first login. Re-run without --headless.')
        process.exit(2)
      }
      await waitForEnter()
    } else {
      // SELECTOR: email input on the login page. Inspect and update if the
      // portal redesigns the form.
      await page.fill('input[type="email"], input[name="email"]', email)
      // SELECTOR: password input.
      await page.fill('input[type="password"], input[name="password"]', password)
      // SELECTOR: login submit button — could be button[type=submit] or text=Login.
      await page.click('button[type="submit"]')
      await page.waitForURL(`${PORTAL_BASE}/**`, { timeout: 15_000 })
    }
    // Save cookies so subsequent runs skip login.
    await context.storageState({ path: STORAGE_STATE })
    console.log(`  Session saved to ${STORAGE_STATE}`)
  }

  // 2. Make sure we're on the right app's page.
  if (!page.url().includes(APP_PACKAGE_ID)) {
    await page.goto(`${PORTAL_BASE}/application/${APP_PACKAGE_ID}`, { waitUntil: 'networkidle' })
  }

  // 3. Open the upload UI. The portal usually has an "Upload new version" or
  // "+ Upload" button on the application page.
  // SELECTOR: upload-trigger button. Try (in order) text=Upload, [data-test="upload"],
  // a button with an upload icon. Update after first inspection.
  const uploadBtn = page.locator('button:has-text("Upload"), button:has-text("New version"), [data-test="upload-button"]').first()
  await uploadBtn.waitFor({ state: 'visible', timeout: 10_000 })
  await uploadBtn.click()

  // 4. The file picker. Playwright handles the native dialog when you set the
  // file input directly — works whether the UI has a hidden <input type=file>
  // or a custom drop zone.
  // SELECTOR: file input. The portal probably uses a hidden <input type=file accept=".ehpk">.
  const fileInput = page.locator('input[type="file"]').first()
  await fileInput.setInputFiles(ehpkPath)

  // 5. Submit. May be auto-uploaded on file pick, or require a confirm click.
  // SELECTOR: confirm/submit button after file pick. Comment this out if the
  // portal auto-uploads on selection.
  const confirmBtn = page.locator('button:has-text("Submit"), button:has-text("Confirm"), button:has-text("Upload")').last()
  if (await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await confirmBtn.click()
  }

  // 6. Wait for success indicator. The portal usually shows a toast or
  // updates the version list.
  // SELECTOR: success toast / version-list update. Adjust to whatever
  // signal the portal gives.
  await page.waitForSelector('text=/uploaded|success|version/i', { timeout: 30_000 }).catch(() => {
    console.warn('  No success signal seen within 30s — upload may still have worked. Check the portal.')
  })

  console.log('✓ Upload submitted. Verify in the portal.')
  await context.storageState({ path: STORAGE_STATE })
  await browser.close()
}

function waitForEnter() {
  return new Promise(resolve => {
    process.stdin.once('data', () => resolve())
    process.stdout.write('  Press Enter when login is complete... ')
  })
}

main().catch(err => {
  console.error('✗ Deploy failed:', err.message)
  process.exit(1)
})
