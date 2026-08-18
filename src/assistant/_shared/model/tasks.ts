// The task list's own view model — collections, the open count, day grouping.
//
// Why this is in `_shared/model/` rather than inside the web component that
// draws it: three different things now publish numbers about the same set, and
// components.md § PathSwitch fixes them as ONE number, not three definitions of
// it — "the count is open tasks due today — the same number § TaskList's header
// publishes, never a second definition of it". The PathSwitch badge, the Tasks
// header and the Lists menu's per-row counts all call `openTodayCount` /
// `collectionTasks` here. A second copy of the predicate is L-004's shape: two
// homes for one fact, drifting silently while both look right.
//
// The collections were `task.status` plus the due-date union the shipped
// `today` filter used (information-architecture.md §7: "S2's Inbox / Today /
// Done collections — they are `status`"). **ADR-009 split them**: Done is
// still `status`, and Today is now purely `due_at` — the status leg is gone,
// and `status: 'today'` is a record-only legacy value nothing writes. IA §7's
// sentence is true of Inbox and Done and no longer of Today; the ADR is the
// authority, and this comment is the place the two are reconciled.
//
// **Inbox is a superset of Today, not its complement, and that is deliberate.**
// Two artifacts describe these rows and they do not say quite the same thing:
// IA §3 says the shipped `all / today / done` filters "become three menu rows —
// same data, addressable", while components.md § ListsMenu names the rows
// Inbox · Today · Done. Reading Inbox as *every open task* satisfies both: it
// is the shipped `all` filter minus the completed rows, so nothing about what
// the user can reach changed, and it is the reading the mockup's own counts
// imply (Today 3, Inbox 7 — a complement could not be larger than the whole).
// It also keeps the property AC-24 leans on when it calls this surface the
// second path: **every open task is reachable by hand from the default
// collection**, with no combination of dates that can strand one.
//
// Recorded rather than assumed: the two artifacts should be reconciled by
// design/spec, and this file is where the reconciliation currently lives.

import type { TaskView } from '../types.ts'

/** The three built-in collections (information-architecture.md §2, §3).
 * Personal lists are NOT here: they need `lists` + `tasks.list_id`, and no
 * such field exists (IA §7). */
export type Collection = 'inbox' | 'today' | 'done'

export const COLLECTIONS: Collection[] = ['today', 'inbox', 'done']

/**
 * What the app opens the list on.
 *
 * **Today** — the owner chose it (owner-decision 2026-08-18, § landing and
 * collections), and `app-shell.html` draws the Tasks surface that way.
 *
 * This constant read `'inbox'` until ADR-009, justified by "`addTask` creates
 * every hand-made task with `status: 'inbox'` and no date, so landing on Today
 * would show a brand-new user an empty list immediately after they added
 * something to it". **Both halves of that are now void**: the owner decided the
 * default, and add-in-context (`dueAtForCollection`) is what stops the list
 * being empty — a task created while viewing Today is dated today, so it is in
 * Today. The constant and its justification changed together, deliberately.
 */
export const DEFAULT_COLLECTION: Collection = 'today'

/** Visible collection names — the house words (components.md § Buttons). */
export function collectionName(c: Collection): string {
  switch (c) {
    case 'today':
      return 'Today'
    case 'inbox':
      return 'Inbox'
    case 'done':
      return 'Done'
  }
}

export function isToday(iso: string | null, now: Date): boolean {
  if (iso === null) return false
  const d = new Date(iso)
  return (
    !Number.isNaN(d.getTime()) &&
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  )
}

export function isTomorrow(iso: string | null, now: Date): boolean {
  if (iso === null) return false
  const t = new Date(now)
  t.setDate(t.getDate() + 1)
  return isToday(iso, t)
}

/**
 * **Today is a date. Full stop** (ADR-009 §1, owner decision 2026-08-18).
 *
 * This used to read `t.status === 'today' || isToday(t.due_at, now)`, which
 * made Today mean two things at once — a date bucket and a status bucket. The
 * status leg is the one that could not answer the owner's question, *if a task
 * has no date, how would you know it is today?*, and it is the one that made
 * `done_today` underivable: a dateless row on Today lost every marker the
 * instant it was ticked, because `toggleTask` writes only `status`.
 *
 * `now` is the DEVICE clock and this bucket is computed client-side. The server
 * stores an instant and serves it; it never buckets tasks by day
 * (data-model.md § Today is a date).
 *
 * A row still carrying `status: 'today'` (4 pre-ADR-009 rows, deliberately not
 * migrated) is inert: it is not done, so it shows in Inbox, and it has no date,
 * so it does not show here. There is no code path left for it to be wrong on.
 */
