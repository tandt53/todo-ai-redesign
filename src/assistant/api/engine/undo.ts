// Undo path (F-001 AC-5..8, ADR-006; F-005 AC-46, AC-28, AC-19, ADR-013). The
// caller runs performUndo INSIDE one store transaction, so the window check and
// the revert are atomic (AC-6) — a refusal throws (rolling back nothing, since
// nothing was written) and a mid-revert failure discards the whole draft.
//
// Refusal rule is mechanical (api-contracts.md): undo succeeds iff
// status == "applied" and the turn has the max seq among applied turns of the
// open session. Idempotent replay of an already-undone turn is checked FIRST:
// it re-serves the recorded success outcome (no second revert) even if the
// session has since closed — mirroring AC-16's replay semantics.
//
// F-005 adds two revert SHAPES and **their conditions differ by class**
// (api-contracts § Revert shapes, ADR-013). Getting this wrong is invisible from
// the natural test, which uses a repeating completion — the one class revision 3's
// single rule did cover.

import { ApiError } from '../errors.ts'
import type { StoreState } from '../store/store.ts'
import type { TaskRow, TurnRow, UndoOutcomeWire, UndoVia } from '../types.ts'
import { newestAppliedTurn } from './sessions.ts'
import { cloneTask, replayTask, taskEquals } from './task-equals.ts'

function refuse(reason: 'not_newest' | 'session_closed' | 'not_undoable', turnId: string | null): ApiError {
  return new ApiError(409, 'UNDO_REFUSED', `undo refused: ${reason}`, {
    detail: { reason, turn_id: turnId },
  })
}

/** voice-guard path: no mutating applied turn exists in the open session */
export const undoRefusedNoAppliedTurn = (): ApiError => refuse('not_undoable', null)

const liveSteps = (state: StoreState, parentId: string): TaskRow[] =>
  Object.values(state.tasks).filter((t) => (t.parent_id ?? null) === parentId && t.deleted_at === null)

/**
 * AC-28's five conditions, conjunctive, evaluated against the row as it stands
 * now: same `series_id` as the occurrence the turn completed, created no earlier
 * than the completion (true by construction — the turn created it), never edited
 * (`updated_at` equals `created_at`), not itself done, and **no step of it ticked
 * or changed**.
 *
 * The whole-row `taskEquals(current, post_apply)` comparison undo uses for an
 * ordinary created row is **not sufficient here**: condition five touches the
 * **step's** row, not the successor's. Left at the whole-row comparison, undo
 * hard-deletes a successor whose steps the user has worked on — in exactly the
 * case AC-28 exists to protect, and the natural test for it passes (ADR-013).
 */
