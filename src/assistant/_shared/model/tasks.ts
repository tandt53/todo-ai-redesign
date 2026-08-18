// The task list's own view model — the collections, the counts, day grouping.
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
// ── THE MODEL IS TWO AXES, NOT ONE PARTITION ────────────────────────────────
// (ADR-009 § Amendment 2; data-model.md § The four collections)
//
//     date axis    Today · Upcoming · `undated`   views computed from `due_at`
//     filing axis  Inbox · each personal list     the container a task lives in
//     the gate     Done                           the one genuine status
//
// **Each axis is separately total and disjoint over the OPEN tasks, and the two
// together are a grid**: a task has a date cell AND a filing cell, and every
// combination of the two is legal. So the collections **overlap** — a task is
// routinely in Today *and* in Inbox, which is what Todoist, Things 3, TickTick
// and OmniFocus all do and what the owner chose. Measured in the live store on
// 2026-08-18: `|Inbox ∩ Today| = 7`.
//
// Two consequences are contract rather than detail. **The counts nest and do
// not sum to a headcount** — Inbox's number contains Today's and Upcoming's
// (716 + 7 + 0 + 21 = 744 against 737 live rows), which is why the Lists menu
// draws the filing group behind a break rather than as a fourth sibling
// (components.md § ListsMenu). And **`inCollection` must NOT be written as one
// classification returning exactly one answer.** That shape was correct while
// the model was one partition and it is false now; the store holds 7 live rows
// that are in Today and in Inbox at the same time.
//
// **Inbox is the tasks filed into no personal list — nothing about dates.**
// `lists` and `tasks.list_id` do not exist (information-architecture.md §7), so
// nothing can be filed, so `isFiled` answers `false` for every task and Inbox
// is every open task today. It narrows by itself when lists ship: one function
// body changes and nothing else moves. It is deliberately NOT written as
// `inbox(t) = open(t)`, even though that is what it evaluates to — see
// `isFiled` below and INV-INBOX-FILING in `specs/assistant/data-model.md`.
//
// **`undated` is a cell of the date axis with no surface of its own.** Inbox
// serves it by coincidence today, and stops the moment anything can be filed:
// post-lists an undated task inside a personal list is in no date collection
// and not in Inbox, and is reachable through its list and only through its
// list. That is how every reference app behaves; this app has no
// "show me everything undated" view and will not have one.
//
// **Reachability rests on the FILING axis** (F-001 AC-24's set half — *the full
// todo list remains usable by hand*). The filing axis is total and every cell
// of it is openable from the Lists menu; today that is Inbox alone, holding
// every open task. It no longer rests on Inbox being a superset (retired
// 2026-08-18 morning) nor on the four buckets being total (retired the same
// afternoon) — the date axis is the thing that keeps getting re-cut, which is
// why the bound kept coming untied. Upcoming must still have its row or a
// future-dated task is unreachable *as a dated task*, but that is a date-axis
// requirement now rather than AC-24's carrier.
//
// **The two dated predicates compare local calendar days, not instants, and
// that is load-bearing rather than a nicety.** `due_at` is a timestamp; a
// bucket boundary is a day. Read Today as `due_at <= now` and a task dated today
// at 17:00 is in Today only after 17:00 — and in Upcoming before then it is not
// either, because its *day* is not after today. The date axis would leak between
// midnight and the due time, so it would stop being total for part of every day.
// `dueDayOffset` is therefore the single place a `due_at` becomes a day, and
// `isToday`, `isTomorrow`, `isOverdue`, `isUndated` and `inCollection` all read
// it.
//
// **A `due_at` no clock can read counts as no day.** Its date cell is `undated`,
// which keeps that axis total: the alternative — each dated predicate answering
// `false` on `NaN` — would leave the row in no date cell at all. Today such a
// row is still reachable, because it is unfiled and therefore in Inbox; that
// reachability is the filing axis's, not the date axis's.
//
// **Overdue is inside Today, deliberately** (ADR-009 § Amendment §3). Today
// means *needs attention now*, not literally *dated today*; a task that vanishes
// from view is how it gets forgotten. Overdue has no collection of its own — it
// surfaces as a day-group heading inside Today AND inside Inbox
// (components.md § TaskList) and as a fact the landing summary may name.
// Narrowing Today back to `isToday` at some later tidy-up would silently hide
// missed work.
//
// `status` participates in exactly one collection, and `status: 'today'` is a
// record-only legacy value nothing writes (4 rows in `data/assistant.json`,
// deliberately not migrated). Under these predicates those rows are undated open
// tasks: `undated` on the date axis, Inbox on the filing axis — the same place
// the three-bucket and four-bucket predicates both put them.

import type { TaskView } from '../types.ts'

/**
 * The four built-in collections — and they are **no longer four of a kind**
 * (ADR-009 § Amendment 2 § 1). Today and Upcoming are *views* of the date axis,
 * Done is the gate, and Inbox is a *container*: the first cell of the filing
 * axis, whose other cells are the personal lists.
 *
 * Personal lists are NOT here: they need `lists` + `tasks.list_id`, and no such
 * field exists (information-architecture.md §7). When they arrive they join
 * Inbox in the second group below, appending beneath it — nothing above the
 * break moves.
 */
