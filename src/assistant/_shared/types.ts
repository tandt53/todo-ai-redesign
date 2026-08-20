// View-model + wire types for the F-001 web client.
//
// Wire shapes are IMPORTED (type-only) from the backend module — the single
// source is docs/specs/assistant/api-contracts.md + data-model.md, which
// src/assistant/api/{types.ts, engine/serialize.ts} implement. Nothing here
// invents a contract (ethos §9); this file only adds the client-side view
// model the reducer renders from.

import type {
  QuestionKind,
  ResolutionResult,
  TurnSource,
  UndoOutcomeWire,
} from '../api/types.ts'
import type {
  BoundaryWire,
  SessionWire,
  TaskWire,
  TurnWire,
} from '../api/engine/serialize.ts'

export type {
  QuestionKind,
  ResolutionResult,
  TurnSource,
  UndoOutcomeWire,
  BoundaryWire,
  SessionWire,
  TaskWire,
  TurnWire,
}

// ---------------------------------------------------------------------------
// Wire request/response shapes (api-contracts.md — POST /assistant/turn)
// ---------------------------------------------------------------------------

/** Exactly the six request fields of POST /assistant/turn — never more
 * (unknown fields are 400-rejected), never fewer (TC-025 asserts the set). */
export interface TurnRequestBody {
  session_id: string | null
  client_turn_id: string
  transcript: string
  source: TurnSource
  answer_to_turn_id: string | null
  timezone: string | null
}

export interface TurnResponseWire {
  session_id: string
  kind: 'turn' | 'undo'
  replayed: boolean
  turn: TurnWire | null
  undo: UndoOutcomeWire | null
  resolutions: { question_turn_id: string; result: ResolutionResult }[]
}

export interface SessionReadWire {
  session: SessionWire | null
  boundary: BoundaryWire | null
}

// ---------------------------------------------------------------------------
// View model — the conversation surface (spec: four states, everything else
// is a message)
// ---------------------------------------------------------------------------

export type Surface = 'idle' | 'listening' | 'thinking' | 'error'

/** Mic modes are orthogonal to the four states (spec Conversation model). */
export type MicMode = 'available' | 'dimmed-permission' | 'dimmed-transient' | 'hidden'

/** One chip of an old→new per-field diff (AC-4). Values are display-formatted;
 * old=null for create, new=null for delete. */
export interface DiffChip {
  field: string
  old: string | null
  new: string | null
}

/** One row of the applied-message anatomy / row attribution marker. */
export interface DiffLine {
  taskId: string
  title: string
  label: 'new' | 'edit'
  chips: DiffChip[]
}

/** Row attribution for the task list (AC-4): only the newest applied turn's
 * own changes are marked. */
export interface Marks {
  turnId: string
  byTask: Record<string, DiffLine>
}

export type Message =
  | {
      id: string
      kind: 'user'
      text: string
      via: TurnSource
      at: string
      /** offline: sent-but-unacked turn, replayed visibly (AC-25) */
      queued: boolean
      clientTurnId: string | null
    }
  | {
      id: string
      kind: 'applied'
      /** the server turn id — the undo target (AC-5) */
      turnId: string
      head: string
      lines: DiffLine[]
      deletedTitles: string[]
      /** `changed_task_ids` was non-empty. Only a mutating turn occupies or
       * advances the undo window (AC-8, api-contracts undo refusal rule): an
       * executed resolution whose tasks were all dropped by AC-12
       * re-validation renders as an applied bubble but must not steal the
       * Undo affordance from the turn before it. */
      mutated: boolean
      undone: boolean
      at: string
    }
  | {
      id: string
      kind: 'question'
      turnId: string
      qkind: QuestionKind
      head: string
      body: string | null
      /** literal option texts — a tap sends one verbatim (AC-10, AC-13) */
      options: string[]
      taskTitles: string[]
      resolved: boolean
      at: string
    }
  | {
      /** declined / declined-superseded / already-resolved / unclassifiable /
       * undo-refusal — every resolution path is a visible message (AC-11) */
      id: string
      kind: 'outcome'
      head: string | null
      body: string[]
      at: string
    }
  | { id: string; kind: 'reverted'; head: string; body: string[]; at: string }
  | { id: string; kind: 'no-match'; heard: string; at: string }
  | { id: string; kind: 'unsupported'; alternative: string; at: string }
  | {
      id: string
      kind: 'error'
      head: string
      body: string[]
      /** non-null renders the Retry button (same client_turn_id, AC-16) */
      retryTurnId: string | null
      at: string
    }
  | { id: string; kind: 'boundary'; head: string; lines: string[]; at: string }
  | {
      /** mic permission / transient-failure guidance (AC-21, AC-22) */
      id: string
      kind: 'info'
      head: string
      body: string[]
      cta: 'permission' | null
      at: string
    }

