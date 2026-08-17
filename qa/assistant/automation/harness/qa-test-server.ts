// QA-owned e2e harness server (T-007e, phase: execute).
//
// specs/_shared/platform/web.md ## Test Harness delegates Playwright e2e to
// QA. The spec's Test strategy names three seams an e2e run needs — an
// injectable transcript source (client-side; already wired by web-agent as
// window.__assistantSeams behind a test-mode guard, see
// src/assistant/web/seams.ts), an AI-call counter, and an injectable
// idle-close timer. The plain `npm run dev:assistant` entrypoint
// (src/assistant/api/server.ts) exposes neither of the latter two over HTTP —
// it hardcodes systemClock and the static FIXTURE_TABLE. This file is the
// harness-side seam: it reuses the SAME public composition root
// (createApp(deps)) the unit-test harness uses
// (src/assistant/api/__tests__/helpers.ts), swapping in a FakeClock and a
// counting Interpreter wrapper, and adding two tiny control endpoints under
// `/__qa__/*` that only this harness serves.
//
// This does not modify src/ — every import below is a public, already-tested
// composition seam (Store / Interpreter / Clock are all constructor-injected
// by design, per ADR-001). qa-web-agent's write scope covers this file
// (MANIFEST writers: qa-web-agent → {qa}/, playwright.config.ts, ...).
//
// QA_EXTRA_ROWS: the spec's Test strategy explicitly permits QA to extend the
// canonical utterance→intent fixture table "via the FixtureInterpreter
// constructor" for scenarios the shared table doesn't enumerate. Documented
// per row below.

import { createServer } from 'node:http'
import { createApp } from '../../../../src/assistant/api/app.ts'
import { FixtureInterpreter } from '../../../../src/assistant/api/ports/fixture-interpreter.ts'
import type { FixtureRow } from '../../../../src/assistant/api/ports/fixture-interpreter.ts'
import { FIXTURE_TABLE } from '../../../../src/assistant/api/ports/fixture-table.ts'
import { FakeClock } from '../../../../src/assistant/api/ports/clock.ts'
import { MemoryStore } from '../../../../src/assistant/api/store/memory-store.ts'
import type {
  Interpretation,
  Interpreter,
  InterpreterContext,
} from '../../../../src/assistant/api/ports/interpreter.ts'
import { DEFAULT_IDLE_CLOSE_MS } from '../../../../src/assistant/api/engine/sessions.ts'

