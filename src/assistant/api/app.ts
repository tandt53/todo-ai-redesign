// createApp(deps): http.RequestListener — routing, auth, validation (platform
// doc app-factory pattern). No framework (ADR-001). Every endpoint shape comes
// from specs/assistant/api-contracts.md; entity shapes from data-model.md.
// Business logic lives in engine/; this file only parses, validates, routes,
// and writes the error envelope. Stack traces never reach clients.

import type { IncomingMessage, RequestListener, ServerResponse } from 'node:http'
import { randomUUID } from 'node:crypto'
import { ApiError, notFound, unauthenticated, validation } from './errors.ts'
import type { Clock } from './ports/clock.ts'
import { systemClock } from './ports/clock.ts'
import type { Interpreter } from './ports/interpreter.ts'
import type { Store } from './store/store.ts'
import type { TaskChanges, TaskRow, TaskStatus, TurnSource, UndoVia } from './types.ts'
import { AccountQueue } from './engine/queue.ts'
import { serializeBoundary, serializeSession, serializeTask, sessionTurns } from './engine/serialize.ts'
import {
  closeSession,
  DEFAULT_IDLE_CLOSE_MS,
  findOpenSession,
  latestClosedSession,
  lazyIdleClose,
  nowIso,
} from './engine/sessions.ts'
import { performUndo } from './engine/undo.ts'
import { preflightInFlight, processTurn, type TurnRequest } from './engine/turns.ts'

export interface AppDeps {
  store: Store
  interpreter: Interpreter
  clock?: Clock
  /** server-owned idle close, lazily evaluated (ADR-004); default 180 s */
  idleCloseMs?: number
  uuid?: () => string
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
/**
 * The **write** vocabulary (ADR-009 §2, api-contracts.md § `status` on the
 * wire) — what a client, the interpreter or the app may SET. It is narrower
 * than `TaskStatus`, and deliberately: `'today'` is retired as a live value
 * (membership in Today is `due_at`, not `status`) and this is the write path,
 * which is where it is stopped from being minted again. `POST /tasks` and
 * `PATCH /tasks/{id}` answer `400 INVALID_INPUT`, `field: "status"`.
 *
 * **`TaskStatus` still has four members and must keep them.** `GET /tasks` may
 * return `'today'` for rows created before ADR-009, and `undo_snapshot` /
 * `ask_snapshot` / `post_apply` / `diff.old|new` hold it in records that undo
 * replays VERBATIM. Deleting the member would mean rewriting those records —
 * making the app report a diff the user never saw. A type has to be able to
 * express what the store already contains.
 */
const TASK_STATUSES: readonly string[] = ['inbox', 'done', 'archived']
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

// contract shapes: create is {id?, title, due_at?, priority?, status?} — id is
// optional and client-generated (offline local path, AC-25); PATCH may edit
// any mutable field
const TASK_CREATE_FIELDS = ['id', 'title', 'due_at', 'priority', 'status'] as const
const TASK_PATCH_FIELDS = ['title', 'due_at', 'reminder_at', 'priority', 'status'] as const

function taskChangesFrom(body: Body, allowed: readonly string[]): TaskChanges {
  rejectUnknownFields(body, allowed)
  const changes: TaskChanges = {}
  for (const [key, value] of Object.entries(body)) {
    switch (key) {
      case 'id':
        break // create-only (allowlisted there); format validated by the handler
      case 'title':
        if (typeof value !== 'string' || value.trim() === '') {
          throw validation('title must be a non-empty string', 'title')
        }
        changes.title = value
        break
      case 'due_at':
      case 'reminder_at':
      case 'priority':
        if (value !== null && typeof value !== 'string') {
          throw validation(`${key} must be a string or null`, key)
        }
        changes[key] = value as string | null
        break
      case 'status':
        if (typeof value !== 'string' || !TASK_STATUSES.includes(value)) {
          throw validation(`status must be one of ${TASK_STATUSES.join(', ')}`, 'status')
        }
        changes.status = value as TaskStatus
        break
    }
  }
  return changes
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

  async function route(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', 'http://localhost')
    const path = url.pathname.replace(/\/+$/, '') || '/'
    const method = req.method ?? 'GET'

    // auth stub (ADR-001): X-User-Id identifies the account; missing/empty → 401
    const userHeader = req.headers['x-user-id']
    const userId = (Array.isArray(userHeader) ? userHeader[0] : userHeader)?.trim() ?? ''
    if (userId === '') throw unauthenticated()

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
            return { session: serializeSession(s, open), boundary: null }
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

    // ---- prototype task CRUD (zero AI calls — AC-18) ----
    if (path === '/tasks' && method === 'GET') {
      const tasks = store.read((s) =>
        Object.values(s.tasks)
          .filter((t) => t.user_id === userId && t.deleted_at === null)
          .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
          .map(serializeTask),
      )
      return json(res, 200, { tasks })
    }

    if (path === '/tasks' && method === 'POST') {
      const body = await readBody(req)
      const changes = taskChangesFrom(body, TASK_CREATE_FIELDS) // rejects unknown fields first
      const title = reqString(body, 'title')
      // optional client-generated id: the offline local path creates the task
      // locally under a real id and replays the create on reconnect (AC-25)
      const clientId = optUuid(body, 'id')
      const task = store.transact((s) => {
        const at = nowIso(clock)
        const taskId = clientId ?? uuid()
        if (s.tasks[taskId] !== undefined) {
          // a client replaying its own create treats this as already-synced
          throw new ApiError(409, 'TASK_ID_EXISTS', 'a task with this id already exists')
        }
        const row: TaskRow = {
          id: taskId,
          user_id: userId,
          title,
          due_at: changes.due_at ?? null,
          reminder_at: null,
          priority: changes.priority ?? null,
          status: changes.status ?? 'inbox',
          created_at: at,
          updated_at: at,
          deleted_at: null,
        }
        s.tasks[row.id] = row
        return serializeTask(row)
      })
      return json(res, 201, { task })
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
        const task = store.transact((s) => {
          const cur = s.tasks[taskId]
          if (cur === undefined || cur.user_id !== userId || cur.deleted_at !== null) {
            throw notFound('unknown task id')
          }
          Object.assign(cur, changes)
          cur.updated_at = nowIso(clock)
          return serializeTask(cur)
        })
        return json(res, 200, { task })
      }
      const task = store.transact((s) => {
        const cur = s.tasks[taskId]
        if (cur === undefined || cur.user_id !== userId || cur.deleted_at !== null) {
          throw notFound('unknown task id')
        }
        cur.deleted_at = nowIso(clock) // soft delete
        cur.updated_at = cur.deleted_at
        return serializeTask(cur)
      })
      return json(res, 200, { task })
    }

    throw notFound(`no route: ${method} ${path}`)
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

/** Exported for tests / debugging: turns of a session in seq order. */
export { sessionTurns }
