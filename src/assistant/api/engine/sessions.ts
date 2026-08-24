// Session lifecycle (ADR-003/004/005): one open session per account, lazy
// server-owned idle close, close resolves unanswered questions as declined
// (D2) and records the boundary (AC-28).

import type { Clock } from '../ports/clock.ts'
import type { StoreState } from '../store/store.ts'
import type {
  BoundaryDeclined,
  BoundaryLateOutcome,
  CloseReason,
  SessionRow,
  TurnRow,
} from '../types.ts'
import { sessionTurns } from './serialize.ts'

export const DEFAULT_IDLE_CLOSE_MS = 180_000 // 180 s (ADR-004)

export const nowIso = (clock: Clock): string => new Date(clock.now()).toISOString()

export function findOpenSession(state: StoreState, userId: string): SessionRow | undefined {
  return Object.values(state.sessions).find((s) => s.user_id === userId && s.status === 'open')
}

export function latestClosedSession(state: StoreState, userId: string): SessionRow | undefined {
  return Object.values(state.sessions)
    .filter((s) => s.user_id === userId && s.status === 'closed')
    .sort((a, b) => Date.parse(b.closed_at ?? '0') - Date.parse(a.closed_at ?? '0'))[0]
}

export function openSession(state: StoreState, userId: string, id: string, at: string): SessionRow {
  const session: SessionRow = {
    id,
    user_id: userId,
    status: 'open',
    close_reason: null,
    created_at: at,
    last_activity_at: at,
    closed_at: null,
    boundary_declined: null,
    boundary_late: null,
    last_foreground_at: at,
  }
  state.sessions[session.id] = session
  return session
}

export function nextSeq(state: StoreState, sessionId: string): number {
  const turns = sessionTurns(state, sessionId)
  return turns.length === 0 ? 1 : turns[turns.length - 1]!.seq + 1
}

/**
 * The undo window rule (AC-8, mechanical): max seq among applied turns **with
 * non-empty changed_task_ids** of the session. Only turns that actually
 * mutated tasks occupy or advance the window — a non-mutating applied turn
 * (no_match, unsupported_query, unclassifiable, declined resolutions) never
 * holds nor ends it, so a misheard utterance never spends the undo.
 */
export function newestAppliedTurn(state: StoreState, sessionId: string): TurnRow | undefined {
  return sessionTurns(state, sessionId)
    .filter((t) => t.status === 'applied' && (t.changed_task_ids.length > 0 || t.created_ids.length > 0))
    .at(-1)
}

/**
 * Close a session: resolve every unanswered question as declined (D2),
 * record which (boundary_declined) and which turns resolved after the last
 * foreground (boundary_late) so GET /assistant/session can render exactly one
 * boundary message (AC-28).
 */
export function closeSession(
  state: StoreState,
  session: SessionRow,
  reason: CloseReason,
  at: string,
): void {
  const declined: BoundaryDeclined[] = []
  for (const turn of sessionTurns(state, session.id)) {
    if (turn.status === 'asked' && turn.question !== null && turn.question.resolution === null) {
      turn.question.resolution = { result: 'declined', resolved_by_turn_id: null, resolved_at: at }
      declined.push({
        turn_id: turn.id,
        kind: turn.question.kind,
        task_titles: [...turn.question.task_titles],
      })
    }
  }
  const lastForeground = Date.parse(session.last_foreground_at)
  const late: BoundaryLateOutcome[] = sessionTurns(state, session.id)
    .filter(
      (t) =>
        (t.status === 'applied' || t.status === 'failed') &&
        t.resolved_at !== null &&
        Date.parse(t.resolved_at) > lastForeground,
    )
    .map((t) => ({ turn_id: t.id, status: t.status as 'applied' | 'failed', outcome: t.outcome }))

  session.status = 'closed'
  session.close_reason = reason
  session.closed_at = at
  session.last_activity_at = at
  session.boundary_declined = declined
  session.boundary_late = late
}

/**
 * Lazy idle close (ADR-004): runs first on every request that touches the
 * account's session; a session idle >= idleCloseMs closes with reason "idle",
 * so a stale session is never seen as open.
 */
export function lazyIdleClose(
  state: StoreState,
  userId: string,
  clock: Clock,
  idleCloseMs: number,
): void {
  const open = findOpenSession(state, userId)
  if (open === undefined) return
  if (clock.now() - Date.parse(open.last_activity_at) >= idleCloseMs) {
    closeSession(state, open, 'idle', nowIso(clock))
  }
}
