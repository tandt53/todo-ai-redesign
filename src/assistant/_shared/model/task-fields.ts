// The read side of every field F-005 adds — one home per fact (L-004).
//
// `## Impact §1` counts SIXTEEN enumerations of the task's field list in `src/**`
// and seven that gate behaviour. This file exists so the client does not open a
// seventeenth: every question a surface asks about a new field ("is this a
// step?", "what priority is this?", "does this row belong to a live series?") is
// answered here, once, and a grep for the function name returns every reader.
//
// Two of these are the specific shape the spec names as the way this fails:
//
// - **`priorityOf` is tolerant on read** (AC-8). The write path narrows to four
//   values; the read must keep working for a stored value outside the set, or a
//   row from before the migration breaks a client. `none` is the ABSENCE of a
//   stored value, never a stored string.
// - **`seriesLive` reads the wire and is never keyed off `series_id`** (AC-25,
//   AC-39). `series_id` is assigned when a repeat is first set and NEVER
//   cleared, so an implementation keyed off it passes the positive case and
//   marks every task that ever repeated as repeating for good.

import { PRIORITIES } from '../types.ts'
import type { Priority, RepeatDraft, TaskF005Fields, TaskView } from '../types.ts'

/**
 * The F-005 fields a **client-built** row carries when it has none of them — the
 * offline local create (F-001 AC-25) is the only producer.
 *
 * It is spelled out rather than spread from a partial because a client row is
 * **wire-shaped**, and a field missing from a constructor is `undefined` rather
 * than its declared empty value — which is exactly the distinction AC-6 makes
 * observable on read-back, and the reason `## Impact §1` lists the four row
 * constructors separately from the seven gating lists.
 *
 * `priority` is `'none'`, not `null`: on the wire the absence of a stored value is
 * spelled `"none"` (AC-8), so a `null` here would be a row no server could send.
 */
export function emptyF005Fields(): TaskF005Fields & {
  priority: Priority
  reminder_at: string | null
} {
  return {
    note: null,
    due_all_day: null,
    reminder_at: null,
    reminder_shown_at: null,
    priority: 'none',
    parent_id: null,
    step_order: null,
    completed_by_parent: false,
    repeat_frequency: null,
    repeat_interval: null,
    repeat_weekdays: null,
    repeat_month_days: null,
    repeat_until: null,
    repeat_count: null,
    series_id: null,
    series_live: false,
  }
}

/**
 * Apply a field-level patch to a row **optimistically**, keeping the row
 * wire-shaped.
 *
 * The one normalisation it performs is `priority: null → 'none'`: the write
 * vocabulary accepts `null` for *clear it* (api-contracts § `PATCH`), and the wire
 * never carries `null` for it (AC-8). Without this the optimistic row would hold
 * a value no read could ever produce, and every predicate downstream would have
 * two shapes to be right about instead of one.
 */
export function mergePatch(task: TaskView, patch: object): TaskView {
  const next = { ...task, ...patch } as TaskView & { priority: Priority | null }
  if (next.priority === null) next.priority = 'none'
  return next as TaskView
}

/**
 * AC-8 — the four states, read tolerantly.
 *
 * `null` (783 of 790 live rows), `undefined` (a row read before the wire carried
 * the field) and any value outside the set all read as `none` — the same move
 * ADR-009 made for `status: 'today'`. This is what keeps `## Data`'s
 * `Required: yes` and the measured migration-free claim true at once.
 */
export function priorityOf(t: TaskView): Priority {
  const raw = t.priority
  if (typeof raw !== 'string') return 'none'
  return (PRIORITIES as readonly string[]).includes(raw) ? (raw as Priority) : 'none'
}

/**
 * AC-18 — a step is a row with a parent. **Structural, not a second flag**: the
 * wire carries `parent_id` and nothing else decides it.
 *
 * `?? null` rather than a truthiness test, because `parent_id` is absent on a
 * row read before the wire carried it and `undefined` must read as *top-level*,
 * not as *unknown*.
 */
export function isStep(t: TaskView): boolean {
  return (t.parent_id ?? null) !== null
}

/**
 * AC-15 — **ONE implementation, not two.** The original product found it had two
 * functions answering "which steps does this task have", one sorted by the
 * user's order and one not, and the unsorted one was the one both clients drew
 * from; nobody saw it because until drag shipped there was no order to lose
 * (`04-feature-audit.md` UC-36). That is L-004's shape and it is the specific way
 * this AC fails, so there is exactly one of these and it always sorts.
 *
 * The order is **never derived from a step's date** — a step that has a deadline
 * does not jump. Ties fall back to `created_at` so the order is total even for
 * rows written before `step_order` existed.
 */
export function stepsOf(tasks: readonly TaskView[], parentId: string): TaskView[] {
  return tasks
    .filter((t) => (t.parent_id ?? null) === parentId && t.deleted_at === null)
    .sort((a, b) => {
      const ao = a.step_order ?? Number.MAX_SAFE_INTEGER
      const bo = b.step_order ?? Number.MAX_SAFE_INTEGER
      if (ao !== bo) return ao - bo
      return a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0
    })
}

