// Shared wire fixtures + the fake server — used by BOTH client tiers.
//
// Wire fixtures are built from the REAL wire types (src/assistant/api), so a
// backend shape change breaks these at typecheck instead of producing tests
// that pass against a shape the server never sends.
//
// This file lives in _shared rather than in one platform's test folder because
// the mobile tier asserts the SAME server contract as the web tier (F-003
// AC-1: one conversation, two clients). A second copy of these builders would
// be a second place for the contract to drift — the failure LEARNINGS L-004
// records.

import type { AppliedAnatomy, TurnOutcome, UndoOutcomeWire } from '../../api/types.ts'
import type { BoundaryWire, SessionWire, TaskWire, TurnWire } from '../types.ts'
import type { FetchLike } from '../api/client.ts'
import { startOfTodayIso } from '../model/tasks.ts'

export const T0 = '2026-08-16T14:04:00.000Z'

/**
 * A task on the wire. **Every field `TaskWire` declares is here**, and that is the
 * point of the builder: `## Impact §1` counts sixteen enumerations of the task's
 * field list and this is one of them, so a field the server starts sending and
 * this builder does not carry is a shape the client tiers never test against.
 * Widened for F-005 with the fields the detail reaches (AC-6, AC-8, AC-13, AC-14,
 * AC-15, AC-18, AC-19, AC-25, AC-38, ADR-011).
 *
 * Empty values, not sample ones: a default task is a **plain, top-level, unfiled,
 * undated, unrepeating task with no note and no steps**, so a test that means
 * anything else has to say so. `emptyDetailFields` is the shared source for the
 * F-005 half, so this builder and `createLocalTask` cannot drift.
 */
export function task(over: Partial<TaskWire> = {}): TaskWire {
  return {
    id: 'task-1',
    title: 'Review Q3 budget draft',
    note: null,
    due_at: null,
    // AC-13 — `null` is NOT DETERMINED, which is the honest default for a row
    // with no due at all, and it renders as a date with no clock time.
    due_all_day: null,
    reminder_at: null,
    reminder_shown_at: null,
    // AC-8 — never `null` on the wire: a stored `null` serializes as `"none"`.
    priority: 'none',
    parent_id: null,
    step_order: null,
    completed_by_parent: false,
    repeat_frequency: null,
    repeat_interval: null,
    repeat_weekdays: null,
    repeat_month_days: null,
    repeat_until: null,
    repeat_count: null,
    series_id: null,
    // AC-25 / AC-39 — false, and NOT derived from `series_id`: a builder that
    // guessed liveness from the id would bake in the exact defect AC-39's third
    // negative case exists to catch.
    series_live: false,
    // `'inbox'`, not `'today'` — ADR-009 retired `status: 'today'` as a live
    // value, so a builder defaulting to it would mint rows the app can no
    // longer produce and put every un-overridden fixture in a state no user
    // can reach. A default task is therefore in **Inbox** and in no day group
    // but Anytime; a test that means "this row is in Today" must now say so
    // with a `due_at`, which is the only thing that puts it there.
    status: 'inbox',
    created_at: T0,
    updated_at: T0,
    deleted_at: null,
    ...over,
  }
}

/**
 * A task the **current device day** holds — ADR-009's only way into Today.
 *
 * Since the status leg was dropped, "put this row in Today" is a statement
 * about `due_at` and about nothing else, and it has to be made against the real
 * clock because `openTodayCount` / `collectionTasks` default `now` to it. This
 * exists so no suite re-derives the date, and so the phrase "a task in Today"
 * has exactly one spelling across both tiers.
 */
export function todayTask(over: Partial<TaskWire> = {}): TaskWire {
  return task({ due_at: startOfTodayIso(new Date(T0)), ...over, due_all_day: over.due_all_day ?? true })
}

/**
 * A task in **Upcoming** — dated after the current device day.
 *
 * It exists because Upcoming cannot be observed from live data: ADR-009
 * § Amendment §2 measured the store and found **no future-dated row in any
 * account**, so a suite that replays it reports Upcoming green having never
 * rendered a member. The first one has to be seeded, and this is the one
 * spelling of it across both tiers.
 *
 * A week out, not a day: tomorrow is its own day GROUP inside Upcoming
 * (`Tomorrow · {date}` before `Later`), so a fixture dated tomorrow would make
 * every grouping assertion about the collection agree by accident.
 */
