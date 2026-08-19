// F-005 AC-47 — a failed write outlives the surface it was typed into.
//
// ── WHY THIS IS `_shared/` AND NOT REACT STATE ──────────────────────────────
//
// The notice has to see **every** write to that task's field — the retry, an
// assistant turn, an undo, and a background refresh — and only the shared
// controller and `state.tasks` observe all four. React state owned by the detail
// cannot see a turn's write (AC-47, `platform/web.md § F-005`). So the mechanism
// lands here, **which the mobile client compiles**; its *rendering* is web-only,
// its *state* is not, and AC-2's mobile half is where the phone's obligation is
// stated.
//
// ── THE FIVE RULES, AND WHICH ONE EACH FUNCTION IS ─────────────────────────
//
// 1. **One notice per task, not one per field** — the same aggregation AC-2
//    requires of concurrent in-field failures, for the same 4.1.3 reason: N
//    polite announcements satisfy the criterion while making the product
//    unusable for exactly the users AC-16 and AC-33 exist for. (`recordFailure`)
// 2. **A later successful write SUPERSEDES; it does not end.** Whoever made it —
//    the user's retry or an assistant turn — the notice **stands**, carrying the
//    superseded text and **no retry**, until the user dismisses it. Ending it
//    silently is a typed value disappearing without being mentioned; keeping the
//    retry is a control that overwrites the newer stored value with the stale
//    failed one, which is the resurrection door AC-4 closes everywhere else.
//    (`supersede`)
// 3. **Elapsing is not a resolution.** There is no timer in this file and there
//    must not be one anywhere: no timeout, no navigation, no surface change
//    (AC-47, AC-33's 2.2.1 at the strength AC-43 states it — *not by a timer,
//    not by a timer that a focus or a hover extends, and not by any duration
//    however long*). The absence is the requirement, which is why this comment
//    is the only place it can be asserted from.
// 4. **A failure whose cause is that the task is gone produces NO notice**, and a
//    notice already outstanding when the task is deleted **ends here** — reported
//    once, value still legible, **no retry** (AC-4, AC-47). (`endForDeletedTask`,
//    and `recordFailure`'s `taskGone` guard.)
// 5. **Retrying from the notice and retrying from the field are ONE write path
//    called from two places** (AC-47). That path is the controller's; this file
//    only records what it is retrying, so the two callers cannot drift — L-005's
//    shape applied to a recovery path.

import type { Notice, NoticeField, NoticeReason } from '../types.ts'

/** The notice for one task, or `null`. */
export function noticeFor(notices: readonly Notice[], taskId: string): Notice | null {
  return notices.find((n) => n.taskId === taskId) ?? null
}

/** What this notice still offers a working retry for. A superseded field
 * reports and offers none (rule 2); an ended notice offers none at all
 * (rule 4). */
export function retryableFields(n: Notice): NoticeField[] {
  if (n.ended !== null) return []
  return n.fields.filter((f) => !f.superseded)
}

/** Does this task have an outstanding notice with something still retryable? */
export function hasRetry(notices: readonly Notice[], taskId: string): boolean {
  const n = noticeFor(notices, taskId)
  return n !== null && retryableFields(n).length > 0
}

/**
 * The value the notice is carrying for this field, if any — what AC-47 requires
 * a reopened detail to show **while nothing newer has been stored**. Once
 * something has, the field shows the stored value and the notice carries the
 * superseded text; that is why a superseded entry answers `undefined` here.
 */
export function carriedValue(
  notices: readonly Notice[],
  taskId: string,
  field: string,
): { value: unknown } | null {
  const n = noticeFor(notices, taskId)
  if (n === null || n.ended !== null) return null
  const f = n.fields.find((x) => x.field === field)
  if (f === undefined || f.superseded) return null
  return { value: f.value }
}

/**
 * Rule 1 + rule 4. Record a failed or refused write against the task, merging
 * into the one notice that task may have.
 *
 * `taskGone` is the AC-4 case and it is a **refusal to create a notice**, not a
 * notice with the retry hidden: there is nothing to retry and nothing to write
 * into. AC-4's terminal state — unsaved text legible on the surface reporting the
 * deletion, a way back, no retry — remains the whole of that case.
 */
