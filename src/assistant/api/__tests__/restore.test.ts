// `POST /tasks/{id}/restore` (F-005 AC-41, AC-31, AC-42, AC-19, AC-15, ADR-012).
//
// > A soft-deleted task can be restored, and today **nothing in this system can do
// > that.** `DELETE` sets `deleted_at`; `PATCH` 404s on a deleted row and
// > `deleted_at` is not in `TASK_PATCH_FIELDS`; `GET /tasks` filters deleted rows
// > out; a re-`POST` under the same id answers 409; and the only un-delete that
// > exists reverts a TURN, which a hand delete never creates.
//
// Four ACs assert on this write path, so these cases are what makes them buildable.

import { describe, expect, it } from 'vitest'
import { buildHarness, createTask, listTasks, uid } from './helpers.ts'
import type { TaskRow } from '../types.ts'

type Harness = Awaited<ReturnType<typeof buildHarness>>

const restore = (h: Harness, user: string, id: string) =>
  h.agent.post(`/tasks/${id}/restore`).set('X-User-Id', user)

describe('AC-41 — the restore replays the membership the DELETE recorded', () => {
  it('a parent-and-steps cluster comes back in ONE call, ids and positions intact', async () => {
    const h = await buildHarness()
    const user = uid()
    const parent = await createTask(h, user, 'Ship the release')
    const stepIds: string[] = []
    for (const title of ['A', 'B', 'C']) {
      const res = await h.agent
        .post('/tasks')
        .set('X-User-Id', user)
        .send({ title, parent_id: parent.id })
      stepIds.push(res.body.task.id as string)
    }
    const before = await listTasks(h, user)
    await h.agent.delete(`/tasks/${parent.id}`).set('X-User-Id', user).expect(200)
    expect(await listTasks(h, user)).toHaveLength(0)

    h.clock.advance(60_000)
    const res = await restore(h, user, parent.id as string)
    expect(res.status).toBe(200)
    expect(res.body.restored).toBe(true)
    expect(res.body.changed).toHaveLength(3)

    const after = await listTasks(h, user)
    expect(after).toHaveLength(4)
    // **Restoring is not creating**: ids, `step_order`, `series_id` and `created_at`
    // are kept; only `deleted_at` clears and `updated_at` advances. AC-15's
    // *"deleting a step and then undoing returns it to the position it held,
    // because the order lives on the record that came back"* is literally true —
    // the row comes back with its own `step_order`, from the SERVER.
    const strip = ({ updated_at, ...rest }: Record<string, unknown>) => rest
    expect(after.map(strip)).toEqual(before.map(strip))
    for (const id of stepIds) {
      expect(after.find((t) => t.id === id)).toBeDefined()
    }
  })

  it('a step restored ALONE brings its still-deleted parent with it — an invariant, not a key', async () => {
    const h = await buildHarness()
    const user = uid()
    const parent = await createTask(h, user, 'Ship the release')
    const step = await h.agent
      .post('/tasks')
      .set('X-User-Id', user)
      .send({ title: 'A', parent_id: parent.id })
    // delete the step by itself, then the parent by itself — two gestures, so the
    // step's membership set holds only the step
    await h.agent.delete(`/tasks/${step.body.task.id}`).set('X-User-Id', user).expect(200)
    await h.agent.delete(`/tasks/${parent.id}`).set('X-User-Id', user).expect(200)

    const res = await restore(h, user, step.body.task.id as string)
    expect(res.status).toBe(200)
    // a step with no parent is in no collection and therefore unreachable, so the
    // parent rule is evaluated AFTER the membership set is assembled
    expect(res.body.changed.map((t: { id: string }) => t.id)).toEqual([parent.id])
    const after = await listTasks(h, user)
    expect(after.map((t) => t.id).sort()).toEqual([parent.id, step.body.task.id].sort())
  })

  it('the delete of a step alone does NOT resurrect the parent`s other steps', async () => {
    const h = await buildHarness()
    const user = uid()
    const parent = await createTask(h, user, 'Ship the release')
    const a = await h.agent.post('/tasks').set('X-User-Id', user).send({ title: 'A', parent_id: parent.id })
    const b = await h.agent.post('/tasks').set('X-User-Id', user).send({ title: 'B', parent_id: parent.id })
    // two independent gestures an hour apart. `parent_id` as the key would
    // resurrect a step the user deliberately deleted an hour earlier — AC-41
    // rejects it by name, and so does matching `deleted_at`.
    await h.agent.delete(`/tasks/${a.body.task.id}`).set('X-User-Id', user).expect(200)
    h.clock.advance(3_600_000)
    await h.agent.delete(`/tasks/${b.body.task.id}`).set('X-User-Id', user).expect(200)

    const res = await restore(h, user, b.body.task.id as string)
    expect(res.body.changed).toEqual([])
    const after = await listTasks(h, user)
    expect(after.map((t) => t.title).sort()).toEqual(['B', 'Ship the release'])
  })

  it('the 53-row legacy case: a row with NO membership record restores ALONE', async () => {
    const h = await buildHarness()
    const user = uid()
    // Measured, re-verified 2026-08-19: 53 of 790 rows are already soft-deleted with
    // no membership record, across 18 accounts, all predating the field. **No
    // migration is run** — every available way to infer a membership is a key AC-41
    // rejects by name, so a singleton restore is the only answer that is TRUE rather
    // than plausible, and it fails in the SAFE direction (it under-restores).
    const ids = [uid(), uid()]
    h.store.transact((s) => {
      for (const id of ids) {
        s.tasks[id] = {
          id,
          user_id: user,
          title: `legacy ${id.slice(0, 4)}`,
          due_at: null,
          reminder_at: null,
          priority: null,
          status: 'inbox',
          created_at: '2026-08-10T00:00:00.000Z',
          updated_at: '2026-08-10T00:00:00.000Z',
          // deleted in the SAME second, which is a coincidence and not a key
          deleted_at: '2026-08-11T09:00:00.000Z',
        } as TaskRow
      }
    })
    const res = await restore(h, user, ids[0]!)
    expect(res.status).toBe(200)
    expect(res.body.restored).toBe(true)
    expect(res.body.changed).toEqual([])
    const after = await listTasks(h, user)
    expect(after.map((t) => t.id)).toEqual([ids[0]])
    // …and the second one is restorable individually
    await restore(h, user, ids[1]!).expect(200)
    expect(await listTasks(h, user)).toHaveLength(2)
  })

  it('restoring a row that is NOT deleted is a stated no-op — 200 with `restored: false`', async () => {
    const h = await buildHarness()
    const user = uid()
    const task = await createTask(h, user, 'Buy milk')
    const res = await restore(h, user, task.id as string)
    // never 404 and never 409: a double-tap is ordinary on an undo that is one
    // action away wherever the user is
    expect(res.status).toBe(200)
    expect(res.body.restored).toBe(false)
    expect(res.body.task.id).toBe(task.id)
    expect(res.body.changed).toEqual([])
  })

  it('a double restore is idempotent: the second is the stated no-op', async () => {
    const h = await buildHarness()
    const user = uid()
    const task = await createTask(h, user, 'Buy milk')
    await h.agent.delete(`/tasks/${task.id}`).set('X-User-Id', user).expect(200)
    expect((await restore(h, user, task.id as string)).body.restored).toBe(true)
    expect((await restore(h, user, task.id as string)).body.restored).toBe(false)
    expect(await listTasks(h, user)).toHaveLength(1)
  })

  it('it is scoped to the caller`s rows: another account`s id behaves as 404', async () => {
    const h = await buildHarness()
    const user = uid()
    const other = uid()
    const task = await createTask(h, user, 'Secret task')
    await h.agent.delete(`/tasks/${task.id}`).set('X-User-Id', user).expect(200)
    // stated explicitly because a brand-new write path is exactly where cross-account
    // scoping gets missed, and no AC would otherwise turn red
    const cross = await restore(h, other, task.id as string)
    expect(cross.status).toBe(404)
    const unknown = await restore(h, user, uid())
    expect(unknown.status).toBe(404)
    const unauthed = await h.agent.post(`/tasks/${task.id}/restore`)
    expect(unauthed.status).toBe(401)
    // the refused restore left the row deleted
    expect(await listTasks(h, user)).toHaveLength(0)
  })

  it('the body must be empty — the one unknown-field policy applies here too', async () => {
    const h = await buildHarness()
    const user = uid()
    const task = await createTask(h, user, 'Buy milk')
    await h.agent.delete(`/tasks/${task.id}`).set('X-User-Id', user).expect(200)
    const res = await h.agent
      .post(`/tasks/${task.id}/restore`)
      .set('X-User-Id', user)
      .send({ deleted_at: null })
    expect(res.status).toBe(400)
    expect(res.body.error.field).toBe('deleted_at')
    expect(await listTasks(h, user)).toHaveLength(0)
  })

  it('a SERIES delete`s whole membership comes back in one call', async () => {
    const h = await buildHarness()
    const user = uid()
    const created = await h.agent
      .post('/tasks')
      .set('X-User-Id', user)
      .send({
        title: 'Water the plants',
        due_at: '2026-08-20T07:00:00.000Z',
        repeat_frequency: 'week',
        repeat_interval: 1,
      })
    const id = created.body.task.id as string
    await h.agent.post('/tasks').set('X-User-Id', user).send({ title: 'Fill the can', parent_id: id })
    const del = await h.agent.delete(`/tasks/${id}?scope=series`).set('X-User-Id', user)
    expect(del.status).toBe(200)
    expect(await listTasks(h, user)).toHaveLength(0)
    // the membership is the delete's unit, and the unit follows the GESTURE
    const res = await restore(h, user, id)
    expect(res.body.restored).toBe(true)
    expect(await listTasks(h, user)).toHaveLength(2)
  })

  it('PATCH still 404s on a deleted row — which is why restore is a ROUTE (ADR-012)', async () => {
    const h = await buildHarness()
    const user = uid()
    const task = await createTask(h, user, 'Buy milk')
    await h.agent.delete(`/tasks/${task.id}`).set('X-User-Id', user).expect(200)
    const patched = await h.agent
      .patch(`/tasks/${task.id}`)
      .set('X-User-Id', user)
      .send({ title: 'x' })
    expect(patched.status).toBe(404)
    // `deleted_at` in TASK_PATCH_FIELDS would make un-delete reachable from every
    // client that can spell a field name, and inverting the 404 would weaken the
    // guard for every other field
    const undelete = await h.agent
      .patch(`/tasks/${task.id}`)
      .set('X-User-Id', user)
      .send({ deleted_at: null })
    expect(undelete.status).toBe(400)
    expect(undelete.body.error.field).toBe('deleted_at')
  })
})
