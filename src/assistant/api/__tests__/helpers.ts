// Shared test harness: in-process supertest against createApp(...) with the
// fixture Interpreter (wrapped in an AI-call counter — AC-18/AC-25), a fake
// Clock, injectable idleCloseMs (ADR-004), and a sabotage-able Store for the
// atomicity tests (AC-1, AC-6). No listening port, no network.

import { randomUUID } from 'node:crypto'
import { createServer, globalAgent, type Server } from 'node:http'
import request from 'supertest'
import { onTestFinished } from 'vitest'
import type TestAgent from 'supertest/lib/agent.js'
import { createApp } from '../app.ts'
import { FakeClock } from '../ports/clock.ts'
import { FixtureInterpreter, type FixtureRow } from '../ports/fixture-interpreter.ts'
import { FIXTURE_TABLE } from '../ports/fixture-table.ts'
import type { Interpretation, Interpreter, InterpreterContext } from '../ports/interpreter.ts'
import { MemoryStore } from '../store/memory-store.ts'
import type { Store, StoreState } from '../store/store.ts'
import type { TurnSource } from '../types.ts'

/** AI-call counter wrapper — the harness seam the spec's Test strategy names. */
export class CountingInterpreter implements Interpreter {
  readonly calls: { transcript: string; startedAt: number; finishedAt: number }[] = []
  private readonly inner: Interpreter

  constructor(inner: Interpreter) {
    this.inner = inner
  }

  async interpret(ctx: InterpreterContext): Promise<Interpretation> {
    const rec = { transcript: ctx.transcript, startedAt: performance.now(), finishedAt: 0 }
    this.calls.push(rec)
    try {
      return await this.inner.interpret(ctx)
    } finally {
      rec.finishedAt = performance.now()
    }
  }
}

/**
 * Store wrapper that injects a throw after N writes to state.tasks inside a
 * transaction — proves mid-apply/mid-revert failures leave zero partial writes.
 */
export class SabotageStore implements Store {
  private readonly inner: MemoryStore
  private failAfter: number | null = null
  private writes = 0

  constructor(inner: MemoryStore) {
    this.inner = inner
  }

  arm(failAfterWrites: number): void {
    this.failAfter = failAfterWrites
    this.writes = 0
  }

  disarm(): void {
    this.failAfter = null
  }

  read<T>(fn: (state: StoreState) => T): T {
    return this.inner.read(fn)
  }

  transact<T>(fn: (state: StoreState) => T): T {
    return this.inner.transact((state) => {
      if (this.failAfter === null) return fn(state)
      const bump = (): void => {
        this.writes += 1
        if (this.writes > (this.failAfter ?? Infinity)) {
          throw new Error('sabotage: injected mid-transaction failure')
        }
      }
      const tasksProxy = new Proxy(state.tasks, {
        set: (target, prop, value) => {
          bump()
          Reflect.set(target, prop, value)
          return true
        },
        deleteProperty: (target, prop) => {
          bump()
          Reflect.deleteProperty(target, prop)
          return true
        },
      })
      const stateProxy = new Proxy(state, {
        get: (target, prop) => (prop === 'tasks' ? tasksProxy : Reflect.get(target, prop)),
      })
      return fn(stateProxy)
    })
  }
}

// Test-client determinism (T-006e). Two independent defaults conspired to make
// the suite flaky at ~1 run in 10:
//   1. `request(listener)` — passing supertest a REQUEST LISTENER (a function)
//      makes its Test constructor call `http.createServer(listener)` and
//      `listen(0)` *per request*, leaking one never-closed server per HTTP call.
//   2. Node >= 19 ships `http.globalAgent.keepAlive = true`, so client sockets
//      are pooled by `host:port` and outlive the request.
// Together: hundreds of short-lived servers churn through ephemeral ports while
// pooled sockets keep pointing at port numbers the OS later rebinds to a
// different harness's server. A request then lands on the wrong app instance —
// observed as a foreign (empty-store) response or, on a half-dead pooled
// socket, a bogus status line such as 426.
//
// Fix (no retries): pool nothing, and give each harness exactly ONE server that
// is destroyed with its test.
// (@types/node omits the writable `keepAlive` field that Node's Agent actually
// reads when disposing sockets, so the cast is a typing gap, not a hack —
// verified: with it false, `globalAgent.freeSockets` stays empty after a response.)
;(globalAgent as unknown as { keepAlive: boolean; options: { keepAlive?: boolean } }).keepAlive =
  false
;(globalAgent as unknown as { options: { keepAlive?: boolean } }).options.keepAlive = false

export interface Harness {
  agent: InstanceType<typeof TestAgent>
  clock: FakeClock
  interpreter: CountingInterpreter
  store: SabotageStore
  server: Server
}

