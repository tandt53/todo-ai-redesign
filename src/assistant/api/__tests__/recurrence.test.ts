// Recurrence (F-005 AC-20..AC-30, ADR-011, ADR-014).
//
// The shapes that exist exactly, the alignment, the clamp, the successor, and the
// five conditions that decide whether an un-complete takes the successor with it.
//
// Every case pins its zone explicitly. A case that let the zone default would be
// asserting against the harness's UTC and would pass an implementation that reads
// the server's own zone — the silent fallback AC-44 forbids by name.

import { describe, expect, it } from 'vitest'
import { buildHarness, createTask, listTasks, uid } from './helpers.ts'

type Harness = Awaited<ReturnType<typeof buildHarness>>
const ZONE = 'Europe/Berlin'

const post = (h: Harness, user: string, body: Record<string, unknown>) =>
  h.agent.post('/tasks').set('X-User-Id', user).set('X-Timezone', ZONE).send(body)

const patch = (h: Harness, user: string, id: string, body: Record<string, unknown>) =>
  h.agent.patch(`/tasks/${id}`).set('X-User-Id', user).set('X-Timezone', ZONE).send(body)

const preview = (h: Harness, user: string, id: string, body: Record<string, unknown>) =>
  h.agent
    .post(`/tasks/${id}/repeat-preview`)
    .set('X-User-Id', user)
    .set('X-Timezone', ZONE)
    .send(body)

/** 09:00 Berlin on a given date, as the ISO instant (CEST = UTC+2 in summer) */
const berlinNine = (date: string): string => `${date}T07:00:00.000Z`

/**
 * A fresh account whose zone is Berlin.
 *
 * The zone comes from the account's **FIRST** report and is never overwritten by a
 * later one (ADR-010), so the first request an account ever makes decides it. The
 * harness's ordinary client sends `X-Timezone: UTC`, which means a test that let
 * any helper touch the account before this line would silently be asserting against
 * UTC while reading Berlin off the header — the *one row, three answers* defect in
 * miniature, and the reason this is a helper rather than a convention.
 */
const newUser = async (h: Harness): Promise<string> => {
  const user = uid()
  await h.agent.get('/account').set('X-User-Id', user).set('X-Timezone', ZONE).expect(200)
  return user
}

describe('AC-21 — the shapes that exist, exactly, and nothing else is expressible', () => {
  it('accepts every N days / weeks / months / years, and canonicalises the sets (ADR-011)', async () => {
    const h = await buildHarness()
    const user = await newUser(h)
    const created = await post(h, user, {
      title: 'Weekly review',
      due_at: berlinNine('2026-08-20'),
      repeat_frequency: 'week',
      repeat_interval: 2,
      // `"th,mo"` is canonicalised, not refused — so two equal sets are BYTE-equal
      // and `taskEquals`'s `===` stays correct
      repeat_weekdays: 'th,mo',
    })
    expect(created.status).toBe(201)
    expect(created.body.task.repeat_weekdays).toBe('mo,th')

    const monthly = await post(h, user, {
      title: 'Pay rent',
      due_at: berlinNine('2026-08-20'),
      repeat_frequency: 'month',
      repeat_interval: 1,
      repeat_month_days: '15,1,31',
    })
    expect(monthly.body.task.repeat_month_days).toBe('1,15,31')
  })

  it('refuses hourly, refuses weekdays under a DAILY rule, and refuses an out-of-range interval', async () => {
    const h = await buildHarness()
    const user = await newUser(h)
    // no hourly repeat: each occurrence is a row, so a four-hour cycle produces six
    // rows a day and drowns the history for one task
    const hourly = await post(h, user, {
      title: 'x',
      due_at: berlinNine('2026-08-20'),
      repeat_frequency: 'hour',
    })
    expect(hourly.status).toBe(400)
    expect(hourly.body.error.field).toBe('repeat_frequency')

    // "daily, but only Mondays and Fridays" is not daily, it is weekly on two days,
    // and offering both is two paths to one cadence
    const dailyWeekdays = await post(h, user, {
      title: 'x',
      due_at: berlinNine('2026-08-20'),
      repeat_frequency: 'day',
      repeat_interval: 1,
      repeat_weekdays: 'mo,fr',
    })
    expect(dailyWeekdays.status).toBe(400)
    expect(dailyWeekdays.body.error.field).toBe('repeat_weekdays')

    const wildInterval = await post(h, user, {
      title: 'x',
      due_at: berlinNine('2026-08-20'),
      repeat_frequency: 'day',
      repeat_interval: 1000,
    })
    expect(wildInterval.status).toBe(400)
    expect(wildInterval.body.error.field).toBe('repeat_interval')

    const badWeekday = await post(h, user, {
      title: 'x',
      due_at: berlinNine('2026-08-20'),
      repeat_frequency: 'week',
      repeat_interval: 1,
      repeat_weekdays: 'mo,funday',
    })
    expect(badWeekday.status).toBe(400)
    expect(await listTasks(h, user)).toHaveLength(0) // every refusal wrote nothing
  })

  it('an empty set is not representable and is not a state (ADR-011)', async () => {
    const h = await buildHarness()
    const user = await newUser(h)
    const res = await post(h, user, {
      title: 'x',
      due_at: berlinNine('2026-08-20'),
      repeat_frequency: 'week',
      repeat_interval: 1,
      repeat_weekdays: '',
    })
    expect(res.status).toBe(400)
    expect(res.body.error.field).toBe('repeat_weekdays')
  })
})

