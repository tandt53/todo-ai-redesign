// Interpreter port (ADR-001): the AI seam. The engine hands the model an
// interpretation context in HANDLE space — candidate tasks appear as per-turn
// handles t1..tn with titles/fields, never raw uuids (ADR-002); the engine
// keeps the handle→uuid map to itself. The stub replaces model interpretation
// ONLY, including answer classification (spec, Test strategy); orchestration,
// gating, persistence, dedupe and undo always run real.

import type { PendingOp, QuestionKind, TaskChanges, TaskStatus, TurnSource } from '../types.ts'
import type { NewTaskFields } from '../engine/apply.ts'

/**
 * AI endpoint parameters, resolved SERVER-side (api-contracts.md): the model
 * is never chosen by the client; temperature is deliberately not sent (the
 * parameter is removed on current Claude models — the request would 400).
 * The real Anthropic-backed Interpreter that consumes these lands in a later
 * phase behind this same port — this phase ships the fixture stub only
 * (briefing: no real AI provider calls).
 */
export const INTERPRETER_DEFAULTS = {
  model: 'claude-opus-5',
  max_tokens: 1024,
} as const

/**
 * Candidate task as the model sees it — handle, no uuid (ADR-002).
 *
 * **`note` and `reminder_at` joined it in F-005 (AC-36): the assistant must be
 * able to READ what it may write.** *"Push the reminder an hour later"* had
 * nothing to read, and the note was invisible to the model that may now change
 * it. Steps are not in this list at all (AC-35) — a task with eight steps
 * contributes one handle.
 */
export interface ContextTask {
  handle: string
  title: string
  status: TaskStatus
  note: string | null
  due_at: string | null
  reminder_at: string | null
  priority: string | null
  /** F-008 AC-18: the interpreter must see where a task is filed */
  list_id: string | null
}

export interface QuestionContext {
  kind: QuestionKind
  task_titles: string[]
  options: string[]
}

export interface ContextList {
  id: string
  name: string
}

/**
 * F-006 AC-14 (processing rule 5 amendment): top-level deleted tasks,
 * unexpired. Read-only — the interpreter may recognise a task as "in the
 * trash" and produce a trash_read outcome, but may NEVER target a row in
 * this set for any mutation. Steps excluded (mirroring the handle list).
 */
export interface DeletedContextTask {
  id: string
  title: string
  deleted_at: string
}

export interface InterpreterContext {
  transcript: string
  source: TurnSource
  timezone: string | null
  /** the user's current tasks, read fresh inside this turn's queue slot (OQ 7) */
  tasks: ContextTask[]
  /** F-006 AC-14: top-level deleted tasks, unexpired, read-only */
  deleted_tasks: DeletedContextTask[]
  /** F-008: the user's personal lists, for list-name resolution */
  lists: ContextList[]
  /** sliding window: at most the last 10 resolved turns (ADR-003) */
  recent_turns: { transcript: string; outcome_kind: string | null }[]
  /** the pending question this turn is bound to, if any (answer classification) */
  question: QuestionContext | null
}

export type AnswerClass =
  | { type: 'affirmative' }
  | { type: 'negative' }
  | { type: 'unclassifiable' }
  | { type: 'selection'; handle: string }

export type Interpretation =
  /** create carries `NewTaskFields` — the turn-path create allowlist (AC-36) */
  | { kind: 'create'; tasks: NewTaskFields[] }
  | { kind: 'edit'; edits: { handle: string; changes: TaskChanges }[] }
  | { kind: 'delete'; handles: string[] }
  | { kind: 'clarify'; handles: string[]; pending_op: PendingOp }
  | { kind: 'no_match' }
  | { kind: 'query' }
  | { kind: 'answer'; answer: AnswerClass }
  /** F-008 AC-17: create a list by voice */
  | { kind: 'list_create'; name: string }
  /** F-008 AC-18/AC-19: move a task to a named list or to Inbox */
  | { kind: 'list_move'; handle: string; list_name: string | null }
  /** F-008 AC-20: attempted rename/recolour/delete a list — refused */
  | { kind: 'list_refuse' }
  /** F-006 AC-14: the user asked about a task in the trash or about trash contents */
  | { kind: 'trash_read'; query: 'task_in_trash' | 'trash_contents'; handle?: string }

export interface Interpreter {
  interpret(ctx: InterpreterContext): Promise<Interpretation>
}
