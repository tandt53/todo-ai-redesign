// Entity + wire types for the assistant module.
// Shapes come from specs/assistant/data-model.md and specs/assistant/api-contracts.md
// — never invented (ethos §9). Internal-only fields are marked and stripped by
// engine/serialize.ts before anything goes on the wire.

export type TaskStatus = 'inbox' | 'today' | 'done' | 'archived'

/** task (existing todo-ai model — unchanged; F-001 adds no fields). */
export interface TaskRow {
  id: string
  /** internal — never serialized (data-model serves the task without user_id) */
  user_id: string
  title: string
  due_at: string | null
  reminder_at: string | null
  priority: string | null
  status: TaskStatus
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type TurnStatus = 'pending' | 'applied' | 'asked' | 'failed' | 'undone'
export type TurnSource = 'voice' | 'typed' | 'tap'
export type QuestionKind = 'bulk_delete' | 'clarify'
export type SessionStatus = 'open' | 'closed'
export type CloseReason = 'idle' | 'user_closed'
export type UndoVia = 'tap' | 'voice'

export type ResolutionResult =
  | 'executed'
  | 'declined'
  | 'declined_superseded'
  | 'already_resolved'

/** diff row: old=null for create, new=null for delete (AC-4). */
export interface DiffRow {
  task_id: string
  field: string
  old: unknown
  new: unknown
}

/** The full applied anatomy (data-model TurnOutcome kind=applied). */
export interface AppliedAnatomy {
  changed_task_ids: string[]
  diff: DiffRow[]
  created_titles: string[]
  deleted_titles: string[]
}

export type TurnOutcome =
  | ({ kind: 'applied' } & AppliedAnatomy)
  | { kind: 'question' }
  | {
      kind: 'resolution'
      result: ResolutionResult
      question_turn_id: string
      executed?: AppliedAnatomy
    }
  | { kind: 'unclassifiable'; question_turn_id: string }
  | { kind: 'no_match'; heard_transcript: string }
  | { kind: 'unsupported_query'; alternative: string }

export interface QuestionResolution {
  result: ResolutionResult
  resolved_by_turn_id: string | null
  resolved_at: string
}

/** The pending operation a clarify question will execute once answered. Internal. */
export type PendingOp = { op: 'delete' } | { op: 'edit'; changes: TaskChanges }

export interface TaskChanges {
  title?: string
  due_at?: string | null
  reminder_at?: string | null
  priority?: string | null
  status?: TaskStatus
}

export interface Question {
  kind: QuestionKind
  task_ids: string[]
  task_titles: string[]
  /** literal texts; a tap sends one verbatim as a normal turn */
  options: string[]
  /** state at ask time — AC-12 re-validation compares against this */
  ask_snapshot: TaskRow[]
  resolution: QuestionResolution | null
}

/** Stored on undone turns; mirror of the undo endpoint's 200 body. */
export interface UndoResultRec {
  reverted: { task_id: string; title: string }[]
  skipped: { task_id: string; title: string; reason: 'modified_since_apply' }[]
  nothing_reverted: boolean
  via: UndoVia
  transcript?: string
  undone_at: string
}

export interface TurnRow {
  id: string
  session_id: string
  user_id: string
  /** strictly increasing per session, assigned at receipt (AC-10) */
  seq: number
  /** unique per (user_id, client_turn_id) — the dedupe key (AC-16, ADR-005) */
  client_turn_id: string
  status: TurnStatus
  /** persisted before interpretation (AC-23) */
  transcript_raw: string
  source: TurnSource
  answer_to_turn_id: string | null
  outcome: TurnOutcome | null
  changed_task_ids: string[]
  diff: DiffRow[]
  /** applying turns only: pre-apply state (edit/delete) or created rows (create) */
  undo_snapshot: TaskRow[] | null
  question: Question | null
  undo_result: UndoResultRec | null
  created_at: string
  resolved_at: string | null
  // ---- internal fields (stripped by serialize.ts) ----
  /** state of each touched task immediately AFTER apply; undo's modified-since
   * comparison is current-vs-post-apply (AC-7 — comparing against the pre-apply
   * snapshot would flag the turn's own change as a modification) */
  post_apply: Record<string, TaskRow> | null
  /** ids this turn created (undo removes them) */
  created_ids: string[]
  /** clarify turns: the op to run on the selected candidate */
  pending_op: PendingOp | null
  /** resolutions this turn caused — replayed verbatim on dedupe (AC-16) */
  caused_resolutions: { question_turn_id: string; result: ResolutionResult }[]
}

export interface BoundaryDeclined {
  turn_id: string
  kind: QuestionKind
  task_titles: string[]
}

export interface BoundaryLateOutcome {
  turn_id: string
  status: 'applied' | 'failed'
  outcome: TurnOutcome | null
}

export interface SessionRow {
  id: string
  user_id: string
  status: SessionStatus
  close_reason: CloseReason | null
  created_at: string
  /** bumped on every accepted turn / undo / close touching the session (ADR-004) */
  last_activity_at: string
  closed_at: string | null
  /** questions declined by this close, by name (AC-28) */
  boundary_declined: BoundaryDeclined[] | null
  /** turns resolved between last foreground and close (AC-28) — computed at close */
  boundary_late: BoundaryLateOutcome[] | null
  // ---- internal ----
  /** last time this open session was read via GET /assistant/session; the
   * prototype's best server-visible proxy for "last foreground" (AC-28) */
  last_foreground_at: string
}

/** Wire shape of POST /assistant/turn/{turn_id}/undo 200 (UndoOutcome). */
export interface UndoOutcomeWire {
  turn_id: string
  undone: true
  already_undone: boolean
  reverted: { task_id: string; title: string }[]
  skipped: { task_id: string; title: string; reason: 'modified_since_apply' }[]
  nothing_reverted: boolean
  via: UndoVia
}