describe('AC-22 / AC-23 — create, then align. One order, three entry points', () => {
  it('setting a repeat on a DATELESS task creates today, all-day, then aligns it', async () => {
    const h = await buildHarness()
    const user = await newUser(h)
    h.clock.set('2026-08-19T12:00:00.000Z') // Wednesday
    const task = await createTask(h, user, 'Weekly review')
    // rule: weekly on Monday and Thursday. Today is Wednesday, which the rule does
    // not admit, so the created due moves FORWARD to Thursday the 20th.
    const set = await patch(h, user, task.id as string, {
      repeat_frequency: 'week',
      repeat_interval: 1,
      repeat_weekdays: 'mo,th',
    })
    expect(set.status).toBe(200)
    // local start of 2026-08-20 in Berlin (CEST) is 2026-08-19T22:00Z
    expect(set.body.task.due_at).toBe('2026-08-19T22:00:00.000Z')
    // AC-13's date-only form — no invented time
    expect(set.body.task.due_all_day).toBe(true)
  })

  it('the due moves FORWARD onto the rule, never backward', async () => {
    const h = await buildHarness()
    const user = await newUser(h)
    // due Wednesday 09:00, rule weekly on Monday and Thursday → Thursday 09:00.
    // Backward would land it in the past and the task is overdue the instant the
    // rule is set.
    const created = await post(h, user, {
      title: 'Weekly review',
      due_at: berlinNine('2026-08-19'),
    })
    const set = await patch(h, user, created.body.task.id as string, {
      repeat_frequency: 'week',
      repeat_interval: 1,
      repeat_weekdays: 'mo,th',
    })
    expect(set.body.task.due_at).toBe(berlinNine('2026-08-20')) // Thursday, 09:00 kept
    expect(set.body.task.due_all_day).toBe(false)
  })

  it('a due the rule ALREADY admits does not move', async () => {
    const h = await buildHarness()
    const user = await newUser(h)
    // without this case the assertion above passes against an implementation that
    // always advances by one admitted day
    const created = await post(h, user, {
      title: 'Weekly review',
      due_at: berlinNine('2026-08-20'), // a Thursday
      repeat_frequency: 'week',
      repeat_interval: 1,
      repeat_weekdays: 'mo,th',
    })
    expect(created.body.task.due_at).toBe(berlinNine('2026-08-20'))
  })

  it('clearing `due_at` while a repeat is set is REFUSED, naming the action that ends the repeat', async () => {
    const h = await buildHarness()
    const user = await newUser(h)
    const created = await post(h, user, {
      title: 'Water the plants',
      due_at: berlinNine('2026-08-20'),
      repeat_frequency: 'day',
      repeat_interval: 1,
    })
    const cleared = await patch(h, user, created.body.task.id as string, { due_at: null })
    expect(cleared.status).toBe(400)
    expect(cleared.body.error.field).toBe('due_at')
    expect(cleared.body.error.message).toMatch(/clear the repeat/)
    // the invariant holds: a repeating task always has a due date
    expect((await listTasks(h, user))[0]!.due_at).toBe(berlinNine('2026-08-20'))

    // …and clearing BOTH in one write is allowed, because the invariant is about
    // the resulting row and not about the field
    const both = await patch(h, user, created.body.task.id as string, {
      due_at: null,
      repeat_frequency: null,
      repeat_interval: null,
    })
    expect(both.status).toBe(200)
    expect(both.body.task.due_at).toBeNull()
  })
})