/**
 * Test-server determinism (T-006f). Two independent bugs, found in sequence:
 *
 * 1. **Wrong interface.** Node's `listen(0)` with NO host binds the IPv6
 *    WILDCARD `::` — dual-stack, all interfaces, not just loopback. Because
 *    Node sets SO_REUSEADDR, that dual-stack bind can coexist on macOS with an
 *    unrelated already-running process's IPv4-specific bind on the identical
 *    port number (reproduced: a long-lived `playwright test-server --host
 *    127.0.0.1` from another session was found holding the exact port our
 *    harness got handed) instead of erring EADDRINUSE. The OS then delivers
 *    `127.0.0.1` connections — supertest always targets `127.0.0.1` literally
 *    — to WHICHEVER of the two listeners it picks, non-deterministically:
 *    sometimes ours, sometimes the stranger's. That produced BOTH observed
 *    symptoms: a foreign "Cannot POST /tasks" 404 (the other server's own
 *    routing) and an outright hang (its protocol not answering our request
 *    shape). Fix: bind the SAME interface supertest connects to (`127.0.0.1`),
 *    not the wildcard.
 * 2. **That fix alone made it worse** (verified empirically: `listen(0)` with
 *    NO host populates `server.address()` SYNCHRONOUSLY; passing ANY explicit
 *    host string — even a numeric IP — makes Node resolve it through an
 *    async path, so `server.address()` is still `null` right after the call).
 *    supertest's own `Test.serverAddress()` has a fallback for exactly that:
 *    `if (!addr) this._server = app.listen(0)` — it calls `.listen(0)` AGAIN
 *    on our already-listening-in-progress server the instant `address()` is
 *    null, which is undefined behaviour on a server mid-bind and produced the
 *    same 404/426/ECONNREFUSED symptoms, now on nearly every run instead of
 *    ~1 in 8. Fix: never hand supertest a server before it has actually
 *    finished listening — await the real `'listening'` event.
 *
 * Together: bind loopback explicitly, and await 'listening' before anyone
 * touches the server, so `server.address()` is always populated non-null and
 * supertest's double-listen fallback path is never triggered.
 */
export async function buildHarness(
  opts: { rows?: FixtureRow[]; idleCloseMs?: number } = {},
): Promise<Harness> {
  const clock = new FakeClock()
  const interpreter = new CountingInterpreter(
    new FixtureInterpreter(opts.rows ?? FIXTURE_TABLE),
  )
  const store = new SabotageStore(new MemoryStore())
  const app = createApp({
    store,
    interpreter,
    clock,
    idleCloseMs: opts.idleCloseMs ?? 180_000,
  })
  const server = createServer(app)
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => resolve())
  })
  onTestFinished(
    () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections() // no socket survives its server
        server.close(() => resolve())
      }),
  )
  return { agent: request(server), clock, interpreter, store, server }
}

export const uid = (): string => randomUUID()

export interface TurnOpts {
  ctid?: string
  source?: TurnSource
  session_id?: string | null
  answer_to?: string | null
}

export function sendTurn(h: Harness, user: string, transcript: string, opts: TurnOpts = {}) {
  return h.agent
    .post('/assistant/turn')
    .set('X-User-Id', user)
    .send({
      session_id: opts.session_id ?? null,
      client_turn_id: opts.ctid ?? uid(),
      transcript,
      source: opts.source ?? 'typed',
      answer_to_turn_id: opts.answer_to ?? null,
      timezone: null,
    })
}

export async function createTask(
  h: Harness,
  user: string,
  title: string,
  fields: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  const res = await h.agent.post('/tasks').set('X-User-Id', user).send({ title, ...fields })
  if (res.status !== 201) throw new Error(`seed task failed: ${res.status} ${res.text}`)
  return res.body.task as Record<string, unknown>
}

export async function listTasks(h: Harness, user: string): Promise<Record<string, unknown>[]> {
  const res = await h.agent.get('/tasks').set('X-User-Id', user)
  if (res.status !== 200) throw new Error(`list tasks failed: ${res.status}`)
  return res.body.tasks as Record<string, unknown>[]
}

export function getSession(h: Harness, user: string) {
  return h.agent.get('/assistant/session').set('X-User-Id', user)
}

export function closeSessionReq(h: Harness, user: string, sessionId: string) {
  return h.agent
    .post('/assistant/session/close')
    .set('X-User-Id', user)
    .send({ session_id: sessionId, reason: 'user_closed' })
}

export function undoTurn(h: Harness, user: string, turnId: string, via?: 'tap' | 'voice') {
  return h.agent
    .post(`/assistant/turn/${turnId}/undo`)
    .set('X-User-Id', user)
    .send(via === undefined ? {} : { via })
}

export const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))