/**
 * A task **filed into a personal list** — the one shape the app cannot produce
 * and the store cannot hold, and the reason it exists is that without it the
 * filing axis has no falsifiable assertion at all.
 *
 * `lists` and `tasks.list_id` do not exist, so `isFiled` answers `false` for
 * every row anything else can build, and every claim about the two axes would
 * be vacuously true. ADR-009 § Amendment 2 § 3 makes this a requirement in as
 * many words — *`isFiled` must be answerable `true` in a test today* — because
 * an invariant with no failing case is **unproven rather than passing**. This
 * builder is that case: it is what INV-INBOX-FILING's test hands `inCollection`
 * to show that Inbox narrows and Today does not.
 *
 * The key is deliberately **not** on `TaskWire`. No `list_id` ships — not on
 * the entity, not on the wire, not in the store — so this returns the wire
 * shape plus the structurally-read key that `isFiled` looks for, and nothing in
 * `src/assistant/api` knows the word.
 */
export function filedTask(over: Partial<TaskWire> = {}): TaskWire & { list_id: string } {
  return { ...task(over), list_id: 'list-work' }
}

export function upcomingTask(over: Partial<TaskWire> = {}): TaskWire {
  const d = new Date(startOfTodayIso(new Date(T0)))
  d.setDate(d.getDate() + 7)
  return task({ due_at: d.toISOString(), ...over, due_all_day: over.due_all_day ?? true })
}

export function turn(over: Partial<TurnWire> = {}): TurnWire {
  return {
    id: 'turn-1',
    session_id: 'sess-1',
    user_id: 'user-1',
    seq: 1,
    client_turn_id: 'cid-1',
    status: 'applied',
    transcript_raw: 'push the budget review to 4pm',
    source: 'typed',
    answer_to_turn_id: null,
    outcome: null,
    changed_task_ids: [],
    diff: [],
    undo_snapshot: null,
    question: null,
    undo_result: null,
    created_at: T0,
    resolved_at: T0,
    ...over,
  }
}

export function applied(over: Partial<AppliedAnatomy> = {}): TurnOutcome {
  return {
    kind: 'applied',
    changed_task_ids: ['task-1'],
    diff: [{ task_id: 'task-1', field: 'due_at', old: '2:00 PM', new: '4:00 PM' }],
    created_titles: [],
    deleted_titles: [],
    ...over,
  }
}

/** An applied turn with its anatomy wired into both places the server sets. */
export function appliedTurn(over: Partial<TurnWire> = {}, anatomy: Partial<AppliedAnatomy> = {}): TurnWire {
  const outcome = applied(anatomy) as Extract<TurnOutcome, { kind: 'applied' }>
  return turn({
    status: 'applied',
    outcome,
    changed_task_ids: outcome.changed_task_ids,
    diff: outcome.diff,
    ...over,
  })
}

export function askedTurn(
  kind: 'bulk_delete' | 'clarify',
  titles: string[],
  options: string[],
  over: Partial<TurnWire> = {},
): TurnWire {
  return turn({
    status: 'asked',
    outcome: { kind: 'question' },
    question: {
      kind,
      task_ids: titles.map((_, i) => `task-${i + 1}`),
      task_titles: titles,
      options,
      ask_snapshot: [],
      resolution: null,
    },
    ...over,
  })
}

export function session(over: Partial<SessionWire> = {}): SessionWire {
  return {
    id: 'sess-1',
    user_id: 'user-1',
    status: 'open',
    close_reason: null,
    created_at: T0,
    last_activity_at: T0,
    closed_at: null,
    messages: [],
    ...over,
  }
}

export function boundary(over: Partial<BoundaryWire> = {}): BoundaryWire {
  return {
    session_id: 'sess-0',
    closed_at: '2026-08-15T16:42:00.000Z',
    close_reason: 'idle',
    declined_questions: [],
    late_outcomes: [],
    ...over,
  }
}

/** A 200 body for POST /assistant/turn — the contract's six response fields. */
export function turnResponse(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    session_id: 'sess-1',
    kind: 'turn',
    replayed: false,
    turn: null,
    undo: null,
    resolutions: [],
    ...over,
  }
}

