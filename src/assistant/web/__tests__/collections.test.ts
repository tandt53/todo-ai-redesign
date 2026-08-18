// ADR-009 + its two amendments — **two axes**, not one partition:
// a *date* axis (Today · Upcoming · `undated`) and a *filing* axis
// (Inbox · each personal list), over the same open tasks, with Done the gate
// that empties both.
//
// The owner asked three questions and this suite is all of them. First: *if a
// task has no date, how would you know it is today?* Before ADR-009 `dueToday`
// answered "because its status says so", which is the half that cannot answer
// it. Second, the same day: *I thought Inbox and Today were just due-date
// filters, why is this so complicated?* — right, and the reason was that one
// collection was a date filter and the other was a status filter. Third, the
// same afternoon: *how do other apps keep Inbox?* Todoist, Things 3, TickTick
// and OmniFocus agree on something stronger than a default — **Inbox is a
// container you empty by filing, never a date filter** — and a task is in Inbox
// *and* in Today at once, because Today is a view and Inbox is a place.
//
// **So the set-level property changed shape, and this suite changed with it**
// (T-139). It used to assert that the four collections were total and disjoint
// — that every open task was in exactly one of Today, Upcoming and Inbox. That
// is now **false of the model and of the store**: the live data holds 7 rows
// that are dated and unfiled, so they are in Today and in Inbox at once
// (ADR-009 § Amendment 2 § 4). What replaces it is not a weaker claim but two
// stronger ones, each stated per axis and each falsifiable on its own:
//
//   3a. the DATE axis is total and disjoint — exactly one of `today`,
//       `upcoming`, `undated`, for every open task and every clock;
//   3b. the FILING axis is total and disjoint — exactly one of Inbox and the
//       personal lists, which with no lists means Inbox for every open task;
//   6.  the two axes are INDEPENDENT — filing a task does not move it on the
//       date axis, dating it does not move it on the filing axis.
//
// F-001 AC-24's reachability bound rests on **3b**, not on 3a (§ Amendment 2
// § 6): a task is reachable because it sits in a container that has a menu row,
// not because of when it is due. That is the third reason the same bound has
// been true, and the first two both expired unnoticed — so it is asserted
// directly, on the axis that actually carries it.
//
// **INV-INBOX-FILING has its own test below, and it is the point of the seam.**
// `inbox_count` and `open_all` are exactly equal today in every account, and
// they must never be sourced from one another. The only artifact a re-merge
// cannot walk past is a test that hands `inCollection` a FILED task — which is
// why `filedTask()` exists and why `isFiled` had to be answerable `true`.
//
// The tests are written against `status: 'inbox'` rows with real dates, because
// that is the only shape the app can now produce: `'today'` is a record-only
// legacy value (data-model.md § `status` — three vocabularies, one union) and
// nothing writes it. Where a row DOES carry it, that is a deliberate stand-in
// for one of the 4 pre-ADR-009 rows still in `data/assistant.json`, and the
// assertion is that it is inert — not that it is rejected.

import { describe, expect, it } from 'vitest'
import { filedTask, task } from './_helpers.ts'
import {
  COLLECTIONS,
  COLLECTION_GROUPS,
  DEFAULT_COLLECTION,
  collectionCount,
  collectionName,
  collectionTasks,
  dueAtForCollection,
  groupTasks,
  groupsByDay,
  inCollection,
  isFiled,
  isOverdue,
  isToday,
  isUndated,
  openTodayCount,
  startOfTodayIso,
} from '../../_shared/model/tasks.ts'
import type { Collection } from '../../_shared/model/tasks.ts'
import type { TaskView } from '../../_shared/types.ts'

/** A fixed instant with a fixed local calendar day around it. */
const NOW = new Date('2026-08-18T09:00:00.000Z')

/** Same local day as NOW, some hours later — never crosses midnight either way
 * (NOW is 09:00 UTC, so ±6h stays inside the day in every zone from -09 to
 * +14). */
function laterToday(): string {
  return new Date(NOW.getTime() + 6 * 60 * 60 * 1000).toISOString()
}

function otherDay(days: number): string {
  return new Date(NOW.getTime() + days * 24 * 60 * 60 * 1000).toISOString()
}

/**
 * An instant built from the **local wall clock**, `dayOffset` days from NOW's
 * local day. The day-boundary cases have to be stated this way: "23:59 today"
 * is a statement about the device's calendar, and adding hours to a UTC instant
 * expresses it only in one timezone.
 */
function atLocal(dayOffset: number, h: number, m = 0): string {
  return new Date(
    NOW.getFullYear(),
    NOW.getMonth(),
    NOW.getDate() + dayOffset,
    h,
    m,
    0,
    0,
  ).toISOString()
}

/** The device clock at a local time of day, on NOW's day. */
function clockAt(h: number, m = 0): Date {
  return new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate(), h, m, 0, 0)
}

/** Every collection that claims this task, in `COLLECTIONS` order.
 *
 * **The length is no longer always 1, and that is the model rather than a
 * regression** (T-139): a dated, unfiled row is in Today AND in Inbox, because
 * it has a date cell and a filing cell at once. Expectations below therefore
 * read `['today', 'inbox']` — views first, then the filing group, which is the
 * order both Lists menus render. */
function homes(t: TaskView, now: Date): Collection[] {
  return COLLECTIONS.filter((c) => inCollection(t, c, now))
}

/**
 * The task's cells on the **date axis**, by name — including `undated`, which
 * has no collection and no surface and so cannot be read off `homes`.
 *
 * Built out of the shipped predicates rather than recomputed from `due_at`, so
 * that this reads what the app does and not a second implementation of it. A
 * done row has no date cell at all: the gate empties both axes.
 */
