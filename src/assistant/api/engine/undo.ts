// Undo path (AC-5..8, ADR-006). The caller runs performUndo INSIDE one store
// transaction, so the window check and the revert are atomic (AC-6) — a
// refusal throws (rolling back nothing, since nothing was written) and a
// mid-revert failure discards the whole draft.
//
// Refusal rule is mechanical (api-contracts.md): undo succeeds iff
// status == "applied" and the turn has the max seq among applied turns of the
// open session. Idempotent replay of an already-undone turn is checked FIRST:
// it re-serves the recorded success outcome (no second revert) even if the
// session has since closed — mirroring AC-16's replay semantics.

import { ApiError } from '../errors.ts'
import type { StoreState } from '../store/store.ts'
import type { TaskRow, TurnRow, UndoOutcomeWire, UndoVia } from '../types.ts'
import { newestAppliedTurn } from './sessions.ts'
import { cloneTask, taskEquals } from './task-equals.ts'

function refuse(reason: 'not_newest' | 'session_closed' | 'not_undoable', turnId: string | null): ApiError {
  return new ApiError(409, 'UNDO_REFUSED', `undo refused: ${reason}`, {
    detail: { reason, turn_id: turnId },
  })
}

/** voice-guard path: no mutating applied turn exists in the open session */
export const undoRefusedNoAppliedTurn = (): ApiError => refuse('not_undoable', null)

/**
 * Execute (or refuse) an undo of `turn`. Mutates `state`; must run inside
 * Store.transact. Returns the UndoOutcome wire shape.
 */
export function performUndo(
  state: StoreState,
  turn: TurnRow,
  via: UndoVia,
  at: string,
  transcript?: string,
): UndoOutcomeWire {
  // idempotent replay: same success outcome, no second revert (AC-6)
  if (turn.status === 'undone' && turn.undo_result !== null) {
    const r = turn.undo_result
    return {
      turn_id: turn.id,
      undone: true,
      already_undone: true,
      reverted: structuredClone(r.reverted),
      skipped: structuredClone(r.skipped),
      nothing_reverted: r.nothing_reverted,
      via: r.via,
    }
  }

  const session = state.sessions[turn.session_id]
  if (session === undefined || session.status === 'closed') {
    throw refuse('session_closed', turn.id)
  }
  if (turn.status !== 'applied') {
    throw refuse('not_undoable', turn.id)
  }
  // a non-mutating applied turn captured no undo_snapshot and is never in the
  // window (contract: refused not_undoable, not not_newest)
  if (turn.changed_task_ids.length === 0) {
    throw refuse('not_undoable', turn.id)
  }
  const newest = newestAppliedTurn(state, session.id)
  if (newest === undefined || newest.id !== turn.id) {
    throw refuse('not_newest', turn.id)
  }

  const reverted: { task_id: string; title: string }[] = []
  const skipped: { task_id: string; title: string; reason: 'modified_since_apply' }[] = []
  const postApply = turn.post_apply ?? {}
  const createdIds = new Set(turn.created_ids)

  // created tasks: removed, and staying removed on a fresh task-list read (AC-6)
  for (const taskId of turn.created_ids) {
    const cur = state.tasks[taskId]
    const expected = postApply[taskId]
    if (cur !== undefined && taskEquals(cur, expected)) {
      delete state.tasks[taskId]
      reverted.push({ task_id: taskId, title: expected?.title ?? '' })
    } else {
      skipped.push({
        task_id: taskId,
        title: cur?.title ?? expected?.title ?? '',
        reason: 'modified_since_apply',
      })
    }
  }

  // edit → prior field values restored; delete → tasks restored, fields intact.
  // Snapshot comparison: a task is skipped iff its current state differs from
  // the state this turn left it in — zero silent overwrites (AC-7).
  for (const entry of turn.undo_snapshot ?? []) {
    if (createdIds.has(entry.id)) continue // handled above
    const cur = state.tasks[entry.id]
    const expected = postApply[entry.id]
    if (cur !== undefined && taskEquals(cur, expected)) {
      state.tasks[entry.id] = cloneTask(entry)
      reverted.push({ task_id: entry.id, title: entry.title })
    } else {
      skipped.push({
        task_id: entry.id,
        title: cur?.title ?? entry.title,
        reason: 'modified_since_apply',
      })
    }
  }

  const nothingReverted = reverted.length === 0
  turn.status = 'undone'
  turn.undo_result = {
    reverted,
    skipped,
    nothing_reverted: nothingReverted,
    via,
    ...(transcript !== undefined ? { transcript } : {}), // recorded on voice undo (ADR-006)
    undone_at: at,
  }
  session.last_activity_at = at

  return {
    turn_id: turn.id,
    undone: true,
    already_undone: false,
    reverted: structuredClone(reverted),
    skipped: structuredClone(skipped),
    nothing_reverted: nothingReverted,
    via,
  }
}
