// Wire serializers: emit exactly the shapes data-model.md defines and strip
// every internal field (post_apply, created_ids, pending_op,
// caused_resolutions, last_foreground_at, task.user_id). No draft-ref tokens
// exist anywhere on this surface (ADR-002); clients receive titles plus task
// uuids as identifiers only.

import type {
  BoundaryDeclined,
  BoundaryLateOutcome,
  CloseReason,
  DiffRow,
  Question,
  QuestionResolution,
  RepeatFrequency,
  SessionRow,
  TaskPriority,
  TaskRow,
  TaskStatus,
  TurnOutcome,
  TurnRow,
  TurnSource,
  TurnStatus,
  UndoResultRec,
} from '../types.ts'
import type { StoreState } from '../store/store.ts'
import { PRIORITIES } from './task-fields.ts'
import { seriesLive } from './recurrence.ts'
import { isLocalStartOfDay } from './zone.ts'

/**
 * `Task` on the wire (api-contracts § `Task` on the wire). `serializeTask` emits
 * exactly this; fields that exist on the row and are never serialized are
 * `user_id`, `ever_completed` (ADR-014), `delete_gesture_id` (ADR-012) and
 * `series_ended_at`.
 */
export interface TaskWire {
  id: string
  title: string
  note: string | null
  due_at: string | null
  /** AC-13 — `null` means NOT DETERMINED; see `serializeTask` */
  due_all_day: boolean | null
  reminder_at: string | null
  /** AC-38 — so a client can tell an acknowledged reminder from an unacknowledged one */
  reminder_shown_at: string | null
  /** AC-8 — **never `null` on the wire**: a stored `null` emits `"none"` */
  priority: TaskPriority
  status: TaskStatus
  parent_id: string | null
  step_order: number | null
  completed_by_parent: boolean
  repeat_frequency: RepeatFrequency | null
  repeat_interval: number | null
  repeat_weekdays: string | null
  repeat_month_days: string | null
  repeat_until: string | null
  repeat_count: number | null
  series_id: string | null
  /** AC-25 — DERIVED server-side, never stored, never keyed off `series_id` */
  series_live: boolean
  /** F-008 AC-10 — uuid of a personal list, or null (Inbox) */
  list_id: string | null
  /** F-009 AC-5 — manual position; null on a step and on any row written before F-009 */
  sort_order: number | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

/**
 * What the two derived wire fields need. Threaded through every serializer
 * rather than read from a global, so a record and a live row are rendered by
 * ONE code path — the alternative is two answers for `due_all_day`, which is the
 * defect AC-13's *one answer per row* clause exists to forbid.
 */
export interface TaskView {
  state: StoreState
  /** `account.timezone`; `null` = never reported, and reads never refuse */
  zone: string | null
  nowMs: number
}

export interface QuestionWire {
  kind: Question['kind']
  task_ids: string[]
  task_titles: string[]
  options: string[]
  ask_snapshot: TaskWire[]
  resolution: QuestionResolution | null
}

export interface TurnWire {
  id: string
  session_id: string
  user_id: string
  seq: number
  client_turn_id: string
  status: TurnStatus
  transcript_raw: string
  source: TurnSource
  answer_to_turn_id: string | null
  outcome: TurnOutcome | null
  changed_task_ids: string[]
  diff: DiffRow[]
  undo_snapshot: TaskWire[] | null
  question: QuestionWire | null
  undo_result: UndoResultRec | null
  created_at: string
  resolved_at: string | null
}

export interface SessionWire {
  id: string
  user_id: string
  status: SessionRow['status']
  close_reason: CloseReason | null
  created_at: string
  last_activity_at: string
  closed_at: string | null
  /** turns ARE the messages, in seq order (data-model) */
  messages: TurnWire[]
}

export interface BoundaryWire {
  session_id: string
  closed_at: string
  close_reason: CloseReason
  declined_questions: BoundaryDeclined[]
  late_outcomes: BoundaryLateOutcome[]
}

/**
 * `due_all_day` resolution, in the contract's order (api-contracts § `Task` on
 * the wire):
 *
 *  1. a **stored** flag is authoritative wherever present, on every tier;
 *  2. absent, and `account.timezone` is set → the server resolves it: **all-day
 *     iff the stored instant is the local start of its own day in that zone**
 *     (AC-13), timed otherwise. The row is **not rewritten by the read**; the
 *     next write that touches `due_at` stores the resolved value;
 *  3. absent, and the zone is unset → `null`, meaning *not determined*, and a
 *     client renders such a due as a date with no clock time.
 *
 * **A read never refuses.** AC-18's *a refused write writes nothing* governs
 * writes; a read withholds a **derived value**, never a row — refusing would make
 * `GET /tasks` unrenderable for an account with no zone, which on day one is
 * every row of every account (0 of 790 rows carry the flag).
 */
function resolveAllDay(t: TaskRow, view: TaskView): boolean | null {
  const stored = t.due_all_day
  if (stored !== undefined && stored !== null) return stored
  if (t.due_at === null) return null
  if (view.zone === null) return null
  const ms = Date.parse(t.due_at)
  if (Number.isNaN(ms)) return null
  return isLocalStartOfDay(ms, view.zone)
}

export function serializeTask(t: TaskRow, view: TaskView): TaskWire {
  // AC-8: `none` is the absence of a stored value. Reads stay **tolerant** — a
  // stored value outside the set is emitted as `"none"`, never as itself and
  // never as an error (ADR-009's precedent for `status: 'today'`). Its fixture
  // cannot be built through the API, since this field's own write path refuses
  // exactly the value it must tolerate; the seed path constructs it.
  const priority: TaskPriority =
    t.priority !== null && PRIORITIES.includes(t.priority) && t.priority !== 'none'
      ? (t.priority as TaskPriority)
      : 'none'
  return {
    id: t.id,
    title: t.title,
    note: t.note ?? null,
    due_at: t.due_at,
    due_all_day: resolveAllDay(t, view),
    reminder_at: t.reminder_at,
    reminder_shown_at: t.reminder_shown_at ?? null,
    priority,
    status: t.status,
    parent_id: t.parent_id ?? null,
    step_order: t.step_order ?? null,
    completed_by_parent: t.completed_by_parent ?? false,
    repeat_frequency: t.repeat_frequency ?? null,
    repeat_interval: t.repeat_interval ?? null,
    repeat_weekdays: t.repeat_weekdays ?? null,
    repeat_month_days: t.repeat_month_days ?? null,
    repeat_until: t.repeat_until ?? null,
    repeat_count: t.repeat_count ?? null,
    series_id: t.series_id ?? null,
    series_live: seriesLive(t, view.state, view.nowMs, view.zone),
    list_id: t.list_id ?? null,
    sort_order: t.sort_order ?? null,
    created_at: t.created_at,
    updated_at: t.updated_at,
    deleted_at: t.deleted_at,
  }
}

function serializeQuestion(q: Question, view: TaskView): QuestionWire {
  return {
    kind: q.kind,
    task_ids: [...q.task_ids],
    task_titles: [...q.task_titles],
    options: [...q.options],
    ask_snapshot: q.ask_snapshot.map((t) => serializeTask(t, view)),
    resolution: q.resolution === null ? null : { ...q.resolution },
  }
}

export function serializeTurn(t: TurnRow, view: TaskView): TurnWire {
  return {
    id: t.id,
    session_id: t.session_id,
    user_id: t.user_id,
    seq: t.seq,
    client_turn_id: t.client_turn_id,
    status: t.status,
    transcript_raw: t.transcript_raw,
    source: t.source,
    answer_to_turn_id: t.answer_to_turn_id,
    outcome: t.outcome === null ? null : structuredClone(t.outcome),
    changed_task_ids: [...t.changed_task_ids],
    diff: structuredClone(t.diff),
    undo_snapshot:
      t.undo_snapshot === null ? null : t.undo_snapshot.map((row) => serializeTask(row, view)),
    question: t.question === null ? null : serializeQuestion(t.question, view),
    undo_result: t.undo_result === null ? null : structuredClone(t.undo_result),
    created_at: t.created_at,
    resolved_at: t.resolved_at,
  }
}

export function sessionTurns(state: StoreState, sessionId: string): TurnRow[] {
  return Object.values(state.turns)
    .filter((t) => t.session_id === sessionId)
    .sort((a, b) => a.seq - b.seq)
}

export function serializeSession(state: StoreState, s: SessionRow, view: TaskView): SessionWire {
  return {
    id: s.id,
    user_id: s.user_id,
    status: s.status,
    close_reason: s.close_reason,
    created_at: s.created_at,
    last_activity_at: s.last_activity_at,
    closed_at: s.closed_at,
    messages: sessionTurns(state, s.id).map((t) => serializeTurn(t, view)),
  }
}

export function serializeBoundary(s: SessionRow): BoundaryWire {
  return {
    session_id: s.id,
    closed_at: s.closed_at ?? '',
    close_reason: s.close_reason ?? 'idle',
    declined_questions: structuredClone(s.boundary_declined ?? []),
    late_outcomes: structuredClone(s.boundary_late ?? []),
  }
}