function dateCells(t: TaskView, now: Date): string[] {
  const cells: string[] = []
  if (inCollection(t, 'today', now)) cells.push('today')
  if (inCollection(t, 'upcoming', now)) cells.push('upcoming')
  if (t.status !== 'done' && isUndated(t.due_at, now)) cells.push('undated')
  return cells
}

// ---------------------------------------------------------------------------
// The two axes — each total and disjoint on its own
// ---------------------------------------------------------------------------

describe('two axes, each total and disjoint (ADR-009 § Amendment 2 — AC 3a, 3b)', () => {
  // One row per shape the model can hold — including two nobody designed for,
  // and two the store cannot hold at all but the seam can build.
  const cases: [string, TaskView, string | null, Collection[]][] = [
    ['open, dated today', task({ id: 'a', due_at: laterToday() }), 'today', ['today', 'inbox']],
    ['open, overdue by a day', task({ id: 'b', due_at: otherDay(-1) }), 'today', ['today', 'inbox']],
    ['open, overdue by a year', task({ id: 'c', due_at: otherDay(-365) }), 'today', ['today', 'inbox']],
    ['open, dated tomorrow', task({ id: 'd', due_at: otherDay(1) }), 'upcoming', ['upcoming', 'inbox']],
    ['open, dated next year', task({ id: 'e', due_at: otherDay(365) }), 'upcoming', ['upcoming', 'inbox']],
    ['open, no date', task({ id: 'f', due_at: null }), 'undated', ['inbox']],
    ['open, legacy status today, no date', task({ id: 'g', status: 'today', due_at: null }), 'undated', ['inbox']],
    ['open, due_at is not a date at all', task({ id: 'h', due_at: 'someday' }), 'undated', ['inbox']],
    ['done, dated today', task({ id: 'i', status: 'done', due_at: laterToday() }), null, ['done']],
    ['done, overdue', task({ id: 'j', status: 'done', due_at: otherDay(-9) }), null, ['done']],
    ['done, no date', task({ id: 'k', status: 'done', due_at: null }), null, ['done']],
    ['archived, no date', task({ id: 'l', status: 'archived', due_at: null }), 'undated', ['inbox']],
    // The two the store cannot hold. They are the whole reason `isFiled` had to
    // be answerable `true`: without them every assertion about the filing axis
    // is vacuous, and the invariant is unproven rather than passing.
    ['FILED, dated today', filedTask({ id: 'm', due_at: laterToday() }), 'today', ['today']],
    ['FILED, no date', filedTask({ id: 'n', due_at: null }), 'undated', []],
  ]

  it.each(cases)('%s — its date cell is the right one', (_label, t, cell) => {
    expect(dateCells(t, NOW)).toEqual(cell === null ? [] : [cell])
  })

  it.each(cases)('%s — the collections claiming it are exactly these', (_label, t, _cell, expected) => {
    expect(homes(t, NOW)).toEqual(expected)
  })

  it('AC 3a — the date axis is total and disjoint: exactly one cell per open row', () => {
    // Asserted over the set rather than row by row, because the failure this
    // guards is a SET failure: three predicates that each look right on their
    // own can still overlap or leave a gap. This is the property Amendment 1
    // proved of all four collections; it is true of the DATE AXIS and was never
    // true of the union once Inbox left that axis.
    for (const [label, t] of cases.map(([l, t]) => [l, t] as const)) {
      const expected = t.status === 'done' ? 0 : 1
      expect(dateCells(t, NOW), `${label} — date cells claiming it`).toHaveLength(expected)
    }
  })

  it('AC 3b — the filing axis is total and disjoint: Inbox is exactly the unfiled', () => {
    // With no `lists`, "exactly one of Inbox and the personal lists" reduces to
    // "Inbox iff unfiled", and that is asserted as an equivalence rather than
    // as a membership so it fails in BOTH directions: a re-merged
    // `inbox(t) = open(t)` puts the filed rows back in Inbox and fails here.
    for (const [label, t] of cases.map(([l, t]) => [l, t] as const)) {
      if (t.status === 'done') continue
      expect(inCollection(t, 'inbox', NOW), `${label} — in Inbox?`).toBe(!isFiled(t))
    }
  })

  it('P3 — Done empties both axes, and nothing else is in Done', () => {
    for (const [label, t] of cases.map(([l, t]) => [l, t] as const)) {
      const done = t.status === 'done'
      expect(inCollection(t, 'done', NOW), `${label} — in Done?`).toBe(done)
      if (done) expect(homes(t, NOW), `${label} — and in nothing else`).toEqual(['done'])
    }
  })

  it('an unfiled row is always reachable — that is what AC-24 rests on now', () => {
    // F-001 AC-24's set half, asserted on the axis that carries it (§ Amendment
    // 2 § 6). Every open, unfiled row is in Inbox whatever its date does —
    // including the row whose date cell has no surface at all. The two previous
    // reasons for this bound were both properties of the date axis and both
    // expired; this one does not read `due_at`.
    for (const [label, t] of cases.map(([l, t]) => [l, t] as const)) {
      if (t.status === 'done' || isFiled(t)) continue
      expect(homes(t, NOW), `${label} — reachable from the menu`).toContain('inbox')
    }
  })

  it('a FILED undated row is in no collection at all — the strand LM-LIST must prevent', () => {
    // Under the old model "in zero collections" was the forbidden state. It is
    // legal now and it is what post-lists actually looks like: the row's date
    // cell is `undated`, which has no surface; it is not in Inbox, because that
    // is what filing means; and its list's row is its ONLY door. Recorded as a
    // test because ADR-009 § Amendment 2 § 6 converts AC-24 into a hard
    // requirement on LM-LIST — a list that exists and is not drawn strands
    // every undated task in it, silently and with nothing erroring.
    const t = filedTask({ id: 'stranded', due_at: null })
    expect(homes(t, NOW)).toEqual([])
    expect(dateCells(t, NOW)).toEqual(['undated'])
  })

  it('a date no clock can read names no day, and the row is still reachable', () => {
    // The case worth checking on the code actually written, not on the ADR's
    // table. `isToday` already guarded `NaN` by answering `false`; two more
    // predicates answering `false` the same way would drop the row out of every
    // DATE cell — which is why `undated` catches it. Its reachability is the
    // filing axis's, not the date axis's: it is in Inbox because it is unfiled.
    for (const bad of ['someday', '', 'not-a-date', '2026-13-45T99:99:99Z']) {
      const t = task({ id: 'bad', due_at: bad })
      expect(dateCells(t, NOW), `due_at ${JSON.stringify(bad)}`).toEqual(['undated'])
      expect(homes(t, NOW), `due_at ${JSON.stringify(bad)}`).toEqual(['inbox'])
      expect(isToday(bad, NOW)).toBe(false)
      expect(isOverdue(bad, NOW)).toBe(false)
      expect(isUndated(bad, NOW)).toBe(true)
    }
  })

  it('…and a string `Date` parses LENIENTLY still lands in exactly one date cell', () => {
    // Found while writing the test above, and worth keeping as its own case:
    // `new Date('tomorrow at 4')` is not `Invalid Date` — V8's legacy parser
    // answers `2001-04-01`. So "malformed" is not a set this code can
    // enumerate, and totality must not depend on recognising it. What the axis
    // guarantees is the weaker, checkable thing: whatever `Date` makes of the
    // string, the row has exactly one date cell. Here it is Today, because a
    // date in 2001 is overdue — the correct answer for a row the parser
    // believes is 25 years late, not a special case.
    for (const odd of ['tomorrow at 4', '2026-02-30T00:00:00Z']) {
      const t = task({ id: 'odd', due_at: odd })
      expect(dateCells(t, NOW), `due_at ${JSON.stringify(odd)}`).toHaveLength(1)
    }
  })

  it('`Collection` and `TaskStatus` are different sets — no row ever holds `upcoming`', () => {
    // The confusion this whole thread came out of is the two sets sharing
    // member names. Upcoming is a VIEW computed from `due_at`; there is no
    // `status: 'upcoming'` and no client may send one. Filing is not a status
    // either — there is no `status: 'work'` — which is the same rule one axis
    // over. The assertion is that the DATE cell is decided by the date alone:
    // same status, two dates, two cells.
    const soon = task({ id: 'soon', status: 'inbox', due_at: otherDay(3) })
    const late = task({ id: 'late', status: 'inbox', due_at: otherDay(-3) })
    expect(homes(soon, NOW)).toEqual(['upcoming', 'inbox'])
    expect(homes(late, NOW)).toEqual(['today', 'inbox'])
  })
})