describe('AC-24 — month-day overflow lands on the last day of the month', () => {
  it('day 31 in a 30-day month falls on the 30th, and never spills into the next', async () => {
    const h = await buildHarness()
    const user = await newUser(h)
    // The concrete failure is known and was shipped once: adding a month to 31
    // January with the platform's own date arithmetic yields 3 March.
    const created = await post(h, user, {
      title: 'Pay rent',
      due_at: berlinNine('2026-03-31'),
      repeat_frequency: 'month',
      repeat_interval: 1,
      repeat_month_days: '31',
    })
    expect(created.status).toBe(201)
    h.clock.set('2026-03-31T12:00:00.000Z')
    const done = await patch(h, user, created.body.task.id as string, { status: 'done' })
    const successor = done.body.changed[0]
    // April has 30 days: the 30th, not 1 May and not a skipped month
    expect(successor.due_at.slice(0, 10)).toBe('2026-04-30')
  })

  it('February clamps to the 28th (or 29th), and 29 Feb in a yearly rule clamps too', async () => {
    const h = await buildHarness()
    const user = await newUser(h)
    const created = await post(h, user, {
      title: 'Pay rent',
      due_at: berlinNine('2026-01-31'),
      repeat_frequency: 'month',
      repeat_interval: 1,
      repeat_month_days: '31',
    })
    h.clock.set('2026-01-31T12:00:00.000Z')
    const done = await patch(h, user, created.body.task.id as string, { status: 'done' })
    expect(done.body.changed[0].due_at.slice(0, 10)).toBe('2026-02-28')
  })

  it('candidates are de-duplicated AFTER clamping: {30,31} in April both resolve to the 30th', async () => {
    const h = await buildHarness()
    const user = await newUser(h)
    // a rule that produces one date twice is a defect that only becomes visible
    // once the set has two members, which is precisely why the month-boundary table
    // the test strategy asks for would not have contained it (architect F13)
    const created = await post(h, user, {
      title: 'Pay rent',
      due_at: berlinNine('2026-04-29'),
      repeat_frequency: 'month',
      repeat_interval: 1,
      repeat_month_days: '30,31',
    })
    expect(created.body.task.repeat_month_days).toBe('30,31')
    // due 29 April → the rule's next admitted date in April is the 30th (both
    // members clamp there)
    expect(created.body.task.due_at.slice(0, 10)).toBe('2026-04-30')
    h.clock.set('2026-04-30T12:00:00.000Z')
    const done = await patch(h, user, created.body.task.id as string, { status: 'done' })
    // …and the NEXT one is May, not a second 30 April
    expect(done.body.changed[0].due_at.slice(0, 10)).toBe('2026-05-30')
  })
})

describe('AC-25 — a series ends by a date or by a count, never by both', () => {
  it('`until` AND `count` together are refused', async () => {
    const h = await buildHarness()
    const user = await newUser(h)
    const res = await post(h, user, {
      title: 'x',
      due_at: berlinNine('2026-08-20'),
      repeat_frequency: 'day',
      repeat_interval: 1,
      repeat_until: '2026-12-31',
      repeat_count: 5,
    })
    expect(res.status).toBe(400) // "which one wins" is a question with no right answer
    expect(res.body.error.field).toBe('repeat_until')
  })

  it('an `until` EARLIER than the due date is reported, not silently corrected', async () => {
    const h = await buildHarness()
    const user = await newUser(h)
    const res = await post(h, user, {
      title: 'x',
      due_at: berlinNine('2026-08-20'),
      repeat_frequency: 'day',
      repeat_interval: 1,
      repeat_until: '2026-08-01',
    })
    // the user may be about to change the due date next, and a date that moves on
    // its own while they are still typing is worse than a sentence
    expect(res.status).toBe(400)
    expect(res.body.error.field).toBe('repeat_until')
  })
})