export type Collection = 'inbox' | 'today' | 'upcoming' | 'done'

/**
 * The Lists menu's **two visual groups**, in render order, separated by a group
 * break — the views and the gate, then the filing rows (components.md
 * § ListsMenu, "Where the Inbox row sits").
 *
 * The break is why this is a list of lists rather than a flat array with a
 * comment beside it. **Inbox's count contains Today's and Upcoming's**, so the
 * column does not sum to a headcount (measured: 716 + 7 + 0 + 21 = 744 against
 * 737 live rows) — and numbers look like they should add up when the rows
 * carrying them look like siblings under one heading. Separating the groups
 * retires the arithmetic claim without a word of explanation: the overlap lives
 * *between* the groups, which is exactly where the break is drawn.
 *
 * Both clients render this, so where the break falls is one fact with one home
 * (L-004) rather than a constant each client spells for itself and drifts on.
 */
export const COLLECTION_GROUPS: readonly (readonly Collection[])[] = [
  ['today', 'upcoming', 'done'],
  ['inbox'],
]

/**
 * The order the Lists menu renders, flattened — first group, then second.
 *
 * **Inbox MOVED** (2026-08-18, T-139): this read
 * `['today', 'upcoming', 'inbox', 'done']` and is the first change to this menu
 * that reorders an existing row rather than inserting one. The old order was
 * published as a time horizon — *now, ahead, undated, finished* — and Inbox is
 * not *undated*; it is where a task lives, which is a different axis. Taking it
 * out leaves `now · ahead · finished`, monotonic and needing no new
 * justification, and puts it where it has to end up anyway: at the head of the
 * rows it will be emptied into.
 *
 * Order is contract, not presentation: `homes()`-style set assertions read
 * membership through this array, and both Lists menus render it.
 */
export const COLLECTIONS: Collection[] = COLLECTION_GROUPS.flat()

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
 * **The third cell of the date axis, and the only one with no surface** — the
 * rows that name no day at all (ADR-009 § Amendment 2 § 1).
 *
 * It is what makes the date axis *statable*: Today and Upcoming alone are not
 * total over the open tasks, and the property worth testing is that exactly one
 * of the three is true for every open task and every clock. Without a name for
 * the third cell that property can only be written as "in neither of the other
 * two", which is not the same claim and does not fail the same way.
 *
 * **`undated` is not Inbox.** Inbox serves this cell by coincidence today,
 * because nothing can be filed; post-lists an undated task inside a personal
 * list is in `undated` and NOT in Inbox, and is reachable through its list and
 * only through its list. This app has no *"show me everything undated"* view
 * and will not have one — which is normal, not a gap.
 *
 * `now` cannot change the answer and is taken anyway, because `dueDayOffset` is
 * the single place a `due_at` becomes a day and a date no clock can read must
 * count as no day here exactly as it does everywhere else.
 */
export function isUndated(iso: string | null, now: Date): boolean {
  return dueDayOffset(iso, now) === null
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
      // **Same answer, cleaner reason since § Amendment 2.** Inbox is a
      // container, and a container names no date — so there is nothing to
      // derive, rather than "no date is what Inbox means". A task created here
      // is unfiled and undated, which lands it in Inbox on BOTH axes, so the
      // create-in-context rule holds without the date leg doing any work. Done
      // gets none either: a task cannot be created already finished, and dating
      // it today would put it in a collection the user is not looking at.
      return null
  }
}

/**
 * The filing axis's one door, as a **structurally-typed key on the argument**.
 *
 * `TaskWire` has no `list_id` and no `list_id` ships: not on the entity, not on
 * the wire, not in the store — verified absent from all 790 rows (ADR-009
 * § Amendment 2 § 3). A field that is always `null` cannot be kept off `GET
 * /tasks`, and a field on the wire needs a write-vocabulary rejection, a `400`,
 * a contract entry and tests, all for a value nothing would ever set. Worse, it
 * would pre-commit the shape of UC-41, which nobody has designed.
 *
 * So the fact *this task is unfiled* gets a **name and one home** here instead
 * of being re-derived at every call site the day lists land (L-004). The key is
 * read structurally rather than declared: today nothing carries it, and the day
 * `lists` ships this becomes an ordinary field read and one function body is
 * the whole of the change.
 *
 * **This seam exists so `isFiled` can be answered `true` in a test today**, and
 * that is a requirement rather than a convenience (ADR-009 § Amendment 2 § 3;
 * `data-model.md § isFiled`). A predicate whose only reachable answer is
 * `false` cannot be exercised, and INV-INBOX-FILING's test would then be
 * *unproven* rather than passing. `filedTask()` in `_shared/testing/fixtures.ts`
 * is the constructor; the store holds no such row and cannot.
 */
interface FilingKey {
  readonly list_id?: string | null
}

function listIdOf(t: TaskView): string | null {
  return (t as TaskView & FilingKey).list_id ?? null
}