export function undoOutcome(over: Partial<UndoOutcomeWire> = {}): UndoOutcomeWire {
  return {
    turn_id: 'turn-1',
    undone: true,
    already_undone: false,
    reverted: [{ task_id: 'task-1', title: 'Review Q3 budget draft' }],
    skipped: [],
    nothing_reverted: false,
    via: 'tap',
    ...over,
  }
}

// ---------------------------------------------------------------------------
// Fake server — the API seam (web.md Test Harness: unit tests mock the API at
// the fetch seam; no live server, no network).
// ---------------------------------------------------------------------------

export interface Call {
  method: string
  path: string
  body: unknown
  headers: Record<string, string>
}

type Reply =
  | { status: number; body: unknown }
  | { throws: unknown }
  /** `holdOnce` — a reply the caller settles later. See the method for why. */
  | { pending: Promise<Reply> }

export class FakeServer {
  readonly calls: Call[] = []
  private readonly queues = new Map<string, Reply[]>()
  private readonly defaults = new Map<string, Reply>()
  /** null until `withTasks()` opts in — see below. */
  private tasks: Map<string, TaskWire> | null = null
  private serverIds = 0

  private key(method: string, path: string): string {
    // Collapse ids so `POST /assistant/turn/{id}/undo` has one key.
    //
    // **F-005 adds three task SUB-routes and they have to be collapsed too**
    // (`POST /tasks/{id}/restore`, `/reminder-ack`, `/repeat-preview`). The old
    // `/tasks/[^/]+$` anchor only matched a path ENDING in an id, so a scripted
    // reply for one of them silently matched nothing and the caller got the
    // catch-all `200 {}` — which is L-007's shape exactly: a fake that answers
    // whatever it likes reads as a green test about a route nobody exercised.
    // The query string is stripped first, so `?scope=series` shares its key.
    const [bare = ''] = path.split('?')
    return `${method} ${bare
      .replace(/\/assistant\/turn\/[^/]+\/undo/, '/assistant/turn/:id/undo')
      .replace(/\/tasks\/[^/]+\/(restore|reminder-ack|repeat-preview)$/, '/tasks/:id/$1')
      .replace(/\/tasks\/[^/]+$/, '/tasks/:id')}`
  }

  /** Reply once (queued, in order). */
  once(route: string, status: number, body: unknown): this {
    const q = this.queues.get(route) ?? []
    q.push({ status, body })
    this.queues.set(route, q)
    return this
  }

  /** Reply to every unqueued call on this route. */
  always(route: string, status: number, body: unknown): this {
    this.defaults.set(route, { status, body })
    return this
  }

  /** Simulate a dropped connection (fetch rejects) once. */
  failOnce(route: string, error: unknown = new TypeError('Failed to fetch')): this {
    const q = this.queues.get(route) ?? []
    q.push({ throws: error })
    this.queues.set(route, q)
    return this
  }

  /**
   * **A request that has not resolved yet**, and the caller decides when and how it
   * does.
   *
   * `failOnce` throws *inside* the call, so every reply this fake can give has
   * already arrived by the time the next line runs — there is no window for
   * anything to happen *during* one. `F-005 AC-2` lives in exactly that window:
   * *"the ordinary order in an outage is close, then fail"* — leaving a field is the
   * gesture that precedes closing, so the write is in flight precisely when the user
   * closes, and it fails after. Revision 2's AC-2 keyed the notice to the write's
   * state *at the moment of closing*, which excludes that order; three lenses found
   * it independently, and this is what makes the corrected trigger assertable.
   *
   * (The same shape as `animateScrollTo` in the web helpers, and for the same
   * reason: a fake whose every effect lands synchronously cannot model a defect that
   * lives mid-flight.)
   */
  holdOnce(route: string): { fail: (error?: unknown) => void; ok: (status: number, body: unknown) => void } {
    let settle: ((r: Reply) => void) | null = null
    const pending = new Promise<Reply>((res) => {
      settle = res
    })
    const q = this.queues.get(route) ?? []
    q.push({ pending })
    this.queues.set(route, q)
    return {
      fail: (error: unknown = new TypeError('Failed to fetch')) => settle?.({ throws: error }),
      ok: (status: number, body: unknown) => settle?.({ status, body }),
    }
  }

