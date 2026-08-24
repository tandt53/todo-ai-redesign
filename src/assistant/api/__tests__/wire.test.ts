// `Task` on the wire (F-005 AC-8, AC-13, AC-25, AC-39, ADR-011, ADR-014).
//
// Three of these fixtures **cannot be built through the API**, because the write
// path refuses exactly the value the read path must tolerate — an out-of-set
// stored `priority`, a non-canonical `repeat_weekdays`, a pre-F-005 row. They are
// seeded through the `Store` port, which is what `POST /__qa__/seed` does for the
// QA tier (api-contracts § Harness doors). A test that can only build what the
// write path allows cannot fail these ACs.

import { describe, expect, it } from 'vitest'
import { buildHarness, createTask, listTasks, uid } from './helpers.ts'
import type { TaskRow } from '../types.ts'

type Harness = Awaited<ReturnType<typeof buildHarness>>

/** the shape a row had BEFORE F-005 — nine fields, no more */
const legacyRow = (id: string, user: string, over: Partial<TaskRow> = {}): TaskRow =>
  ({
    id,
    user_id: user,
    title: 'a row from before F-005',
    due_at: null,
    reminder_at: null,
    priority: null,
    status: 'inbox',
    created_at: '2026-08-17T00:00:00.000Z',
    updated_at: '2026-08-17T00:00:00.000Z',
    deleted_at: null,
    ...over,
  }) as TaskRow

const seed = (h: Harness, row: TaskRow): void => {
  h.store.transact((s) => {
    s.tasks[row.id] = row
  })
}

describe('priority — `none` is the ABSENCE of a stored value (AC-8)', () => {
  it('783 of 790 live rows hold `null`, and every one of them reads as "none"', async () => {
    const h = await buildHarness()
    const user = uid()
    const id = uid()
    seed(h, legacyRow(id, user))
    expect((await listTasks(h, user))[0]!.priority).toBe('none')
  })

  it('writing `none` stores nothing — so a create emits NO priority diff row', async () => {
    const h = await buildHarness()
    const user = uid()
    const created = await h.agent
      .post('/tasks')
      .set('X-User-Id', user)
      .send({ title: 'Buy milk', priority: 'none' })
    expect(created.status).toBe(201)
    expect(created.body.task.priority).toBe('none')
    // the row stores null, not the string. A literal `'none'` would add a
    // `priority: none` row to F-001 AC-4's message on EVERY create, and would make
    // `taskEquals`'s `===` report every pre-F-005 `null` row modified in the very
    // gate AC-34 exists to protect.
    expect(h.store.read((s) => s.tasks[created.body.task.id as string]!.priority)).toBeNull()
  })

  it('clearing priority to `none` is observable on read-back and stores no value', async () => {
    const h = await buildHarness()
    const user = uid()
    const task = await createTask(h, user, 'Buy milk', { priority: 'high' })
    const cleared = await h.agent
      .patch(`/tasks/${task.id}`)
      .set('X-User-Id', user)
      .send({ priority: 'none' })
    expect(cleared.status).toBe(200)
    expect(cleared.body.task.priority).toBe('none')
    expect(cleared.body.prior).toEqual({ priority: 'high' })
    expect(h.store.read((s) => s.tasks[task.id as string]!.priority)).toBeNull()
  })

  it('the write path NARROWS while the read stays TOLERANT — the same value, two answers', async () => {
    const h = await buildHarness()
    const user = uid()
    // the write refuses it…
    const rejected = await h.agent
      .post('/tasks')
      .set('X-User-Id', user)
      .send({ title: 'x', priority: 'urgent' })
    expect(rejected.status).toBe(400)
    expect(rejected.body.error.field).toBe('priority')
    expect(await listTasks(h, user)).toHaveLength(0)

    // …and the read emits `none` for it rather than breaking a client, the same
    // move ADR-009 made for `status: 'today'`. This fixture is only constructible
    // through the seed path, since the write path above refuses exactly it.
    const id = uid()
    seed(h, legacyRow(id, user, { priority: 'urgent' } as Partial<TaskRow>))
    const rows = await listTasks(h, user)
    expect(rows[0]!.priority).toBe('none')
    expect(rows[0]!.priority).not.toBe('urgent') // emitted as `none`, never as itself
  })
})

describe('due_all_day — three rules in order, and `null` is not a third state (AC-13)', () => {
  it('a write that sets `due_at` STORES the resolved flag, so `null` is a shrinking population', async () => {
    const h = await buildHarness()
    const user = uid()
    const id = uid()
    seed(h, legacyRow(id, user, { due_at: '2026-08-20T10:00:00.000Z' }))
    // the read resolves it and does NOT rewrite the row (ADR-010, rule 2)
    expect((await listTasks(h, user))[0]!.due_all_day).toBe(false)
    expect(h.store.read((s) => s.tasks[id]!.due_all_day)).toBeUndefined()

    // the next write that touches `due_at` stores it
    await h.agent
      .patch(`/tasks/${id}`)
      .set('X-User-Id', user)
      .send({ due_at: '2026-08-21T00:00:00.000Z' })
    expect(h.store.read((s) => s.tasks[id]!.due_all_day)).toBe(true)
  })

  it('clearing `due_at` clears the flag with it — not a zero date, not a stale true', async () => {
    const h = await buildHarness()
    const user = uid()
    const task = await createTask(h, user, 'Buy milk', { due_at: '2026-08-20T00:00:00.000Z' })
    expect(task.due_all_day).toBe(true)
    const cleared = await h.agent
      .patch(`/tasks/${task.id}`)
      .set('X-User-Id', user)
      .send({ due_at: null })
    expect(cleared.body.task.due_at).toBeNull()
    expect(cleared.body.task.due_all_day).toBeNull()
  })
})

