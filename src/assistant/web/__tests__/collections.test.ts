// ADR-009 + § Amendment — the four buckets: Today · Upcoming · Inbox · Done.
//
// The owner asked two questions and this suite is both of them. First: *if a
// task has no date, how would you know it is today?* Before ADR-009 `dueToday`
// answered "because its status says so", which is the half that cannot answer
// it. Second, on the same day: *I thought Inbox and Today were just due-date
// filters, why is this so complicated?* — which was right, and the reason was
// that one collection was a date filter and the other was a status filter.
//
// So the property under test is no longer one predicate but the **set**: the
// four collections are total and disjoint, every open task is in exactly one of
// Today, Upcoming and Inbox, and no clock and no `due_at` — malformed ones
// included — can make that untrue. That totality is what F-001 AC-24's
// reachability bound rests on since Inbox stopped being a superset of every
// open task, so it is asserted directly rather than inferred.
//
// The tests are written against `status: 'inbox'` rows with real dates, because
// that is the only shape the app can now produce: `'today'` is a record-only
// legacy value (data-model.md § `status` — three vocabularies, one union) and
// nothing writes it. Where a row DOES carry it, that is a deliberate stand-in
// for one of the 4 pre-ADR-009 rows still in `data/assistant.json`, and the
// assertion is that it is inert — not that it is rejected.

