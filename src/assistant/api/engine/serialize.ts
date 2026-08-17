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
  SessionRow,
  TaskRow,
  TaskStatus,
  TurnOutcome,
  TurnRow,
  TurnSource,
  TurnStatus,
  UndoResultRec,
} from '../types.ts'
import type { StoreState } from '../store/store.ts'

export interface TaskWire {
  id: string
  title: string
  due_at: string | null
  reminder_at: string | null
  priority: string | null
  status: TaskStatus
  created_at: string
  updated_at: string
  deleted_at: string | null
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

export function serializeTask(t: TaskRow): TaskWire {
  return {
    id: t.id,
    title: t.title,
    due_at: t.due_at,
    reminder_at: t.reminder_at,
    priority: t.priority,
    status: t.status,
    created_at: t.created_at,
    updated_at: t.updated_at,
    deleted_at: t.deleted_at,
  }
}

function serializeQuestion(q: Question): QuestionWire {
  return {
    kind: q.kind,
    task_ids: [...q.task_ids],
    task_titles: [...q.task_titles],
    options: [...q.options],
    ask_snapshot: q.ask_snapshot.map(serializeTask),
    resolution: q.resolution === null ? null : { ...q.resolution },
  }
}

export function serializeTurn(t: TurnRow): TurnWire {
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
    undo_snapshot: t.undo_snapshot === null ? null : t.undo_snapshot.map(serializeTask),
    question: t.question === null ? null : serializeQuestion(t.question),
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

export function serializeSession(state: StoreState, s: SessionRow): SessionWire {
  return {
    id: s.id,
    user_id: s.user_id,
    status: s.status,
    close_reason: s.close_reason,
    created_at: s.created_at,
    last_activity_at: s.last_activity_at,
    closed_at: s.closed_at,
    messages: sessionTurns(state, s.id).map(serializeTurn),
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
