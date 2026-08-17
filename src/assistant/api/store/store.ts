// Store port (ADR-001). "Transaction" = a synchronous mutation applied
// atomically to the in-memory state: transact() runs the callback against a
// clone and commits by swapping — a mid-mutation throw discards the clone, so
// partial writes can never land (AC-1, AC-6).

import type { SessionRow, TaskRow, TurnRow, TurnSource, UndoOutcomeWire } from '../types.ts'

/**
 * Dedupe record for voice-guard undos (no turn row exists — ADR-006).
 * Per data-model: `(user_id, client_turn_id) → {recorded response, transcript,
 * source, answer_to_turn_id}` — the stored request fields serve the
 * divergent-body comparison (409 CLIENT_TURN_ID_REUSED, TC-24/TC-25).
 * Exactly one of `outcome` (success) / `refusal` (recorded 409) is non-null.
 */
export interface UndoDedupeRecord {
  session_id: string
  transcript: string
  source: TurnSource
  answer_to_turn_id: string | null
  outcome: UndoOutcomeWire | null
  refusal: { code: string; message: string; detail: Record<string, unknown> } | null
}

export interface StoreState {
  sessions: Record<string, SessionRow>
  turns: Record<string, TurnRow>
  tasks: Record<string, TaskRow>
  /** keyed `${user_id}:${client_turn_id}` */
  undo_records: Record<string, UndoDedupeRecord>
}

export const emptyState = (): StoreState => ({
  sessions: {},
  turns: {},
  tasks: {},
  undo_records: {},
})

export interface Store {
  /** Read-only access to current state. Callers must not mutate. */
  read<T>(fn: (state: StoreState) => T): T
  /**
   * Atomic mutation: the callback gets a draft; on normal return the draft
   * becomes the state (and is snapshotted); on throw nothing changes.
   */
  transact<T>(fn: (state: StoreState) => T): T
}
