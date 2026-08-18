// The task list's own view model — the four collections, the open count, day
// grouping.
//
// Why this is in `_shared/model/` rather than inside the web component that
// draws it: several different things publish numbers about the same set, and
// components.md § PathSwitch fixes them as ONE number, not several definitions
// of it — "the count is open tasks due today — the same number § TaskList's
// header publishes, never a second definition of it". The PathSwitch badge, the
// Tasks header and the Lists menu's per-row counts all call `openTodayCount` /
// `collectionTasks` here. A second copy of a predicate is L-004's shape: two
// homes for one fact, drifting silently while both look right.
//
// **All four collections are date predicates but one, and the one is genuinely
// a status** (ADR-009 § Amendment, owner decision 2026-08-18 § four buckets):
//
//     Done      status === 'done'
//     Today     open and dated ON OR BEFORE today
//     Upcoming  open and dated AFTER today
//     Inbox     open and carrying no date at all
//
// **Total and disjoint, and that is the property everything else rests on.**
// Not-done splits on has-a-date; dated splits on past-or-today versus future.
// Every task is in exactly one collection, for every clock. `inCollection`
// below is written so this is *structural* — one classification, one answer —
// rather than three predicates that happen to line up. Three predicates that
// happen to line up is how a row falls out of all of them and is reachable from
// nowhere, with nothing erroring.
//
// **What that replaced, and why the replacement matters.** Inbox used to be
// *every open task* — a superset of Today, not its complement. That shape
// existed because with three buckets a future-dated task had no other home, and
// F-001 AC-24's bound leaned directly on it: *every open task is reachable by
// hand from the default collection*. **That argument is gone.** Inbox is now a
// strict subset, and reachability rests instead on the four buckets being total
// — which is only reachability if all four are *openable*, so the Lists menu
// renders `COLLECTIONS` in full (components.md § ListsMenu, the fourth row).
// Drop the Upcoming row and a future-dated task is in no collection the user
// can reach, silently.
//
// **The two dated predicates compare local calendar days, not instants, and
// that is load-bearing rather than a nicety.** `due_at` is a timestamp; a
// bucket boundary is a day. Read Today as `due_at <= now` and a task dated today
// at 17:00 is in Today only after 17:00 — and in Upcoming before then it is not
// either, because its *day* is not after today. The set would leak between
// midnight and the due time, so it would stop being total for part of every day.
// `dueDayOffset` is therefore the single place a `due_at` becomes a day, and
// `isToday`, `isTomorrow`, `isOverdue` and `inCollection` all read it.
//
// **A `due_at` no clock can read counts as no date, so it lands in Inbox.** It
// is the only answer that keeps the set total: a row whose date is malformed
// names no day, and the collection for "names no day" is Inbox. The alternative
// — each dated predicate answering `false` on `NaN` — drops the row out of all
// four buckets at once, which is exactly the silent stranding the totality
// argument exists to prevent.
//
// **Overdue is inside Today, deliberately** (ADR-009 § Amendment §3). Today
// means *needs attention now*, not literally *dated today*; a task that vanishes
// from view is how it gets forgotten. Overdue has no collection of its own — it
// surfaces as a day-group heading inside Today (components.md § TaskList) and as
// a fact the landing summary may name. Narrowing Today back to `isToday` at some
// later tidy-up would silently hide missed work.
//
// `status` participates in exactly one collection, and `status: 'today'` is a
// record-only legacy value nothing writes (4 rows in `data/assistant.json`,
// deliberately not migrated). Under these predicates those rows are undated open
// tasks and land in Inbox — the same place the three-bucket predicate put them.

import type { TaskView } from '../types.ts'

/** The four built-in collections (ADR-009 § Amendment §1).
 * Personal lists are NOT here: they need `lists` + `tasks.list_id`, and no
 * such field exists (information-architecture.md §7). */
export type Collection = 'inbox' | 'today' | 'upcoming' | 'done'

/** The order the Lists menu renders — by time horizon: now, then ahead, then
 * undated, then finished (components.md § ListsMenu, "Position"). Upcoming was
 * INSERTED here; no row moved. */
export const COLLECTIONS: Collection[] = ['today', 'upcoming', 'inbox', 'done']

/**
 * What the app opens the list on.
 *
 * **Today** — the owner chose it (owner-decision 2026-08-18, § landing and
 * collections), and `app-shell.html` draws the Tasks surface that way.
 *
 * This constant read `'inbox'` until ADR-009, justified by "`addTask` creates
 * every hand-made task with `status: 'inbox'` and no date, so landing on Today
 * would show a brand-new user an empty list immediately after they added
 * something to it". **Both halves of that are void**: the owner decided the
 * default, and add-in-context (`dueAtForCollection`) is what stops the list
 * being empty — a task created while viewing Today is dated today, so it is in
 * Today. Since the amendment, Today also holds everything overdue, which makes
 * the choice easier rather than harder.
 */
export const DEFAULT_COLLECTION: Collection = 'today'