export function recordFailure(
  notices: readonly Notice[],
  entry: {
    taskId: string
    taskTitle: string
    field: string
    value: unknown
    /** what the store held when this failed — see `NoticeField.baseline`. */
    baseline: unknown
    reason: NoticeReason
    at: string
    taskGone?: boolean
  },
): Notice[] {
  if (entry.taskGone === true) return [...notices]
  const field: NoticeField = {
    field: entry.field,
    value: entry.value,
    baseline: entry.baseline,
    reason: entry.reason,
    superseded: false,
  }
  const existing = noticeFor(notices, entry.taskId)
  if (existing === null) {
    return [
      ...notices,
      { taskId: entry.taskId, taskTitle: entry.taskTitle, fields: [field], ended: null, at: entry.at },
    ]
  }
  // A field that fails twice carries the newer value; it does not accumulate two
  // entries, because "one notice per task" would otherwise become "one notice
  // per task with N lines per field", which is rule 1 defeated by arithmetic.
  const fields = [...existing.fields.filter((f) => f.field !== entry.field), field]
  return notices.map((n) =>
    n.taskId === entry.taskId
      ? { ...n, taskTitle: entry.taskTitle, fields, ended: null, at: entry.at }
      : n,
  )
}

/**
 * Rule 2 — a later **successful** write to a field this notice is carrying.
 *
 * The notice stands. The field is marked superseded, keeps the user's text so it
 * can still be read, and records what the store holds now so the report can say
 * *which* newer value it is rather than only that the value moved. **The retry
 * goes** (`retryableFields` filters it), because retrying would overwrite the
 * newer stored value with the stale failed one. Retyping is the available action
 * and it is an ordinary edit, not a recovery path.
 */
export function supersede(
  notices: readonly Notice[],
  taskId: string,
  field: string,
  storedNow: unknown,
): Notice[] {
  const n = noticeFor(notices, taskId)
  if (n === null || n.ended !== null) return [...notices]
  if (!n.fields.some((f) => f.field === field && !f.superseded)) return [...notices]
  return notices.map((x) =>
    x.taskId !== taskId
      ? x
      : {
          ...x,
          fields: x.fields.map((f) =>
            f.field === field ? { ...f, superseded: true, storedNow } : f,
          ),
        },
  )
}

/**
 * A retry **succeeded** — this is the one path that removes a field outright,
 * because the value the notice existed to protect is now in the store and
 * nothing is being lost by the entry going away. When the last field goes, the
 * notice goes.
 */
export function resolveField(notices: readonly Notice[], taskId: string, field: string): Notice[] {
  const out: Notice[] = []
  for (const n of notices) {
    if (n.taskId !== taskId) {
      out.push(n)
      continue
    }
    const fields = n.fields.filter((f) => f.field !== field)
    if (fields.length > 0) out.push({ ...n, fields })
  }
  return out
}

/** The user dismissed it. The only *user* ender, and the only one that may
 * discard a value the user can still see — because they are the one seeing it. */
export function dismiss(notices: readonly Notice[], taskId: string): Notice[] {
  return notices.filter((n) => n.taskId !== taskId)
}

/**
 * Rule 4's other direction (AC-4, tester W9, design D20). AC-47 forbids
 * *creating* a notice for a write that failed **because** the task was gone; a
 * task deleted **after** a notice already exists is reachable from an ordinary
 * sequence — fail a write, close the detail, say *"delete that"*.
 *
 * The notice is **not removed**: it becomes a report, keeping the value it was
 * carrying legible, with no retry. Its lifetime is still AC-47's — it ends when
 * the user dismisses it and by nothing else except a reload — because it is the
 * **last legible copy of text the user typed** and the one ending that offers no
 * retry, so self-dismissal would lose the value by elapse, which is the single
 * failure AC-47 exists to prevent arriving one ender over.
 */
export function endForDeletedTask(notices: readonly Notice[], taskId: string): Notice[] {
  return notices.map((n) => (n.taskId === taskId ? { ...n, ended: 'task-deleted' as const } : n))
}

/**
 * Keep the notice's task title current. The notice **names the task**, and after
 * the row is gone the only copy of that name is the one held here — so a rename
 * that lands while a notice is outstanding has to reach it, or the notice names
 * the task by a name it no longer has.
 */
export function renameIn(notices: readonly Notice[], taskId: string, title: string): Notice[] {
  return notices.map((n) => (n.taskId === taskId ? { ...n, taskTitle: title } : n))
}