// ---------------------------------------------------------------------------
// INV-INBOX-FILING — the equality that must never become a definition
// ---------------------------------------------------------------------------

describe('INV-INBOX-FILING (data-model.md; ADR-009 § Amendment 2 § 5)', () => {
  // `open_all` counts every open task; `inbox_count` counts the open tasks in
  // the Inbox CONTAINER. They are exactly equal today — 716 = 716 globally and
  // in all 193 accounts — and neither may be sourced from the other. The
  // equality is a reading of the store, and it ends with the first filed task.
  //
  // The risk is concrete and has already happened once in reverse: § Landing-
  // Summary split these two facts on the morning of 2026-08-18 *because* they
  // had stopped being equal. Re-merging them puts back the bug the split fixed
  // — a user with a full week ahead told "All done — your list is clear."

  it('a FILED task leaves Inbox and STAYS in Today — both halves, both able to fail', () => {
    // The test ADR-009 § Amendment 2 § 5 (2) specifies, and the only artifact a
    // re-merge cannot walk past. Note the two halves are guarding two different
    // mistakes:
    //
    //   · the first fails against a re-merged `inbox(t) = open(t)` — the filed
    //     row is still counted in Inbox;
    //   · the second fails against the OVER-CORRECTION, an implementation that
    //     "resolves" the new overlap by dropping the row out of its date cell.
    //
    // Neither half detects the other's failure, which is why both are here.
    const filed = filedTask({ id: 'filed-today', due_at: laterToday() })
    expect(isFiled(filed)).toBe(true)
    expect(inCollection(filed, 'inbox', NOW)).toBe(false)
    expect(inCollection(filed, 'today', NOW)).toBe(true)

    // …and the same both ways round on the other dated cell
    const ahead = filedTask({ id: 'filed-ahead', due_at: otherDay(9) })
    expect(inCollection(ahead, 'inbox', NOW)).toBe(false)
    expect(inCollection(ahead, 'upcoming', NOW)).toBe(true)
  })

  it('the counts diverge the moment one task is filed — equal is a reading, not a rule', () => {
    // Both numbers computed the way the app computes them: `open_all` as a sum
    // over the DATE axis (§ LandingSummary: `open_today + upcoming + undated`),
    // `inbox_count` as one call on the FILING axis. Written differently on
    // purpose — that is the guard that works without anyone remembering the
    // rule (§ Amendment 2 § 5 (1)).
    const openAll = (ts: TaskView[]): number =>
      collectionCount(ts, 'today', NOW) +
      collectionCount(ts, 'upcoming', NOW) +
      ts.filter((t) => t.status !== 'done' && isUndated(t.due_at, NOW)).length
    const inboxCount = (ts: TaskView[]): number => collectionCount(ts, 'inbox', NOW)

    const unfiled: TaskView[] = [
      task({ id: 'a', due_at: laterToday() }),
      task({ id: 'b', due_at: null }),
      task({ id: 'c', due_at: otherDay(3) }),
      task({ id: 'd', status: 'done', due_at: laterToday() }),
    ]
    // today's store: equal, in every account, and it says nothing
    expect(openAll(unfiled)).toBe(3)
    expect(inboxCount(unfiled)).toBe(3)

    // file one row and they part company — `open_all` does not move, because
    // filing is not a status and does not finish anything
    const afterFiling: TaskView[] = [filedTask({ id: 'a', due_at: laterToday() }), ...unfiled.slice(1)]
    expect(openAll(afterFiling)).toBe(3)
    expect(inboxCount(afterFiling)).toBe(2)
  })

  it('AC 6 — the axes are independent: neither move touches the other', () => {
    // The property that makes "two axes" a claim rather than a description, and
    // the first thing a re-merge breaks. Asserted as a grid: every (date cell ×
    // filing cell) pair is reachable, and moving on one axis leaves the other
    // answer identical.
    const dated = { today: laterToday(), upcoming: otherDay(4), undated: null } as const
    for (const [cell, due] of Object.entries(dated)) {
      const unfiled = task({ id: `u-${cell}`, due_at: due })
      const filed = filedTask({ id: `f-${cell}`, due_at: due })

      // filing does not move the date cell
      expect(dateCells(filed, NOW), `${cell} — filed`).toEqual([cell])
      expect(dateCells(unfiled, NOW), `${cell} — unfiled`).toEqual([cell])

      // dating does not move the filing cell
      expect(inCollection(unfiled, 'inbox', NOW), `${cell} — unfiled is in Inbox`).toBe(true)
      expect(inCollection(filed, 'inbox', NOW), `${cell} — filed is not`).toBe(false)
    }
  })

  it('Inbox does not read `due_at` at all — the same rows, at every hour of the day', () => {
    // A date-blind predicate cannot drift with the clock, and asserting that
    // directly is what stops Inbox quietly acquiring a date leg again. Sampled
    // across the whole local day, including both midnight edges.
    const rows = [
      task({ id: 'dated', due_at: atLocal(0, 23, 59) }),
      task({ id: 'ahead', due_at: atLocal(1, 0, 1) }),
      task({ id: 'undated', due_at: null }),
      filedTask({ id: 'filed', due_at: atLocal(0, 12) }),
      task({ id: 'done', status: 'done', due_at: null }),
    ]
    for (let h = 0; h < 24; h += 1) {
      expect(
        collectionTasks(rows, 'inbox', clockAt(h, 30)).map((t) => t.id),
        `Inbox at ${String(h)}:30`,
      ).toEqual(['dated', 'ahead', 'undated'])
    }
  })
})