import { describe, expect, it } from 'vitest'
import { task } from './_helpers.ts'
import {
  COLLECTIONS,
  DEFAULT_COLLECTION,
  collectionCount,
  collectionName,
  collectionTasks,
  dueAtForCollection,
  groupTasks,
  groupsByDay,
  inCollection,
  isOverdue,
  isToday,
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

/** Every collection that claims this task. The set-level assertion is about
 * this list's LENGTH as much as its contents. */
function homes(t: TaskView, now: Date): Collection[] {
  return COLLECTIONS.filter((c) => inCollection(t, c, now))
}

// ---------------------------------------------------------------------------
// The set — total and disjoint
// ---------------------------------------------------------------------------

describe('the four buckets are total and disjoint (ADR-009 § Amendment)', () => {
  // One row per shape the store can hold, including two nobody designed for.
  const cases: [string, TaskView, Collection][] = [
    ['open, dated today', task({ id: 'a', due_at: laterToday() }), 'today'],
    ['open, overdue by a day', task({ id: 'b', due_at: otherDay(-1) }), 'today'],
    ['open, overdue by a year', task({ id: 'c', due_at: otherDay(-365) }), 'today'],
    ['open, dated tomorrow', task({ id: 'd', due_at: otherDay(1) }), 'upcoming'],
    ['open, dated next year', task({ id: 'e', due_at: otherDay(365) }), 'upcoming'],
    ['open, no date', task({ id: 'f', due_at: null }), 'inbox'],
    ['open, legacy status today, no date', task({ id: 'g', status: 'today', due_at: null }), 'inbox'],
    ['open, due_at is not a date at all', task({ id: 'h', due_at: 'someday' }), 'inbox'],
    ['done, dated today', task({ id: 'i', status: 'done', due_at: laterToday() }), 'done'],
    ['done, overdue', task({ id: 'j', status: 'done', due_at: otherDay(-9) }), 'done'],
    ['done, no date', task({ id: 'k', status: 'done', due_at: null }), 'done'],
    ['archived, no date', task({ id: 'l', status: 'archived', due_at: null }), 'inbox'],
  ]

  it.each(cases)('%s is in exactly one collection, and it is the right one', (_label, t, home) => {
    expect(homes(t, NOW)).toEqual([home])
  })

  it('no task is in two collections and none is in zero — the whole matrix at once', () => {
    // Asserted over the set rather than row by row, because the failure this
    // guards is a SET failure: three predicates that each look right on their
    // own can still overlap or leave a gap. `every open task is reachable by
    // hand` (F-001 AC-24) used to follow from Inbox being a superset; it now
    // follows from this line and from nothing else.
    for (const [label, t] of cases.map(([l, t]) => [l, t] as const)) {
      expect(homes(t, NOW), `${label} — collections claiming it`).toHaveLength(1)
    }
  })

  it('a date no clock can read names no day, so the row is in Inbox rather than nowhere', () => {
    // The case worth checking on the code actually written, not on the ADR's
    // table. `isToday` already guarded `NaN` by answering `false`; two more
    // predicates answering `false` the same way would have dropped this row out
    // of ALL FOUR buckets — reachable from nowhere, with nothing erroring.
    for (const bad of ['someday', '', 'not-a-date', '2026-13-45T99:99:99Z']) {
      const t = task({ id: 'bad', due_at: bad })
      expect(homes(t, NOW), `due_at ${JSON.stringify(bad)}`).toEqual(['inbox'])
      expect(isToday(bad, NOW)).toBe(false)
      expect(isOverdue(bad, NOW)).toBe(false)
    }
  })

  it('…and a string `Date` parses LENIENTLY still lands in exactly one bucket', () => {
    // Found while writing the test above, and worth keeping as its own case:
    // `new Date('tomorrow at 4')` is not `Invalid Date` — V8's legacy parser
    // answers `2001-04-01`. So "malformed" is not a set this code can
    // enumerate, and totality must not depend on recognising it. What the
    // buckets guarantee is the weaker, checkable thing: whatever `Date` makes
    // of the string, the row has exactly one home. Here that home is Today,
    // because a date in 2001 is overdue — which is the correct answer for a
    // row the parser believes is 25 years late, not a special case.
    for (const odd of ['tomorrow at 4', '2026-02-30T00:00:00Z']) {
      const t = task({ id: 'odd', due_at: odd })
      expect(homes(t, NOW), `due_at ${JSON.stringify(odd)}`).toHaveLength(1)
    }
  })

  it('`Collection` and `TaskStatus` are different sets — no row ever holds `upcoming`', () => {
    // The confusion this whole thread came out of is the two sets sharing
    // member names. Upcoming is a VIEW computed from `due_at`; there is no
    // `status: 'upcoming'` and no client may send one. The assertion is that
    // membership is decided by the date alone: same status, two dates, two
    // collections.
    const soon = task({ id: 'soon', status: 'inbox', due_at: otherDay(3) })
    const late = task({ id: 'late', status: 'inbox', due_at: otherDay(-3) })
    expect(homes(soon, NOW)).toEqual(['upcoming'])
    expect(homes(late, NOW)).toEqual(['today'])
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

  it('an open task dated today is in Today and NOWHERE else — Inbox is not a superset', () => {
    // CHANGED at T-128, and it is the assertion that records the model change:
    // this line read `inCollection(dated, 'inbox', NOW) === true` with the
    // comment "Inbox is the superset". Inbox is now the undated open tasks, so
    // a dated row leaving it is the whole of what users see change.
    const dated = task({ id: 'dated', status: 'inbox', due_at: laterToday() })
    expect(inCollection(dated, 'today', NOW)).toBe(true)
    expect(inCollection(dated, 'inbox', NOW)).toBe(false)
    expect(inCollection(dated, 'upcoming', NOW)).toBe(false)
    expect(inCollection(dated, 'done', NOW)).toBe(false)
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

  it('an open task dated after today is in Upcoming, and in nothing else', () => {
    for (const offset of [1, 2, 7, 365]) {
      const t = task({ id: `f${offset}`, status: 'inbox', due_at: otherDay(offset) })
      expect(homes(t, NOW), `dated +${offset}d`).toEqual(['upcoming'])
    }
  })

  it('ticking a future-dated task moves it to Done, not to Inbox', () => {
    const t = task({ id: 'future-done', status: 'done', due_at: otherDay(4) })
    expect(homes(t, NOW)).toEqual(['done'])
  })

  it('`COLLECTIONS` renders Today · Upcoming · Inbox · Done, and the name is the house word', () => {
    // Order is components.md § ListsMenu's — by time horizon. This INSERTED a
    // member and moved none: the array was already `['today','inbox','done']`,
    // which is what both Lists menus render.
    expect(COLLECTIONS).toEqual<Collection[]>(['today', 'upcoming', 'inbox', 'done'])
    expect(COLLECTIONS.map(collectionName)).toEqual(['Today', 'Upcoming', 'Inbox', 'Done'])
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
    // CHANGED at T-128: this read `['a','b','c']` — the superset. Inbox is the
    // UNDATED open rows now, so `a` (dated today) is no longer among them.
    expect(collectionTasks(tasks, 'inbox', NOW).map((t) => t.id)).toEqual(['b', 'c'])
    expect(collectionTasks(tasks, 'done', NOW).map((t) => t.id)).toEqual(['d'])

    // the badge, the Today row and the header are one call, and it includes
    // overdue now (§ PathSwitch: one number, never a second definition of it)
    expect(openTodayCount(tasks, NOW)).toBe(2)
    expect(collectionCount(tasks, 'today', NOW)).toBe(2)

    // …and the three open collections partition the open rows, which is the
    // arithmetic the landing summary's `open_all` now rests on
    const open = tasks.filter((t) => t.status !== 'done')
    const parts = (['today', 'upcoming', 'inbox'] as const).map((c) =>
      collectionCount(tasks, c, NOW),
    )
    expect(parts.reduce((a, b) => a + b, 0)).toBe(open.length)
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
    const t = task({ id: 'late-today', due_at: atLocal(0, 23, 59) })
    expect(homes(t, clockAt(0, 1))).toEqual(['today'])
    expect(homes(t, clockAt(12))).toEqual(['today'])
    expect(homes(t, clockAt(23, 58))).toEqual(['today'])
  })

  it('a task dated TOMORROW at 00:01 is in Upcoming all day today', () => {
    const t = task({ id: 'early-tomorrow', due_at: atLocal(1, 0, 1) })
    expect(homes(t, clockAt(0, 1))).toEqual(['upcoming'])
    expect(homes(t, clockAt(23, 59))).toEqual(['upcoming'])
  })

  it('a task overdue by ONE HOUR is in Today, like one overdue by a year', () => {
    // 00:30 today, read at 01:30 today, is not overdue — same day. The hour
    // that matters is the one that crosses midnight.
    const justPast = task({ id: 'just-past', due_at: atLocal(-1, 23, 30) })
    expect(homes(justPast, clockAt(0, 30))).toEqual(['today'])
    expect(isOverdue(justPast.due_at, clockAt(0, 30))).toBe(true)

    const earlierToday = task({ id: 'earlier', due_at: atLocal(0, 0, 30) })
    expect(homes(earlierToday, clockAt(1, 30))).toEqual(['today'])
    expect(isOverdue(earlierToday.due_at, clockAt(1, 30))).toBe(false)
  })

  it('membership does not change as the day passes — every hour, same answer', () => {
    // The property an instant comparison cannot satisfy, asserted directly: the
    // buckets are a function of the calendar day, so sampling the same set at
    // every hour of it must give the same partition every time. This is the
    // assertion that goes red if `<=` is ever applied to the timestamp.
    const tasks = [
      task({ id: 'yesterday', due_at: atLocal(-1, 9) }),
      task({ id: 'today-early', due_at: atLocal(0, 0, 1) }),
      task({ id: 'today-late', due_at: atLocal(0, 23, 59) }),
      task({ id: 'tomorrow-early', due_at: atLocal(1, 0, 1) }),
      task({ id: 'undated', due_at: null }),
    ]
    const expected = {
      today: ['yesterday', 'today-early', 'today-late'],
      upcoming: ['tomorrow-early'],
      inbox: ['undated'],
      done: [] as string[],
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

  it('Inbox and Done render FLAT — one group, no heading at all', () => {
    // `label: null` is the instruction, not a missing label. Inbox *is* "no
    // date", so `Anytime` would be true of every row it can hold; and grouping
    // Done by `due_at` would put a task finished this morning under `Overdue`
    // because it was due last week — a NEW falsehood introduced by the fix for
    // an old one.
    for (const c of ['inbox', 'done'] as const) {
      const rows = [undated, task({ id: 'un2', due_at: null })]
      const groups = groupTasks(rows, c, NOW)
      expect(groups).toHaveLength(1)
      expect(groups[0]?.label, `${c} heading`).toBeNull()
      expect(groups[0]?.tasks.map((t) => t.id)).toEqual(['un', 'un2'])
    }
    // a long-finished task does NOT acquire an `Overdue` heading on Done
    const finishedLate = task({ id: 'fin', status: 'done', due_at: otherDay(-30) })
    expect(groupTasks([finishedLate], 'done', NOW).map((g) => g.label)).toEqual([null])
  })

  it('an empty collection produces no groups at all, flat or grouped', () => {
    for (const c of COLLECTIONS) expect(groupTasks([], c, NOW), c).toEqual([])
  })

  it('`groupsByDay` is the same answer `groupTasks` acts on — the skeleton reads it', () => {
    // The skeleton draws a heading-shaped bar only where a heading will go, and
    // it must not get that from a second list of collections (L-004).
    expect(COLLECTIONS.filter(groupsByDay)).toEqual<Collection[]>(['today', 'upcoming'])
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
