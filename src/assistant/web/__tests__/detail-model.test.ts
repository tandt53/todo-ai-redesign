// F-005 — the task detail's view model, under node with no React.
//
// This is the tier that can falsify the arithmetic and the state machine: the
// picker's shortcuts (AC-12), the all-day path (AC-13), the move mode (AC-16), the
// repeat draft's exclusivity (AC-25) and the sparse position (ADR-015).
//
// **AC-16's move mode is the unit-testable half of ordering and this is where its
// mutation coverage lives** (`platform/web.md § F-005`): jsdom does not exercise a
// path-based pointer gesture, so the drag is a web-e2e case only — which is exactly
// why the accessible path has to be the one with the assertions, on the feature
// whose own AC says that path exists for the users the second path is for.
//
// Every case passes `now` explicitly. There is no defaulted clock in `detail.ts`
// and this suite is what would notice one appearing (AC-44).

import { describe, expect, it } from 'vitest'
import {
  DETAIL_FIELDS,
  IDLE_MOVE,
  STEP_GAP,
  acceptsRepeat,
  acceptsSteps,
  announceMove,
  calendarDate,
  cancel,
  canReorder,
  collectionForDue,
  combineDateTime,
  dateInputValue,
  dateShortcuts,
  drop,
  grab,
  move,
  namedCadences,
  repeatChanged,
  repeatPatch,
  setEnd,
  stepOrderBetween,
  thisWeekend,
  timeInputValue,
  toggleWeekday,
} from '../detail.ts'
import { EMPTY_REPEAT } from '../../_shared/model/task-fields.ts'
import { task } from './_helpers.ts'
import type { RepeatDraft, TaskView } from '../../_shared/types.ts'

/** A local wall-clock instant, so the cases read as the days they are about. */
const at = (y: number, m: number, d: number, h = 12, min = 0): Date =>
  new Date(y, m - 1, d, h, min, 0, 0)

const step = (over: Partial<TaskView>): TaskView =>
  task({ parent_id: 'parent-1', step_order: 1024, ...over }) as TaskView

// ---------------------------------------------------------------------------
// AC-1 — the surface's own account of its controls
// ---------------------------------------------------------------------------

describe('AC-1 — the account of the surface’s own controls', () => {
  it('names exactly the seven user-settable fields, and excludes the four that are not controls', () => {
    // The object that makes AC-1's bound assertable (tester W5). Revision 2 stated
    // the guarantee naming no object, which left both available tests wrong:
    // asserting seven VISIBLE controls over-constrains a compliant implementation
    // that collapses empty fields behind a disclosure, and "reachable" had no
    // budget.
    expect([...DETAIL_FIELDS]).toEqual([
      'title',
      'note',
      'priority',
      'deadline',
      'reminder',
      'steps',
      'repeat',
    ])
    // The exclusions are the AC's own and they are stated as an absence, so they
    // are asserted as one: `due_all_day` is a consequence of whether a time was
    // picked (AC-13) and the other three are structure.
    for (const notAControl of ['due_all_day', 'parent_id', 'step_order', 'series_id']) {
      expect(DETAIL_FIELDS as readonly string[]).not.toContain(notAControl)
    }
  })
})

// ---------------------------------------------------------------------------
// AC-12 — the picker's shortcuts, and the one that was not exact
// ---------------------------------------------------------------------------