// ---------------------------------------------------------------------------
// F-005 — the fields the task detail reaches (api-contracts § `Task` on the
// wire). Read-side only: nothing here is invented, and every member is the
// contract's own name and type.
// ---------------------------------------------------------------------------

/** AC-8 — exactly four states, and `none` is the ABSENCE of a stored value.
 * The row stores `null`; the serializer emits `"none"`, so `priority` is never
 * `null` on the wire. Reads stay tolerant (`priorityOf`). */
export type Priority = 'none' | 'low' | 'medium' | 'high'

export const PRIORITIES: readonly Priority[] = ['none', 'low', 'medium', 'high']

/** ADR-011 — the six repeat members' frequency half. No hourly repeat (AC-21). */
export type RepeatFrequency = 'day' | 'week' | 'month' | 'year'

/**
 * Everything `TaskWire` gains for F-005, declared here as **optional** and
 * intersected into `TaskView` rather than extended onto it.
 *
 * Two reasons, and the second is the load-bearing one:
 *
 * 1. **A read must tolerate their absence.** `api-contracts § Task on the wire`
 *    makes `due_all_day: null` mean *not determined* and keeps reads tolerant of
 *    a stored value outside a declared set; a client that requires the key
 *    cannot render a row that predates the field.
 * 2. **`TaskWire` is owned by `src/assistant/api/` and is being widened in
 *    parallel.** An `interface TaskView extends TaskWire` that re-declares
 *    `note?: string | null` is a *type error* the moment `TaskWire` declares
 *    `note: string | null`. An **intersection** is not: the property type is the
 *    intersection of both declarations and is required if either says so. So
 *    this file needs no edit when the wire catches up, and both states
 *    typecheck. (`TaskView` was an interface until F-005; nothing extends it —
 *    checked.)
 */
export interface TaskF005Fields {
  /** AC-6 — never `""`; whitespace-only stores `null`. */
  note: string | null
  /** AC-13 — `null` means NOT DETERMINED, and renders as a date with no clock
   * time. It is not a third state of the flag and not a fallback (ADR-010). */
  due_all_day: boolean | null
  /** AC-38 — written by `POST /tasks/{id}/reminder-ack` and no other door. */
  reminder_shown_at: string | null
  /** AC-18 — a step has exactly one parent; `null` for a top-level task. */
  parent_id: string | null
  /** AC-15, ADR-015 — sparse integer, `null` for a top-level task. */
  step_order: number | null
  /** AC-19 — `false` for a top-level task. Records which ticks the cascade made
   * so un-completing reverses only the cascade. */
  completed_by_parent: boolean
  repeat_frequency: RepeatFrequency | null
  repeat_interval: number | null
  /** canonical: a subset of `"mo,tu,we,th,fr,sa,su"` in that order. */
  repeat_weekdays: string | null
  /** canonical: ascending ints 1–31, comma-joined. */
  repeat_month_days: string | null
  repeat_until: string | null
  repeat_count: number | null
  /** AC-25 — assigned when a repeat is first set and never cleared, which is
   * exactly why it must not be the liveness predicate. */
  series_id: string | null
  /** AC-25 — DERIVED server-side and carried on the wire so both clients and
   * all three tiers read one answer instead of each deriving one. */
  series_live: boolean
}

/** The six ADR-011 repeat members, as one object for the picker's draft. */
export interface RepeatDraft {
  repeat_frequency: RepeatFrequency | null
  repeat_interval: number | null
  repeat_weekdays: string | null
  repeat_month_days: string | null
  repeat_until: string | null
  repeat_count: number | null
}

/** `GET /account` (ADR-010). The zone here is what every client date
 * computation reads — never the device zone. */