// ---------------------------------------------------------------------------
// The predicate, bucket by bucket
// ---------------------------------------------------------------------------

describe('Today is a date (ADR-009 §1, widened to `<= today` by § Amendment)', () => {
  it('a dateless task is NOT in Today — even one carrying the legacy status', () => {
    // The owner's question, as an assertion. `status: 'today'` is one of the 4
    // stored rows: it must not put a dateless row into Today, because there is
    // no day it could be pointing at.
    const legacy = task({ id: 'legacy', status: 'today', due_at: null })
    expect(inCollection(legacy, 'today', NOW)).toBe(false)

    // …and it is not merely absent, it is inert: it behaves exactly like the
    // `inbox` row it renders beside. Asserting only the first half would pass
    // for an implementation that dropped the row from every collection.
    const plain = task({ id: 'plain', status: 'inbox', due_at: null })
    for (const c of COLLECTIONS) {
      expect(inCollection(legacy, c, NOW), `legacy row in ${c}`).toBe(inCollection(plain, c, NOW))
    }
    expect(inCollection(legacy, 'inbox', NOW)).toBe(true)
  })

  it('an open task dated today is in Today AND in Inbox — one date cell, one container', () => {
    // CHANGED TWICE IN ONE DAY, and the history is the point. It first read
    // `inCollection(dated, 'inbox', NOW) === true`, commented "Inbox is the
    // superset". T-128 flipped it to `false`: Inbox had become the undated open
    // tasks, and a dated row leaving it was the whole of what users saw change.
    // T-139 flips it back — and NOT to the superset. Inbox is the tasks filed
    // nowhere, this row is filed nowhere, and it is dated today; it is in both
    // because those are answers on two different axes. The row that tells the
    // two models apart is the FILED one, which the invariant suite holds.
    const dated = task({ id: 'dated', status: 'inbox', due_at: laterToday() })
    expect(inCollection(dated, 'today', NOW)).toBe(true)
    expect(inCollection(dated, 'inbox', NOW)).toBe(true)
    expect(inCollection(dated, 'upcoming', NOW)).toBe(false)
    expect(inCollection(dated, 'done', NOW)).toBe(false)
    // …and it is the 7 live rows' shape: dated and unfiled, counted on both
    // axes, which is why the menu column no longer sums to a headcount.
    expect(homes(dated, NOW)).toEqual(['today', 'inbox'])
  })

  it('an OVERDUE task is in Today — folded in deliberately, not stranded in the past', () => {
    // ADR-009 § Amendment §3: Today means "needs attention now", not literally
    // "dated today". Recorded as a test so a later tidy-up back to `isToday`
    // fails here instead of silently hiding missed work. All 7 rows that change
    // bucket in the live store are this case.
    const late = task({ id: 'late', status: 'inbox', due_at: otherDay(-1) })
    expect(inCollection(late, 'today', NOW)).toBe(true)
    expect(isOverdue(late.due_at, NOW)).toBe(true)
    // and `isOverdue` is a SUBSET of Today, not its complement
    const onTime = task({ id: 'ontime', status: 'inbox', due_at: laterToday() })
    expect(inCollection(onTime, 'today', NOW)).toBe(true)
    expect(isOverdue(onTime.due_at, NOW)).toBe(false)
  })

  it('a ticked task leaves Today even though its date survives — Today is OPEN tasks', () => {
    const ticked = task({ id: 'ticked', status: 'done', due_at: laterToday() })
    expect(homes(ticked, NOW)).toEqual(['done'])
    // the date is what makes it recoverable — see the `done_today` derivation
    expect(isToday(ticked.due_at, NOW)).toBe(true)
  })

  it('`done_today` is derivable with no new field (ADR-009 § What the decision buys)', () => {
    const tasks = [
      task({ id: 'a', status: 'done', due_at: laterToday() }), // counted
      task({ id: 'b', status: 'done', due_at: otherDay(-1) }), // due yesterday — not counted
      task({ id: 'c', status: 'done', due_at: null }), // dateless — never counted
      task({ id: 'd', status: 'inbox', due_at: laterToday() }), // not done
    ]
    const doneToday = tasks.filter((t) => t.status === 'done' && isToday(t.due_at, NOW))
    expect(doneToday.map((t) => t.id)).toEqual(['a'])
  })
})