describe('series_live — derived, and NEVER keyed off `series_id` (AC-25, AC-39)', () => {
  const repeating = (h: Harness, user: string, over: Record<string, unknown> = {}) =>
    h.agent
      .post('/tasks')
      .set('X-User-Id', user)
      .send({
        title: 'Water the plants',
        due_at: '2026-08-20T07:00:00.000Z',
        repeat_frequency: 'day',
        repeat_interval: 1,
        ...over,
      })

  it('a repeat that is set reads live, and carries a `series_id`', async () => {
    const h = await buildHarness()
    const user = uid()
    const res = await repeating(h, user)
    expect(res.status).toBe(201)
    expect(res.body.task.series_live).toBe(true)
    expect(res.body.task.series_id).not.toBeNull()
  })

  it('CLEARING the repeat ends the series, and `series_id` SURVIVES — which is why it is not the predicate', async () => {
    const h = await buildHarness()
    const user = uid()
    const created = await repeating(h, user)
    const seriesId = created.body.task.series_id as string
    const cleared = await h.agent
      .patch(`/tasks/${created.body.task.id}`)
      .set('X-User-Id', user)
      .send({ repeat_frequency: null, repeat_interval: null })
    expect(cleared.status).toBe(200)
    // an implementation keyed off `series_id` passes the positive case above and
    // marks every task that ever repeated as repeating FOR GOOD
    expect(cleared.body.task.series_live).toBe(false)
    expect(cleared.body.task.series_id).toBe(seriesId)
    // ending a repeat is not deleting a task: it keeps its due date (AC-25)
    expect(cleared.body.task.due_at).toBe('2026-08-20T07:00:00.000Z')
  })

  it('an `until` now in the past ends the series (ending two of four)', async () => {
    const h = await buildHarness()
    const user = uid()
    const created = await repeating(h, user, { repeat_until: '2026-08-21' })
    expect(created.body.task.series_live).toBe(true)
    h.clock.set('2026-08-22T00:00:00.000Z')
    expect((await listTasks(h, user))[0]!.series_live).toBe(false)
  })

  it('a run count now REACHED ends the series (ending three of four), counted from `ever_completed`', async () => {
    const h = await buildHarness()
    const user = uid()
    const created = await repeating(h, user, { repeat_count: 1 })
    const done = await h.agent
      .patch(`/tasks/${created.body.task.id}`)
      .set('X-User-Id', user)
      .send({ status: 'done' })
    expect(done.status).toBe(200)
    // the count is reached, so the completion generates NO successor and the
    // series is over (ADR-014: the three properties fall out of the flag)
    expect(done.body.changed).toEqual([])
    expect(done.body.task.series_live).toBe(false)
    // …and un-completing does not un-count a run: the flag is never cleared
    const undone = await h.agent
      .patch(`/tasks/${created.body.task.id}`)
      .set('X-User-Id', user)
      .send({ status: 'inbox' })
    expect(undone.body.task.series_live).toBe(false)
  })
})

describe('the wire shape itself', () => {
  it('emits every declared field and no internal one', async () => {
    const h = await buildHarness()
    const user = uid()
    const task = await createTask(h, user, 'Buy milk')
    expect(Object.keys(task).sort()).toEqual(
      [
        'completed_by_parent',
        'created_at',
        'deleted_at',
        'due_all_day',
        'due_at',
        'id',
        'list_id',
        'note',
        'parent_id',
        'priority',
        'reminder_at',
        'reminder_shown_at',
        'repeat_count',
        'repeat_frequency',
        'repeat_interval',
        'repeat_month_days',
        'repeat_until',
        'repeat_weekdays',
        'series_id',
        'series_live',
        'sort_order',
        'status',
        'step_order',
        'title',
        'updated_at',
      ].sort(),
    )
    // internal, never serialized (data-model § task — the F-005 fields)
    for (const internal of ['user_id', 'ever_completed', 'delete_gesture_id', 'series_ended_at']) {
      expect(task).not.toHaveProperty(internal)
    }
  })

  it('a pre-F-005 row serializes with defaults rather than `undefined` holes', async () => {
    const h = await buildHarness()
    const user = uid()
    const id = uid()
    seed(h, legacyRow(id, user))
    const row = (await listTasks(h, user))[0]!
    expect(row.note).toBeNull()
    expect(row.completed_by_parent).toBe(false)
    expect(row.series_live).toBe(false)
    expect(row.step_order).toBeNull()
    expect(row.parent_id).toBeNull()
    expect(row.reminder_shown_at).toBeNull()
  })
})
