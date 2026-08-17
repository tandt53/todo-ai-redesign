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
// The collections are `task.status` plus the due-date union the shipped `today`
// filter already used (information-architecture.md §7: "S2's Inbox / Today /
// Done collections — they are `status`").
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
 * **Inbox, not Today, and this is a decision worth reading.** `app-shell.html`
 * draws the Tasks surface on Today — but that is one drawn state, and no
 * artifact declares a default. This app's own `addTask` creates every hand-made
 * task with `status: 'inbox'` and no date, so landing on Today would show a
 * brand-new user an empty list immediately after they added something to it.
 * Inbox is also what the shipped default filter (`all`) already showed, so this
 * preserves today's behaviour rather than changing it under a redesign.
 */
export const DEFAULT_COLLECTION: Collection = 'inbox'

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

/** Due today, in the sense the shipped `today` filter already used: the row is
 * dated today, or carries `status: today` with no date of its own. */
function dueToday(t: TaskView, now: Date): boolean {
  return t.status === 'today' || isToday(t.due_at, now)
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