describe('Upcoming — the bucket with no member anywhere in the live store', () => {
  // ADR-009 § Amendment §2 measured it: 737 live rows, nothing dated in the
  // future, in any account. So every assertion here is against a SEEDED row —
  // a suite that replayed the store would report this collection green having
  // never held anything.

  it('an open task dated after today is in Upcoming, and in no OTHER date cell', () => {
    // It is also in Inbox, because it is filed nowhere — the second half of
    // every one of these expectations since T-139, and not a leak from Today.
    for (const offset of [1, 2, 7, 365]) {
      const t = task({ id: `f${offset}`, status: 'inbox', due_at: otherDay(offset) })
      expect(homes(t, NOW), `dated +${offset}d`).toEqual(['upcoming', 'inbox'])
      expect(dateCells(t, NOW), `dated +${offset}d`).toEqual(['upcoming'])
    }
  })

  it('ticking a future-dated task moves it to Done, not to Inbox', () => {
    const t = task({ id: 'future-done', status: 'done', due_at: otherDay(4) })
    expect(homes(t, NOW)).toEqual(['done'])
  })

  it('`COLLECTIONS` renders Today · Upcoming · Done, a break, then Inbox', () => {
    // MOVED at T-139, and it is the first change to this menu that reorders an
    // existing row rather than inserting one (components.md § ListsMenu, "Where
    // the Inbox row sits"). The old order was `['today','upcoming','inbox',
    // 'done']`, published as a time horizon — now, ahead, undated, finished.
    // Inbox is not *undated*; it is where a task lives. Taking it out leaves
    // `now · ahead · finished`, which needs no new justification, and puts it
    // at the head of the rows it will one day be emptied into.
    expect(COLLECTIONS).toEqual<Collection[]>(['today', 'upcoming', 'done', 'inbox'])
    expect(COLLECTIONS.map(collectionName)).toEqual(['Today', 'Upcoming', 'Done', 'Inbox'])
  })

  it('the group break is where the overlap is — views and the gate, then filing', () => {
    // The break is a fact about the model, not a rendering choice, which is why
    // both clients read it from here (L-004). Inbox's count CONTAINS Today's
    // and Upcoming's, so the column does not sum to a headcount; rows that look
    // like siblings look like they should add up, and the break is what retires
    // that claim. Within the first group the rows really are disjoint — which
    // is asserted, because it is the half that makes the split meaningful.
    expect(COLLECTION_GROUPS).toEqual([
      ['today', 'upcoming', 'done'],
      ['inbox'],
    ])
    expect(COLLECTION_GROUPS.flat()).toEqual(COLLECTIONS)

    const rows = [
      task({ id: 'a', due_at: laterToday() }),
      task({ id: 'b', due_at: otherDay(2) }),
      task({ id: 'c', due_at: null }),
      task({ id: 'd', status: 'done', due_at: null }),
    ]
    // Disjoint, not total: the undated open row is in NO row of the first
    // group, because `undated` has no surface. That is the asymmetry the break
    // is drawn around — the second group is what catches it.
    const first = COLLECTION_GROUPS[0] ?? []
    for (const t of rows) {
      const claims = first.filter((c) => inCollection(t, c, NOW))
      expect(claims.length, `${t.id} — first-group rows claiming it`).toBeLessThanOrEqual(1)
    }
    expect(first.filter((c) => inCollection(rows[2] as TaskView, c, NOW))).toEqual([])

    // …and the arithmetic that is expected to look wrong: 1 + 1 + 1 + 3 = 6
    // across 4 rows, over by exactly the two dated-and-unfiled ones counted on
    // both axes. It is the model, not a defect (§ ListsMenu, "The counts nest").
    const column = COLLECTIONS.map((c) => collectionCount(rows, c, NOW))
    expect(column).toEqual([1, 1, 1, 3])
    expect(column.reduce((a, b) => a + b, 0)).toBe(6)
    expect(rows).toHaveLength(4)
  })

  it('the one count and the collections agree — there is no second definition', () => {
    const tasks = [
      task({ id: 'a', status: 'inbox', due_at: laterToday() }),
      task({ id: 'b', status: 'inbox', due_at: null }),
      task({ id: 'c', status: 'today', due_at: null }), // legacy, inert
      task({ id: 'd', status: 'done', due_at: laterToday() }),
      task({ id: 'e', status: 'inbox', due_at: otherDay(-2) }), // overdue → Today
      task({ id: 'f', status: 'inbox', due_at: otherDay(2) }), // future → Upcoming
    ]
    expect(collectionTasks(tasks, 'today', NOW).map((t) => t.id)).toEqual(['a', 'e'])
    expect(collectionTasks(tasks, 'upcoming', NOW).map((t) => t.id)).toEqual(['f'])
    // CHANGED TWICE. It read `['a','b','c']` (the superset), then `['b','c']`
    // (T-128, the undated rows). Inbox is the UNFILED open rows now, and none
    // of these is filed, so it holds every one of them — the same list as the
    // superset by value and a different claim by definition.
    expect(collectionTasks(tasks, 'inbox', NOW).map((t) => t.id)).toEqual(['a', 'b', 'c', 'e', 'f'])
    expect(collectionTasks(tasks, 'done', NOW).map((t) => t.id)).toEqual(['d'])

    // the badge, the Today row and the header are one call, and it includes
    // overdue now (§ PathSwitch: one number, never a second definition of it)
    expect(openTodayCount(tasks, NOW)).toBe(2)
    expect(collectionCount(tasks, 'today', NOW)).toBe(2)

    // …and it is the DATE axis that partitions the open rows, which is what the
    // landing summary's `open_all` sums over — `open_today + upcoming + undated`.
    // CHANGED at T-139: this summed the three open COLLECTIONS, which now
    // double-counts every dated unfiled row. `inbox_count` is not one of the
    // terms and adding it back is the re-merge INV-INBOX-FILING forbids.
    const open = tasks.filter((t) => t.status !== 'done')
    const openAll =
      collectionCount(tasks, 'today', NOW) +
      collectionCount(tasks, 'upcoming', NOW) +
      open.filter((t) => isUndated(t.due_at, NOW)).length
    expect(openAll).toBe(open.length)
    // and today — only today — that sum equals the Inbox count exactly
    expect(collectionCount(tasks, 'inbox', NOW)).toBe(openAll)
  })
})