  /**
   * Opt in to a **stateful** `/tasks`: creates land in a store that later
   * `GET /tasks` reads back. Scripted replies still win (queued, then
   * `always`), so this changes nothing for suites that do not call it.
   *
   * It mirrors the three rules of the real handler (src/assistant/api/app.ts,
   * api-contracts "Prototype task CRUD") that a client-side sync depends on:
   * a client-supplied `id` is used verbatim, a colliding one answers
   * `409 TASK_ID_EXISTS` without overwriting, and an omitted one is generated.
   * Without this, an offline-replay test can only assert the request it sent —
   * not that the task is actually on the server afterwards.
   */
  withTasks(initial: TaskWire[] = []): this {
    this.tasks = new Map(initial.map((t) => [t.id, t]))
    return this
  }

  /** The server's own view of the account's tasks. Prefer asserting through a
   * real `GET /tasks` where the point is the read-back; use this for setup. */
  storedTasks(): TaskWire[] {
    return [...(this.tasks?.values() ?? [])]
  }

  private taskReply(method: string, path: string, body: unknown): Reply | null {
    const store = this.tasks
    if (store === null || !path.startsWith('/tasks')) return null
    const idMatch = path.match(/^\/tasks\/([^/]+)$/)
    if (method === 'GET' && path === '/tasks') {
      return { status: 200, body: { tasks: [...store.values()] } }
    }
    if (method === 'POST' && path === '/tasks') {
      const b = (body ?? {}) as Partial<TaskWire>
      const id = typeof b.id === 'string' ? b.id : `srv-${(this.serverIds += 1)}`
      const existing = store.get(id)
      if (existing !== undefined) {
        // the collision ack — the existing row is NOT overwritten
        return {
          status: 409,
          body: { error: { code: 'TASK_ID_EXISTS', message: 'a task with this id already exists' } },
        }
      }
      const row = task({
        id,
        title: String(b.title ?? ''),
        due_at: b.due_at ?? null,
        priority: b.priority ?? 'none',
        status: b.status ?? 'inbox',
      })
      store.set(id, row)
      return { status: 201, body: { task: row } }
    }
    if (idMatch !== null) {
      const row = store.get(idMatch[1] ?? '')
      if (row === undefined) {
        return { status: 404, body: { error: { code: 'NOT_FOUND', message: 'no such task' } } }
      }
      if (method === 'PATCH') {
        const next = { ...row, ...(body as Partial<TaskWire>) }
        store.set(row.id, next)
        return { status: 200, body: { task: next } }
      }
      if (method === 'DELETE') {
        const next = { ...row, deleted_at: T0 }
        store.set(row.id, next)
        return { status: 200, body: { task: next } }
      }
    }
    return null
  }

  /** Calls that reached the assistant surface — the AC-18 zero-AI assertion. */
  assistantCalls(): Call[] {
    return this.calls.filter((c) => c.path.startsWith('/assistant'))
  }

  turnBodies(): Record<string, unknown>[] {
    return this.calls
      .filter((c) => c.method === 'POST' && c.path === '/assistant/turn')
      .map((c) => c.body as Record<string, unknown>)
  }

  readonly fetchFn: FetchLike = async (url, init) => {
    const method = init?.method ?? 'GET'
    const path = String(url)
    const raw = init?.body
    const body: unknown = typeof raw === 'string' ? JSON.parse(raw) : null
    this.calls.push({
      method,
      path,
      body,
      headers: (init?.headers ?? {}) as Record<string, string>,
    })
    const k = this.key(method, path)
    const queued = this.queues.get(k)?.shift()
    const chosen: Reply = queued ??
      this.defaults.get(k) ??
      this.taskReply(method, path, body) ?? { status: 200, body: {} }
    const reply: Reply = 'pending' in chosen ? await chosen.pending : chosen
    if ('pending' in reply) throw new Error('holdOnce settled with another pending reply')
    if ('throws' in reply) throw reply.throws
    return new Response(JSON.stringify(reply.body), {
      status: reply.status,
      headers: { 'content-type': 'application/json' },
    })
  }
}
