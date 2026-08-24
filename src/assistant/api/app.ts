// createApp(deps): http.RequestListener — routing, auth, validation (platform
// doc app-factory pattern). No framework (ADR-001). Every endpoint shape comes
// from docs/specs/assistant/api-contracts.md; entity shapes from data-model.md.
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
import { ApiError, conflict, notFound, unauthenticated, validation } from './errors.ts'
import {
  aggregate,
  buildUsageRow,
  priceTableFromEnv,
  type AiUsageRow,
  type Bucket,
  type ModelUsage,
} from './ai/usage.ts'
import {
  hashPassword,
  hashToken,
  isPlausibleEmail,
  mintToken,
  normalizeEmail,
  passwordComplaint,
  tokenExpiryIso,
  verifyPassword,
} from './auth.ts'
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
  /**
   * Whether a bare `X-User-Id` header still identifies an account (UC-22).
   *
   * Default `true`, and that default is a statement about where the product is,
   * not an oversight: every existing test, the QA e2e harness, and the web
   * client's `?qaUser=` door identify this way, and no client has a sign-in
   * screen yet. Registration and sign-in are real underneath it — a bearer
   * token always wins when one is presented. Flip this to `false` in one place
   * the day a client can sign in, and the header door closes for good.
   */
  allowHeaderIdentity?: boolean
  /**
   * USD per million tokens, keyed `provider/model`. Defaults to `AI_PRICES` in
   * the environment. A model absent from the table records tokens with a null
   * cost rather than a guessed one.
   */
  prices?: Record<string, { input?: number; output?: number; cached_input?: number; per_minute?: number; per_million_chars?: number }>
  /**
   * Handed the app's AI-turn sink at construction, so a model-backed interpreter
   * built OUTSIDE the app can report into it. The app cannot build the
   * interpreter itself: the interpreter needs the store, and the store is one of
   * the app's own dependencies.
   */
  onAiTurn?: (sink: (userId: string, telemetry: {
    provider: string; model: string
    usage: { input_tokens: number; cached_input_tokens: number; output_tokens: number }
    rounds: number; toolCalls: number; outcome: string
    reply: { message: string; speech: string } | null
    refusal?: string | null
    latencyMs?: number; retries?: number; fellBack?: boolean
    toolsUsed?: string[]; transcriptChars?: number
  }) => void) => void
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
  'sort_order',
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
  'list_id',
  'sort_order',
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
  const allowHeaderIdentity = deps.allowHeaderIdentity ?? true
  const prices = deps.prices ?? priceTableFromEnv()

  /**
   * What the model said and what it cost, for the turn currently being handled.
   *
   * The `Interpreter` port returns an `Interpretation` and nothing else, and
   * widening that port would touch the fixture stub and every test that builds
   * one. Instead the model interpreter reports through a callback, which lands
   * here, and the turn handler picks it up. One turn at a time per account is
   * already guaranteed by the FIFO queue (AC-10), so a single slot is safe.
   */
  const lastTurn = new Map<string, { message: string; speech: string } | null>()

  /**
   * The AI interpreter's report for the turn just handled: record what it cost,
   * and hold its two sentences for the turn handler to attach.
   *
   * A single slot per account is safe because the FIFO queue already runs one
   * turn at a time per account (AC-10) - the same guarantee the turn engine
   * relies on for dedupe.
   */
  const onAiTurn = (aiUserId: string, t: {
    provider: string; model: string
    usage: { input_tokens: number; cached_input_tokens: number; output_tokens: number }
    rounds: number; toolCalls: number; outcome: string
    reply: { message: string; speech: string } | null
    refusal?: string | null
    latencyMs?: number; retries?: number; fellBack?: boolean
    toolsUsed?: string[]; transcriptChars?: number
  }): void => {
    recordAiUsage({
      userId: aiUserId, provider: t.provider, model: t.model,
      usage: t.usage, rounds: t.rounds, toolCalls: t.toolCalls, outcome: t.outcome,
      latencyMs: t.latencyMs, retries: t.retries, fellBack: t.fellBack,
      toolsUsed: t.toolsUsed, refusalReason: t.refusal ?? null,
      transcriptChars: t.transcriptChars,
    })
    // Only a reply that survived every check is offered to the client; a refused
    // turn's sentence describes something that did not happen.
    lastTurn.set(aiUserId, t.outcome === 'final' ? t.reply : null)
  }
  deps.onAiTurn?.(onAiTurn)
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
    // ---- UC-22: register and sign in, the two routes reachable with no identity --
    if (path === '/auth/register' && method === 'POST') {
      return json(res, 201, await register(await readBody(req)))
    }
    if (path === '/auth/login' && method === 'POST') {
      return json(res, 200, await login(await readBody(req)))
    }

    const userId = identify(header)
    if (userId === '') throw unauthenticated()

    if (path === '/auth/me' && method === 'GET') {
      return json(res, 200, { user: publicUser(userId) })
    }
    if (path === '/usage' && method === 'GET') {
      const bucketRaw = url.searchParams.get('bucket') ?? 'day'
      if (!['day', 'week', 'month', 'total'].includes(bucketRaw)) {
        throw validation('bucket must be day, week, month or total', 'bucket')
      }
      const byRaw = url.searchParams.get('by') ?? 'none'
      if (!['model', 'provider', 'user', 'role', 'none'].includes(byRaw)) {
        throw validation('by must be model, provider, user, role or none', 'by')
      }
      const from = url.searchParams.get('from') ?? undefined
      const to = url.searchParams.get('to') ?? undefined
      for (const [name, value] of [['from', from], ['to', to]] as const) {
        if (value !== undefined && Number.isNaN(Date.parse(value))) {
          throw validation(`${name} must be an ISO 8601 instant`, name)
        }
      }
      // An account reads its OWN usage. `by=user` groups that one account's rows
      // and is there for the day this serves more than one person; it is not a
      // door onto anybody else's spend.
      const mine = store.read((st) =>
        Object.values(st.ai_usage ?? {}).filter((r) => r.user_id === userId),
      )
      return json(res, 200, {
        groups: aggregate(mine, {
          bucket: bucketRaw as Bucket,
          by: byRaw as 'model' | 'provider' | 'user' | 'role' | 'none',
          ...(from === undefined ? {} : { from }),
          ...(to === undefined ? {} : { to }),
        }),
      })
    }

    if (path === '/auth/logout' && method === 'POST') {
      const presented = bearer(header)
      if (presented !== null) store.transact((st) => { delete st.auth_tokens?.[hashToken(presented)] })
      return json(res, 200, { signed_out: true })
    }

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
      // The model's two sentences arrive by callback, not through the
      // `Interpreter` port, so they are attached here: onto the stored row, so a
      // session read replays them, and onto the response, so this turn carries
      // them without a second request.
      const reply = lastTurn.get(userId) ?? null
      lastTurn.delete(userId)
      if (reply !== null && out.turn !== null) {
        const turnId = out.turn.id
        store.transact((st) => {
          const row = st.turns[turnId]
          if (row !== undefined) row.reply = reply
        })
        out.turn.reply = reply
      }
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

    // ---- GET /tasks/deleted — new (F-006 AC-5, AC-12, AC-14) ----
    if (path === '/tasks/deleted' && method === 'GET') {
      const out = getDeletedTasks(store, userId, clock)
      return json(res, 200, out)
    }

    // ---- DELETE /tasks/deleted — empty the trash (F-006 AC-17) ----
    if (path === '/tasks/deleted' && method === 'DELETE') {
      const body = await readBody(req)
      rejectUnknownFields(body, ['task_ids'])
      const taskIds = body.task_ids
      if (!Array.isArray(taskIds)) {
        throw validation('task_ids must be an array', 'task_ids')
      }
      for (const id of taskIds) {
        if (typeof id !== 'string' || !UUID_RE.test(id)) {
          throw validation('every entry in task_ids must be a uuid', 'task_ids')
        }
      }
      const out = store.transact((s) => {
        const removed: string[] = []
        const pinned = new Set(taskIds as string[])
        for (const id of pinned) {
          const row = s.tasks[id]
          // Only remove rows belonging to this user that are still deleted
          if (row === undefined || row.user_id !== userId || row.deleted_at === null) continue
          removed.push(row.id)
          delete s.tasks[id]
        }
        return { removed }
      })
      return json(res, 200, out)
    }

    // ---- DELETE /tasks/deleted/{id} — permanent delete one entry (F-006 AC-11) ----
    const deletedEntryMatch = path.match(/^\/tasks\/deleted\/([^/]+)$/)
    if (method === 'DELETE' && deletedEntryMatch !== null) {
      const taskId = deletedEntryMatch[1]!
      const out = store.transact((s) => {
        const row = s.tasks[taskId]
        if (row === undefined || row.user_id !== userId || row.deleted_at === null) {
          throw notFound('unknown task id')
        }
        // Resolve the entry's membership: all rows sharing the same gesture id
        const gesture = row.delete_gesture_id ?? null
        const members = gesture === null
          ? [row]
          : Object.values(s.tasks).filter(
              (t) => t.user_id === userId && t.deleted_at !== null && t.delete_gesture_id === gesture,
            )
        const removed: string[] = []
        for (const member of members) {
          // Only remove rows still deleted at the moment of the act
          if (member.deleted_at === null) continue
          removed.push(member.id)
          delete s.tasks[member.id]
        }
        return { removed }
      })
      return json(res, 200, out)
    }

    // ---- POST /tasks/{id}/restore — (AC-41, ADR-012, F-006 AC-9) ----
    const restoreMatch = path.match(/^\/tasks\/([^/]+)\/restore$/)
    if (method === 'POST' && restoreMatch !== null) {
      const taskId = restoreMatch[1]!
      const body = await readBody(req)
      rejectUnknownFields(body, [])
      const out = store.transact((s) => restoreTask(s, userId, taskId, nowIso(clock), view, clock.now()))
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
          // F-008 AC-13: step constraint for list_id. F-008 AC-11: list existence.
          // These checks live here (not in planEdits) so the HTTP path can throw
          // the contract's 400/404 directly — the turn path resolves lists by name
          // and handles the constraints in its own code path.
          if (changes.list_id !== undefined && changes.list_id !== null) {
            const lists = s.lists ?? {}
            const list = lists[changes.list_id as string]
            if (list === undefined || list.user_id !== userId) {
              throw notFound('unknown list_id')
            }
          }
          if (changes.list_id !== undefined && (cur.parent_id ?? null) !== null) {
            throw validation("A step's filing follows its parent", 'list_id')
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

    // ---- LIST CRUD (F-008) ----

    // ---- POST /lists (AC-1, AC-2, AC-3, AC-23, AC-24) ----
    if (path === '/lists' && method === 'POST') {
      const body = await readBody(req)
      rejectUnknownFields(body, ['name', 'color'])
      const nameRaw = body.name
      if (typeof nameRaw !== 'string' || nameRaw.trim() === '') {
        throw validation('name is required and must be a non-empty string', 'name')
      }
      const name = nameRaw.trim()
      if (name.length > 100) {
        throw validation('name exceeds 100 characters', 'name')
      }
      let color = 0
      if (body.color !== undefined) {
        if (typeof body.color !== 'number' || !Number.isInteger(body.color) || body.color < 0 || body.color > 6) {
          throw validation('color must be an integer 0–6', 'color')
        }
        color = body.color
      }
      const out = store.transact((s) => {
        const lists = s.lists ?? (s.lists = {})
        const userLists = Object.values(lists).filter((l) => l.user_id === userId)
        // AC-23: 50 list limit
        if (userLists.length >= 50) {
          throw new ApiError(409, 'LIST_LIMIT_REACHED', 'user already has 50 lists')
        }
        // AC-3: duplicate name check (case-insensitive)
        const nameLower = name.toLowerCase()
        if (userLists.some((l) => l.name.toLowerCase() === nameLower)) {
          throw new ApiError(409, 'DUPLICATE_NAME', `a list with this name already exists`)
        }
        // position: max + 1024, or 1024 if none
        const maxPos = userLists.length > 0 ? Math.max(...userLists.map((l) => l.position)) : 0
        const at = nowIso(clock)
        const id = uuid()
        const row = {
          id,
          user_id: userId,
          name,
          color,
          position: maxPos + 1024,
          created_at: at,
          updated_at: at,
        }
        lists[id] = row
        // task_count is computed: tasks where list_id = this list and not deleted and not step
        return {
          list: {
            ...row,
            task_count: 0,
          },
        }
      })
      return json(res, 201, out)
    }

    // ---- GET /lists (AC-14) ----
    if (path === '/lists' && method === 'GET') {
      const out = store.read((s) => {
        const lists = s.lists ?? {}
        const userLists = Object.values(lists)
          .filter((l) => l.user_id === userId)
          .sort((a, b) => a.position - b.position)
        return {
          lists: userLists.map((l) => ({
            ...l,
            task_count: Object.values(s.tasks).filter(
              (t) =>
                t.user_id === userId &&
                t.deleted_at === null &&
                (t.parent_id ?? null) === null &&
                (t.list_id ?? null) === l.id,
            ).length,
          })),
        }
      })
      return json(res, 200, out)
    }

    // ---- PATCH /lists/{id} (AC-4, AC-5) ----
    const listMatch = path.match(/^\/lists\/([^/]+)$/)
    if (listMatch !== null && method === 'PATCH') {
      const listId = listMatch[1]!
      const body = await readBody(req)
      rejectUnknownFields(body, ['name', 'color', 'position'])
      if (Object.keys(body).length === 0) {
        throw validation('at least one field is required')
      }
      const out = store.transact((s) => {
        const lists = s.lists ?? {}
        const list = lists[listId]
        if (list === undefined || list.user_id !== userId) {
          throw notFound('unknown list id')
        }
        // name validation
        if (body.name !== undefined) {
          if (typeof body.name !== 'string' || (body.name as string).trim() === '') {
            throw validation('name must be a non-empty string', 'name')
          }
          const newName = (body.name as string).trim()
          if (newName.length > 100) {
            throw validation('name exceeds 100 characters', 'name')
          }
          const nameLower = newName.toLowerCase()
          const dup = Object.values(lists).find(
            (l) => l.user_id === userId && l.id !== listId && l.name.toLowerCase() === nameLower,
          )
          if (dup !== undefined) {
            throw new ApiError(409, 'DUPLICATE_NAME', 'a list with this name already exists')
          }
          list.name = newName
        }
        // color validation
        if (body.color !== undefined) {
          if (typeof body.color !== 'number' || !Number.isInteger(body.color) || body.color < 0 || body.color > 6) {
            throw validation('color must be an integer 0–6', 'color')
          }
          list.color = body.color
        }
        // position
        if (body.position !== undefined) {
          if (typeof body.position !== 'number' || !Number.isInteger(body.position)) {
            throw validation('position must be an integer', 'position')
          }
          list.position = body.position
        }
        list.updated_at = nowIso(clock)
        return {
          list: {
            ...list,
            task_count: Object.values(s.tasks).filter(
              (t) =>
                t.user_id === userId &&
                t.deleted_at === null &&
                (t.parent_id ?? null) === null &&
                (t.list_id ?? null) === list.id,
            ).length,
          },
        }
      })
      return json(res, 200, out)
    }

    // ---- DELETE /lists/{id} (AC-6, AC-7, AC-9) ----
    if (listMatch !== null && method === 'DELETE') {
      const listId = listMatch[1]!
      const body = await readBody(req)
      rejectUnknownFields(body, ['confirm'])
      const out = store.transact((s) => {
        const lists = s.lists ?? {}
        const list = lists[listId]
        if (list === undefined || list.user_id !== userId) {
          throw notFound('unknown list id')
        }
        // count tasks in the list: non-deleted, non-step rows
        const tasksInList = Object.values(s.tasks).filter(
          (t) =>
            t.user_id === userId &&
            t.deleted_at === null &&
            (t.parent_id ?? null) === null &&
            (t.list_id ?? null) === listId,
        )
        const count = tasksInList.length
        if (count > 0 && body.confirm !== true) {
          throw new ApiError(409, 'LIST_NOT_EMPTY', 'list has tasks and confirm is missing or false', {
            detail: { task_count: count, list_name: list.name },
          })
        }
        // AC-7: set list_id = null on every task in the list (same transaction)
        let tasksMoved = 0
        if (count > 0) {
          const at = nowIso(clock)
          // Unfile ALL tasks in the list (not just non-step), because a step's
          // list_id should follow parent, but we clean up any stale refs too
          for (const t of Object.values(s.tasks)) {
            if (t.user_id === userId && (t.list_id ?? null) === listId && t.deleted_at === null) {
              t.list_id = null
              t.updated_at = at
              tasksMoved += 1
            }
          }
        }
        // AC-9: permanent delete — no soft delete, no trash
        delete lists[listId]
        return { deleted: true, tasks_moved: tasksMoved }
      })
      return json(res, 200, out)
    }

    throw notFound(`no route: ${method} ${path}`)
  }

  // -------------------------------------------------------------------------
  /**
   * Append one row to the usage ledger (F-007). Called once per model-backed
   * turn, with what the provider reported - never with an estimate.
   *
   * Cost is resolved HERE, at call time, and stored. Resolving it at query time
   * would silently rewrite history every time a price changed.
   */
  function recordAiUsage(input: {
    userId: string
    provider: string
    model: string
    usage: ModelUsage
    rounds: number
    toolCalls: number
    outcome: string
    latencyMs?: number
    retries?: number
    fellBack?: boolean
    toolsUsed?: readonly string[]
    refusalReason?: string | null
    transcriptChars?: number
  }): AiUsageRow {
    const row = buildUsageRow({ ...input, id: uuid(), at: nowIso(clock), prices })
    store.transact((st) => {
      st.ai_usage ??= {}
      st.ai_usage[row.id] = row
    })
    return row
  }

  // ---- UC-22: registration, sign-in, and who the request is ----------------

  const bearer = (header: (n: string) => string | undefined): string | null => {
    const raw = header('authorization')
    if (raw === undefined) return null
    const match = /^Bearer[ ]+(.+)$/i.exec(raw)
    return match === null ? null : match[1]!.trim()
  }

  /**
   * Who the request is. A bearer token always wins; the `X-User-Id` header is
   * the pre-auth door and answers only when no token was presented AND
   * `allowHeaderIdentity` is on.
   *
   * A presented-but-invalid token is an error, never a silent fall-through to
   * the header. Falling through would mean a client whose session expired
   * quietly keeps working under whatever id it also happens to send — which is
   * the failure that makes an expiry meaningless.
   */
  const identify = (header: (n: string) => string | undefined): string => {
    const token = bearer(header)
    if (token !== null) {
      const row = store.read((st) => st.auth_tokens?.[hashToken(token)])
      if (row === undefined) throw new ApiError(401, 'INVALID_TOKEN', 'token is not valid')
      if (Date.parse(row.expires_at) <= clock.now()) {
        store.transact((st) => { delete st.auth_tokens?.[hashToken(token)] })
        throw new ApiError(401, 'TOKEN_EXPIRED', 'token has expired; sign in again')
      }
      return row.user_id
    }
    if (!allowHeaderIdentity) throw unauthenticated()
    return header('x-user-id') ?? ''
  }

  const publicUser = (userId: string): Record<string, unknown> => {
    const row = store.read((st) => st.users?.[userId])
    // An id that reached here through the header door has no user row, and that
    // is not an error while that door is open: it is an account with no
    // credentials yet. Report what is true rather than inventing an email.
    if (row === undefined) return { id: userId, email: null, created_at: null, registered: false }
    return { id: row.id, email: row.email, created_at: row.created_at, registered: true }
  }

  const credentials = (body: Body): { email: string; password: string } => {
    rejectUnknownFields(body, ['email', 'password'])
    const rawEmail = body.email
    if (typeof rawEmail !== 'string' || rawEmail.trim() === '') {
      throw validation('email is required', 'email')
    }
    const email = normalizeEmail(rawEmail)
    if (!isPlausibleEmail(email)) throw validation('email is not a valid address', 'email')
    const password = body.password
    if (typeof password !== 'string') throw validation('password is required', 'password')
    return { email, password }
  }

  const issue = (userId: string): Record<string, unknown> => {
    const { token, hash } = mintToken()
    const row = {
      token_hash: hash,
      user_id: userId,
      created_at: nowIso(clock),
      expires_at: tokenExpiryIso(clock.now()),
    }
    store.transact((st) => {
      st.auth_tokens ??= {}
      st.auth_tokens[hash] = row
    })
    return { token, expires_at: row.expires_at }
  }

  async function register(body: Body): Promise<Record<string, unknown>> {
    const { email, password } = credentials(body)
    const complaint = passwordComplaint(password)
    if (complaint !== null) throw validation(complaint, 'password')

    // Hash BEFORE the transaction: scrypt takes ~60 ms, and the store's
    // transact() holds the whole state for the length of its callback.
    const passwordHash = hashPassword(password)
    const id = uuid()
    const at = nowIso(clock)
    const created = store.transact((st) => {
      st.users ??= {}
      const taken = Object.values(st.users).some((u) => u.email === email)
      if (taken) throw conflict('EMAIL_TAKEN', 'an account with that email already exists', { field: 'email' })
      const row = { id, email, password_hash: passwordHash, created_at: at, updated_at: at }
      st.users[id] = row
      return row
    })
    return { user: { id: created.id, email: created.email, created_at: created.created_at, registered: true }, ...issue(created.id) }
  }

  async function login(body: Body): Promise<Record<string, unknown>> {
    const { email, password } = credentials(body)
    const row = store.read((st) => Object.values(st.users ?? {}).find((u) => u.email === email))
    // One error for "no such account" and for "wrong password", deliberately:
    // two distinguishable answers turn this endpoint into a way to ask whether
    // an address is registered.
    const invalid = (): ApiError => new ApiError(401, 'INVALID_CREDENTIALS', 'email or password is incorrect')
    if (row === undefined) {
      // Still spend the time a real verification costs, so the response time
      // does not answer the question the error message refuses to.
      verifyPassword(password, 'scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAA')
      throw invalid()
    }
    if (!verifyPassword(password, row.password_hash)) throw invalid()
    return { user: { id: row.id, email: row.email, created_at: row.created_at, registered: true }, ...issue(row.id) }
  }

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
   * `GET /tasks/deleted` (F-006 AC-5, AC-12, AC-14). The account's deleted
   * rows, grouped into entries by `delete_gesture_id`, server-side.
   *
   * **ADR-017: the surface's call purges expired rows.** When called via HTTP
   * (the surface's caller), rows whose `deleted_at + 30 days` is past are
   * excluded from the response and hard-removed from the store in the same
   * transaction. The turn path's inline read evaluates the same predicate to
   * exclude expired rows but does not remove them — a question purges nothing.
   */
  function getDeletedTasks(
    st: Store,
    userId: string,
    clk: Clock,
  ): Record<string, unknown> {
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000
    const nowMs = clk.now()

    // Check if any row is expired using a read first (ADR-017 optimization:
    // avoid a full snapshot write when the trash holds nothing to purge).
    const hasExpired = st.read((s) =>
      Object.values(s.tasks).some(
        (t) =>
          t.user_id === userId &&
          t.deleted_at !== null &&
          Date.parse(t.deleted_at) + THIRTY_DAYS_MS <= nowMs,
      ),
    )

    if (hasExpired) {
      // Enter transact to purge expired rows and read in one atomic step
      return st.transact((s) => {
        // Purge expired rows
        for (const t of Object.values(s.tasks)) {
          if (
            t.user_id === userId &&
            t.deleted_at !== null &&
            Date.parse(t.deleted_at) + THIRTY_DAYS_MS <= nowMs
          ) {
            delete s.tasks[t.id]
          }
        }
        return buildDeletedResponse(s, userId, nowMs, THIRTY_DAYS_MS)
      })
    }

    // No expired rows — pure read
    return st.read((s) => buildDeletedResponse(s, userId, nowMs, THIRTY_DAYS_MS))
  }

  function buildDeletedResponse(
    s: StoreState,
    userId: string,
    nowMs: number,
    thirtyDaysMs: number,
  ): Record<string, unknown> {
    const userDeleted = Object.values(s.tasks).filter(
      (t) =>
        t.user_id === userId &&
        t.deleted_at !== null &&
        Date.parse(t.deleted_at) + thirtyDaysMs > nowMs,
    )

    // Group by delete_gesture_id (or singleton id for null-gesture rows)
    const groups = new Map<string, TaskRow[]>()
    for (const t of userDeleted) {
      const key = t.delete_gesture_id ?? t.id
      const group = groups.get(key) ?? []
      group.push(t)
      groups.set(key, group)
    }

    // Build entries, ordered by deleted_at desc, then addressing_id asc
    const entries: Record<string, unknown>[] = []
    for (const [, group] of groups) {
      const deletedAt = group[0]!.deleted_at!
      const expiresAt = new Date(Date.parse(deletedAt) + thirtyDaysMs).toISOString()
      const tasks = group
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((t) => ({
          id: t.id,
          title: t.title,
          status: t.status,
          parent_id: (t.parent_id ?? null),
        }))

      // Parent resolution for steps (AC-7)
      const hasStep = tasks.some((t) => t.parent_id !== null)
      let parent: Record<string, unknown> | undefined
      if (hasStep) {
        const stepRow = group.find((t) => (t.parent_id ?? null) !== null)
        if (stepRow !== undefined) {
          const parentId = stepRow.parent_id!
          const parentRow = s.tasks[parentId]
          if (parentRow === undefined) {
            parent = { id: parentId, title: '(deleted)', state: 'gone' }
          } else if (parentRow.deleted_at !== null) {
            parent = { id: parentId, title: parentRow.title, state: 'deleted' }
          } else {
            parent = { id: parentId, title: parentRow.title, state: 'live' }
          }
        }
      }

      const entry: Record<string, unknown> = {
        deleted_at: deletedAt,
        expires_at: expiresAt,
        tasks,
      }
      if (parent !== undefined) entry.parent = parent

      entries.push(entry)
    }

    // Sort entries by deleted_at desc
    entries.sort((a, b) =>
      (b.deleted_at as string).localeCompare(a.deleted_at as string),
    )

    return { entries }
  }

  /**
   * `POST /tasks/{id}/restore` (AC-41, ADR-012, F-006 AC-9).
   *
   * Five outcomes (F-006 api-contracts):
   *   (a) Restored — 200 `{ task, changed, restored: true }`
   *   (b) Already live — 200 `{ task, changed: [], restored: false }`
   *   (c) Refused/expired — 409 RESTORE_EXPIRED
   *   (d) Refused/parent gone — 409 RESTORE_PARENT_GONE
   *   (e) Unknown — 404 NOT_FOUND
   *
   * ADR-012 amendment: the restore also clears `series_ended_at` on rows of the
   * restored series whose `series_ended_at` equals the gesture's `deleted_at`.
   */
  function restoreTask(
    s: StoreState,
    userId: string,
    taskId: string,
    at: string,
    mkView: (s: StoreState, userId: string) => TaskView,
    nowMs: number,
  ): Record<string, unknown> {
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000
    const row = s.tasks[taskId]
    // (e) Ownership check — another account's id or unknown id
    if (row === undefined || row.user_id !== userId) throw notFound('unknown task id')
    const v = mkView(s, userId)
    // (b) Already live — a stated no-op, never 404, never 409
    if (row.deleted_at === null) {
      return { task: serializeTask(row, v), changed: [], restored: false }
    }

    // (c) Expiry check on the addressed row
    const deletedAtMs = Date.parse(row.deleted_at)
    if (deletedAtMs + THIRTY_DAYS_MS <= nowMs) {
      throw new ApiError(409, 'RESTORE_EXPIRED', 'this entry has expired and can no longer be restored', {
        detail: {
          task_id: taskId,
          expired_at: new Date(deletedAtMs + THIRTY_DAYS_MS).toISOString(),
        },
      })
    }

    const gesture = row.delete_gesture_id ?? null
    const members =
      gesture === null
        ? [row]
        : Object.values(s.tasks).filter(
            (t) =>
              t.user_id === userId && t.deleted_at !== null && t.delete_gesture_id === gesture,
          )

    // Assemble the membership set, then apply the parent invariant
    const set = new Map(members.map((m) => [m.id, m]))
    for (const member of members) {
      const parentId = member.parent_id ?? null
      if (parentId === null) continue
      const parent = s.tasks[parentId]
      if (parent === undefined || parent.user_id !== userId) {
        // (d) Parent's row has been hard-removed from the store
        throw new ApiError(409, 'RESTORE_PARENT_GONE', "this step's parent has been permanently deleted", {
          detail: { task_id: member.id, parent_id: parentId },
        })
      }
      // (c) Expiry check on the required parent — AC-12 reachability limit
      if (parent.deleted_at !== null) {
        const parentDeletedAtMs = Date.parse(parent.deleted_at)
        if (parentDeletedAtMs + THIRTY_DAYS_MS <= nowMs) {
          throw new ApiError(409, 'RESTORE_EXPIRED', 'this entry has expired and can no longer be restored', {
            detail: {
              task_id: member.id,
              expired_at: new Date(parentDeletedAtMs + THIRTY_DAYS_MS).toISOString(),
            },
          })
        }
        set.set(parent.id, parent)
      }
    }

    const restored: TaskRow[] = []
    const gestureDeletedAt = row.deleted_at // capture before clearing
    for (const member of set.values()) {
      if (member.deleted_at === null) continue
      member.deleted_at = null
      member.updated_at = at
      restored.push(member)
    }

    // ADR-012 amendment: clear series_ended_at on rows of the restored series
    // whose series_ended_at equals the gesture's shared deleted_at (L-026).
    //
    // The clearing fires ONLY when the gesture being restored is the gesture
    // that WROTE series_ended_at. plan.ts's series-delete writes
    // series_ended_at on ALL rows of the series — including LIVE (done) rows
    // it does not trash. A live (non-deleted) row that carries
    // series_ended_at === gestureDeletedAt and is NOT in the membership set
    // proves that this gesture wrote series_ended_at: no other mechanism writes
    // that value at that timestamp on a live row.
    //
    // An individually-deleted row may acquire series_ended_at from a DIFFERENT
    // series-delete gesture. When the two gestures happen at the same clock
    // instant (FakeClock in tests), the timestamps match, but the non-member
    // rows visible to the check are all TRASHED (they were trashed by the other
    // gesture, not by this one). A trashed non-member does not prove this
    // gesture wrote series_ended_at — it might have been written by the gesture
    // that trashed it. So the check requires a LIVE non-member, which can only
    // exist if planDelete(scope=series) wrote series_ended_at on a done row.
    const restoredSeriesIds = new Set<string>()
    for (const m of members) {
      const sid = m.series_id ?? null
      if (sid !== null) restoredSeriesIds.add(sid)
    }
    if (restoredSeriesIds.size > 0) {
      let seriesEndedByThisGesture = false
      for (const t of Object.values(s.tasks)) {
        if (t.user_id !== userId) continue
        const sid = t.series_id ?? null
        if (sid === null || !restoredSeriesIds.has(sid)) continue
        if (set.has(t.id)) continue // skip membership rows
        // A LIVE non-member row with series_ended_at === gestureDeletedAt
        // is conclusive evidence this gesture was a series delete.
        if (t.deleted_at === null && (t.series_ended_at ?? null) === gestureDeletedAt) {
          seriesEndedByThisGesture = true
          break
        }
      }
      if (seriesEndedByThisGesture) {
        for (const t of Object.values(s.tasks)) {
          if (t.user_id !== userId) continue
          const sid = t.series_id ?? null
          if (sid === null || !restoredSeriesIds.has(sid)) continue
          if ((t.series_ended_at ?? null) === gestureDeletedAt) {
            t.series_ended_at = null
            t.updated_at = at
            if (!set.has(t.id)) restored.push(t)
          }
        }
      }
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