/** Visible collection names — the house words (components.md § Buttons,
 * § ListsMenu). `Upcoming` is the word the owner decision, ADR-009 § Amendment
 * and information-architecture.md §9 all already use; a synonym here would be a
 * second name for a thing four artifacts have agreed on. */
export function collectionName(c: Collection): string {
  switch (c) {
    case 'today':
      return 'Today'
    case 'upcoming':
      return 'Upcoming'
    case 'inbox':
      return 'Inbox'
    case 'done':
      return 'Done'
  }
}

/**
 * The one place a `due_at` becomes a **day**: how many local calendar days the
 * task's date sits from `now`'s. Negative is past, `0` is today, positive is
 * future, and `null` means the row names no day at all — no date, or a date no
 * clock can read.
 *
 * Every date question in this file goes through here, so there is one comparison
 * to be wrong about rather than four. Days are compared as calendar days and not
 * as instants (see the header): a task dated today at 17:00 is in Today from
 * midnight, not from 17:00.
 */
function dueDayOffset(iso: string | null, now: Date): number | null {
  if (iso === null) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const day = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((day - today) / 86_400_000)
}

export function isToday(iso: string | null, now: Date): boolean {
  return dueDayOffset(iso, now) === 0
}

export function isTomorrow(iso: string | null, now: Date): boolean {
  return dueDayOffset(iso, now) === 1
}

/**
 * Dated **strictly before** today — the `Overdue` day group (components.md
 * § TaskList) and the landing summary's `overdue` fact, which is why the
 * predicate lives here beside its siblings rather than in a composer (L-004:
 * one home per fact).
 *
 * It is **not** a collection: overdue rows are inside Today, and this names a
 * subset of it. `isOverdue` and `inCollection(t, 'today', now)` are therefore
 * not complements and must not be read as such.
 */
export function isOverdue(iso: string | null, now: Date): boolean {
  const day = dueDayOffset(iso, now)
  return day !== null && day < 0
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
 * Every branch is written out because one of them is an open question, and a
 * fallthrough would answer it silently — which is how it got answered the first
 * time.
 */
export function dueAtForCollection(c: Collection, now: Date = new Date()): string | null {
  switch (c) {
    case 'today':
      // The collection is exactly one day, so the day's local start is
      // derivable and honest.
      return startOfTodayIso(now)

    case 'upcoming':
      // ─────────────────────────────────────────────────────────────────────
      // OPEN DECISION — **T-130**. This cell is NOT decided, and the `null`
      // below is not an answer; it is the absence of one, kept deliberately
      // rather than filled.
      //
      // ADR-009 §4 fixes *creating in a collection puts it in that collection,
      // by date*. **Upcoming is not one day** — its predicate is
      // `due_at > today`, which names no instant, so there is nothing to
      // derive. ADR-009 § The one cell this amendment refuses to fill and
      // components.md § The cell this pass refuses to fill each lay out the
      // candidate answers (tomorrow's local start · `null` with the composer
      // saying where it went · no composer on Upcoming at all) and each
      // recommends none of them; design's note adds a fourth — ask for the
      // date, as the voice path already does.
      //
      // **What ships until it is decided:** `null`, so a task created while
      // viewing Upcoming lands in **Inbox** — off the surface it was created
      // on, at the moment of creation, **and nothing tells the user.** That is
      // one of the candidate answers with its notice removed, arrived at by
      // fallthrough rather than by choice. It is recorded here, loudly, so it
      // is read as an unfilled cell and not as a decision anyone made.
      // ─────────────────────────────────────────────────────────────────────
      return null

    case 'inbox':
    case 'done':
      // Inbox IS "no date", so no date is the whole of its answer. Done gets
      // none either: a task cannot be created already finished, and dating it
      // today would put it in a collection the user is not looking at.
      return null
  }
}

/**
 * The one classification, and the reason the four buckets are total and
 * disjoint rather than merely believed to be.
 *
 * A task is sorted **once** — done, or undated, or dated on-or-before today, or
 * dated after today — and the collection argument only asks which answer came
 * back. So for any task and any clock exactly one collection returns `true`,
 * by construction. There is no combination of `status` and `due_at`, malformed
 * dates included, that returns `true` twice or `false` four times.
 */
export function inCollection(t: TaskView, c: Collection, now: Date): boolean {
  if (t.status === 'done') return c === 'done'
  if (c === 'done') return false
  const day = dueDayOffset(t.due_at, now)
  if (day === null) return c === 'inbox'
  return day <= 0 ? c === 'today' : c === 'upcoming'
}

export function collectionTasks(tasks: readonly TaskView[], c: Collection, now: Date): TaskView[] {
  return tasks.filter((t) => inCollection(t, c, now))
}

/**
 * The one count, parameterised by collection — one definition ("open tasks in
 * this collection"), never two implementations.
 *
 * The PathSwitch badge is this function at `today`, which is what
 * components.md § PathSwitch fixes it as; a Lists-menu row is this function at
 * its own collection; and on the Today collection the badge and the header are
 * literally the same call, which is the identity that section asserts. Since
 * the amendment that number includes overdue, which is a change in what it
 * means and not a second definition of it.
 *
 * Zero is never rendered as a badge or a row count: "a badge reading `0` is a
 * number pretending to be news" (§ PathSwitch, and § ListsMenu for the same
 * reason). The zero case is said in words on the Tasks surface instead — which
 * is what Upcoming ships showing, since nothing in the live store is dated in
 * the future.
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
  /** The heading over these rows, or **`null` when the collection renders
   * flat** — Inbox and Done have no headings at all (components.md § TaskList,
   * "Which collections group at all"). `null` is a rendering instruction, not a
   * missing label: draw the rows and draw no heading. */
  label: string | null
  tasks: TaskView[]
}

