/**
 * QA harness doors — the `__qa__` namespace, one implementation.
 *
 * Owner: qa-api-agent (T-166). Consumers: this module is mounted by
 * `qa-test-server.ts` (the Playwright/e2e harness process) and by the
 * in-process api suites under `qa/assistant/automation/api/`. It is ONE
 * implementation deliberately: two copies of a seed door would be L-004's
 * shape inside the instrument built to detect it.
 *
 * Contract: `specs/assistant/api-contracts.md § Harness doors` (F-005).
 * That section names three doors and says the existing `__qa__` namespace
 * "wraps createApp and writes through the Store port". It also states WHY
 * each exists — three F-005 ACs have no reachable fixture without them:
 *
 *   POST /__qa__/seed         AC-8   an out-of-set STORED priority; the same
 *                                    AC's write path refuses exactly the value
 *                                    its read must tolerate.
 *                             AC-34  a snapshot record in the PRE-F-005 shape;
 *                                    "a test that captures its own snapshot
 *                                    cannot fail this AC".
 *                             ADR-011 a non-canonical repeat_weekdays.
 *                             ADR-012 a soft-deleted row with
 *                                    delete_gesture_id: null (the measured
 *                                    53-of-790 legacy case).
 *   POST /__qa__/set-clock    AC-44  hold BOTH seams at one instant AND one
 *                                    zone for the length of a run.
 *   POST /__qa__/reopen-store AC-15  "survives a restart" — the harness
 *                                    composes a fresh MemoryStore per process,
 *                                    so a restart has nothing to survive.
 *
 * L-023 is the reason `set-clock` takes an instant AND a zone and writes the
 * zone onto the account rows: this project has already shipped a harness that
 * pinned the seam and left the fixtures on the wall clock, and the suite was
 * green only because the view read the wrong clock. Every fixture instant a
 * caller derives must be derived from `now` AFTER set-clock, in the zone
 * set-clock wrote — never from `new Date()`.
 *
 * No file under `src/` is modified. Every import below is a public,
 * constructor-injected composition seam (Store / Interpreter / Clock — ADR-001).
 */

import { MemoryStore } from '../../../../src/assistant/api/store/memory-store.ts'
import type { Store, StoreState } from '../../../../src/assistant/api/store/store.ts'
import type {
  Interpretation,
  Interpreter,
  InterpreterContext,
} from '../../../../src/assistant/api/ports/interpreter.ts'
import type { IncomingMessage, ServerResponse } from 'node:http'

// ───────────────────────────── the clock seam ─────────────────────────────

/**
 * AC-44's seam, harness side. `FakeClock` already carries `set`/`advance`, but
 * a QA-owned class keeps the door's contract in QA's hands and lets the zone
 * ride alongside the instant, which is the half `advance-clock` never had
 * ("the web harness drives only POST /__qa__/advance-clock … while the browser
 * under test runs on the real wall clock" — AC-44).
 *
 * `zone` here is bookkeeping for the door's response and for callers deriving
 * fixture instants. The AUTHORITATIVE zone for every server-side computation
 * is `account.timezone` (ADR-010) — which is why `set-clock` writes it there
 * rather than holding it on the clock.
 */
export class QaClock {
  private t: number
  /** The zone the run is held in. Not read by the app — see the note above. */
  zone: string

  constructor(at: string | number = '2026-08-19T09:00:00.000Z', zone = 'UTC') {
    this.t = typeof at === 'string' ? Date.parse(at) : at
    this.zone = zone
  }

  now(): number {
    return this.t
  }

  setAt(at: string | number): void {
    this.t = typeof at === 'string' ? Date.parse(at) : at
  }

  advance(ms: number): void {
    this.t += ms
  }
}

// ───────────────────────────── the store seam ─────────────────────────────

/**
 * AC-15's "survives a restart", made constructible. `createApp` holds ONE
 * store reference for the life of the process, so a restart cannot be
 * simulated by constructing a second store — the app would keep using the
 * first. This wrapper is the indirection that lets the door swap the inner
 * store for one freshly read from the durable snapshot, in-process.
 *
 * `MemoryStore.transact` already writes the snapshot when constructed with a
 * `snapshotPath`, so `reopen()` re-reads exactly what the app committed. With
 * no `snapshotPath` there is nothing durable and `reopen()` refuses rather
 * than pretending (a silent no-op here would make AC-15's persistence case
 * green for the wrong reason — L-012).
 */
