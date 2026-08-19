// createApp(deps): http.RequestListener — routing, auth, validation (platform
// doc app-factory pattern). No framework (ADR-001). Every endpoint shape comes
// from specs/assistant/api-contracts.md; entity shapes from data-model.md.
// Business logic lives in engine/; this file only parses, validates, routes,
// and writes the error envelope. Stack traces never reach clients.
//
// F-005 widens the four CRUD endpoints, adds five routes (`restore`,
// `reminder-ack`, `repeat-preview`, `GET`/`PATCH /account`), and puts the ONE
// zone installer in the auth step. **`__qa__` endpoints are not served here**
// (platform doc): the seed path, the clock setter and the store re-open live in
// the QA harness, because adding them to the production app would put a
// validation bypass on the shipped surface.

import type { IncomingMessage, RequestListener, ServerResponse } from 'node:http'
import { randomUUID } from 'node:crypto'
import { ApiError, notFound, unauthenticated, validation } from './errors.ts'
import type { Clock } from './ports/clock.ts'
import { systemClock } from './ports/clock.ts'
import type { Interpreter } from './ports/interpreter.ts'
import type { Store, StoreState } from './store/store.ts'
import type { AccountRow, TaskChanges, TaskRow, TurnSource, UndoVia } from './types.ts'
import { AccountQueue } from './engine/queue.ts'
import {
  serializeBoundary,
  serializeSession,
  serializeTask,
  sessionTurns,
  type TaskView,
} from './engine/serialize.ts'
import {
  closeSession,
  DEFAULT_IDLE_CLOSE_MS,
  findOpenSession,
  latestClosedSession,
  lazyIdleClose,
  nowIso,
} from './engine/sessions.ts'
import {
  executePlan,
  planContext,
  planCreate,
  planDelete,
  planEdits,
  previewRepeat,
  type DeleteScope,
  type ExecutedPlan,
} from './engine/plan.ts'
import { RECURRENCE_MEMBERS } from './engine/recurrence.ts'
import {
  timezoneUnknown,
  violationToApiError,
  type FieldViolation,
} from './engine/task-fields.ts'
import { performUndo } from './engine/undo.ts'
import { accountZone, isValidZone, recordClientZone } from './engine/zone.ts'
import { preflightInFlight, processTurn, taskView, type TurnRequest } from './engine/turns.ts'

export interface AppDeps {
  store: Store
  interpreter: Interpreter
  clock?: Clock
  /** server-owned idle close, lazily evaluated (ADR-004); default 180 s */
  idleCloseMs?: number
  uuid?: () => string
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const TURN_SOURCES: readonly string[] = ['voice', 'typed', 'tap']

type Body = Record<string, unknown>

function readBody(req: IncomingMessage): Promise<Body> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => chunks.push(c))
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8').trim()
      if (raw === '') return resolve({})
      try {
        const parsed: unknown = JSON.parse(raw)
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
          return reject(validation('request body must be a JSON object'))
        }
        resolve(parsed as Body)
      } catch {
        reject(validation('request body is not valid JSON'))
      }
    })
    req.on('error', reject)
  })
}

function json(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(payload),
  })
  res.end(payload)
}

// ---- field validators (400 VALIDATION with the offending field named) ----

/**
 * Unknown request fields are rejected on every endpoint: any field not named
 * in the endpoint's request shape → 400 VALIDATION naming the field, zero
 * side effects (Conventions, pinned by TC-34). Runs before any state change.
 *
 * `X-Timezone` is a HEADER, not a body field, so the F-005 zone report leaves
 * this policy untouched (api-contracts § Conventions).
 */
function rejectUnknownFields(body: Body, allowed: readonly string[]): void {
  for (const key of Object.keys(body)) {
    if (!allowed.includes(key)) throw validation(`unknown field: ${key}`, key)
  }
}

function reqString(body: Body, field: string): string {
  const v = body[field]
  if (typeof v !== 'string' || v.trim() === '') {
    throw validation(`${field} is required and must be a non-empty string`, field)
  }
  return v
}

function reqUuid(body: Body, field: string): string {
  const v = reqString(body, field)
  if (!UUID_RE.test(v)) throw validation(`${field} must be a uuid`, field)
  return v
}

