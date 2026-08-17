// Snapshot comparison (AC-7, AC-12): a task counts as modified iff its current
// state differs from the recorded entry — field-by-field over the full task
// shape, zero heuristics.

import type { TaskRow } from '../types.ts'

const FIELDS = [
  'id',
  'user_id',
  'title',
  'due_at',
  'reminder_at',
  'priority',
  'status',
  'created_at',
  'updated_at',
  'deleted_at',
] as const

export function taskEquals(a: TaskRow | undefined, b: TaskRow | undefined): boolean {
  if (a === undefined || b === undefined) return a === b
  return FIELDS.every((f) => a[f] === b[f])
}

export const cloneTask = (t: TaskRow): TaskRow => ({ ...t })
