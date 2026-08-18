// ADR-009 — Today is a date; `status: 'today'` is retired.
//
// The owner's question is the whole suite: *if a task has no date, how would
// you know it is today?* Before ADR-009 `dueToday` answered "because its status
// says so", which is the half that cannot answer the question. These tests hold
// the single fact that replaced it — membership in Today is `isToday(due_at)` —
// at each of the four sites that used to express it separately: the predicate,
// the day grouping, the landing collection and the create path.
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
  collectionTasks,
  dueAtForCollection,
  groupTasks,
  inCollection,
  isToday,
  openTodayCount,
  startOfTodayIso,
} from '../../_shared/model/tasks.ts'
import type { Collection } from '../../_shared/model/tasks.ts'

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

// ---------------------------------------------------------------------------
// The predicate
// ---------------------------------------------------------------------------

describe('Today is a date (ADR-009 §1)', () => {
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

  it('an open task dated today is in Today, whatever its status says', () => {
    const dated = task({ id: 'dated', status: 'inbox', due_at: laterToday() })
    expect(inCollection(dated, 'today', NOW)).toBe(true)
    expect(inCollection(dated, 'inbox', NOW)).toBe(true) // Inbox is the superset
    expect(inCollection(dated, 'done', NOW)).toBe(false)
  })

  it('a task dated another day is never in Today', () => {
    for (const offset of [-1, 1, 7]) {
      const t = task({ id: `d${offset}`, status: 'inbox', due_at: otherDay(offset) })
      expect(inCollection(t, 'today', NOW), `offset ${offset}`).toBe(false)
    }
  })

  it('a ticked task leaves Today even though its date survives — Today is OPEN tasks', () => {
    const ticked = task({ id: 'ticked', status: 'done', due_at: laterToday() })
    expect(inCollection(ticked, 'today', NOW)).toBe(false)
    expect(inCollection(ticked, 'inbox', NOW)).toBe(false)
    expect(inCollection(ticked, 'done', NOW)).toBe(true)
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

  it('the one count and the collection agree — there is no second definition', () => {
    const tasks = [
      task({ id: 'a', status: 'inbox', due_at: laterToday() }),
      task({ id: 'b', status: 'inbox', due_at: null }),
      task({ id: 'c', status: 'today', due_at: null }), // legacy, inert
      task({ id: 'd', status: 'done', due_at: laterToday() }),
    ]
    expect(collectionTasks(tasks, 'today', NOW).map((t) => t.id)).toEqual(['a'])
    expect(openTodayCount(tasks, NOW)).toBe(1)
    expect(collectionCount(tasks, 'today', NOW)).toBe(1)
    expect(collectionTasks(tasks, 'inbox', NOW).map((t) => t.id)).toEqual(['a', 'b', 'c'])
    expect(collectionTasks(tasks, 'done', NOW).map((t) => t.id)).toEqual(['d'])
  })
})

// ---------------------------------------------------------------------------
// Day grouping — the SECOND reader of the predicate
// ---------------------------------------------------------------------------

describe('day headers read the same fact (groupTasks)', () => {
  it('a dateless row lands under Anytime, never under Today', () => {
    // `groupTasks` calls the same `dueToday` the collections do, so the status
    // leg used to reach it too: a dateless row carrying `today` was drawn under
    // a day header naming a date it did not have.
    const groups = groupTasks(
      [
        task({ id: 'a', status: 'inbox', due_at: laterToday() }),
        task({ id: 'b', status: 'today', due_at: null }),
        task({ id: 'c', status: 'inbox', due_at: null }),
      ],
      NOW,
    )
    expect(groups.map((g) => g.label.split(' · ')[0])).toEqual(['Today', 'Anytime'])
    expect(groups[0]?.tasks.map((t) => t.id)).toEqual(['a'])
    expect(groups[1]?.tasks.map((t) => t.id)).toEqual(['b', 'c'])
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

  it('startOfTodayIso is the same instant for every moment inside one local day', () => {
    const midday = new Date(NOW)
    midday.setHours(12, 34, 56, 789)
    const evening = new Date(NOW)
    evening.setHours(23, 59, 59, 999)
    expect(startOfTodayIso(midday)).toBe(startOfTodayIso(evening))
    expect(isToday(startOfTodayIso(midday), evening)).toBe(true)
  })
})
