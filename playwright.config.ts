// Playwright e2e config (T-007e, phase: execute). Owned by qa-web-agent per
// docs/specs/_shared/platform/web.md ## Test Harness ("e2e (Playwright) is
// QA-owned under tests/{module}/e2e/") and MANIFEST writers:.
//
// webServer starts BOTH processes the suite needs, so the orchestrator never
// manages background processes for this:
//   1. The assistant API — but via tests/harness/qa-test-server.ts,
//      NOT the plain `npm run dev:assistant` entrypoint. That entrypoint hardcodes
//      systemClock and the static FIXTURE_TABLE, exposing neither the AI-call
//      counter nor an injectable idle-close timer over HTTP — both named as
//      required seams in docs/specs/assistant/F-001-voice-assistant-view.md
//      ## Test strategy. qa-test-server.ts reuses the real app factory
//      (createApp) with a FakeClock + counting Interpreter wrapper and two
//      `/__qa__/*` control endpoints; see that file's header comment.
//   2. The web app via `npm run dev:web` (Vite dev server) rather than a
//      build+preview step — chosen for determinism of *this* first execute
//      pass (one less build step that can go stale between runs); its proxy
//      config already targets http://localhost:4460, the same port the QA
//      harness listens on, so no extra env wiring is needed.
//
// workers: 1 — deliberate, not a default. The QA harness's AI-call counter
// and FakeClock are process-global (not per-account), so parallel test
// workers could observe cross-test clock jumps / counter deltas. Test-DATA
// isolation is still per-account (qaweb-tc*@qa.example.com, one user per
// TC — _qa-foundations.md §10); only the two harness-global seams need serial
// execution. Revisit if the harness is made per-account.

import { defineConfig, devices } from '@playwright/test'

const WEB_PORT = Number(process.env['WEB_PORT'] ?? 5173)
const API_PORT = Number(process.env['PORT'] ?? 4460)

export default defineConfig({
  testDir: 'tests/assistant/e2e',
  testMatch: '**/*.spec.ts',
  // Generated output goes to output/ (MANIFEST ## Paths.output), not into
  // docs/qa/…/runs/. That directory holds AUTHORED run records — a QA agent's
  // written summary of what happened — and burying regenerable traces and
  // screenshots inside it is how the two stop being distinguishable. The
  // original reason for putting them there was that docs/qa/ was the only writable
  // subtree; output/ is now a declared root and is gitignored.
  outputDir: 'output/test-results',
  fullyParallel: false,
  workers: 1,
  retries: 0, // QA triages flakes manually (three-run rule, _qa-foundations §8) — CI retries would hide them
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'output/playwright-report' }]],
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'node --experimental-strip-types tests/harness/qa-test-server.ts',
      url: `http://localhost:${API_PORT}/tasks`,
      // /tasks 401s with no X-User-Id, which still proves the server answered.
      reuseExistingServer: !process.env['CI'],
      timeout: 30_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: 'npm run dev:web',
      url: `http://localhost:${WEB_PORT}/`,
      reuseExistingServer: !process.env['CI'],
      timeout: 30_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  ],
})