function dayLabel(d: Date): string {
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

/**
 * The collections that day-group at all (components.md § TaskList).
 *
 * **Inbox and Done render flat**, and each for its own reason. Inbox *is* "no
 * date", so `Anytime` would be true of every row it can ever hold — the
 * collection's name said a second time. Done is the one status predicate, so it
 * holds rows with any date or none: group it and a task finished this morning
 * appears under `Overdue` because it was due last week. It is not overdue; it is
 * done. The fact a reader wants there is *when I finished*, which is
 * `completed_at`, which does not exist.
 */
const GROUPED_COLLECTIONS: readonly Collection[] = ['today', 'upcoming']

/**
 * Day groups, stacked above their rows at every width — the 180px day-header
 * gutter T-101 drew was withdrawn by T-105 (components.md § AppFrame).
 *
 * **Grouping is per collection**, which is why this takes one. Today gets
 * `Overdue` + `Today · {date}`; Upcoming gets `Tomorrow · {date}` + `Later`;
 * Inbox and Done get a single unlabelled group and render flat.
 *
 * `Overdue` is tested **before** `Later` and carries **no date**. Both follow
 * rules the group table already had: the axis runs earliest to latest, so
 * overdue extends it backwards by one step
 * (`Overdue → Today → Tomorrow → Later → Anytime`); and a heading takes a date
 * when it names exactly one day and none when it names a span, which is why
 * `Later` and `Anytime` are already bare. Before this group existed an overdue
 * row failed `isToday` and `isTomorrow`, had a date, and landed under **`Later`**
 * — a heading reading *after tomorrow* over tasks that are late. Since overdue
 * folded into Today that heading rendered inside the Today collection, on the
 * seven rows that are the entire observable effect of the amendment.
 *
 * The lateness signal is the heading and nothing else: § TaskRow gets no overdue
 * badge, no red date and no icon. Two signals for one meaning read as alarm.
 *
 * A grouped collection can only produce some of the five headings — `Anytime` is
 * unreachable inside Today, `Overdue` inside Upcoming, and so on. The
 * classification is run in full anyway and empty groups are dropped, so a row
 * that should not have been in this collection renders under its true heading
 * instead of disappearing.
 */
export function groupTasks(tasks: readonly TaskView[], c: Collection, now: Date): DayGroup[] {
  if (!GROUPED_COLLECTIONS.includes(c)) {
    return tasks.length === 0 ? [] : [{ label: null, tasks: [...tasks] }]
  }
  const overdue: TaskView[] = []
  const today: TaskView[] = []
  const tomorrow: TaskView[] = []
  const later: TaskView[] = []
  const anytime: TaskView[] = []
  for (const t of tasks) {
    const day = dueDayOffset(t.due_at, now)
    if (day === null) anytime.push(t)
    else if (day < 0) overdue.push(t)
    else if (day === 0) today.push(t)
    else if (day === 1) tomorrow.push(t)
    else later.push(t)
  }
  const tmr = new Date(now)
  tmr.setDate(tmr.getDate() + 1)
  const groups: DayGroup[] = []
  if (overdue.length > 0) groups.push({ label: 'Overdue', tasks: overdue })
  if (today.length > 0) groups.push({ label: `Today · ${dayLabel(now)}`, tasks: today })
  if (tomorrow.length > 0) groups.push({ label: `Tomorrow · ${dayLabel(tmr)}`, tasks: tomorrow })
  if (later.length > 0) groups.push({ label: 'Later', tasks: later })
  if (anytime.length > 0) groups.push({ label: 'Anytime', tasks: anytime })
  return groups
}

/**
 * Whether a collection renders day headings at all.
 *
 * Exported because the **loading skeleton** needs the same answer the read will
 * produce, and it is the only thing about a heading a skeleton may know. It
 * cannot know *which* heading — on Upcoming the first is `Tomorrow · {date}`,
 * on Today it is `Overdue` whenever anything is late — so it draws a
 * heading-shaped bar where a heading will go and asserts no words
 * (components.md § Skeletons: skeletons carry no text). Flat collections
 * skeleton flat.
 */
export function groupsByDay(c: Collection): boolean {
  return GROUPED_COLLECTIONS.includes(c)
}