describe('AC-12 — the three shortcuts resolve from the injected clock', () => {
  it('today at 18:00 and tomorrow at 09:00 are the exact instants UC-34 names', () => {
    const now = at(2026, 8, 19, 10, 30) // a Wednesday morning
    const [today, tomorrow] = dateShortcuts(now)
    const t = new Date(today?.at as string)
    expect([t.getFullYear(), t.getMonth() + 1, t.getDate(), t.getHours(), t.getMinutes()]).toEqual([
      2026, 8, 19, 18, 0,
    ])
    const m = new Date(tomorrow?.at as string)
    expect([m.getFullYear(), m.getMonth() + 1, m.getDate(), m.getHours(), m.getMinutes()]).toEqual([
      2026, 8, 20, 9, 0,
    ])
    // All three carry a time, so none of them is all-day — which is why AC-13's
    // date-only path had to be a fourth route rather than a default on these.
    for (const s of dateShortcuts(now)) expect(s.allDay).toBe(false)
  })

  it('"this weekend" is the nearest of Sat 09:00 and Sun 09:00 still in the FUTURE — all three boundaries', () => {
    // tester T5: its two siblings are exact and this one was not. The three cases
    // are the ones the arithmetic version gets wrong, and each is written so it can
    // ONLY be reached its own way (L-012) — a single mid-week case would leave all
    // three unproven.
    const dow = (iso: string): number => new Date(iso).getDay()
    const day = (iso: string): number => new Date(iso).getDate()

    // (1) Mid-week → the coming Saturday.
    const wed = at(2026, 8, 19, 10, 0)
    expect(dow(thisWeekend(wed))).toBe(6)
    expect(day(thisWeekend(wed))).toBe(22)

    // (2) **Saturday BEFORE 09:00 → today.** The boundary a picker gets wrong by
    // adding days unconditionally.
    const satEarly = at(2026, 8, 22, 7, 0)
    expect(dow(thisWeekend(satEarly))).toBe(6)
    expect(day(thisWeekend(satEarly))).toBe(22)

    // (3) **Saturday evening → tomorrow, Sunday.** The other half of the same
    // boundary: the weekend has started but its 09:00 has passed.
    const satLate = at(2026, 8, 22, 20, 0)
    expect(dow(thisWeekend(satLate))).toBe(0)
    expect(day(thisWeekend(satLate))).toBe(23)

    // (4) **Sunday evening → next Saturday.** Both of this weekend's mornings are
    // gone, which is the case that needs the scan to reach past seven days.
    const sunLate = at(2026, 8, 23, 20, 0)
    expect(dow(thisWeekend(sunLate))).toBe(6)
    expect(day(thisWeekend(sunLate))).toBe(29)
  })

  it('a task given today’s date joins Today — the visible consequence, not a surprise', () => {
    const now = at(2026, 8, 19, 10, 0)
    const [today, tomorrow] = dateShortcuts(now)
    expect(collectionForDue(today?.at ?? null, now)).toBe('today')
    expect(collectionForDue(tomorrow?.at ?? null, now)).toBe('upcoming')
    // A dateless task is in Inbox on the filing axis, which is what the picker
    // discloses when the deadline is cleared.
    expect(collectionForDue(null, now)).toBe('inbox')
  })
})

// ---------------------------------------------------------------------------
// AC-13 — a date with no time is never a time the user did not choose
// ---------------------------------------------------------------------------

describe('AC-13 — the calendar’s date-only path', () => {
  it('a calendar pick is ALL-DAY at that day’s local start, never a fabricated time', () => {
    // design D7: AC-13 forbids a fabricated time on a date-only due and revision 1
    // gave the user **no way to produce one** — all three shortcuts carry times, and
    // an implementer choosing the calendar's default picks one, shipping the exact
    // defect AC-13 cites from the original product (say "Friday", get 9:00).
    const picked = calendarDate('2026-08-21')
    expect(picked).not.toBeNull()
    expect(picked?.allDay).toBe(true)
    const d = new Date(picked?.at as string)
    expect([d.getFullYear(), d.getMonth() + 1, d.getDate()]).toEqual([2026, 8, 21])
    expect([d.getHours(), d.getMinutes(), d.getSeconds()]).toEqual([0, 0, 0])
    // …and the flag is what carries it. The instant alone is a bare local
    // midnight, which is indistinguishable from a deliberate 00:00 — the whole
    // reason `due_all_day` exists rather than the instant being read for it.
  })

  it('adding a time to the same day turns the flag off — one fact, two halves', () => {
    const dateOnly = combineDateTime('2026-08-21', '')
    expect(dateOnly?.allDay).toBe(true)
    const timed = combineDateTime('2026-08-21', '14:30')
    expect(timed?.allDay).toBe(false)
    const d = new Date(timed?.at as string)
    expect([d.getHours(), d.getMinutes()]).toEqual([14, 30])
  })

  it('refuses a malformed or non-existent date rather than coercing one', () => {
    expect(calendarDate('')).toBeNull()
    expect(calendarDate('2026-8-1')).toBeNull()
    // 31 February is not a date. `new Date(2026, 1, 31)` silently rolls to March,
    // which is precisely the class of silent coercion AC-24's clamp exists to
    // forbid one level up, so the client refuses rather than inventing a day.
    expect(calendarDate('2026-02-31')).toBeNull()
  })

  it('the date and time inputs read the LOCAL day, not the UTC one', () => {
    // A due at 23:00 local would show as tomorrow in the control the user sets it
    // with if the value came from the ISO string's date part.
    const local = new Date(2026, 7, 21, 23, 30, 0, 0)
    expect(dateInputValue(local.toISOString())).toBe('2026-08-21')
    expect(timeInputValue(local.toISOString())).toBe('23:30')
    expect(dateInputValue(null)).toBe('')
    expect(timeInputValue(null)).toBe('')
  })
})

// ---------------------------------------------------------------------------
// AC-16 — the move mode, and the three states revision 2 left unentered
// ---------------------------------------------------------------------------