function dueToday(t: TaskView, now: Date): boolean {
  return isToday(t.due_at, now)
}

/**
 * The instant a task created **on Today** is dated with: the local start of the
 * current day, serialized as an ISO instant.
 *
 * **Not `now`.** `due_at` is a timestamp and "today" is a day, so the instant
 * has to be stated somewhere or two clients pick differently and group the same
 * task differently (ADR-009 §4). Midnight-local is also the honest reading:
 * putting a task on Today is a commitment to a day, and `now` would render as a
 * time-of-day commitment the user never made. Ordering inside the group is
 * unaffected — this repo orders by `created_at` (uc-coverage-map D5).
 */
export function startOfTodayIso(now: Date = new Date()): string {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).toISOString()
}

/**
 * Creating a task while viewing a collection puts it in that collection **by
 * date, never by status** (ADR-009 §4). One definition, shared by both clients
 * and by the online and offline create paths.
 *
 * Done gets no date, same as Inbox: a task cannot be created already finished,
 * and dating it today would make it appear in a collection the user is not
 * looking at. Inbox is a superset of every open task, so nothing is stranded.
 */
export function dueAtForCollection(c: Collection, now: Date = new Date()): string | null {
  return c === 'today' ? startOfTodayIso(now) : null
}

export function inCollection(t: TaskView, c: Collection, now: Date): boolean {
  if (c === 'done') return t.status === 'done'
  if (t.status === 'done') return false
  if (c === 'inbox') return true
  return dueToday(t, now)
}

export function collectionTasks(tasks: readonly TaskView[], c: Collection, now: Date): TaskView[] {
  return tasks.filter((t) => inCollection(t, c, now))
}

/**
 * The one count, parameterised by collection — one definition ("open tasks in
 * this collection"), never two implementations.
 *
 * The PathSwitch badge is this function at `today`, which is exactly what
 * components.md § PathSwitch fixes it as ("open tasks due today"); a Lists-menu
 * row is this function at its own collection; and on the Today collection the
 * badge and the header are literally the same call, which is the identity that
 * section asserts.
 *
 * Zero is never rendered as a badge or a row count: "a badge reading `0` is a
 * number pretending to be news" (§ PathSwitch, and § ListsMenu for the same
 * reason). The zero case is said in words on the Tasks surface instead.
 */
export function collectionCount(
  tasks: readonly TaskView[],
  c: Collection,
  now: Date = new Date(),
): number {
  return collectionTasks(tasks, c, now).length
}

/** The PathSwitch badge's number, named for what it is. */
export function openTodayCount(tasks: readonly TaskView[], now: Date = new Date()): number {
  return collectionCount(tasks, 'today', now)
}

export interface DayGroup {
  label: string
  tasks: TaskView[]
}

function dayLabel(d: Date): string {
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

/** The first day header — also the one the loading skeleton sits under, so the
 * placeholder mirrors the real silhouette instead of inventing a second
 * heading format (components.md § Skeletons: SK-ROW is "five rows under a real
 * day header"). */
export function todayGroupLabel(now: Date = new Date()): string {
  return `Today · ${dayLabel(now)}`
}

/**
 * Day groups, stacked above their rows at every width — the 180px day-header
 * gutter T-101 drew was withdrawn by T-105 (components.md § AppFrame, "The
 * day-header gutter is withdrawn").
 */
export function groupTasks(tasks: readonly TaskView[], now: Date): DayGroup[] {
  const today: TaskView[] = []
  const tomorrow: TaskView[] = []
  const later: TaskView[] = []
  const anytime: TaskView[] = []
  for (const t of tasks) {
    if (dueToday(t, now)) today.push(t)
    else if (isTomorrow(t.due_at, now)) tomorrow.push(t)
    else if (t.due_at !== null) later.push(t)
    else anytime.push(t)
  }
  const tmr = new Date(now)
  tmr.setDate(tmr.getDate() + 1)
  const groups: DayGroup[] = []
  if (today.length > 0) groups.push({ label: `Today · ${dayLabel(now)}`, tasks: today })
  if (tomorrow.length > 0) groups.push({ label: `Tomorrow · ${dayLabel(tmr)}`, tasks: tomorrow })
  if (later.length > 0) groups.push({ label: 'Later', tasks: later })
  if (anytime.length > 0) groups.push({ label: 'Anytime', tasks: anytime })
  return groups
}