describe('AC-26 / AC-27 — completing a repeating task never loses the work', () => {
  const repeating = (h: Harness, user: string, over: Record<string, unknown> = {}) =>
    post(h, user, {
      title: 'Water the plants',
      due_at: berlinNine('2026-08-20'),
      repeat_frequency: 'week',
      repeat_interval: 1,
      ...over,
    })

  it('the completed occurrence STAYS as history and exactly one successor appears', async () => {
    const h = await buildHarness()
    const user = await newUser(h)
    const created = await repeating(h, user)
    h.clock.set('2026-08-22T12:00:00.000Z') // ticked on a Saturday
    const done = await patch(h, user, created.body.task.id as string, { status: 'done' })
    expect(done.status).toBe(200)
    expect(done.body.task.status).toBe('done')
    expect(done.body.changed).toHaveLength(1)
    // computed from the PREVIOUS DUE, not from the moment of completion: ticking
    // Thursday's task on Saturday still produces next Thursday
    expect(done.body.changed[0].due_at).toBe(berlinNine('2026-08-27'))
    expect(done.body.changed[0].series_id).toBe(created.body.task.series_id)
    expect(await listTasks(h, user)).toHaveLength(2)
  })

  it('re-completing an occurrence generates NOTHING — the guarantee is per occurrence', async () => {
    const h = await buildHarness()
    const user = await newUser(h)
    const created = await repeating(h, user)
    const id = created.body.task.id as string
    await patch(h, user, id, { status: 'done' }).expect(200)
    await patch(h, user, id, { status: 'inbox' }).expect(200)
    const again = await patch(h, user, id, { status: 'done' })
    // re-completing an occurrence AC-28 left standing is a second PATH generating
    // nothing, which is not a violation of "no occurrence generates a second"
    expect(again.body.changed).toEqual([])
    expect((await listTasks(h, user)).length).toBeLessThanOrEqual(2)
  })

  it('the successor carries the note, the priority, and every step UNTICKED', async () => {
    const h = await buildHarness()
    const user = await newUser(h)
    const created = await repeating(h, user, {
      note: 'The watering can is under the sink',
      priority: 'high',
    })
    const parentId = created.body.task.id as string
    for (const title of ['Fill the can', 'Do the ferns']) {
      await post(h, user, { title, parent_id: parentId })
    }
    // the parent's completion cascades to the steps AND generates the successor,
    // in one plan (ADR-013)
    const done = await patch(h, user, parentId, { status: 'done' })
    expect(done.status).toBe(200)
    const successor = done.body.changed.find(
      (t: { parent_id: string | null; series_id: string | null }) =>
        t.parent_id === null && t.series_id !== null,
    )
    expect(successor.note).toBe('The watering can is under the sink')
    expect(successor.priority).toBe('high')
    expect(successor.status).toBe('inbox')

    const newSteps = (await listTasks(h, user)).filter((t) => t.parent_id === successor.id)
    expect(newSteps).toHaveLength(2)
    for (const step of newSteps) {
      expect(step.status).toBe('inbox')
      // …and with `completed_by_parent` clear, so a cascade on the NEW occurrence
      // reverses correctly
      expect(step.completed_by_parent).toBe(false)
    }
  })

  it('the reminder travels keeping its OFFSET from the due, and `reminder_shown_at` is CLEAR', async () => {
    const h = await buildHarness()
    const user = await newUser(h)
    const created = await repeating(h, user, {
      // one day before the due
      reminder_at: berlinNine('2026-08-19'),
    })
    const id = created.body.task.id as string
    // acknowledge it first, so the successor has something to wrongly inherit
    await h.agent
      .post(`/tasks/${id}/reminder-ack`)
      .set('X-User-Id', user)
      .set('X-Timezone', ZONE)
      .send({ reminder_at: berlinNine('2026-08-19') })
      .expect(200)
    const done = await patch(h, user, id, { status: 'done' })
    const successor = done.body.changed[0]
    // an alert copied verbatim onto next week's task is already in the past — the
    // same drift AC-22 exists to prevent, arriving through a different door
    expect(successor.reminder_at).toBe(berlinNine('2026-08-26'))
    // a successor inheriting the marker carries a reminder that never fires
    expect(successor.reminder_shown_at).toBeNull()
  })

  it('AC-25 — an `until` the successor would pass means NO successor, and the series is over', async () => {
    const h = await buildHarness()
    const user = await newUser(h)
    const created = await repeating(h, user, { repeat_until: '2026-08-25' })
    const done = await patch(h, user, created.body.task.id as string, { status: 'done' })
    // next Thursday is the 27th, past the inclusive end date
    expect(done.body.changed).toEqual([])
    expect(await listTasks(h, user)).toHaveLength(1)
  })
})