export class ReopenableStore implements Store {
  private inner: MemoryStore
  readonly snapshotPath: string | undefined
  /** How many times the durable store has been re-opened this process. */
  reopens = 0

  constructor(opts: { snapshotPath?: string; initial?: StoreState } = {}) {
    this.snapshotPath = opts.snapshotPath
    this.inner = new MemoryStore(opts as never)
  }

  read<T>(fn: (state: StoreState) => T): T {
    return this.inner.read(fn)
  }

  transact<T>(fn: (state: StoreState) => T): T {
    return this.inner.transact(fn)
  }

  /** Close and re-open the durable snapshot. Throws when there is none. */
  reopen(): void {
    if (this.snapshotPath === undefined) {
      throw new Error(
        'reopen-store: this harness has no snapshotPath, so nothing is durable and a restart has nothing to survive (AC-15)',
      )
    }
    this.inner = new MemoryStore({ snapshotPath: this.snapshotPath } as never)
    this.reopens += 1
  }
}

// ───────────────────────── the AI-call counter seam ─────────────────────────

/** F-001 AC-18/AC-25 and F-005 AC-20/AC-32: "zero AI calls" needs a counter. */
export class CountingInterpreter implements Interpreter {
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

// ───────────────────────────── the doors ─────────────────────────────

export interface QaSeedBody {
  /** Raw task rows, written VERBATIM — bypassing every write rule. */
  tasks?: Record<string, unknown>[]
  /** Raw turn rows, incl. undo_snapshot / post_apply in the pre-F-005 shape. */
  turns?: Record<string, unknown>[]
  /** Raw account rows, incl. one with `timezone: null`. */
  accounts?: Record<string, unknown>[]
  /** Raw undo records, for AC-34's replay half. */
  undo_records?: Record<string, unknown>[]
  /** Raw session rows, for completeness with the store's top-level keys. */
  sessions?: Record<string, unknown>[]
}

export interface QaSetClockBody {
  at: string
  zone?: string
  /** Which accounts to write the zone onto. Omitted = every existing account. */
  users?: string[]
}

interface DoorDeps {
  store: ReopenableStore
  clock: QaClock
  interpreter?: CountingInterpreter
  /**
   * What `advance-clock` advances by when the body names no `ms`. The e2e
   * harness has always defaulted this to "past the idle-close window" and
   * `seams.ts`'s resync() doc depends on it; the api tier passes its own
   * amounts, so the default there is 0.
   */
  defaultAdvanceMs?: number
}

const KEYED_BY_ID = ['tasks', 'turns', 'undo_records', 'sessions'] as const

/**
 * Apply a seed body. Rows are written verbatim into the store's top-level
 * records, keyed by `id` (`user_id` for accounts). No validation, no
 * defaulting, no field completion — that is the entire point of the door: it
 * is the only producer of rows the write paths refuse by design.
 */
export function applySeed(store: Store, body: QaSeedBody): Record<string, number> {
  const counts: Record<string, number> = {}
  store.transact((state) => {
    const s = state as unknown as Record<string, Record<string, unknown>>
    for (const key of KEYED_BY_ID) {
      const rows = body[key]
      if (rows === undefined) continue
      for (const row of rows) {
        const id = row['id']
        if (typeof id !== 'string' || id === '') {
          throw new Error(`seed: every ${key} row needs a string id`)
        }
        s[key]![id] = row
      }
      counts[key] = rows.length
    }
    if (body.accounts !== undefined) {
      for (const row of body.accounts) {
        const uid = row['user_id']
        if (typeof uid !== 'string' || uid === '') {
          throw new Error('seed: every account row needs a string user_id')
        }
        s['accounts']![uid] = row
      }
      counts['accounts'] = body.accounts.length
    }
    return null
  })
  return counts
}

/**
 * Set the run's instant and zone. The instant goes on the clock seam; the zone
 * goes on `account.timezone` with `timezone_source: 'user'`, because ADR-010
 * makes the stored account zone the ONE source every date computation reads
 * and makes `PATCH /account` (source `user`) the only way to change an
 * established one. Writing it here is what lets a suite hold the seam and the
 * zone at one value for a whole run (AC-44) instead of hoping the header a
 * request happened to carry was the first one.
 */
export function applySetClock(
  store: Store,
  clock: QaClock,
  body: QaSetClockBody,
): { now: number; at: string; zone: string; accounts: string[] } {
  if (typeof body.at !== 'string' || Number.isNaN(Date.parse(body.at))) {
    throw new Error('set-clock: `at` must be an iso8601 instant')
  }
  clock.setAt(body.at)
  const zone = body.zone ?? clock.zone
  clock.zone = zone
  const touched: string[] = []
  store.transact((state) => {
    const accounts = (state as unknown as Record<string, Record<string, Record<string, unknown>>>)[
      'accounts'
    ]!
    const ids = body.users ?? Object.keys(accounts)
    for (const uid of ids) {
      const existing = accounts[uid]
      accounts[uid] = {
        ...(existing ?? { user_id: uid, created_at: new Date(clock.now()).toISOString() }),
        user_id: uid,
        timezone: zone,
        timezone_source: 'user',
        timezone_set_at: new Date(clock.now()).toISOString(),
      }
      touched.push(uid)
    }
    return null
  })
  return { now: clock.now(), at: body.at, zone, accounts: touched }
}

function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
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

function send(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(JSON.stringify(body))
}

/**
 * Build the `__qa__` request handler. Returns `true` when it handled the
 * request, `false` when the caller should fall through to `createApp`.
 *
 * Doors served:
 *   GET  /__qa__/ai-calls       (pre-existing, F-001)
 *   POST /__qa__/advance-clock  (pre-existing, F-001 — kept, per the contract)
 *   POST /__qa__/set-clock      (F-005 AC-44)
 *   POST /__qa__/seed           (F-005 AC-8, AC-34, AC-15)
 *   POST /__qa__/reopen-store   (F-005 AC-15)
 */
export function createQaDoors(deps: DoorDeps): (req: IncomingMessage, res: ServerResponse) => boolean {
  const { store, clock, interpreter, defaultAdvanceMs = 0 } = deps

  return (req, res): boolean => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    const path = url.pathname
    if (!path.startsWith('/__qa__/')) return false

    if (path === '/__qa__/ai-calls' && req.method === 'GET') {
      send(res, 200, { count: interpreter?.count ?? 0 })
      return true
    }

    if (path === '/__qa__/advance-clock' && req.method === 'POST') {
      void readJsonBody(req).then((body) => {
        const ms = typeof body['ms'] === 'number' ? body['ms'] : defaultAdvanceMs
        clock.advance(ms)
        send(res, 200, { now: clock.now() })
      })
      return true
    }

    if (path === '/__qa__/set-clock' && req.method === 'POST') {
      void readJsonBody(req).then((body) => {
        try {
          send(res, 200, applySetClock(store, clock, body as unknown as QaSetClockBody))
        } catch (e) {
          send(res, 400, { error: { code: 'QA_DOOR', message: String(e) } })
        }
      })
      return true
    }

    if (path === '/__qa__/seed' && req.method === 'POST') {
      void readJsonBody(req).then((body) => {
        try {
          send(res, 200, { seeded: applySeed(store, body as unknown as QaSeedBody) })
        } catch (e) {
          send(res, 400, { error: { code: 'QA_DOOR', message: String(e) } })
        }
      })
      return true
    }

    if (path === '/__qa__/reopen-store' && req.method === 'POST') {
      void readJsonBody(req).then(() => {
        try {
          store.reopen()
          send(res, 200, {
            reopened: true,
            reopens: store.reopens,
            tasks: store.read((s) => Object.keys((s as unknown as Record<string, object>)['tasks']!).length),
          })
        } catch (e) {
          send(res, 400, { error: { code: 'QA_DOOR', message: String(e) } })
        }
      })
      return true
    }

    send(res, 404, { error: { code: 'QA_DOOR', message: `no such harness door: ${req.method} ${path}` } })
    return true
  }
}
