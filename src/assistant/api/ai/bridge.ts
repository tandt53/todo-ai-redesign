// From what the model said to what the engine will execute (F-007).
//
// The model returns free-form JSON under `respond.action`. The engine executes
// an `Interpretation`, a closed union. **Nothing may cross that gap unchecked.**
// A model that emits a `kind` nobody implemented, a handle that resolves to
// nothing, or a field the turn path is forbidden to write must be REFUSED here,
// where the answer is "I did not understand", rather than deeper in, where the
// answer is a wrong write to somebody's task list.
//
// The rule this file exists to hold: **an invalid action is a `no_match`, never
// an approximation.** Guessing what the model probably meant is how an assistant
// deletes the wrong row.

import type { Interpretation } from '../ports/interpreter.ts'
import type { TaskChanges, TaskStatus } from '../types.ts'

export type BridgeResult =
  | { ok: true; interpretation: Interpretation }
  | { ok: false; reason: string }

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v : null)

/** Fields the turn path may write. Deliberately NOT the HTTP patch list: a turn
 *  may not set structural members (F-005 AC-36), and the model must not be able
 *  to reach them by naming them. */
const TURN_WRITABLE = ['title', 'note', 'due_at', 'due_all_day', 'reminder_at', 'priority', 'status'] as const
const STATUSES: readonly string[] = ['inbox', 'done', 'archived']

function changesFrom(raw: unknown): { ok: true; changes: TaskChanges } | { ok: false; reason: string } {
  if (!isObj(raw)) return { ok: false, reason: 'changes must be an object' }
  const out: TaskChanges = {}
  for (const [key, value] of Object.entries(raw)) {
    if (!(TURN_WRITABLE as readonly string[]).includes(key)) {
      // Named and refused, rather than dropped: a silently ignored field means
      // the model believes it changed something it did not, and its own sentence
      // will say so.
      return { ok: false, reason: `a turn may not set "${key}"` }
    }
    switch (key) {
      case 'title': {
        const t = str(value)
        if (t === null) return { ok: false, reason: 'title must be a non-empty string' }
        out.title = t
        break
      }
      case 'note':
        if (value !== null && typeof value !== 'string') return { ok: false, reason: 'note must be a string or null' }
        out.note = value as string | null
        break
      case 'due_at':
      case 'reminder_at': {
        if (value === null) { out[key] = null; break }
        const iso = str(value)
        if (iso === null || Number.isNaN(Date.parse(iso))) {
          return { ok: false, reason: `${key} must be an ISO 8601 instant or null` }
        }
        out[key] = iso
        break
      }
      case 'due_all_day':
        if (value !== null && typeof value !== 'boolean') return { ok: false, reason: 'due_all_day must be a boolean or null' }
        out.due_all_day = value as boolean | null
        break
      case 'priority':
        if (value !== null && typeof value !== 'string') return { ok: false, reason: 'priority must be a string or null' }
        out.priority = value as string | null
        break
      case 'status': {
        const st = str(value)
        if (st === null || !STATUSES.includes(st)) {
          return { ok: false, reason: `status must be one of ${STATUSES.join(', ')}` }
        }
        out.status = st as TaskStatus
        break
      }
    }
  }
  if (Object.keys(out).length === 0) return { ok: false, reason: 'changes is empty' }
  return { ok: true, changes: out }
}

function handlesFrom(raw: unknown, known: Record<string, string>): { ok: true; handles: string[] } | { ok: false; reason: string } {
  if (!Array.isArray(raw) || raw.length === 0) return { ok: false, reason: 'handles must be a non-empty array' }
  const out: string[] = []
  for (const h of raw) {
    const handle = str(h)
    if (handle === null) return { ok: false, reason: 'every handle must be a string' }
    // A handle the engine cannot resolve would silently target nothing. Refusing
    // is the difference between "I did not understand" and "done" over an empty
    // set.
    if (known[handle] === undefined) return { ok: false, reason: `unknown handle "${handle}"` }
    out.push(handle)
  }
  return { ok: true, handles: out }
}

/**
 * Validate one `respond.action` against the engine's vocabulary.
 *
 * `handleMap` is this turn's handle table; every handle the model names is
 * checked against it here rather than resolved to nothing later.
 */
