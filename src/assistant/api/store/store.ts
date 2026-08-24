// Store port (ADR-001). "Transaction" = a synchronous mutation applied
// atomically to the in-memory state: transact() runs the callback against a
// clone and commits by swapping — a mid-mutation throw discards the clone, so
// partial writes can never land (AC-1, AC-6).

import type { AiUsageRow } from '../ai/usage.ts'
import type {
  AccountRow,
  AuthTokenRow,
  ListRow,
  SessionRow,
  TaskRow,
  TurnRow,
  UserRow,
  TurnSource,
  UndoOutcomeWire,
} from '../types.ts'

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
  /**
   * account rows keyed by `user_id` (ADR-010, F-005). **Optional, because the
   * live snapshot predates the entity**: measured 2026-08-19, the store's
   * top-level keys are `sessions`, `turns`, `tasks`, `undo_records`. ADR-005
   * decided on 2026-08-16 that *the account* is the scope and there has never
   * been a row; `recordClientZone` creates the key lazily on the first
   * authenticated request rather than a migration adding it (platform doc:
   * migrations, none).
   */
  accounts?: Record<string, AccountRow>
  /** F-008 — personal lists, keyed by list id. Optional (predates the entity). */
  lists?: Record<string, ListRow>
  /**
   * UC-22 — registered people, keyed by `user_id`. Optional for the same reason
   * `accounts` is: every snapshot written before registration existed has no
   * such key, and a reader that assumes one crashes on the store it is given.
   */
  users?: Record<string, UserRow>
  /** UC-22 — live sign-ins, keyed by the token's SHA-256 (never the token). */
  auth_tokens?: Record<string, AuthTokenRow>
  /**
   * F-007 - one row per model-backed turn, keyed by its own id. This is an
   * append-only ledger: nothing rewrites a row, because what a call cost is a
   * fact about the day it ran.
   */
  ai_usage?: Record<string, AiUsageRow>
}

export const emptyState = (): StoreState => ({
  sessions: {},
  turns: {},
  tasks: {},
  undo_records: {},
  accounts: {},
  lists: {},
  users: {},
  auth_tokens: {},
  ai_usage: {},
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