describe('AC-16 — the keyboard-operable move mode', () => {
  const three = [
    step({ id: 's1', title: 'one', step_order: 1024 }),
    step({ id: 's2', title: 'two', step_order: 2048 }),
    step({ id: 's3', title: 'three', step_order: 3072 }),
  ]

  it('does not appear on a one-step list, because there is nowhere to drop it', () => {
    // AC-15's edge, and it is asserted on the PREDICATE rather than on the markup,
    // so the control's presence and the mode's entry condition cannot disagree.
    expect(canReorder([three[0] as TaskView])).toBe(false)
    expect(canReorder(three)).toBe(true)
    expect(grab([three[0] as TaskView], 's1')).toEqual(IDLE_MOVE)
  })

  it('idle → grabbed → moving, and the write is deferred until the drop', () => {
    let mode = grab(three, 's1')
    expect(mode.state.phase).toBe('grabbed')
    mode = move(mode, 1)
    expect(mode.state.phase).toBe('moving')
    expect(mode.order).toEqual(['s2', 's1', 's3'])
    // Nothing is written while moving, which is what makes `cancel` able to return
    // the step to where it was rather than needing a second write to undo one.
    const target = drop(mode)
    expect(target).toEqual({ taskId: 's1', before: 's2', after: 's3' })
  })

  it('a move announces a position on EVERY step, one-based and naming the total', () => {
    // 4.1.3. "Position 3" alone does not say whether the step has reached the end,
    // which is the one thing a user moving blind needs to know.
    expect(announceMove(0, 3)).toBe('Step 1 of 3')
    expect(announceMove(2, 3)).toBe('Step 3 of 3')
  })

  it('will not move past either end', () => {
    const first = grab(three, 's1')
    expect(move(first, -1)).toBe(first)
    const last = grab(three, 's3')
    expect(move(last, 1)).toBe(last)
  })

  it('a drop where the step ALREADY WAS writes nothing, creates no undo entry and announces nothing', () => {
    // One condition, three observables, answered once — so a caller cannot get two
    // of the three right (AC-15's *"writes nothing and creates no undo entry"*,
    // AC-16's *"announces nothing"*, AC-43's *"the no-op case must create no entry"*).
    let mode = grab(three, 's2')
    mode = move(mode, 1)
    mode = move(mode, -1) // back where it started
    expect(mode.order).toEqual(['s1', 's2', 's3'])
    expect(drop(mode)).toBeNull()
  })

  it('cancelled has an ENTRY CONDITION and returns the step to the position it held', () => {
    // tester W13: revision 2 left this state with no trigger at all. The trigger is
    // the user abandoning the move — the keyboard cancel, or a pointer release
    // outside the list — and the outcome is announced like any other position change.
    let mode = grab(three, 's3')
    mode = move(mode, -1)
    mode = move(mode, -1)
    expect(mode.order).toEqual(['s3', 's1', 's2'])
    const { mode: after, returnedTo } = cancel(mode)
    expect(after).toEqual(IDLE_MOVE)
    expect(returnedTo).toBe(2) // where s3 was
    expect(announceMove(returnedTo as number, 3)).toBe('Step 3 of 3')
  })

  it('cancel from idle is inert and reports no position', () => {
    expect(cancel(IDLE_MOVE)).toEqual({ mode: IDLE_MOVE, returnedTo: null })
  })
})

// ---------------------------------------------------------------------------
// ADR-015 — the sparse position, and a move that is one write
// ---------------------------------------------------------------------------

describe('ADR-015 — step_order is a sparse integer', () => {
  it('appends at a gap and inserts at the midpoint — one row per move', () => {
    expect(STEP_GAP).toBe(1024)
    expect(stepOrderBetween(null, null)).toBe(1024)
    expect(stepOrderBetween(2048, null)).toBe(3072)
    expect(stepOrderBetween(null, 2048)).toBe(1024)
    expect(stepOrderBetween(1024, 2048)).toBe(1536)
  })

  it('a gap smaller than 2 collapses to a neighbour — the server renumbers and returns every row', () => {
    // The client computes a value because `PATCH` takes `step_order` and not a pair
    // of neighbours; where the gap is exhausted the server renumbers in the same
    // transaction and returns every row it changed (AC-26), which the receiver
    // clause then applies. So a client value the server refines is corrected by a
    // response the client already handles — no second contract.
    expect(stepOrderBetween(1024, 1025)).toBe(1024)
  })
})

// ---------------------------------------------------------------------------
// AC-18 / AC-21 — the surface does not offer what the write refuses
// ---------------------------------------------------------------------------

