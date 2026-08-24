// Snapshot comparison (F-001 AC-7, AC-12; F-005 AC-34): a task counts as
// modified iff its current state differs from the recorded entry — field-by-field
// over the full task shape, zero heuristics.

import type { TaskRow } from '../types.ts'
import { RECURRENCE_MEMBERS } from './recurrence.ts'

/**
 * The comparison list gains **every** F-005 field except the derived
 * `series_live` (`data-model.md § task-equals's FIELDS`). Widening it is what
 * makes AC-34's second rule necessary — see `taskEquals`.
 */
const FIELDS = [
  'id',
  'user_id',
  'title',
  'note',
  'due_at',
  'due_all_day',
  'reminder_at',
  'reminder_shown_at',
  'priority',
  'status',
  'parent_id',
  'step_order',
  'completed_by_parent',
  'ever_completed',
  ...RECURRENCE_MEMBERS,
  'series_id',
  'series_ended_at',
  'delete_gesture_id',
  'list_id',
  'created_at',
  'updated_at',
  'deleted_at',
] as const

/**
 * AC-34's **second** rule, and it pulls in the opposite direction to the replay
 * rule beside it:
 *
 * > On comparison (the modified-since gate in front of the replay): an **absent
 * > key in a stored record means *not recorded* and compares equal to whatever
 * > is live.**
 *
 * Without this, every pre-F-005 `post_apply` record compares unequal to its live
 * row — `undefined` stored versus `null` live — for **every new field at once**,
 * so an undo across the change reverts nothing and reports *every* task as
 * modified: F-001 AC-7's skip path firing on tasks the user never touched, and a
 * created task left standing. That is louder and more wrong than the unset-field
 * case, and the replay rule does not fix it, because the gate **compares** rather
 * than replays.
 *
 * The record this is proven against **cannot be produced by today's code** — a
 * snapshot captured by this build is already the new shape, so a test that
 * captures its own snapshot cannot fail AC-34. The old-shape record comes from
 * the QA harness's `POST /__qa__/seed` (api-contracts § Harness doors).
 */
export function taskEquals(a: TaskRow | undefined, b: TaskRow | undefined): boolean {
  if (a === undefined || b === undefined) return a === b
  return FIELDS.every((f) => {
    if (!(f in a) || !(f in b)) return true // not recorded — equal to whatever is live
    return a[f] === b[f]
  })
}

export const cloneTask = (t: TaskRow): TaskRow => ({ ...t })

/**
 * AC-34's **first** rule, the replay half: *a field the stored record does not
 * mention is left exactly as it is, and "no value" is never written over a value
 * the user set.* Stored records are past states and are not rewritten to the new
 * shape (ADR-009, `data-model.md § status`).
 *
 * So a revert **merges** the record over the live row rather than replacing it:
 * `{...live, ...recordedKeysOnly}`. A whole-row replacement would unset every
 * field a pre-F-005 snapshot predates.
 */
export function replayTask(record: TaskRow, live: TaskRow | undefined): TaskRow {
  if (live === undefined) return cloneTask(record)
  const out = cloneTask(live)
  for (const f of FIELDS) {
    if (!(f in record)) continue
    ;(out as unknown as Record<string, unknown>)[f] = record[f]
  }
  return out
}
