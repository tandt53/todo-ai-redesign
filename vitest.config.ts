// Root vitest config (T-007e, phase: execute).
//
// Why this file exists: `npm run test:all` (`vitest run`) was collecting
// qa/assistant/automation/e2e/*.spec.ts — those files call @playwright/test's
// own `test()`, which is a different function than vitest's `test()` (no
// vitest runtime backs it), so vitest parsed the files but ran zero of their
// tests, and Gate 2's C5 read that as a red suite. vitest's default `include`
// (`**/*.{test,spec}.*`) has no way to distinguish "a Playwright spec" from
// "a vitest spec" by filename alone — the two ecosystems share the
// `*.spec.ts` convention. This file scopes `exclude` to the Playwright
// directory (and the harness script, which is a Node server entrypoint, not a
// test file at all) so `vitest run` only ever collects vitest's own suites
// under src/assistant/{api,web}.

import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.{idea,git,cache,output,temp}/**',
      '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*',
      'qa/**/automation/e2e/**',
      'qa/**/automation/harness/**',
    ],
  },
})