export function toInterpretation(action: unknown, handleMap: Record<string, string>): BridgeResult {
  if (!isObj(action)) return { ok: false, reason: 'action must be an object' }
  const kind = str(action.kind)
  if (kind === null) return { ok: false, reason: 'action.kind is required' }

  switch (kind) {
    case 'create': {
      const tasks = action.tasks
      if (!Array.isArray(tasks) || tasks.length === 0) {
        return { ok: false, reason: 'create needs a non-empty tasks array' }
      }
      const built = []
      for (const t of tasks) {
        if (!isObj(t)) return { ok: false, reason: 'every created task must be an object' }
        const title = str(t.title)
        if (title === null) return { ok: false, reason: 'every created task needs a title' }
        const rest = changesFrom({ ...t, title })
        if (!rest.ok) return rest
        built.push(rest.changes as { title: string })
      }
      return { ok: true, interpretation: { kind: 'create', tasks: built } }
    }

    case 'edit': {
      const edits = action.edits
      if (!Array.isArray(edits) || edits.length === 0) {
        return { ok: false, reason: 'edit needs a non-empty edits array' }
      }
      const built: { handle: string; changes: TaskChanges }[] = []
      for (const e of edits) {
        if (!isObj(e)) return { ok: false, reason: 'every edit must be an object' }
        const handle = str(e.handle)
        if (handle === null) return { ok: false, reason: 'every edit needs a handle' }
        if (handleMap[handle] === undefined) return { ok: false, reason: `unknown handle "${handle}"` }
        const c = changesFrom(e.changes)
        if (!c.ok) return c
        built.push({ handle, changes: c.changes })
      }
      return { ok: true, interpretation: { kind: 'edit', edits: built } }
    }

    case 'delete': {
      const h = handlesFrom(action.handles, handleMap)
      if (!h.ok) return h
      return { ok: true, interpretation: { kind: 'delete', handles: h.handles } }
    }

    case 'clarify': {
      const h = handlesFrom(action.handles, handleMap)
      if (!h.ok) return h
      // `pending_op` is not a bare word: an edit clarify carries the very
      // changes that would be applied on a yes. Accepting `"edit"` alone would
      // ask a question whose answer has nothing to execute.
      const rawOp = action.pending_op
      if (!isObj(rawOp)) return { ok: false, reason: 'clarify needs a pending_op object' }
      const op = str(rawOp.op)
      if (op === 'delete') {
        return { ok: true, interpretation: { kind: 'clarify', handles: h.handles, pending_op: { op: 'delete' } } }
      }
      if (op === 'edit') {
        const c = changesFrom(rawOp.changes)
        if (!c.ok) return c
        return {
          ok: true,
          interpretation: { kind: 'clarify', handles: h.handles, pending_op: { op: 'edit', changes: c.changes } },
        }
      }
      return { ok: false, reason: 'clarify pending_op.op must be "delete" or "edit"' }
    }

    case 'answer': {
      const a = action.answer
      if (!isObj(a)) return { ok: false, reason: 'answer needs an answer object' }
      const type = str(a.type)
      if (type === 'affirmative' || type === 'negative' || type === 'unclassifiable') {
        return { ok: true, interpretation: { kind: 'answer', answer: { type } } }
      }
      if (type === 'selection') {
        const handle = str(a.handle)
        if (handle === null) return { ok: false, reason: 'a selection answer needs a handle' }
        if (handleMap[handle] === undefined) return { ok: false, reason: `unknown handle "${handle}"` }
        return { ok: true, interpretation: { kind: 'answer', answer: { type: 'selection', handle } } }
      }
      return { ok: false, reason: 'answer.type is not one this engine knows' }
    }

    case 'query':
      return { ok: true, interpretation: { kind: 'query' } }

    case 'no_match':
      return { ok: true, interpretation: { kind: 'no_match' } }

    case 'list_create': {
      const name = str(action.name)
      if (name === null) return { ok: false, reason: 'list_create needs a name' }
      return { ok: true, interpretation: { kind: 'list_create', name } }
    }

    case 'list_move': {
      const handle = str(action.handle)
      if (handle === null) return { ok: false, reason: 'list_move needs a handle' }
      if (handleMap[handle] === undefined) return { ok: false, reason: `unknown handle "${handle}"` }
      const listName = action.list_name
      if (listName !== null && str(listName) === null) {
        return { ok: false, reason: 'list_move needs a list_name string or null' }
      }
      return {
        ok: true,
        interpretation: { kind: 'list_move', handle, list_name: listName as string | null },
      }
    }

    case 'list_refuse':
      return { ok: true, interpretation: { kind: 'list_refuse' } }

    case 'trash_read': {
      const query = str(action.query)
      if (query !== 'task_in_trash' && query !== 'trash_contents') {
        return { ok: false, reason: 'trash_read needs query "task_in_trash" or "trash_contents"' }
      }
      const handle = str(action.handle)
      return {
        ok: true,
        interpretation:
          handle === null
            ? { kind: 'trash_read', query }
            : { kind: 'trash_read', query, handle },
      }
    }

    default:
      return { ok: false, reason: `no such action kind: "${kind}"` }
  }
}