function optUuid(body: Body, field: string): string | null {
  const v = body[field]
  if (v === undefined || v === null) return null
  if (typeof v !== 'string' || !UUID_RE.test(v)) {
    throw validation(`${field} must be a uuid or null`, field)
  }
  return v
}

function optNullableString(body: Body, field: string): string | null {
  const v = body[field]
  if (v === undefined || v === null) return null
  if (typeof v !== 'string') throw validation(`${field} must be a string or null`, field)
  return v
}

/**
 * **`TASK_CREATE_FIELDS`, in full** (api-contracts § `POST /tasks`) — enumerated
 * rather than grown ad hoc, because a create that cannot carry a step's parent
 * becomes POST-then-PATCH with a window in which the step exists at an undefined
 * position and AC-3 renders it to every other client watching (AC-14).
 *
 * `reminder_shown_at`, `series_live`, `series_id`, `completed_by_parent` and
 * `deleted_at` are **not creatable** — sending one is `400 VALIDATION` naming the
 * field, per the one unknown-field policy.
 */
const TASK_CREATE_FIELDS = [
  'id',
  'title',
  'note',
  'due_at',
  'due_all_day',
  'reminder_at',
  'priority',
  'status',
  'parent_id',
  'step_order',
  ...RECURRENCE_MEMBERS,
] as const

/**
 * **`TASK_PATCH_FIELDS`, in full** — the create list **minus `id` and
 * `parent_id`, plus `step_order`**, which is patchable and is how a move is made
 * (ADR-015).
 *
 * `parent_id` is deliberately **not** patchable: a step does not change parents
 * this phase, and re-parenting is a gesture no AC describes and no control
 * offers. `reminder_shown_at`, `series_live`, `series_id`, `completed_by_parent`,
 * `ever_completed`, `series_ended_at`, `delete_gesture_id` and `deleted_at` are
 * not patchable either — each has exactly one writer, named where it is defined.
 * That is why restore is a route (ADR-012) and not a patchable `deleted_at`.
 */
const TASK_PATCH_FIELDS = [
  'title',
  'note',
  'due_at',
  'due_all_day',
  'reminder_at',
  'priority',
  'status',
  'step_order',
  ...RECURRENCE_MEMBERS,
] as const

/** The repeat-preview request is exactly the `PATCH` repeat shape (+ the due). */
const REPEAT_PREVIEW_FIELDS = ['due_at', 'due_all_day', ...RECURRENCE_MEMBERS] as const

/**
 * The `taskChangesFrom` switch (api-contracts § The seven closed field lists).
 *
 * It rejects unknown fields and projects the allowed keys — and **it no longer
 * holds the field rules.** Those moved to `engine/task-fields.ts`
 * `enforceFieldRules`, which both this door and the turn path call (F-005 AC-40).
 * Keeping a second copy here would be L-004's shape on the very rule set AC-40
 * exists to unify, and the copy on the HTTP side is the one that already worked —
 * so it is the copy that had to go.
 *
 * Values are handed over raw: `enforceFieldRules` is the runtime type gate as
 * well as the rule gate, and it names the offending field in its message.
 */
function taskChangesFrom(body: Body, allowed: readonly string[]): TaskChanges {
  rejectUnknownFields(body, allowed)
  const changes: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(body)) {
    if (key === 'id') continue // create-only; format validated by the handler
    changes[key] = value
  }
  return changes as TaskChanges
}

// ---------------------------------------------------------------------------