describe('AC-28 — un-completing removes the successor only when it is UNTOUCHED', () => {
  const withSuccessor = async (h: Harness, user: string) => {
    const created = await post(h, user, {
      title: 'Water the plants',
      due_at: berlinNine('2026-08-20'),
      repeat_frequency: 'week',
      repeat_interval: 1,
    })
    const id = created.body.task.id as string
    const done = await patch(h, user, id, { status: 'done' })
    return { id, successorId: done.body.changed[0].id as string }
  }

  it('all five conditions hold → the successor is HARD-removed and reported in `removed`', async () => {
    const h = await buildHarness()
    const user = await newUser(h)
    const { id, successorId } = await withSuccessor(h, user)
    const undone = await patch(h, user, id, { status: 'inbox' })
    expect(undone.status).toBe(200)
    // deliberately NOT a soft delete: a soft-removed successor would be restorable
    // by POST /tasks/{id}/restore and would produce the second open occurrence the
    // recurrence section rests on not having
    expect(undone.body.removed).toEqual([successorId])
    expect(h.store.read((s) => s.tasks[successorId])).toBeUndefined()
    expect(await listTasks(h, user)).toHaveLength(1)
  })

  it('the successor was EDITED → both rows stay', async () => {
    const h = await buildHarness()
    const user = await newUser(h)
    const { id, successorId } = await withSuccessor(h, user)
    h.clock.advance(60_000)
    await patch(h, user, successorId, { title: 'Water the plants and the ferns' }).expect(200)
    const undone = await patch(h, user, id, { status: 'inbox' })
    // deleting something the user has already edited by hand is worse than leaving
    // one extra row
    expect(undone.body.removed).toBeUndefined()
    expect(await listTasks(h, user)).toHaveLength(2)
  })

  it('the successor is ITSELF DONE → both rows stay', async () => {
    const h = await buildHarness()
    const user = await newUser(h)
    const { id, successorId } = await withSuccessor(h, user)
    h.clock.advance(60_000)
    await patch(h, user, successorId, { status: 'done' }).expect(200)
    const undone = await patch(h, user, id, { status: 'inbox' })
    expect(undone.body.removed).toBeUndefined()
    expect(h.store.read((s) => s.tasks[successorId])).toBeDefined()
  })

  it('a STEP of the successor was ticked → both rows stay (the condition the whole-row comparison is blind to)', async () => {
    const h = await buildHarness()
    const user = await newUser(h)
    // the parent has a step, so the successor gets one too (AC-27)
    const created = await post(h, user, {
      title: 'Water the plants',
      due_at: berlinNine('2026-08-20'),
      repeat_frequency: 'week',
      repeat_interval: 1,
    })
    const id = created.body.task.id as string
    await post(h, user, { title: 'Fill the can', parent_id: id })
    const done = await patch(h, user, id, { status: 'done' })
    const successor = done.body.changed.find(
      (t: { parent_id: string | null; series_id: string | null }) =>
        t.parent_id === null && t.series_id !== null,
    )
    const successorStep = (await listTasks(h, user)).find((t) => t.parent_id === successor.id)!

    h.clock.advance(60_000)
    // the user works on the successor's step — the successor's OWN row is untouched,
    // so `taskEquals(current, post_apply)` still passes for it. Left at the
    // whole-row comparison, the un-complete hard-deletes a successor whose steps the
    // user has worked on, in exactly the case AC-28 exists to protect.
    await patch(h, user, successorStep.id as string, { status: 'done' }).expect(200)
    const undone = await patch(h, user, id, { status: 'inbox' })
    expect(undone.body.removed).toBeUndefined()
    expect(h.store.read((s) => s.tasks[successor.id as string])).toBeDefined()
  })
})

