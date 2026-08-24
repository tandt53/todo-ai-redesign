// Entity + wire types for the assistant module.
// Shapes come from docs/specs/assistant/data-model.md and docs/specs/assistant/api-contracts.md
// — never invented (ethos §9). Internal-only fields are marked and stripped by
// engine/serialize.ts before anything goes on the wire.

export type TaskStatus = 'inbox' | 'today' | 'done' | 'archived'

export type TaskPriority = 'none' | 'low' | 'medium' | 'high'

export type RepeatFrequency = 'day' | 'week' | 'month' | 'year'

/**
 * task — the F-001 baseline plus the F-005 fields (`data-model.md § task — the
 * F-005 fields`).
 *
 * **Every F-005 field is declared OPTIONAL, and that is the schema telling the
 * truth rather than a convenience.** No migration is run (platform doc: *do not
 * write a backfill*), so the 790 existing rows genuinely do not carry these
 * keys: 783 hold `priority: null`, 0 carry `due_all_day`, 53 soft-deleted rows
 * carry no `delete_gesture_id`. A required declaration would be a claim about
 * the store that is false, and it is exactly the claim AC-34's comparison rule
 * exists to survive — `engine/task-equals.ts` reads *absent* as "not recorded".
 * Reads apply the defaults (`serialize.ts`); writes store them.
 */
export interface TaskRow {
  id: string
  /** internal — never serialized (data-model serves the task without user_id) */
  user_id: string
  title: string
  due_at: string | null
  reminder_at: string | null
  /**
   * **`none` is the ABSENCE of a stored value, not the string `'none'`** (AC-8,
   * architect F8). The row stores `null`; `serializeTask` emits `"none"`. A
   * literal `'none'` would add a `priority: none` diff row to F-001 AC-4's
   * message on every create, and would make `taskEquals`'s `===` report every
   * one of the 783 pre-F-005 `null` rows modified in the gate AC-34 protects.
   * Reads stay tolerant: an out-of-set stored value reads as `none`.
   */
  priority: string | null
  status: TaskStatus
  created_at: string
  updated_at: string
  deleted_at: string | null
  // ---- F-005 fields ----
  /** AC-6, AC-37 — whitespace-only and newline-only store `null`, never `""` */
  note?: string | null
  /** AC-13 — `null`/absent = NOT DETERMINED; resolved on read, stored on write */
  due_all_day?: boolean | null
  /** AC-38 — written by `POST /tasks/{id}/reminder-ack` and by no other door */
  reminder_shown_at?: string | null
  /** AC-18 — a step has exactly one parent; one level only */
  parent_id?: string | null
  /** AC-15, ADR-015 — sparse, gaps of 1024, per parent; never derived from a date */
  step_order?: number | null
  /** AC-19 — set by the cascade, cleared by any hand tick or untick of the step */
  completed_by_parent?: boolean
  /** AC-25, ADR-014 — set on the first transition to done, NEVER cleared. Internal. */
  ever_completed?: boolean
  repeat_frequency?: RepeatFrequency | null
  repeat_interval?: number | null
  /** canonical: a subset of `mo,tu,we,th,fr,sa,su` in that fixed order */
  repeat_weekdays?: string | null
  /** canonical: ascending ints 1-31, comma-joined */
  repeat_month_days?: string | null
  /** inclusive ISO calendar date; exclusive with `repeat_count` */
  repeat_until?: string | null
  /** >= 1; exclusive with `repeat_until`; runs are COUNTED, never stored */
  repeat_count?: number | null
  /** AC-25 — assigned when a repeat is first set, NEVER cleared */
  series_id?: string | null
  /** AC-30's series delete, written on EVERY row of the series. Internal. */
  series_ended_at?: string | null
  /** ADR-012 — one id per delete gesture, on every row it trashed. Internal. */
  delete_gesture_id?: string | null
  /** F-008 AC-10 — uuid of a personal list, or null (Inbox). A step may not carry a list_id. */
  list_id?: string | null
}

/** list (new entity — F-008). A personal named container on the filing axis. */
export interface ListRow {
  id: string
  user_id: string
  name: string
  /** 0–6, index into tokens.json listColor.palette; default 0 (Grey) */
  color: number
  /** sparse, gaps of 1024; assigned on create, rewritten on reorder */
  position: number
  created_at: string
  updated_at: string
}

/** account (new entity — ADR-010). One row per `user_id`, created lazily. */
/**
 * A person who can sign in (UC-22). `id` is the value every other row's
 * `user_id` carries, so an account created under the pre-auth header door and
 * one created by registration are the same kind of thing.
 *
 * `password_hash` is scrypt output — see auth.ts. The plaintext is never held,
 * not even in memory beyond the request that verified it.
 */