function successorStillRemovable(state: StoreState, succ: TaskRow, seriesIds: Set<string>): boolean {
  if (succ.deleted_at !== null) return false
  const series = succ.series_id ?? null
  if (series === null || !seriesIds.has(series)) return false
  if (succ.updated_at !== succ.created_at) return false
  if (succ.status === 'done') return false
  for (const step of liveSteps(state, succ.id)) {
    if (step.status === 'done') return false
    if (step.updated_at !== step.created_at) return false
  }
  return true
}

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
  // window (contract: refused not_undoable, not not_newest). A `refused` turn
  // (F-005 AC-36) lands here too, by the same mechanical rule and with no new
  // turn status — which is why AC-40's refusal needed none.
  // F-008 AC-26: a list_create turn has empty changed_task_ids but IS undoable
  // (it created a list entity). Check created_ids too.
  if (turn.changed_task_ids.length === 0 && turn.created_ids.length === 0) {
    throw refuse('not_undoable', turn.id)
  }
  const newest = newestAppliedTurn(state, session.id)
  if (newest === undefined || newest.id !== turn.id) {
    throw refuse('not_newest', turn.id)
  }

  const revertedRows: TaskRow[] = []
  const skippedRows: TaskRow[] = []
  let revertedCount = 0
  const postApply = turn.post_apply ?? {}
  const createdIds = new Set(turn.created_ids)
  const snapshot = turn.undo_snapshot ?? []
  // the series the turn's own snapshot rows belong to — AC-28's first condition
  const seriesIds = new Set(
    snapshot.map((r) => r.series_id ?? null).filter((s): s is string => s !== null),
  )
  // Every row this turn knows about, so a parent can be NAMED even after its own
  // row has been hard-removed from the state (AC-28's successor takes its steps).
  const recorded = new Map<string, TaskRow>()
  for (const row of snapshot) recorded.set(row.id, row)
  for (const row of Object.values(postApply)) recorded.set(row.id, row)

  const skip = (row: TaskRow | undefined, fallback: TaskRow | undefined): void => {
    const named = row ?? fallback
    if (named !== undefined) skippedRows.push(named)
  }

  // F-008 AC-26: undo of list_create. A created_id that names a LIST (not a task)
  // removes the list and unfiles all tasks that were filed into it — matching
  // DELETE /lists/{id} with confirm: true semantics. The list's id is in
  // created_ids; if the id is not in state.tasks it must be a list id.
  for (const createdId of [...turn.created_ids]) {
    if (state.tasks[createdId] !== undefined) continue // handled below as a task
    const lists = state.lists ?? {}
    const list = lists[createdId]
    if (list === undefined) continue
    // Unfile all tasks in this list
    for (const t of Object.values(state.tasks)) {
      if (t.user_id === list.user_id && (t.list_id ?? null) === createdId && t.deleted_at === null) {
        t.list_id = null
        t.updated_at = at
      }
    }
    delete lists[createdId]
    // Remove from created_ids so the task loop below doesn't try to process it
    const idx = turn.created_ids.indexOf(createdId)
    if (idx !== -1) {
      // Mark as reverted — the list was removed
      revertedCount += 1
    }
  }

  // created tasks: removed, and staying removed on a fresh task-list read (AC-6)
  for (const taskId of turn.created_ids) {
    const cur = state.tasks[taskId]
    const expected = postApply[taskId]
    // **Which class is this created row?** A generated successor carries a
    // `series_id`; a task a TURN created never can, because a turn may not set
    // any repeat member (AC-36) and `series_id` is assigned only when a repeat is
    // first set. So the discriminator is derived from the records that already
    // exist — ADR-013's *no new record, no fourth shape*.
    const isSuccessor = cur !== undefined && (cur.series_id ?? null) !== null
    const removable = isSuccessor
      ? successorStillRemovable(state, cur, seriesIds)
      : cur !== undefined && taskEquals(cur, expected)
    if (cur !== undefined && removable) {
      for (const step of liveSteps(state, taskId)) {
        // a successor's steps were created with it and go with it
        recorded.set(step.id, cloneTask(step))
        delete state.tasks[step.id]
      }
      recorded.set(taskId, cloneTask(cur))
      delete state.tasks[taskId]
      revertedRows.push(cur)
      revertedCount += 1
    } else {
      skip(cur, expected)
    }
  }

  // edit → prior field values restored; delete → tasks restored, fields intact;
  // hard-removed → put back. Snapshot comparison: a task is skipped iff its
  // current state differs from the state this turn left it in — zero silent
  // overwrites (AC-7).
  for (const entry of snapshot) {
    if (createdIds.has(entry.id)) continue // handled above
    const cur = state.tasks[entry.id]
    const expected = postApply[entry.id]
    // A row this turn HARD-removed (AC-28's successor removal) has no
    // `post_apply` entry and no live row: its current state matches the state the
    // turn left it in — absent — so it reverts. This needs no fourth record
    // (ADR-013): "absent, as planned" is itself the comparison passing.
    const removedByThisTurn = cur === undefined && expected === undefined
    // AC-19's `completed_by_parent` guard for a cascade-ticked step: the step is
    // reverted **as its own row**, never as a side effect of the parent's row
    // being replaced — a whole-row replacement of the parent bypasses the guard
    // entirely. The guard's observable is that a step the user has hand-touched
    // since no longer matches `post_apply` and is therefore skipped.
    if (removedByThisTurn || (cur !== undefined && taskEquals(cur, expected))) {
      state.tasks[entry.id] = replayTask(entry, cur)
      revertedRows.push(state.tasks[entry.id]!)
      revertedCount += 1
    } else {
      skip(cur, entry)
    }
  }

  // **Both lists name top-level tasks ONLY** (ADR-013, AC-35, AC-36).
  //
  // The contract states the rule for `skipped`, and its reason is general: *"step
  // titles are never rendered, because a step is neither drawn nor addressable"*.
  // `reverted` carries a `title` too and a client renders it, so the rule is applied
  // to both — the alternative ships **step titles the user has never seen** into a
  // message through the other half of the same object. A voice "done" on a parent
  // with eight steps reverts nine rows and names ONE. **Extension of the contract's
  // literal wording, recorded in the return rather than left implicit.**
  //
  // A parent can therefore appear in `skipped` while also appearing in `reverted` —
  // its own revert succeeded and its steps' did not, which is exactly *"the parent is
  // named, and the message states that its steps were not fully reversed"*. That is
  // the only encoding the fixed `{task_id, title, reason}` shape admits.
  /**
   * The top-level subject a row is REPORTED THROUGH. A top-level row is its own
   * subject; a step's subject is its parent, resolved from the live state or from
   * the rows this turn recorded (a parent that was hard-removed is still nameable).
   * A step whose parent cannot be resolved is dropped rather than named — naming
   * the step is the thing that is forbidden.
   */
  const subjectOf = (row: TaskRow): TaskRow | undefined => {
    const parentId = row.parent_id ?? null
    if (parentId === null) return row
    return state.tasks[parentId] ?? recorded.get(parentId)
  }

  const nameTopLevel = <T>(rows: TaskRow[], make: (row: TaskRow) => T): T[] => {
    const out: T[] = []
    const named = new Set<string>()
    for (const row of rows) {
      const subject = subjectOf(row)
      if (subject === undefined || named.has(subject.id)) continue
      named.add(subject.id)
      out.push(make(subject))
    }
    return out
  }

  const skipped = nameTopLevel(skippedRows, (row) => ({
    task_id: row.id,
    title: row.title,
    reason: 'modified_since_apply' as const,
  }))
  const reverted = nameTopLevel(revertedRows, (row) => ({ task_id: row.id, title: row.title }))

  // **`nothing_reverted` is the RAW count, not the list length.** The lists are
  // collapsed to top-level subjects, so nine reverted rows can render as one name —
  // deriving the flag from `reverted.length` would be correct today and wrong the
  // first time every reverted row is a step.
  const nothingReverted = revertedCount === 0
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

/** re-exported for the plan/apply path's snapshot capture */
export { cloneTask }
