// View-model + wire types for the F-001 web client.
//
// Wire shapes are IMPORTED (type-only) from the backend module — the single
// source is specs/assistant/api-contracts.md + data-model.md, which
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

/** A task as the list renders it. `local` = created on this device through the
 * offline no-AI path (AC-25) and not yet on the server. */
export interface TaskView extends TaskWire {
  local?: boolean
}