export interface UserRow {
  id: string
  email: string
  password_hash: string
  created_at: string
  updated_at: string
}

/**
 * A live sign-in. Keyed and looked up by `token_hash` — the raw token exists
 * only in the response that minted it and in the client's own storage, so a
 * leaked store snapshot cannot be replayed as a session.
 */
export interface AuthTokenRow {
  token_hash: string
  user_id: string
  created_at: string
  expires_at: string
}

export interface AccountRow {
  user_id: string
  /** the ONE source every date computation reads (AC-44) */
  timezone: string | null
  timezone_source: 'first-report' | 'user' | null
  timezone_set_at: string | null
  /** the most recent client report, applied or not — so a client can OFFER a change */
  timezone_last_report: string | null
  timezone_last_report_at: string | null
  created_at: string
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
  /**
   * The seventh member (F-005 AC-36/AC-40, api-contracts § The refused turn).
   * **The turn's `status` stays `applied`** — the existing status machine is
   * untouched. The task is unchanged, the refusal is whole-write (one legal and
   * one illegal field writes NOTHING), `changed_task_ids` is empty and no
   * `undo_snapshot` is captured, so a refused turn never occupies or advances
   * the undo window, exactly like `no_match`.
   */
  | { kind: 'refused'; reason: RefusalReason; field: string | null; task_id: string | null }
  /**
   * The eighth member (F-006 AC-14, api-contracts § `turn.outcome` gains
   * `trash_read`). A turn that reads the trash and produces an informational
   * answer. The turn's `status` is `applied` (same as every answered query).
   * No mutation. `changed_task_ids` is empty and no `undo_snapshot` is
   * captured, so it never occupies or advances the undo window.
   */
  | {
      kind: 'trash_read'
      query: 'task_in_trash' | 'trash_contents'
      task_id?: string
      task_title?: string
      entry_count?: number
      entry_titles?: string[]
    }

export interface QuestionResolution {
  result: ResolutionResult
  resolved_by_turn_id: string | null
  resolved_at: string
}

/** The pending operation a clarify question will execute once answered. Internal. */
export type PendingOp = { op: 'delete' } | { op: 'edit'; changes: TaskChanges }

/**
 * The closed enumeration of refusal reasons (api-contracts § The refused turn).
 * One validator produces these; the two doors render them differently — the
 * HTTP door answers `400 VALIDATION` with a field name to a client that sent a
 * bad body, the turn door answers with the `refused` outcome to a person who
 * spoke a well-formed sentence (AC-40, platform doc § One validator, two doors).
 */
export type RefusalReason =
  | 'empty_title'
  | 'priority_not_in_set'
  | 'note_not_text'
  | 'structural_field_not_settable'
  | 'step_not_addressable'
  | 'nesting_too_deep'
  | 'repeat_on_step'
  | 'until_and_count'
  | 'end_before_due'
  | 'clear_due_while_repeating'
  | 'timezone_unknown'
  | 'length_exceeded'

/**
 * The AI-facing change shape. It **carries the structural fields and the write
 * path refuses them at runtime** — a deliberate choice of a runtime refusal over
 * a type-level impossibility (AC-36): *a refusal is a fact you can test, an
 * incapacity is not*. Before F-005 no fixture row could express `parent_id`,
 * `step_order` or a repeat member at all, so *"refused with a visible outcome"*
 * had no reachable test and its earliest catch was never.
 */
export interface TaskChanges {
  title?: string
  note?: string | null
  due_at?: string | null
  due_all_day?: boolean | null
  reminder_at?: string | null
  priority?: string | null
  status?: TaskStatus
  // ---- structural: expressible so that a turn attempting one is REFUSED ----
  parent_id?: string | null
  step_order?: number | null
  repeat_frequency?: RepeatFrequency | null
  repeat_interval?: number | null
  repeat_weekdays?: string | null
  repeat_month_days?: string | null
  repeat_until?: string | null
  repeat_count?: number | null
  /** F-008 AC-10 — uuid of a personal list, or null (Inbox) */
  list_id?: string | null
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

/** The two reasons a row can be skipped during undo (F-006 AC-13). */
export type SkippedReason = 'modified_since_apply' | 'permanently_deleted'

/** Stored on undone turns; mirror of the undo endpoint's 200 body. */
export interface UndoResultRec {
  reverted: { task_id: string; title: string }[]
  skipped: { task_id: string; title: string; reason: SkippedReason }[]
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
  skipped: { task_id: string; title: string; reason: SkippedReason }[]
  nothing_reverted: boolean
  via: UndoVia
}