export interface AccountWire {
  user_id: string
  timezone: string | null
  timezone_source: 'first-report' | 'user' | null
  timezone_set_at: string | null
  timezone_last_report: string | null
  timezone_last_report_at: string | null
}

/** A task as the list renders it. `local` = created on this device through the
 * offline no-AI path (AC-25) and not yet on the server. */
export type TaskView = TaskWire & Partial<TaskF005Fields> & { local?: boolean }

// ---------------------------------------------------------------------------
// F-005 AC-47 — the notice family, and AC-43's undo offer
//
// These live in `_shared/` because the mechanism has to observe EVERY write to
// the task's field — the retry, an assistant turn, an undo, a background
// refresh — and only the shared controller and `state.tasks` see all four
// (AC-47, `platform/web.md § F-005`). React state owned by the detail cannot see
// a turn's write. The RENDERING is web-only; the STATE is not.
// ---------------------------------------------------------------------------

/** Why a value is sitting in a notice rather than in the store. */
export type NoticeReason =
  /** AC-2 state 2 — the write was attempted and the server refused or failed. */
  | 'failed'
  /** AC-2 state 3 — offline, **server-owned** row: never attempted, refused. */
  | 'offline-refused'

/** One field's worth of a failed or refused write (AC-47: "carries the user's
 * value", "names the task and the field"). */
export interface NoticeField {
  field: string
  /** what the user typed — the thing that must not vanish. */
  value: unknown
  /**
   * What the **store** held for this field at the moment of the failure.
   *
   * This is what "something newer has been stored" is measured against, and the
   * choice matters: compared against the *typed* value, a successful retry would
   * report itself as a supersede; compared against nothing at all, a stale failed
   * value gets shown over a newer stored one, which breaks AC-3's live-update
   * guarantee for that field.
   */
  baseline: unknown
  reason: NoticeReason
  /** AC-47 — set once a LATER successful write to this field has been stored.
   * A superseded field reports and offers NO retry: retrying would overwrite
   * the newer stored value with the stale failed one, which is the resurrection
   * door AC-4 and AC-47 close everywhere else. */
  superseded: boolean
  /** the value the store holds now, when superseded — so the notice can say
   * *which* newer value the field holds instead of merely that it moved. */
  storedNow?: unknown
}

/**
 * **One notice per task, not one per field** (AC-47) — the same aggregation AC-2
 * requires of concurrent in-field failures, for the same 4.1.3 reason.
 */
export interface Notice {
  taskId: string
  /** kept so the notice can name the task after the row is gone. */
  taskTitle: string
  fields: NoticeField[]
  /** AC-4 — the task was deleted underneath: reported once, value still
   * legible, and **no retry**, because a retry aimed at a soft-deleted row is
   * either dead or a resurrection door. */
  ended: 'task-deleted' | null
  at: string
}

/** AC-43 — the hand-action undo. It is NOT the turn undo (F-001 AC-5) and the
 * two are never substitutes. */
export type UndoAction =
  | { kind: 'delete-task'; taskId: string; title: string }
  | { kind: 'delete-series'; taskId: string; title: string }
  | { kind: 'delete-step'; taskId: string; title: string; parentId: string }
  | { kind: 'move-step'; taskId: string; title: string; priorStepOrder: number }

/**
 * The single-slot undo offer. **It does not stack**: a second undoable action
 * replaces the first offer and the replaced action stays done (AC-43). It
 * renders where AC-47's notice renders — visible wherever the user is, never on
 * the row (owner, 2026-08-19).
 */
export interface UndoOffer {
  action: UndoAction
  at: string
  /**
   * `Put back` has been used — design's **CN-UNDONE** row. The offer becomes a
   * report rather than disappearing, for the same reason CN-DELETED does: the row
   * is what tells the user the reversal happened, and it ends only by their own
   * act or a reload.
   */
  used: boolean
}

/** AC-38 — a passed, unacknowledged reminder, surfaced on open. N of them are
 * ONE surfacing ordered oldest-first, not N (AC-38, tester W7). */
export interface PassedReminder {
  taskId: string
  title: string
  /** the instant being acknowledged — `POST /tasks/{id}/reminder-ack` requires
   * it, so acknowledging a moved reminder cannot retire the new one. */
  reminderAt: string
}