const QA_EXTRA_ROWS: FixtureRow[] = [
  // TC-012 boundary: the canonical table has a 1-target row ("delete the
  // meeting") and a 3-target row ("delete the shopping tasks") but no exact
  // 2-target row, so AC-9's ">1 asks / =1 applies" boundary can't be probed
  // at its tightest edge (N=2) without this. Follow-up suggestion recorded in
  // the run record: add a canonical 2-target delete row.
  {
    utterance: 'delete the qaweb pair',
    result: { kind: 'delete', targets: ['qaweb Cake A', 'qaweb Cake B'] },
  },
  // TC-005 (AC-3, cancel-while-thinking): the canonical table's only delay
  // row ("add a task to buy cheese", delay_ms: 60) is a create. Cancel racing
  // a QUESTION outcome and a FAILED outcome each need their own delayed row —
  // neither exists canonically.
  {
    utterance: 'qaweb delayed bulk delete',
    result: {
      kind: 'delete',
      targets: ['qaweb Delay Shop A', 'qaweb Delay Shop B', 'qaweb Delay Shop C'],
    },
    delay_ms: 150,
  },
  {
    utterance: 'qaweb delayed failure',
    result: { kind: 'fail', message: 'qa injected delay failure' },
    delay_ms: 150,
  },
  // TC-005 sub-case (a), added T-070b. The canonical delayed CREATE row ("add
  // a task to buy cheese") has delay_ms: 60, which is shorter than a single
  // Playwright click round-trip against this in-process server: the turn
  // resolves and React unmounts the thinking indicator (which owns the cancel
  // pill) while the click is still resolving actionability, so the click fails
  // with "element was detached from the DOM". Triaged as a script race, not a
  // product bug — reproduced 1 fail in 3 runs, and the cancel path itself is
  // proven by sub-cases (b) and (c), which already use 150ms rows for exactly
  // this reason. Same remedy, extended to the create variant: 150ms is long
  // enough to drive the cancel deterministically and still far below the
  // 30s test timeout. The 60ms canonical row keeps its own coverage — it is
  // what TC-011 and TC-031 use for the ordinary thinking transition.
  {
    utterance: 'qaweb delayed create',
    result: { kind: 'create', tasks: [{ title: 'qaweb Delayed Create' }] },
    delay_ms: 150,
  },
  // ---------------------------------------------------------------------
  // AC-30 (TC-035..TC-047, T-085). Every clause from (c) onward needs a
  // message to ARRIVE while the user is parked away from the bottom, which
  // means the test must be able to move the scroll AFTER the submit (which
  // scrolls to the bottom by clause (h)) and BEFORE the outcome lands. The
  // existing 150ms rows are far too short for that: the (h) scroll animation
  // alone has not settled at 150ms, so a test parking the viewport in that
  // window is racing the app's own scroll rather than observing it.
  //
  // 2500ms, and the number is set by the WORST case rather than the typical
  // one. Clause (d) needs THREE turns in flight at once: three submits cost
  // ~800ms of real Playwright actionability, the last clause-(h) scroll needs
  // ~500ms to settle, and only then can the viewport be parked — so an arrival
  // must not be possible before ~1300ms. Measured at 1500ms, two of the three
  // outcomes had already landed while the user was still at the bottom, and
  // the case silently stopped testing what it names. Still two orders below
  // the 30s test timeout.
  //
  // Three distinct create rows rather than one used three times: clause (d)
  // is a COUNT over N ≥ 2 arrivals, and three turns of the same utterance
  // would be three identical outcome bubbles — indistinguishable from one
  // bubble re-rendered, which is the failure the count is meant to catch.
  {
    utterance: 'qaweb ac30 slow one',
    result: { kind: 'create', tasks: [{ title: 'qaweb AC30 Slow One' }] },
    delay_ms: 2500,
  },
  {
    utterance: 'qaweb ac30 slow two',
    result: { kind: 'create', tasks: [{ title: 'qaweb AC30 Slow Two' }] },
    delay_ms: 2500,
  },
  {
    utterance: 'qaweb ac30 slow three',
    result: { kind: 'create', tasks: [{ title: 'qaweb AC30 Slow Three' }] },
    delay_ms: 2500,
  },
  // Clause (e): an UNRESOLVED QUESTION has to arrive below the fold, so the
  // affordance can be asked to distinguish "waiting on you" from "something
  // arrived". A bulk delete of 3 targets asks rather than applies (AC-9).
  {
    utterance: 'qaweb ac30 slow confirm',
    result: {
      kind: 'delete',
      targets: ['qaweb AC30 Q A', 'qaweb AC30 Q B', 'qaweb AC30 Q C'],
    },
    delay_ms: 2500,
  },
]

/** AC-18/AC-25 seam: a cumulative interpreter-call counter, read over HTTP.
 * Global (not per-account) — safe because playwright.config.ts runs this
 * suite with workers: 1 (see its comment for why). */
class CountingInterpreter implements Interpreter {
  count = 0
  private readonly inner: Interpreter
  constructor(inner: Interpreter) {
    this.inner = inner
  }
  async interpret(ctx: InterpreterContext): Promise<Interpretation> {
    this.count += 1
    return this.inner.interpret(ctx)
  }
}

const clock = new FakeClock()
const counting = new CountingInterpreter(new FixtureInterpreter([...FIXTURE_TABLE, ...QA_EXTRA_ROWS]))

// In-memory only (no snapshotPath) — fresh per process start, matching the
// unit-test harness. Isolation between tests comes from unique qaweb-tc*
// X-User-Id values (_qa-foundations.md §10), not from process restarts.
const app = createApp({
  store: new MemoryStore(),
  interpreter: counting,
  clock,
  idleCloseMs: DEFAULT_IDLE_CLOSE_MS,
})

const port = Number(process.env['PORT'] ?? 4460)

function readJsonBody(req: import('node:http').IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => chunks.push(c))
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8').trim()
      if (raw === '') return resolve({})
      try {
        resolve(JSON.parse(raw) as Record<string, unknown>)
      } catch {
        resolve({})
      }
    })
  })
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost')

  // AC-18/AC-25 seam
  if (url.pathname === '/__qa__/ai-calls' && req.method === 'GET') {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ count: counting.count }))
    return
  }

  // AC-28 seam: advance the injectable clock. The caller then hits a real
  // endpoint that runs lazyIdleClose (GET /assistant/session does, on every
  // call — src/assistant/api/app.ts) to make the close observable, exactly as
  // seams.ts's resync() doc comment describes.
  if (url.pathname === '/__qa__/advance-clock' && req.method === 'POST') {
    void readJsonBody(req).then((body) => {
      const ms = typeof body['ms'] === 'number' ? body['ms'] : DEFAULT_IDLE_CLOSE_MS + 20_000
      clock.advance(ms)
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ now: clock.now() }))
    })
    return
  }

  app(req, res)
})

server.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`qa e2e harness (real app + FakeClock + counting interpreter) listening on http://localhost:${port}`)
})