export function createApp(deps: AppDeps): RequestListener {
  const store = deps.store
  const interpreter = deps.interpreter
  const clock = deps.clock ?? systemClock
  const idleCloseMs = deps.idleCloseMs ?? DEFAULT_IDLE_CLOSE_MS
  const uuid = deps.uuid ?? (() => randomUUID())
  const queue = new AccountQueue()

  const turnDeps = { store, interpreter, clock, idleCloseMs, uuid }

  const view = (s: StoreState, userId: string): TaskView => taskView(s, userId, clock)

  const plans = (s: StoreState, userId: string) =>
    planContext(s, userId, accountZone(s, userId), clock.now(), nowIso(clock), uuid)

  /** The multi-row response rule (api-contracts § The multi-row response rule). */
  const writeResponse = (
    s: StoreState,
    userId: string,
    res: ExecutedPlan,
    extra: Record<string, unknown> = {},
  ): Record<string, unknown> => {
    const v = view(s, userId)
    const addressed = res.touched.find((t) => t.id === res.addressed_id) ?? res.touched[0]
    const others = res.touched.filter((t) => t.id !== addressed?.id)
    return {
      task: addressed === undefined ? null : serializeTask(addressed, v),
      // every OTHER row this write changed; the addressed row is never repeated
      changed: others.map((t) => serializeTask(t, v)),
      ...(res.removed_ids.length > 0 ? { removed: [...res.removed_ids] } : {}),
      ...extra,
    }
  }

  async function route(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', 'http://localhost')
    const path = url.pathname.replace(/\/+$/, '') || '/'
    const method = req.method ?? 'GET'

    // auth stub (ADR-001): X-User-Id identifies the account; missing/empty → 401
    const header = (name: string): string | undefined => {
      const raw = req.headers[name]
      return (Array.isArray(raw) ? raw[0] : raw)?.trim()
    }
    const userId = header('x-user-id') ?? ''
    if (userId === '') throw unauthenticated()

    // ---- the ONE zone installer, in the auth step, before routing (ADR-010) --
    //
    // `X-Timezone` is a REPORT, never a computation input: it creates the account
    // row if absent and sets `account.timezone` **only when it is currently
    // unset**. Every date computation reads `account.timezone` and never this
    // header. A malformed zone is ignored (recorded as a report, never stored).
    //
    // The read-then-write shape keeps the common case allocation-free — the
    // installer is called on every request, but the store is only written when
    // something it records actually changes.
    const reportedZone = header('x-timezone') ?? null
    const recorded = store.read((s) => s.accounts?.[userId])
    if (recorded === undefined || (reportedZone !== null && recorded.timezone_last_report !== reportedZone)) {
      store.transact((s) => recordClientZone(s, userId, reportedZone, nowIso(clock)))
    }

    // ---- POST /assistant/turn ----
    if (method === 'POST' && path === '/assistant/turn') {
      const body = await readBody(req)
      rejectUnknownFields(body, [
        'session_id',
        'client_turn_id',
        'transcript',
        'source',
        'answer_to_turn_id',
        'timezone',
      ])
      const source = body.source
      if (typeof source !== 'string' || !TURN_SOURCES.includes(source)) {
        throw validation(`source must be one of ${TURN_SOURCES.join(', ')}`, 'source')
      }
      const turnReq: TurnRequest = {
        session_id: optUuid(body, 'session_id'),
        client_turn_id: reqUuid(body, 'client_turn_id'),
        transcript: reqString(body, 'transcript'),
        source: source as TurnSource,
        answer_to_turn_id: optUuid(body, 'answer_to_turn_id'),
        timezone: optNullableString(body, 'timezone'),
      }
      preflightInFlight(store, userId, turnReq)
      const out = await queue.run(userId, () => processTurn(turnDeps, userId, turnReq))
      return json(res, 200, out)
    }

    // ---- GET /assistant/session ----
    if (method === 'GET' && path === '/assistant/session') {
      const out = await queue.run(userId, async () =>
        store.transact((s) => {
          lazyIdleClose(s, userId, clock, idleCloseMs)
          const open = findOpenSession(s, userId)
          if (open !== undefined) {
            open.last_foreground_at = nowIso(clock) // the resume IS the foreground (AC-28)
            return { session: serializeSession(s, open, view(s, userId)), boundary: null }
          }
          const closed = latestClosedSession(s, userId)
          return { session: null, boundary: closed === undefined ? null : serializeBoundary(closed) }
        }),
      )
      return json(res, 200, out)
    }

    // ---- POST /assistant/session/close ----
    if (method === 'POST' && path === '/assistant/session/close') {
      const body = await readBody(req)
      rejectUnknownFields(body, ['session_id', 'reason'])
      const sessionId = reqUuid(body, 'session_id')
      const reason = body.reason
      if (reason !== 'user_closed') {
        // server-initiated idle close uses "idle", never via this endpoint
        throw validation('reason must be "user_closed"', 'reason')
      }
      const out = await queue.run(userId, async () =>
        store.transact((s) => {
          lazyIdleClose(s, userId, clock, idleCloseMs)
          const session = s.sessions[sessionId]
          if (session === undefined || session.user_id !== userId) {
            throw notFound('unknown session_id')
          }
          const alreadyClosed = session.status === 'closed'
          if (!alreadyClosed) closeSession(s, session, 'user_closed', nowIso(clock))
          return {
            session: {
              id: session.id,
              status: 'closed',
              close_reason: session.close_reason,
              closed_at: session.closed_at,
            },
            declined_question_turn_ids: (session.boundary_declined ?? []).map((d) => d.turn_id),
            already_closed: alreadyClosed,
          }
        }),
      )
      return json(res, 200, out)
    }

    // ---- POST /assistant/turn/{turn_id}/undo ----
    const undoMatch = path.match(/^\/assistant\/turn\/([^/]+)\/undo$/)
    if (method === 'POST' && undoMatch !== null) {
      const turnId = undoMatch[1]!
      const body = await readBody(req)
      rejectUnknownFields(body, ['via'])
      const viaRaw = body.via ?? 'tap'
      if (viaRaw !== 'tap' && viaRaw !== 'voice') {
        throw validation('via must be "tap" or "voice"', 'via')
      }
      const via = viaRaw as UndoVia
      const out = await queue.run(userId, async () =>
        // window check and revert run in ONE transaction (AC-6)
        store.transact((s) => {
          lazyIdleClose(s, userId, clock, idleCloseMs)
          const turn = s.turns[turnId]
          if (turn === undefined || turn.user_id !== userId) throw notFound('unknown turn_id')
          return performUndo(s, turn, via, nowIso(clock))
        }),
      )
      return json(res, 200, out)
    }

    // ---- GET /account, PATCH /account (ADR-010) ----
    if (path === '/account' && (method === 'GET' || method === 'PATCH')) {
      if (method === 'GET') {
        const account = store.read((s) => s.accounts?.[userId])
        return json(res, 200, serializeAccount(userId, account, nowIso(clock)))
      }
      const body = await readBody(req)
      rejectUnknownFields(body, ['timezone'])
      const zone = reqString(body, 'timezone')
      if (!isValidZone(zone)) throw validation('timezone must be a known IANA zone', 'timezone')
      const out = store.transact((s) => {
        const at = nowIso(clock)
        const account = recordClientZone(s, userId, null, at)
        // **The only way to change an already-set zone** (ADR-010): a differing
        // client report never overwrites one, because a same-request upsert makes
        // each device resolve rows in its own zone — the *one row, three answers*
        // defect returning through the writer.
        account.timezone = zone
        account.timezone_source = 'user'
        account.timezone_set_at = at
        return serializeAccount(userId, account, at)
      })
      return json(res, 200, out)
    }

    // ---- prototype task CRUD (zero AI calls — AC-18, AC-32) ----
    if (path === '/tasks' && method === 'GET') {
      // **A read never refuses** (ADR-010). `due_all_day: null` on the wire means
      // *not determined*; refusing would make this unrenderable for an account
      // with no zone, which on day one is every row of every account.
      const tasks = store.read((s) => {
        const v = view(s, userId)
        return Object.values(s.tasks)
          .filter((t) => t.user_id === userId && t.deleted_at === null)
          .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
          .map((t) => serializeTask(t, v))
      })
      return json(res, 200, { tasks })
    }

    if (path === '/tasks' && method === 'POST') {
      const body = await readBody(req)
      const changes = taskChangesFrom(body, TASK_CREATE_FIELDS) // rejects unknown fields first
      // optional client-generated id: the offline local path creates the task
      // locally under a real id and replays the create on reconnect (AC-25)
      const clientId = optUuid(body, 'id')
      const out = store.transact((s) => {
        if (clientId !== null && s.tasks[clientId] !== undefined) {
          // a client replaying its own create treats this as already-synced
          throw new ApiError(409, 'TASK_ID_EXISTS', 'a task with this id already exists')
        }
        const ctx = plans(s, userId)
        const planned = planCreate(ctx, { ...changes, ...(clientId !== null ? { id: clientId } : {}) })
        if (!planned.ok) throw violationToApiError(planned.violation)
        const executed = executePlan(ctx, planned.plan)
        return writeResponse(s, userId, executed)
      })
      return json(res, 201, out)
    }

    // ---- POST /tasks/{id}/restore — new (AC-41, ADR-012) ----
    const restoreMatch = path.match(/^\/tasks\/([^/]+)\/restore$/)
    if (method === 'POST' && restoreMatch !== null) {
      const taskId = restoreMatch[1]!
      const body = await readBody(req)
      rejectUnknownFields(body, [])
      const out = store.transact((s) => restoreTask(s, userId, taskId, nowIso(clock), view))
      return json(res, 200, out)
    }

    // ---- POST /tasks/{id}/reminder-ack — new (AC-38) ----
    const ackMatch = path.match(/^\/tasks\/([^/]+)\/reminder-ack$/)
    if (method === 'POST' && ackMatch !== null) {
      const taskId = ackMatch[1]!
      const body = await readBody(req)
      rejectUnknownFields(body, ['reminder_at'])
      const claimed = reqString(body, 'reminder_at')
      if (Number.isNaN(Date.parse(claimed))) {
        throw validation('reminder_at must be an iso8601 instant', 'reminder_at')
      }
      const out = store.transact((s) =>
        acknowledgeReminder(s, userId, taskId, claimed, nowIso(clock), view),
      )
      return json(res, 200, out)
    }

    // ---- POST /tasks/{id}/repeat-preview — new (AC-22, AC-23, AC-25) ----
    const previewMatch = path.match(/^\/tasks\/([^/]+)\/repeat-preview$/)
    if (method === 'POST' && previewMatch !== null) {
      const taskId = previewMatch[1]!
      const body = await readBody(req)
      const proposed = taskChangesFrom(body, REPEAT_PREVIEW_FIELDS)
      const out = store.read((s) => repeatPreview(s, userId, taskId, proposed, clock.now()))
      return json(res, 200, out)
    }

    const taskMatch = path.match(/^\/tasks\/([^/]+)$/)
    if (taskMatch !== null && (method === 'PATCH' || method === 'DELETE')) {
      const taskId = taskMatch[1]!
      if (method === 'PATCH') {
        const body = await readBody(req)
        const changes = taskChangesFrom(body, TASK_PATCH_FIELDS)
        if (Object.keys(changes).length === 0) {
          throw validation('at least one mutable field is required')
        }
        const out = store.transact((s) => {
          const cur = s.tasks[taskId]
          // PATCH still **404s on a deleted row** and `deleted_at` is still not
          // patchable — which is why restore is a route (ADR-012)
          if (cur === undefined || cur.user_id !== userId || cur.deleted_at !== null) {
            throw notFound('unknown task id')
          }
          const ctx = plans(s, userId)
          const planned = planEdits(ctx, [{ task_id: taskId, changes }], { door: 'http' })
          if (!planned.ok) throw violationToApiError(planned.violation)
          const executed = executePlan(ctx, planned.plan)
          // **Every `200` carries `prior`** (ADR-015): the pre-write value of each
          // field the write actually changed, `{}` when the write was a no-op. It
          // is the SINGLE source for the reorder undo's prior position, so no new
          // record is owed. A row untouched by a no-op write is still returned.
          const response = writeResponse(s, userId, executed, { prior: executed.prior })
          if (response.task === null) response.task = serializeTask(cur, view(s, userId))
          return response
        })
        return json(res, 200, out)
      }

      // DELETE /tasks/{id}?scope=occurrence|series (AC-19, AC-30, ADR-012)
      const scopeRaw = url.searchParams.get('scope') ?? 'occurrence'
      if (scopeRaw !== 'occurrence' && scopeRaw !== 'series') {
        throw validation('scope must be "occurrence" or "series"', 'scope')
      }
      const scope = scopeRaw as DeleteScope
      const out = store.transact((s) => {
        const cur = s.tasks[taskId]
        if (cur === undefined || cur.user_id !== userId || cur.deleted_at !== null) {
          throw notFound('unknown task id')
        }
        const ctx = plans(s, userId)
        const planned = planDelete(ctx, [taskId], scope)
        if (!planned.ok) throw violationToApiError(planned.violation)
        const executed = executePlan(ctx, planned.plan)
        return writeResponse(s, userId, executed)
      })
      return json(res, 200, out)
    }

    throw notFound(`no route: ${method} ${path}`)
  }

  // -------------------------------------------------------------------------
  // Handlers with enough body to name (kept out of the router for readability)
  // -------------------------------------------------------------------------

  function serializeAccount(
    userId: string,
    account: AccountRow | undefined,
    at: string,
  ): Record<string, unknown> {
    return {
      user_id: userId,
      timezone: account?.timezone ?? null,
      timezone_source: account?.timezone_source ?? null,
      timezone_set_at: account?.timezone_set_at ?? null,
      // exists so a client can *OFFER* a change when the user has travelled,
      // rather than take one (ADR-010's stated cost)
      timezone_last_report: account?.timezone_last_report ?? null,
      timezone_last_report_at: account?.timezone_last_report_at ?? null,
      created_at: account?.created_at ?? at,
    }
  }

  /**
   * `POST /tasks/{id}/restore` (AC-41, ADR-012). Clears `deleted_at` on the
   * addressed row and on **every other row carrying the same
   * `delete_gesture_id`**. Ids, `step_order`, `series_id` and `created_at` are
   * kept; only `deleted_at` clears and `updated_at` advances — restoring is not
   * creating.
   */
  function restoreTask(
    s: StoreState,
    userId: string,
    taskId: string,
    at: string,
    mkView: (s: StoreState, userId: string) => TaskView,
  ): Record<string, unknown> {
    const row = s.tasks[taskId]
    // **Scoped to the caller's rows.** Another account's id behaves as 404, per
    // the standing convention — stated because a brand-new write path is exactly
    // where that gets missed and no AC would otherwise turn red.
    if (row === undefined || row.user_id !== userId) throw notFound('unknown task id')
    const v = mkView(s, userId)
    // **Restoring a row that is not deleted is a stated no-op** — 200 with
    // `restored: false`, never 404 and never 409 (AC-41). A double-tap is
    // ordinary on an undo that is one action away wherever the user is.
    if (row.deleted_at === null) {
      return { task: serializeTask(row, v), changed: [], restored: false }
    }

    const gesture = row.delete_gesture_id ?? null
    // **A row whose `delete_gesture_id` is `null` restores alone** (ADR-012) —
    // the measured 53-of-790 case, all predating the field. Neither `parent_id`
    // nor matching `deleted_at` is used as a key: AC-41 rejects both by name, and
    // a singleton restore is the only answer that is TRUE rather than plausible.
    // **No migration is run**; ADR-009's precedent holds.
    const members =
      gesture === null
        ? [row]
        : Object.values(s.tasks).filter(
            (t) =>
              t.user_id === userId && t.deleted_at !== null && t.delete_gesture_id === gesture,
          )

    // **Restoring a step whose parent is still deleted restores the parent too**
    // (AC-41) — evaluated AFTER the membership set is assembled, as an invariant
    // rather than as a key, and applying to legacy rows as well. A step with no
    // parent is in no collection and therefore unreachable.
    const set = new Map(members.map((m) => [m.id, m]))
    for (const member of members) {
      const parentId = member.parent_id ?? null
      if (parentId === null) continue
      const parent = s.tasks[parentId]
      if (parent === undefined || parent.user_id !== userId) continue
      if (parent.deleted_at !== null) set.set(parent.id, parent)
    }

    const restored: TaskRow[] = []
    for (const member of set.values()) {
      if (member.deleted_at === null) continue
      member.deleted_at = null
      member.updated_at = at
      restored.push(member)
    }
    const addressed = s.tasks[taskId]!
    return {
      task: serializeTask(addressed, mkView(s, userId)),
      changed: restored
        .filter((t) => t.id !== taskId)
        .map((t) => serializeTask(t, mkView(s, userId))),
      restored: true,
    }
  }

  /**
   * `POST /tasks/{id}/reminder-ack` (AC-38). The **server** writes
   * `reminder_shown_at`, on an acknowledgement the client sends — not on render,
   * and not by the client. `reminder_shown_at` is writable through this door and
   * **no other**: it is in neither `TASK_PATCH_FIELDS` nor `TASK_CREATE_FIELDS`,
   * and a turn attempting it is refused under AC-40 like any unpermitted field —
   * a turn that could set it would silently retire a reminder the user never saw.
   */
  function acknowledgeReminder(
    s: StoreState,
    userId: string,
    taskId: string,
    claimed: string,
    at: string,
    mkView: (s: StoreState, userId: string) => TaskView,
  ): Record<string, unknown> {
    const row = s.tasks[taskId]
    // caller scoping is explicit: only the caller's own rows (AC-38, mirroring
    // AC-41's restore — this door is the other brand-new write path)
    if (row === undefined || row.user_id !== userId) throw notFound('unknown task id')
    const v = mkView(s, userId)
    // acknowledging a reminder on a done or deleted row is a no-op
    if (row.deleted_at !== null || row.status === 'done') {
      return { task: serializeTask(row, v), changed: [], acknowledged: false }
    }
    const current = row.reminder_at
    const same = current !== null && Date.parse(current) === Date.parse(claimed)
    if (!same) {
      // the reminder was changed underneath, and acknowledging the old instant
      // must not retire the new one — nothing is written
      throw new ApiError(409, 'REMINDER_MOVED', 'the reminder has moved since it was surfaced', {
        detail: { reminder_at: current },
      })
    }
    row.reminder_shown_at = at
    row.updated_at = at
    return { task: serializeTask(row, mkView(s, userId)), changed: [], acknowledged: true }
  }

  /**
   * `POST /tasks/{id}/repeat-preview` (AC-22, AC-23, AC-25). A **dry run of the
   * same server code** the commit runs, so the disclosed date is by construction
   * the date that will be written. A client-side preview would be a second
   * implementation of the alignment, the month-day clamp and the exclusivity
   * rules — L-004's shape on arithmetic the spec spends four ACs on.
   *
   * It writes nothing, makes **zero AI calls** (AC-20, AC-32), and the collection
   * the resulting date lands in is *not* returned: the client derives it from
   * `due_at`, because the server has no opinion about collections (ADR-009).
   */
  function repeatPreview(
    s: StoreState,
    userId: string,
    taskId: string,
    proposed: TaskChanges,
    nowMs: number,
  ): Record<string, unknown> {
    const row = s.tasks[taskId]
    if (row === undefined || row.user_id !== userId || row.deleted_at !== null) {
      throw notFound('unknown task id')
    }
    const zone = accountZone(s, userId)
    const refusal = (v: FieldViolation): Record<string, unknown> => ({
      due_at: row.due_at,
      due_all_day: row.due_all_day ?? false,
      created: false,
      moved: false,
      refusals: [{ code: refusalCode(v.reason), field: v.field, message: v.message }],
    })
    if (zone === null) return refusal({ ...zoneMissing })

    // the same validator the commit runs — `refusals` carries what a commit
    // WOULD refuse, so the surface can state the outcome without attempting it
    const ctx = plans(s, userId)
    const planned = planEdits(ctx, [{ task_id: taskId, changes: proposed }], { door: 'http' })
    if (!planned.ok) return refusal(planned.violation)

    const preview = previewRepeat(row, proposed, zone, nowMs)
    if (preview === null) {
      return refusal({
        reason: 'structural_field_not_settable',
        field: 'repeat_frequency',
        message: 'the repeat rule admits no date',
      })
    }
    return { ...preview, refusals: [] }
  }

  return (req, res) => {
    void route(req, res).catch((err: unknown) => {
      if (err instanceof ApiError) {
        json(res, err.status, err.body())
      } else {
        // never leak internals or stack traces
        json(res, 500, { error: { code: 'INTERNAL', message: 'internal error' } })
      }
    })
  }
}

const zoneMissing: FieldViolation = {
  reason: 'timezone_unknown',
  field: null,
  message: 'a date computation requires the account timezone',
}

/** The preview's `refusals[].code` — the wire codes the contract names. */
function refusalCode(reason: FieldViolation['reason']): string {
  switch (reason) {
    case 'until_and_count':
      return 'UNTIL_AND_COUNT'
    case 'end_before_due':
      return 'UNTIL_BEFORE_DUE'
    case 'timezone_unknown':
      return 'TIMEZONE_UNKNOWN'
    case 'clear_due_while_repeating':
      return 'CLEAR_DUE_WHILE_REPEATING'
    case 'length_exceeded':
      return 'LENGTH_EXCEEDED'
    default:
      return 'VALIDATION'
  }
}

/** Exported for tests / debugging: turns of a session in seq order. */
export { sessionTurns, TASK_CREATE_FIELDS, TASK_PATCH_FIELDS }

/** Re-exported so a caller that needs the zone refusal does not rebuild it. */
export { timezoneUnknown }