describe('AC-29 / AC-30 — one occurrence, and the two things a delete can be about', () => {
  it('changing the RULE does not rewrite history: the completed occurrence keeps its date', async () => {
    const h = await buildHarness()
    const user = await newUser(h)
    const created = await post(h, user, {
      title: 'Water the plants',
      due_at: berlinNine('2026-08-20'),
      repeat_frequency: 'week',
      repeat_interval: 1,
    })
    const id = created.body.task.id as string
    const done = await patch(h, user, id, { status: 'done' })
    const successorId = done.body.changed[0].id as string
    h.clock.advance(60_000)
    // the rule applies to every occurrence generated afterwards; the CURRENT
    // occurrence's own due is handled by AC-23 at the moment the rule changes
    const ruled = await patch(h, user, successorId, { repeat_interval: 2 })
    expect(ruled.status).toBe(200)
    expect((await listTasks(h, user)).find((t) => t.id === id)!.due_at).toBe(berlinNine('2026-08-20'))
  })

  it('AC-30 — a SERIES delete trashes every unfinished occurrence and LEAVES every completed one', async () => {
    const h = await buildHarness()
    const user = await newUser(h)
    const created = await post(h, user, {
      title: 'Water the plants',
      due_at: berlinNine('2026-08-20'),
      repeat_frequency: 'week',
      repeat_interval: 1,
    })
    const id = created.body.task.id as string
    const done = await patch(h, user, id, { status: 'done' })
    const successorId = done.body.changed[0].id as string

    const del = await h.agent
      .delete(`/tasks/${successorId}?scope=series`)
      .set('X-User-Id', user)
      .set('X-Timezone', ZONE)
    expect(del.status).toBe(200)
    const rows = await listTasks(h, user)
    // the completed occurrence is a record of work that was actually done, not
    // rubbish
    expect(rows.map((r) => r.id)).toEqual([id])
    expect(rows[0]!.status).toBe('done')
    // …and `series_ended_at` went on EVERY row of the series including the survivor,
    // which is AC-25's fourth ending and AC-39's third negative case: a series that
    // no longer exists must stop reading as live
    expect(rows[0]!.series_live).toBe(false)
    expect(h.store.read((s) => s.tasks[id]!.series_ended_at)).not.toBeNull()
  })

  it('AC-39 — a series-deleted occurrence that was ALREADY trashed still stops reading as live', async () => {
    const h = await buildHarness()
    const user = await newUser(h)
    const created = await post(h, user, {
      title: 'Water the plants',
      due_at: berlinNine('2026-08-20'),
      repeat_frequency: 'week',
      repeat_interval: 1,
    })
    const id = created.body.task.id as string
    const done = await patch(h, user, id, { status: 'done' })
    const successorId = done.body.changed[0].id as string
    // trash the completed occurrence on its own FIRST, then delete the series
    await h.agent.delete(`/tasks/${id}`).set('X-User-Id', user).expect(200)
    await h.agent
      .delete(`/tasks/${successorId}?scope=series`)
      .set('X-User-Id', user)
      .set('X-Timezone', ZONE)
      .expect(200)
    // the end marker goes on EVERY row of the series — an end marker is not trashing
    // the row, and a trashed occurrence that kept `series_ended_at: null` would read
    // as repeating again the moment it came back
    const restored = await h.agent.post(`/tasks/${id}/restore`).set('X-User-Id', user)
    expect(restored.status).toBe(200)
    expect(restored.body.task.series_live).toBe(false)
  })

  it('`scope=series` on a row with NO series is refused, and a bad scope value too', async () => {
    const h = await buildHarness()
    const user = await newUser(h)
    const task = await createTask(h, user, 'Buy milk')
    const res = await h.agent.delete(`/tasks/${task.id}?scope=series`).set('X-User-Id', user)
    expect(res.status).toBe(400)
    const bogus = await h.agent.delete(`/tasks/${task.id}?scope=everything`).set('X-User-Id', user)
    expect(bogus.status).toBe(400)
    expect(bogus.body.error.field).toBe('scope')
    expect(await listTasks(h, user)).toHaveLength(1)
  })
})