describe('AC-18 / AC-21 — one level, and only a whole task repeats', () => {
  it('a step accepts neither steps nor a repeat', () => {
    const parent = task({ id: 'p' }) as TaskView
    const child = step({ id: 'c' })
    expect(acceptsSteps(parent)).toBe(true)
    expect(acceptsRepeat(parent)).toBe(true)
    expect(acceptsSteps(child)).toBe(false)
    expect(acceptsRepeat(child)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// AC-20 / AC-21 / AC-25 — the repeat draft
// ---------------------------------------------------------------------------

describe('AC-20 — named cadences are labels over rules that already exist', () => {
  it('“every weekday” is weekly on five days, not a new concept', () => {
    // product F12: it is expressible — weekly, interval 1, five weekdays — but a
    // user looking for it looks under **Daily**, which is exactly where AC-21
    // removed it, so the correct model reads as a missing feature for a common
    // cadence. Named cadences cost no model change.
    const weekdays = namedCadences().find((c) => c.id === 'weekdays')
    expect(weekdays?.draft.repeat_frequency).toBe('week')
    expect(weekdays?.draft.repeat_interval).toBe(1)
    expect(weekdays?.draft.repeat_weekdays).toBe('mo,tu,we,th,fr')
    // Every cadence resolves into AC-21's shapes and none of them names an hourly
    // repeat or weekdays under a daily rule — the two deliberate exclusions.
    for (const c of namedCadences()) {
      expect(['day', 'week', 'month', 'year']).toContain(c.draft.repeat_frequency)
      if (c.draft.repeat_frequency !== 'week') expect(c.draft.repeat_weekdays).toBeNull()
    }
  })
})

describe('AC-21 — weekdays are canonical, and only under a weekly rule', () => {
  it('a daily rule cannot take weekdays — “daily but only Mondays” is weekly on one day', () => {
    const daily: RepeatDraft = { ...EMPTY_REPEAT, repeat_frequency: 'day', repeat_interval: 1 }
    expect(toggleWeekday(daily, 'mo')).toBe(daily)
  })

  it('a set built by clicking is stored in the wire’s canonical order', () => {
    // Canonical: a subset of "mo,tu,we,th,fr,sa,su" **in that order**. A set in
    // click order is a value `taskEquals` and the diff cannot compare, which is the
    // seed of a "modified since" report about a change nobody made.
    let weekly: RepeatDraft = { ...EMPTY_REPEAT, repeat_frequency: 'week', repeat_interval: 1 }
    weekly = toggleWeekday(weekly, 'fr')
    weekly = toggleWeekday(weekly, 'mo')
    weekly = toggleWeekday(weekly, 'we')
    expect(weekly.repeat_weekdays).toBe('mo,we,fr')
    weekly = toggleWeekday(weekly, 'we')
    expect(weekly.repeat_weekdays).toBe('mo,fr')
    weekly = toggleWeekday(weekly, 'mo')
    weekly = toggleWeekday(weekly, 'fr')
    // The empty set is `null`, not `''`: the same distinction AC-6 makes for the
    // note, on the field beside it.
    expect(weekly.repeat_weekdays).toBeNull()
  })
})

describe('AC-25 — a series ends by a date OR a count, never both', () => {
  it('the picker cannot express both, so the user never meets the refusal for a state it built', () => {
    let d: RepeatDraft = { ...EMPTY_REPEAT, repeat_frequency: 'week', repeat_interval: 1 }
    d = setEnd(d, { kind: 'until', date: '2026-12-31' })
    expect(d).toMatchObject({ repeat_until: '2026-12-31', repeat_count: null })
    d = setEnd(d, { kind: 'count', count: 5 })
    expect(d).toMatchObject({ repeat_until: null, repeat_count: 5 })
    d = setEnd(d, { kind: 'never' })
    expect(d).toMatchObject({ repeat_until: null, repeat_count: null })
  })
})

describe('AC-2 — the repeat commit is still a field-level write', () => {
  it('sends only the members that changed, for the one control that batches', () => {
    const from: RepeatDraft = { ...EMPTY_REPEAT }
    const to: RepeatDraft = { ...EMPTY_REPEAT, repeat_frequency: 'week', repeat_interval: 2 }
    expect(repeatChanged(from, to)).toBe(true)
    expect(repeatPatch(from, to)).toEqual({ repeat_frequency: 'week', repeat_interval: 2 })
    // A commit with nothing changed carries nothing — *"the request carries the
    // fields the user changed and no others"*, and a whole-object write that
    // happens to look correct fails the AC.
    expect(repeatChanged(to, { ...to })).toBe(false)
    expect(repeatPatch(to, { ...to })).toEqual({})
  })
})
