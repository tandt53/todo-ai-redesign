// The write allowlists and the diff enumeration (F-005 AC-36, api-contracts
// § The write allowlist, and `DIFF_FIELDS` splitting in two).
//
// `api-contracts § The seven closed field lists` names this file twice —
// `DIFF_FIELDS` and `NewTaskFields` — so both stay here, under those names, and
// `engine/plan.ts` reads them. The apply PRIMITIVES that used to live here moved
// to `plan.ts` with ADR-013's plan → capture → apply phases: `applyEdit` used to
// assign straight onto the row, which is exactly the unguarded door AC-40 closes,
// and the caused rows AC-46 adds cannot be captured from inside a per-row loop.

import type { TaskChanges, TaskStatus } from '../types.ts'
import { RECURRENCE_MEMBERS } from './recurrence.ts'

/**
 * **`DIFF_FIELDS` becomes two constants** (AC-36) — one constant cannot be both,
 * and narrowing it silently would make a repeating task's deletion emit a diff
 * with no recurrence in it.
 *
 * `TURN_WRITE_FIELDS` is what a TURN may set. `note`, `priority`, `due_at`,
 * `reminder_at` are AC-36's four value fields; `title` and `status` are F-001's.
 * It excludes `parent_id`, `step_order`, every `repeat_*` member, `due_all_day`,
 * `reminder_shown_at`, `series_id` and `deleted_at`.
 */
export const TURN_WRITE_FIELDS = [
  'title',
  'note',
  'due_at',
  'reminder_at',
  'priority',
  'status',
] as const

/**
 * What a create or a delete must describe **completely** (F-001 AC-2, AC-4).
 * A recurrence change is reported as PER-MEMBER rows (ADR-011), so the declared
 * `{task_id, field, old|null, new|null}` shape does not change.
 */
export const DIFF_FIELDS = [
  'title',
  'note',
  'due_at',
  'due_all_day',
  'reminder_at',
  'priority',
  'status',
  'parent_id',
  'step_order',
  ...RECURRENCE_MEMBERS,
] as const

/**
 * The turn-path **create** allowlist, widened to `TURN_WRITE_FIELDS` (AC-36,
 * dev-backend F4). `applyCreate` used to hard-code `reminder_at: null` and carry
 * no note, so *"add a task to call the dentist and remind me at nine"* — the most
 * natural sentence for the field the owner's decision exists to make reachable —
 * created the task and **silently dropped the reminder**, with a diff that never
 * mentioned it.
 */
export interface NewTaskFields {
  title: string
  note?: string | null
  due_at?: string | null
  reminder_at?: string | null
  priority?: string | null
  status?: TaskStatus
}

/** `NewTaskFields` as a change set, for the one planner both doors call. */
export const newTaskChanges = (fields: NewTaskFields): TaskChanges => ({
  title: fields.title,
  ...(fields.note !== undefined ? { note: fields.note } : {}),
  ...(fields.due_at !== undefined ? { due_at: fields.due_at } : {}),
  ...(fields.reminder_at !== undefined ? { reminder_at: fields.reminder_at } : {}),
  ...(fields.priority !== undefined ? { priority: fields.priority } : {}),
  ...(fields.status !== undefined ? { status: fields.status } : {}),
})