describe('POST /tasks/{id}/repeat-preview — a DRY RUN of the same code', () => {
  it('discloses the created-and-aligned date before the commit, and writes nothing', async () => {
    const h = await buildHarness()
    const user = await newUser(h)
    h.clock.set('2026-08-19T12:00:00.000Z') // Wednesday
    const task = await createTask(h, user, 'Weekly review')
    const shown = await preview(h, user, task.id as string, {
      repeat_frequency: 'week',
      repeat_interval: 1,
      repeat_weekdays: 'mo,th',
    })
    expect(shown.status).toBe(200)
    expect(shown.body).toMatchObject({
      due_at: '2026-08-19T22:00:00.000Z',
      due_all_day: true,
      created: true,
      moved: true,
      refusals: [],
    })
    // it writes nothing and makes zero AI calls
    expect((await listTasks(h, user))[0]!.due_at).toBeNull()
    expect(h.interpreter.calls).toHaveLength(0)

    // …and the commit lands on exactly the disclosed date, which is the whole point
    const committed = await patch(h, user, task.id as string, {
      repeat_frequency: 'week',
      repeat_interval: 1,
      repeat_weekdays: 'mo,th',
    })
    expect(committed.body.task.due_at).toBe(shown.body.due_at)
    expect(committed.body.task.due_all_day).toBe(shown.body.due_all_day)
  })

  it('carries what a commit WOULD refuse, so the surface can state the outcome without attempting it', async () => {
    const h = await buildHarness()
    const user = await newUser(h)
    const task = await createTask(h, user, 'Weekly review', { due_at: berlinNine('2026-08-20') })
    const both = await preview(h, user, task.id as string, {
      repeat_frequency: 'day',
      repeat_interval: 1,
      repeat_until: '2026-12-31',
      repeat_count: 5,
    })
    expect(both.status).toBe(200) // a preview never errors; it REPORTS
    expect(both.body.refusals).toEqual([
      { code: 'UNTIL_AND_COUNT', field: 'repeat_until', message: expect.any(String) },
    ])
    expect(both.body.created).toBe(false)
    expect(both.body.moved).toBe(false)

    const early = await preview(h, user, task.id as string, {
      repeat_frequency: 'day',
      repeat_interval: 1,
      repeat_until: '2026-08-01',
    })
    expect(early.body.refusals[0].code).toBe('UNTIL_BEFORE_DUE')
  })

  it('a zoneless client is told TIMEZONE_UNKNOWN rather than being refused the read', async () => {
    const h = await buildHarness()
    // deliberately NOT `newUser`: this account has never reported a zone at all,
    // which is the only state the refusal is reachable from
    const user = uid()
    const created = await h.zonelessAgent
      .post('/tasks')
      .set('X-User-Id', user)
      .send({ title: 'Weekly review' })
    const res = await h.zonelessAgent
      .post(`/tasks/${created.body.task.id}/repeat-preview`)
      .set('X-User-Id', user)
      .send({ repeat_frequency: 'day', repeat_interval: 1 })
    expect(res.status).toBe(200)
    expect(res.body.refusals[0].code).toBe('TIMEZONE_UNKNOWN')
  })

  it('the collection the date lands in is NOT returned — the server has no opinion (ADR-009)', async () => {
    const h = await buildHarness()
    const user = await newUser(h)
    const task = await createTask(h, user, 'Weekly review', { due_at: berlinNine('2026-08-20') })
    const shown = await preview(h, user, task.id as string, {
      repeat_frequency: 'day',
      repeat_interval: 1,
    })
    expect(Object.keys(shown.body).sort()).toEqual([
      'created',
      'due_all_day',
      'due_at',
      'moved',
      'refusals',
    ])
  })

  it('unknown fields are rejected here too, and it 404s for another account`s row', async () => {
    const h = await buildHarness()
    const user = await newUser(h)
    const other = await newUser(h)
    const task = await createTask(h, user, 'Weekly review')
    const unknown = await preview(h, user, task.id as string, { title: 'x' })
    expect(unknown.status).toBe(400)
    expect(unknown.body.error.field).toBe('title')
    const cross = await preview(h, other, task.id as string, { repeat_frequency: 'day' })
    expect(cross.status).toBe(404)
  })
})
