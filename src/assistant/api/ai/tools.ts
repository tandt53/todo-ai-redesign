// The tools the model may call while it works out what the user meant (F-007).
//
// Owner decision 2026-08-21 § "an agentic loop, not a pipeline": the backend
// exposes tools and the AI drives — it asks, reads the answer, and decides
// whether to ask again. How many rounds that takes depends on the question.
//
// **Every tool here is a READ.** The same decision places the user's confirm
// before the backend acts, so a model that could write during the loop would
// make the confirm decorative. Writes stay where they are: the engine's apply
// path, after the turn resolves.
//
// **Everything speaks handles, never uuids** (ADR-002). A tool answer that
// leaked a uuid would put one in the model's context, and from there into a
// sentence. Steps are addressed as `t3.s2` — the parent's handle and the step's
// position — because a step has no handle of its own (F-005 AC-35).

import type { Clock } from '../ports/clock.ts'
import type { StoreState } from '../store/store.ts'
import type { TaskRow } from '../types.ts'

export interface ToolContext {
  read: <T>(fn: (state: StoreState) => T) => T
  userId: string
  /** handle → task id, built by the turn engine for this turn only */
  handleMap: Record<string, string>
  clock: Clock
  /** the account's IANA zone, or null when it has never been established */
  zone: string | null
}

export interface ToolCall {
  name: string
  input: Record<string, unknown>
}

export interface ToolResult {
  /** what the model reads back. Errors are results, not exceptions: a model that
   *  asked for a handle that does not exist should be told so and allowed to
   *  recover, not have its turn fail. */
  content: unknown
  is_error: boolean
}

/**
 * The catalogue, in the shape the Anthropic Messages API takes. It is data, so
 * the same value defines what the model may call and what `runTool` accepts —
 * a schema and an executor that disagree is a whole class of bug this avoids.
 */