// ---------------------------------------------------------------------------
// Day boundaries — the comparison is a DAY, not an instant
// ---------------------------------------------------------------------------

describe('both dated predicates compare local calendar days, not instants', () => {
  it('a task dated TODAY at 23:59 is in Today from midnight, not from 23:59', () => {
    // The leak an instant comparison produces: read Today as `due_at <= now`
    // and this row is in Today only after 23:59 — and it is not in Upcoming
    // before then either, because its DAY is not after today. The set would
    // stop being total for almost the whole day.
    // Read on `dateCells` rather than `homes`, because since T-139 the row is
    // in Inbox at every hour too — and that half is deliberately date-blind, so
    // including it here would dilute the claim this test is making.
    const t = task({ id: 'late-today', due_at: atLocal(0, 23, 59) })
    expect(dateCells(t, clockAt(0, 1))).toEqual(['today'])
    expect(dateCells(t, clockAt(12))).toEqual(['today'])
    expect(dateCells(t, clockAt(23, 58))).toEqual(['today'])
    expect(homes(t, clockAt(0, 1))).toEqual(['today', 'inbox'])
  })

  it('a task dated TOMORROW at 00:01 is in Upcoming all day today', () => {
    const t = task({ id: 'early-tomorrow', due_at: atLocal(1, 0, 1) })
    expect(dateCells(t, clockAt(0, 1))).toEqual(['upcoming'])
    expect(dateCells(t, clockAt(23, 59))).toEqual(['upcoming'])
  })

  it('a task overdue by ONE HOUR is in Today, like one overdue by a year', () => {
    // 00:30 today, read at 01:30 today, is not overdue — same day. The hour
    // that matters is the one that crosses midnight.
    const justPast = task({ id: 'just-past', due_at: atLocal(-1, 23, 30) })
    expect(dateCells(justPast, clockAt(0, 30))).toEqual(['today'])
    expect(isOverdue(justPast.due_at, clockAt(0, 30))).toBe(true)

    const earlierToday = task({ id: 'earlier', due_at: atLocal(0, 0, 30) })
    expect(dateCells(earlierToday, clockAt(1, 30))).toEqual(['today'])
    expect(isOverdue(earlierToday.due_at, clockAt(1, 30))).toBe(false)
  })

  it('membership does not change as the day passes — every hour, same answer', () => {
    // The property an instant comparison cannot satisfy, asserted directly: the
    // date cells are a function of the calendar day, so sampling the same set
    // at every hour of it must give the same answer every time. This is the
    // assertion that goes red if `<=` is ever applied to the timestamp.
    const tasks = [
      task({ id: 'yesterday', due_at: atLocal(-1, 9) }),
      task({ id: 'today-early', due_at: atLocal(0, 0, 1) }),
      task({ id: 'today-late', due_at: atLocal(0, 23, 59) }),
      task({ id: 'tomorrow-early', due_at: atLocal(1, 0, 1) }),
      task({ id: 'undated', due_at: null }),
    ]
    // CHANGED at T-139: Inbox read `['undated']` and now holds every open row,
    // because none of them is filed. That is not the date axis leaking into it
    // — it is the same list at every hour precisely because Inbox never reads
    // `due_at`, which the invariant suite asserts directly.
    const expected = {
      today: ['yesterday', 'today-early', 'today-late'],
      upcoming: ['tomorrow-early'],
      done: [] as string[],
      inbox: ['yesterday', 'today-early', 'today-late', 'tomorrow-early', 'undated'],
    }
    for (let h = 0; h < 24; h += 1) {
      const at = clockAt(h, 30)
      for (const c of COLLECTIONS) {
        expect(
          collectionTasks(tasks, c, at).map((t) => t.id),
          `${c} at ${String(h)}:30`,
        ).toEqual(expected[c])
      }
    }
  })
})