/**
 * Whether a task is filed into a personal list. **`false` for every task
 * today**, because the filing axis has exactly one door and this app has not
 * built it.
 *
 * Read the equality that follows as a consequence, never as a definition:
 * `inbox(t)` currently selects the same rows as `open(t)`, and
 * INV-INBOX-FILING (`data-model.md`) is the rule that it must not therefore be
 * *written* as `open(t)`. Written that way it is token-identical to `open_all`,
 * two facts become one to every reader and every grep, and the re-merge arrives
 * through the predicate instead of through a careless edit — putting back the
 * bug the split fixed: a user with a full week ahead told *"All done — your
 * list is clear."*
 */
export function isFiled(t: TaskView): boolean {
  return listIdOf(t) !== null
}

/**
 * Membership, one collection at a time — and deliberately **not** one
 * classification returning exactly one answer.
 *
 * This function used to sort a task **once** and let the collection argument
 * ask which answer came back, so that exactly one collection returned `true`
 * *by construction*. **That shape was correct while the model was one partition
 * and it is false now** (ADR-009 § Amendment 2 § 1): the collections span two
 * independent axes, a task has a date cell AND a filing cell, and every
 * combination of the two is legal. The live store holds 7 rows that are in
 * Today and in Inbox at the same time — dated and unfiled — and a
 * one-answer classifier cannot report both without lying about one.
 *
 * What survives, and is asserted per axis rather than over the union:
 * - the **date axis** is total and disjoint over the open tasks — exactly one
 *   of `today`, `upcoming`, `undated` (AC 3a);
 * - the **filing axis** is total and disjoint — exactly one of Inbox and the
 *   personal lists, which today means Inbox for every open task (AC 3b);
 * - the two are **independent**: filing a task does not move it on the date
 *   axis and dating it does not move it on the filing axis (AC 6). That is the
 *   first thing a re-merge breaks, and it is what the INV-INBOX-FILING test
 *   asserts both halves of.
 */
export function inCollection(t: TaskView, c: Collection, now: Date): boolean {
  // The gate empties both axes: a done task is in Done and in no cell of
  // either, which is what `open(t)` gating every predicate below means.
  if (c === 'done') return t.status === 'done'
  if (t.status === 'done') return false

  // Axis B — filing. Answered without reading `due_at` at all, because Inbox
  // says nothing about dates; the day this line consults the calendar is the
  // day Inbox went back to being a date filter.
  if (c === 'inbox') return !isFiled(t)

  // Axis A — date. `undated` is its third cell and has no surface of its own,
  // so a row that names no day is in neither of the two that do. It is not
  // stranded by that: it is unfiled, so it is in Inbox above — reachability is
  // the filing axis's job now (F-001 AC-24, ADR-009 § Amendment 2 § 6).
  const day = dueDayOffset(t.due_at, now)
  if (day === null) return false
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
   * flat** — since T-139 that is **Done alone** (components.md § TaskList,
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
 * **Inbox groups, and it is the only collection that can produce all five
 * headings** (changed 2026-08-18, T-139). It read flat here, on the premise
 * that Inbox *is* "no date" so `Anytime` was true of every row it could ever
 * hold — the collection's name said a second time. That premise is gone: Inbox
 * is a container, so it holds rows from every cell of the date axis, and
 * `Anytime` becomes what it is everywhere else, one group among five.
 *
 * **What flat was costing is a fact, not a heading.** § TaskList's *one signal,
 * not two* puts lateness in the group heading and deliberately nowhere else —
 * no badge, no red date, no icon on the row. Flat, Inbox rendered the live
 * store's 7 overdue rows with **no lateness signal anywhere on the surface
 * every account opens**, unmarked in the middle of 716. `Overdue` is therefore
 * more load-bearing than when it was specified, not less: it carries lateness
 * on two collections now, and on this one it is the only thing carrying it.
 *
 * **Done must not group, and `Overdue` is exactly why.** Done is the one status
 * predicate, so it holds rows with any date or none: group it and a task
 * finished this morning appears under `Overdue` because it was due last week.
 * It is not overdue; it is done. The fact a reader wants there is *when I
 * finished*, which is `completed_at`, which does not exist.
 */
const GROUPED_COLLECTIONS: readonly Collection[] = ['today', 'upcoming', 'inbox']

/**
 * Day groups, stacked above their rows at every width — the 180px day-header
 * gutter T-101 drew was withdrawn by T-105 (components.md § AppFrame).
 *
 * **Grouping is per collection**, which is why this takes one. Today gets
 * `Overdue` + `Today · {date}`; Upcoming gets `Tomorrow · {date}` + `Later`;
 * **Inbox can produce all five**, being the one collection that holds rows from
 * every cell of the date axis; Done gets a single unlabelled group and renders
 * flat.
 *
 * Today and Inbox therefore render the same rows under the same heading — the
 * 7 overdue rows appear under `Overdue` in both — and that is the two axes
 * showing through rather than a duplication bug. It is the first thing that
 * looks wrong in a screenshot diff and the first thing a reader will try to fix
 * by deleting one of the two.
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