/**
 * AC-17 — how many steps are left, for the row.
 *
 * **A different number about a different set**, and never sourced from
 * `collectionCount` (L-004, `## Impact §5`): that one counts what a collection
 * holds and steps are in no collection at all (AC-35). A task with no steps
 * returns `0`, and the row shows nothing — the AC's own negative half.
 */
export function remainingSteps(tasks: readonly TaskView[], parentId: string): number {
  return stepsOf(tasks, parentId).filter((t) => t.status !== 'done').length
}

/** Total steps, for the detail's own account of the list. */
export function totalSteps(tasks: readonly TaskView[], parentId: string): number {
  return stepsOf(tasks, parentId).length
}

/**
 * AC-25 / AC-39 — **is this row in a LIVE series?** Read from the wire, derived
 * nowhere else.
 *
 * The negative cases are half the AC: a cleared repeat, a series ended by an end
 * date or a run count, and **a completed occupant of a series AC-30's series
 * delete removed** all answer `false`. All four endings are the server's to
 * evaluate (`series_live`); the client's job is to not re-derive them, because
 * every plausible client-side predicate — `series_id != null` most of all — gets
 * the fourth ending wrong on every occurrence of every deleted series.
 *
 * A row from before the wire carried the field answers `false`: nothing that
 * predates F-005 can be in a series, since nothing could set a repeat.
 */
export function seriesLive(t: TaskView): boolean {
  return t.series_live === true
}

/** Does this row carry a repeat at all? Distinct from `seriesLive`: a repeat can
 * be set on a series that has already ended by its end date or run count. */
export function hasRepeat(t: TaskView): boolean {
  return (t.repeat_frequency ?? null) !== null
}

/** The six ADR-011 members as a draft object — what the picker edits. */
export function repeatOf(t: TaskView): RepeatDraft {
  return {
    repeat_frequency: t.repeat_frequency ?? null,
    repeat_interval: t.repeat_interval ?? null,
    repeat_weekdays: t.repeat_weekdays ?? null,
    repeat_month_days: t.repeat_month_days ?? null,
    repeat_until: t.repeat_until ?? null,
    repeat_count: t.repeat_count ?? null,
  }
}

export const EMPTY_REPEAT: RepeatDraft = {
  repeat_frequency: null,
  repeat_interval: null,
  repeat_weekdays: null,
  repeat_month_days: null,
  repeat_until: null,
  repeat_count: null,
}

/**
 * AC-6 — **empty, whitespace-only and newline-only input is no note at all,
 * never an empty string**, and the distinction is observable on read-back.
 * Line breaks inside a real note survive untouched.
 */
export function normalizeNote(input: string): string | null {
  return input.trim() === '' ? null : input
}

/**
 * AC-37 — **an empty title is refused; the task keeps the name it had.** Blank,
 * whitespace-only and newline-only are all empty.
 *
 * Returns `null` for "refuse this", so the caller states the refusal rather than
 * silently writing something. The guard belongs on the transition (L-005) and
 * `AC-40` is where it binds server-side; this is the surface's copy of the same
 * rule, and the two must agree because F-001 AC-18's inline rename is a second
 * door onto the same field.
 */
export function normalizeTitle(input: string): string | null {
  const t = input.trim()
  return t === '' ? null : t
}

/**
 * AC-13 — is this due a **date with no time**?
 *
 * Three-way, deliberately, because the wire's third value is not a third state
 * of the flag (ADR-010): a **stored** flag is authoritative wherever present;
 * `null`/absent means NOT DETERMINED and **renders as a date with no clock
 * time**, which is the direction AC-13 exists to protect — never a time nobody
 * picked. So both `true` and *undetermined* suppress the clock, and only an
 * explicit `false` prints one.
 */
export function rendersClockTime(t: TaskView): boolean {
  return t.due_all_day === false
}

/**
 * AC-38 — has this reminder's moment passed **and not been acknowledged**?
 *
 * "Already acknowledged" is a **stored** fact (`reminder_shown_at`) and not a
 * session fact, so it resolves everywhere: not on the next launch, not on the
 * next device, not after a reload. A reminder on a task that is done or deleted
 * is not surfaced.
 *
 * `now` is required rather than defaulted — this is a date computation and AC-44
 * forbids one that can silently read the wall clock.
 */
export function reminderPassedUnacknowledged(t: TaskView, now: Date): boolean {
  const at = t.reminder_at
  if (at === null || at === undefined) return false
  if (t.status === 'done' || t.deleted_at !== null) return false
  if ((t.reminder_shown_at ?? null) !== null) return false
  const d = new Date(at)
  if (Number.isNaN(d.getTime())) return false
  return d.getTime() <= now.getTime()
}