// ---------------------------------------------------------------------------
// Day grouping — per collection since T-128
// ---------------------------------------------------------------------------

describe('day groups are per collection (components.md § TaskList)', () => {
  const overdue = task({ id: 'od', due_at: otherDay(-2) })
  const alsoOverdue = task({ id: 'od2', due_at: otherDay(-9) })
  const todayRow = task({ id: 'td', due_at: laterToday() })
  const tomorrowRow = task({ id: 'tm', due_at: otherDay(1) })
  const laterRow = task({ id: 'lt', due_at: otherDay(30) })
  const undated = task({ id: 'un', due_at: null })

  it('Today groups Overdue ABOVE Today, and Overdue carries no date', () => {
    // Before this group existed, an overdue row failed `isToday` and
    // `isTomorrow`, had a date, and landed under `Later` — a heading reading
    // *after tomorrow* over tasks that are late. Once Today widened to
    // `<= today` that heading rendered inside Today, and in the live store,
    // where every dated open row is overdue, the WHOLE of Today rendered under
    // one heading reading `Later`. Not unhelpful — false.
    const groups = groupTasks([todayRow, overdue, alsoOverdue], 'today', NOW)
    expect(groups.map((g) => g.label?.split(' · ')[0])).toEqual(['Overdue', 'Today'])
    // a heading takes a date when it names exactly one day and none when it
    // names a span — Overdue reaches back as far as the account is old
    expect(groups[0]?.label).toBe('Overdue')
    expect(groups[1]?.label).toMatch(/^Today · /)
    expect(groups[0]?.tasks.map((t) => t.id)).toEqual(['od', 'od2'])
    expect(groups[1]?.tasks.map((t) => t.id)).toEqual(['td'])
  })

  it('Upcoming groups Tomorrow then Later', () => {
    const groups = groupTasks([laterRow, tomorrowRow], 'upcoming', NOW)
    expect(groups.map((g) => g.label?.split(' · ')[0])).toEqual(['Tomorrow', 'Later'])
    expect(groups[1]?.label).toBe('Later')
  })

  it('DONE alone renders flat — one group, no heading at all', () => {
    // `label: null` is the instruction, not a missing label. CHANGED at T-139:
    // Inbox used to be in this loop, on the premise that Inbox *is* "no date"
    // so `Anytime` was true of every row it could hold. Done stays, and for the
    // reason that has not moved: grouping it by `due_at` would put a task
    // finished this morning under `Overdue` because it was due last week — a
    // NEW falsehood introduced by the fix for an old one.
    const rows = [undated, task({ id: 'un2', due_at: null })]
    const groups = groupTasks(rows, 'done', NOW)
    expect(groups).toHaveLength(1)
    expect(groups[0]?.label).toBeNull()
    expect(groups[0]?.tasks.map((t) => t.id)).toEqual(['un', 'un2'])
    // a long-finished task does NOT acquire an `Overdue` heading on Done
    const finishedLate = task({ id: 'fin', status: 'done', due_at: otherDay(-30) })
    expect(groupTasks([finishedLate], 'done', NOW).map((g) => g.label)).toEqual([null])
  })

  it('INBOX groups, and it is the only collection that can produce all five', () => {
    // Rewritten at T-139 (components.md § TaskList, "Which collections group at
    // all"). Inbox is a container, not a date, so it holds rows from every cell
    // of the date axis — and `Anytime` stops being true of every row and
    // becomes one group among five.
    //
    // **What flat was costing is a fact, not a heading.** § TaskList's *one
    // signal, not two* puts lateness in the group heading and NOWHERE else — no
    // badge, no red date, no icon. Flat, Inbox rendered the live store's 7
    // overdue rows with no lateness signal anywhere on the surface every account
    // opens: unmarked, in the middle of 716.
    const all = [todayRow, overdue, laterRow, undated, tomorrowRow, alsoOverdue]
    const groups = groupTasks(all, 'inbox', NOW)
    expect(groups.map((g) => g.label?.split(' · ')[0])).toEqual([
      'Overdue',
      'Today',
      'Tomorrow',
      'Later',
      'Anytime',
    ])
    // the lateness signal, on the surface it was missing from
    expect(groups[0]?.label).toBe('Overdue')
    expect(groups[0]?.tasks.map((t) => t.id)).toEqual(['od', 'od2'])
    expect(groups[4]?.label).toBe('Anytime')
    expect(groups[4]?.tasks.map((t) => t.id)).toEqual(['un'])

    // …and Today renders the SAME overdue rows under the SAME heading. That is
    // the two axes showing through, not a duplication bug — it is the first
    // thing that looks wrong in a screenshot diff and the first thing someone
    // will try to fix by deleting one of the two.
    const inToday = groupTasks(all, 'today', NOW)
    expect(inToday[0]?.label).toBe('Overdue')
    expect(inToday[0]?.tasks.map((t) => t.id)).toEqual(groups[0]?.tasks.map((t) => t.id))
  })

  it('an empty collection produces no groups at all, flat or grouped', () => {
    for (const c of COLLECTIONS) expect(groupTasks([], c, NOW), c).toEqual([])
  })

  it('`groupsByDay` is the same answer `groupTasks` acts on — the skeleton reads it', () => {
    // The skeleton draws a heading-shaped bar only where a heading will go, and
    // it must not get that from a second list of collections (L-004).
    expect(COLLECTIONS.filter(groupsByDay)).toEqual<Collection[]>(['today', 'upcoming', 'inbox'])
    for (const c of COLLECTIONS) {
      const groups = groupTasks([todayRow, undated], c, NOW)
      const labelled = groups.every((g) => g.label !== null)
      expect(labelled, `${c} labels its groups`).toBe(groupsByDay(c))
    }
  })

  it('no row is ever dropped, in any collection', () => {
    // A grouped collection can only produce SOME of the five headings, and the
    // temptation is to compute only those. The classification runs in full so a
    // row that should not have been in this collection renders under its true
    // heading instead of disappearing — which is the same stranding the
    // totality assertions above guard at the collection level.
    const all = [overdue, todayRow, tomorrowRow, laterRow, undated]
    for (const c of COLLECTIONS) {
      const ids = groupTasks(all, c, NOW).flatMap((g) => g.tasks.map((t) => t.id))
      expect([...ids].sort(), `${c} kept every row`).toEqual(all.map((t) => t.id).sort())
    }
  })

  it('a dateless row lands under Anytime, never under Today', () => {
    // `groupTasks` reads the same day offset the collections do, so the retired
    // status leg used to reach it too: a dateless row carrying `today` was
    // drawn under a day header naming a date it did not have.
    const groups = groupTasks(
      [todayRow, task({ id: 'b', status: 'today', due_at: null }), undated],
      'today',
      NOW,
    )
    expect(groups.map((g) => g.label?.split(' · ')[0])).toEqual(['Today', 'Anytime'])
    expect(groups[1]?.tasks.map((t) => t.id)).toEqual(['b', 'un'])
  })
})

