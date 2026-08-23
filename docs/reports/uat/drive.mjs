// Shared driver for the real-app UAT capture.
//
// Every screenshot in the UAT book must come from the running product, not from
// a mockup. This module is the only place that knows how to reach a state: the
// flows in capture-real.mjs describe *what a person does*, and these helpers
// carry it out against the live web client on :5173 and the QA API on :4460.
//
// One user id per flow (`uat-<flow>@qa.example.com`) so no flow can see another
// flow's data — the per-account isolation _qa-foundations.md §10 asks for.
import { chromium } from '@playwright/test'

export const API = process.env.UAT_API ?? 'http://localhost:4460'
export const WEB = process.env.UAT_WEB ?? 'http://localhost:5173'

export const VIEWPORTS = {
  // The real web client at the two widths it actually branches on.
  // `split` is 1024 in tokens.json, so 1280 is the two-pane layout and 390 is
  // the single-pane one the bottom bar was designed for.
  wide: { w: 1280, h: 900 },
  narrow: { w: 390, h: 844 },
}

export async function api(user, path, method = 'GET', body) {
  const r = await fetch(API + path, {
    method,
    // X-Timezone is required by any write that computes a date (the API answers
    // 409 TIMEZONE_UNKNOWN without it). Found by seeding a due_at and reading
    // the 409 back, not by guessing.
    headers: { 'content-type': 'application/json', 'X-User-Id': user, 'X-Timezone': 'Asia/Ho_Chi_Minh' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const j = await r.json().catch(() => null)
  if (r.status >= 400) throw new Error(`${method} ${path} → ${r.status} ${JSON.stringify(j)}`)
  return j
}

/** Create tasks through the real endpoint, then patch the fields creation does not take. */
export async function seed(user, rows) {
  const out = []
  for (const row of rows) {
    const { title, ...rest } = row
    const { task } = await api(user, '/tasks', 'POST', { title })
    if (Object.keys(rest).length) await api(user, `/tasks/${task.id}`, 'PATCH', rest)
    out.push(task)
  }
  return out
}

export async function launch() {
  return chromium.launch({ executablePath: process.env.DESIGN_CHECK_BROWSER })
}

export async function openApp(browser, user, viewport) {
  const page = await browser.newPage()
  await page.setViewportSize({ width: viewport.w, height: viewport.h })
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e.message)))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  page.errors = errors
  await page.goto(`${WEB}/?qaUser=${encodeURIComponent(user)}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  return page
}

/**
 * Below `split` the app opens on Talk and Tasks is a separate screen; at or
 * above split both panes are on screen at once. These two make "be on Tasks" /
 * "be on Talk" mean the same thing at either width.
 */
export async function goTasks(page) {
  const btn = page.locator('[data-testid=shell-tasks-button]').first()
  if (await btn.isVisible().catch(() => false)) { await btn.click(); await page.waitForTimeout(400) }
}

export async function goTalk(page) {
  // Tasks → Talk below split is the bottom bar's mic button with the field
  // empty (TasksSurface.tsx: `else onGoTalk()`); there is no separate control.
  const bar = page.locator('[data-testid=tasks-bar-action]').first()
  if (await bar.isVisible().catch(() => false)) {
    const input = page.locator('[data-testid=tasks-bar-input]').first()
    await input.fill('')
    await bar.click()
    await page.waitForTimeout(400)
  }
}

/**
 * Switch collection. The left rail exists in the DOM at every width but is only
 * *visible* in the wide layout; below split it lives behind the hamburger. Found
 * by driving it — a click on the rail row at 1280 times out on "not visible".
 */
export async function goCollection(page, name) {
  const rail = page.locator('[data-testid=rail-collection-row]').filter({ hasText: name }).first()
  if (await rail.isVisible().catch(() => false)) { await rail.click() }
  else {
    await page.locator('[data-testid=shell-lists-menu-button]').click()
    await page.waitForTimeout(250)
    await page.locator('[data-testid=menu-collection-row]').filter({ hasText: name }).first().click()
  }
  await page.waitForTimeout(450)
  await dismissOverlays(page)
}

export async function dismissOverlays(page) {
  for (const sel of ['[data-testid=menu-close-button]', '[data-testid=detail-close-button]']) {
    const el = page.locator(sel).first()
    if (await el.isVisible().catch(() => false)) { await el.click(); await page.waitForTimeout(200) }
  }
  await page.keyboard.press('Escape').catch(() => {})
  await page.waitForTimeout(150)
}
