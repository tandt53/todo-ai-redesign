// Apply primitives: create / edit / delete against the in-memory state, all
// invoked INSIDE a store transaction (the caller wraps them — AC-1 atomicity
// comes from Store.transact's clone-and-swap). Every apply returns the full
// anatomy (AC-4), the pre-apply undo_snapshot captured immediately before the
// mutation (AC-6), and the post-apply state used for modified-since detection
// (AC-7).

import type { StoreState } from '../store/store.ts'
import type { AppliedAnatomy, DiffRow, TaskChanges, TaskRow, TaskStatus } from '../types.ts'
import { cloneTask } from './task-equals.ts'

export interface ApplyResult {
  anatomy: AppliedAnatomy
  /** pre-apply state (edit/delete) or created rows (create) */
  snapshot: TaskRow[]
  /** state of each touched task immediately after apply, keyed by task id */
  post_apply: Record<string, TaskRow>
  created_ids: string[]
}

export interface NewTaskFields {
  title: string
  due_at?: string | null
  priority?: string | null
  status?: TaskStatus
}

const DIFF_FIELDS = ['title', 'due_at', 'reminder_at', 'priority', 'status'] as const

export function applyCreate(
  state: StoreState,
  userId: string,
  tasks: NewTaskFields[],
  at: string,
  uuid: () => string,
): ApplyResult {
  const result: ApplyResult = {
    anatomy: { changed_task_ids: [], diff: [], created_titles: [], deleted_titles: [] },
    snapshot: [],
    post_apply: {},
    created_ids: [],
  }
  for (const fields of tasks) {
    const row: TaskRow = {
      id: uuid(),
      user_id: userId,
      title: fields.title,
      due_at: fields.due_at ?? null,
      reminder_at: null,
      priority: fields.priority ?? null,
      status: fields.status ?? 'inbox',
      created_at: at,
      updated_at: at,
      deleted_at: null,
    }
    state.tasks[row.id] = row
    result.anatomy.changed_task_ids.push(row.id)
    result.anatomy.created_titles.push(row.title)
    for (const field of DIFF_FIELDS) {
      if (row[field] !== null) {
        result.anatomy.diff.push({ task_id: row.id, field, old: null, new: row[field] })
      }
    }
    // create: nothing pre-existing to snapshot — the snapshot records the
    // created rows themselves (data-model: "records the created task ids")
    result.snapshot.push(cloneTask(row))
    result.post_apply[row.id] = cloneTask(row)
    result.created_ids.push(row.id)
  }
  return result
}

export function applyEdit(
  state: StoreState,
  edits: { task_id: string; changes: TaskChanges }[],
  at: string,
): ApplyResult {
  const result: ApplyResult = {
    anatomy: { changed_task_ids: [], diff: [], created_titles: [], deleted_titles: [] },
    snapshot: [],
    post_apply: {},
    created_ids: [],
  }
  for (const { task_id, changes } of edits) {
    const cur = state.tasks[task_id]
    if (cur === undefined || cur.deleted_at !== null) continue
    result.snapshot.push(cloneTask(cur)) // immediately before apply (AC-6)
    const diffs: DiffRow[] = []
    for (const field of DIFF_FIELDS) {
      const next = changes[field]
      if (next !== undefined && next !== cur[field]) {
        diffs.push({ task_id, field, old: cur[field], new: next })
        ;(cur as unknown as Record<string, unknown>)[field] = next
      }
    }
    cur.updated_at = at
    result.anatomy.changed_task_ids.push(task_id)
    result.anatomy.diff.push(...diffs)
    result.post_apply[task_id] = cloneTask(cur)
  }
  return result
}

/** Soft delete (deleted_at) — AC-4: deletes are named by title, no row remains on reads. */
export function applyDelete(state: StoreState, taskIds: string[], at: string): ApplyResult {
  const result: ApplyResult = {
    anatomy: { changed_task_ids: [], diff: [], created_titles: [], deleted_titles: [] },
    snapshot: [],
    post_apply: {},
    created_ids: [],
  }
  for (const taskId of taskIds) {
    const cur = state.tasks[taskId]
    if (cur === undefined || cur.deleted_at !== null) continue
    result.snapshot.push(cloneTask(cur)) // pre-delete state, all fields intact (AC-6)
    for (const field of DIFF_FIELDS) {
      if (cur[field] !== null) {
        result.anatomy.diff.push({ task_id: taskId, field, old: cur[field], new: null })
      }
    }
    cur.deleted_at = at
    cur.updated_at = at
    result.anatomy.changed_task_ids.push(taskId)
    result.anatomy.deleted_titles.push(cur.title)
    result.post_apply[taskId] = cloneTask(cur)
  }
  return result
}