// ---------------------------------------------------------------------------
// The landing collection
// ---------------------------------------------------------------------------

describe('the app lands on Today (ADR-009 § Consequences, owner decision)', () => {
  it('DEFAULT_COLLECTION is today', () => {
    expect(DEFAULT_COLLECTION).toBe<Collection>('today')
  })

  it('and it is not empty for a brand-new user, because add-in-context dates the row', () => {
    // This is the half of the retired doc-comment that add-in-context replaced.
    // A task created while viewing Today is in Today — so landing there cannot
    // show an empty list to a user who has just added something to it.
    const created = task({
      id: 'new',
      status: 'inbox',
      due_at: dueAtForCollection(DEFAULT_COLLECTION, NOW),
    })
    expect(inCollection(created, DEFAULT_COLLECTION, NOW)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// The create path's date
// ---------------------------------------------------------------------------

describe('creating in a collection sets the date, not the status (ADR-009 §4)', () => {
  it('Today gets the LOCAL START of today — not the moment of creation', () => {
    const due = dueAtForCollection('today', NOW)
    expect(due).not.toBeNull()
    expect(isToday(due, NOW)).toBe(true)
    // The instant has to be pinned or two clients group the same task
    // differently. Read the local wall clock back off it: 00:00:00.000.
    const d = new Date(due as string)
    expect([d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds()]).toEqual([0, 0, 0, 0])
    // …and it is emphatically not `now`, which would read as a time-of-day
    // commitment the user never made.
    expect(due).not.toBe(NOW.toISOString())
  })

  it('Inbox and Done both get no date', () => {
    expect(dueAtForCollection('inbox', NOW)).toBeNull()
    expect(dueAtForCollection('done', NOW)).toBeNull()
  })

  it('Upcoming has NO decided answer — this records the accident, it does not bless it', () => {
    // ── OPEN DECISION, T-130 ──
    // Upcoming is not one day: its predicate is `due_at > today`, which names
    // no instant, so §4's rule has nothing to derive from. ADR-009 § The one
    // cell this amendment refuses to fill and components.md § The cell this
    // pass refuses to fill both lay out the candidates and recommend none.
    //
    // What ships is `null`, and the assertion below is the CONSEQUENCE rather
    // than the value: a task created while viewing Upcoming lands in Inbox —
    // off the surface it was created on — and nothing tells the user. Written
    // down so the behaviour is visible in the suite as an unfilled cell, and so
    // whoever fills it has a test that fails and names the ticket.
    expect(dueAtForCollection('upcoming', NOW)).toBeNull()
    const created = task({ id: 'made-on-upcoming', due_at: dueAtForCollection('upcoming', NOW) })
    expect(inCollection(created, 'upcoming', NOW)).toBe(false)
    expect(homes(created, NOW)).toEqual(['inbox'])
  })

  it('startOfTodayIso is the same instant for every moment inside one local day', () => {
    const midday = new Date(NOW)
    midday.setHours(12, 34, 56, 789)
    const evening = new Date(NOW)
    evening.setHours(23, 59, 59, 999)
    expect(startOfTodayIso(midday)).toBe(startOfTodayIso(evening))
    expect(isToday(startOfTodayIso(midday), evening)).toBe(true)
  })
})