export const TOOL_SCHEMAS = [
  {
    name: 'search_tasks',
    description:
      'Find the user\'s tasks by words in the title or note. Use this when the user names a task you cannot already see in the context, or when they describe one loosely. Returns handles you can then act on.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'words to look for, case-insensitive' },
        include_done: { type: 'boolean', description: 'include completed tasks (default false)' },
        limit: { type: 'integer', description: 'at most this many results (default 20, max 50)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_task',
    description:
      'Read one task in full, including its steps, its repeat rule and which list it is filed in. Use this before answering a question about a specific task, and before editing a field you have not seen.',
    input_schema: {
      type: 'object' as const,
      properties: {
        handle: { type: 'string', description: 'a task handle such as t3' },
      },
      required: ['handle'],
    },
  },
  {
    name: 'list_lists',
    description: 'The user\'s personal lists, with how many live tasks each holds.',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'list_trash',
    description:
      'Tasks the user deleted in the last 30 days. Read-only: you may tell the user what is in the trash, but you may never target one of these for a change.',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'now',
    description:
      'The current date and time in the user\'s own timezone. Call this before resolving any relative date — "tomorrow", "next Friday", "tonight" — rather than assuming one.',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
] as const

export const TOOL_NAMES: readonly string[] = TOOL_SCHEMAS.map((t) => t.name)

const ok = (content: unknown): ToolResult => ({ content, is_error: false })
const err = (message: string): ToolResult => ({ content: { error: message }, is_error: true })

/** Reverse of the turn's handle map, so a row found by search can be named. */
function handleOf(map: Record<string, string>, id: string): string | null {
  for (const [handle, taskId] of Object.entries(map)) if (taskId === id) return handle
  return null
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

function liveTopLevel(state: StoreState, userId: string): TaskRow[] {
  return Object.values(state.tasks)
    .filter((t) => t.user_id === userId && t.deleted_at === null && (t.parent_id ?? null) === null)
    .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
}

export function runTool(ctx: ToolContext, call: ToolCall): ToolResult {
  switch (call.name) {
    case 'search_tasks': {
      const raw = call.input.query
      if (typeof raw !== 'string' || raw.trim() === '') return err('query is required')
      const needle = raw.trim().toLowerCase()
      const includeDone = call.input.include_done === true
      const limitRaw = call.input.limit
      const limit = typeof limitRaw === 'number' && Number.isInteger(limitRaw)
        ? Math.min(Math.max(limitRaw, 1), 50)
        : 20
      const hits = ctx.read((s) =>
        liveTopLevel(s, ctx.userId)
          .filter((t) => includeDone || t.status !== 'done')
          .filter(
            (t) =>
              t.title.toLowerCase().includes(needle) ||
              (t.note ?? '').toLowerCase().includes(needle),
          )
          .slice(0, limit)
          .map((t) => ({
            // A row outside this turn's handle map has no handle, and saying so
            // is better than minting one: the engine resolves targets through
            // that map, so an invented handle would resolve to nothing.
            handle: handleOf(ctx.handleMap, t.id),
            title: t.title,
            status: t.status,
            due_at: t.due_at,
            priority: t.priority ?? 'none',
          })),
      )
      return ok({ matches: hits, count: hits.length })
    }

    case 'get_task': {
      const handle = call.input.handle
      if (typeof handle !== 'string') return err('handle is required')
      const id = ctx.handleMap[handle]
      if (id === undefined) return err(`no such handle: ${handle}`)
      return ctx.read((s) => {
        const t = s.tasks[id]
        if (t === undefined || t.deleted_at !== null) return err(`no such handle: ${handle}`)
        const steps = Object.values(s.tasks)
          .filter((x) => x.parent_id === id && x.deleted_at === null)
          .sort((a, b) => (a.step_order ?? 0) - (b.step_order ?? 0))
          .map((x, i) => ({ handle: `${handle}.s${i + 1}`, title: x.title, done: x.status === 'done' }))
        const list = t.list_id === null || t.list_id === undefined ? null : s.lists?.[t.list_id]
        return ok({
          handle,
          title: t.title,
          note: t.note ?? null,
          status: t.status,
          due_at: t.due_at,
          due_all_day: t.due_all_day ?? null,
          reminder_at: t.reminder_at,
          priority: t.priority ?? 'none',
          list: list === undefined || list === null ? null : list.name,
          repeat: t.repeat_frequency ?? null,
          steps,
        })
      })
    }

    case 'list_lists': {
      return ctx.read((s) => {
        const lists = Object.values(s.lists ?? {})
          .filter((l) => l.user_id === ctx.userId)
          .map((l) => ({
            name: l.name,
            task_count: Object.values(s.tasks).filter(
              (t) =>
                t.user_id === ctx.userId &&
                t.deleted_at === null &&
                (t.list_id ?? null) === l.id &&
                t.status !== 'done',
            ).length,
          }))
        return ok({ lists, count: lists.length })
      })
    }

    case 'list_trash': {
      const nowMs = ctx.clock.now()
      return ctx.read((s) => {
        const rows = Object.values(s.tasks)
          .filter(
            (t) =>
              t.user_id === ctx.userId &&
              t.deleted_at !== null &&
              (t.parent_id ?? null) === null &&
              Date.parse(t.deleted_at) + THIRTY_DAYS_MS > nowMs,
          )
          .sort((a, b) => b.deleted_at!.localeCompare(a.deleted_at!))
          .map((t) => ({ title: t.title, deleted_at: t.deleted_at }))
        return ok({ deleted: rows, count: rows.length })
      })
    }

    case 'now': {
      const iso = new Date(ctx.clock.now()).toISOString()
      if (ctx.zone === null) {
        // Not an error: the account's zone is genuinely unknown until a client
        // reports one, and a model told "UTC" would silently resolve "tonight"
        // in the wrong place.
        return ok({ utc: iso, timezone: null, note: 'the account has no timezone yet — do not resolve a relative date' })
      }
      const local = new Intl.DateTimeFormat('en-CA', {
        timeZone: ctx.zone,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', weekday: 'long', hour12: false,
      }).format(new Date(ctx.clock.now()))
      return ok({ utc: iso, timezone: ctx.zone, local })
    }

    default:
      return err(`no such tool: ${call.name}`)
  }
}
