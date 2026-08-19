// Steps (F-005 AC-14, AC-15, AC-18, AC-19, AC-35, ADR-015).
//
// A step is a `task` row with `parent_id != null`. There is no `step` entity: one
// table, one id space, so a step can be restored, snapshotted and diffed by every
// mechanism that already exists.
//
// **One case per door, structurally distinct** (platform doc § Tests, L-005,
// L-006): the cascade's tick and its untick are two transitions, not one
// parameterised setup, and the un-complete case shuts the other door explicitly
// by hand-ticking one step first.

import { describe, expect, it } from 'vitest'
import { buildHarness, createTask, listTasks, sendTurn, uid } from './helpers.ts'

type Harness = Awaited<ReturnType<typeof buildHarness>>

const addStep = (h: Harness, user: string, parentId: string, title: string, fields = {}) =>
  h.agent.post('/tasks').set('X-User-Id', user).send({ title, parent_id: parentId, ...fields })

describe('AC-14 — a step is created in ONE call', () => {
  it('POST /tasks accepts `parent_id`, and the server appends it last', async () => {
    const h = await buildHarness()
    const user = uid()
    const parent = await createTask(h, user, 'Ship the release')
    const first = await addStep(h, user, parent.id as string, 'Write the notes')
    const second = await addStep(h, user, parent.id as string, 'Tag the commit')
    expect(first.status).toBe(201)
    // Not POST-then-PATCH: between the two calls the step would exist at an
    // undefined position, and AC-3's live-update guarantee renders that state to
    // every other client watching (architect F11).
    expect(first.body.task.parent_id).toBe(parent.id)
    expect(first.body.task.step_order).toBe(1024) // ADR-015: gaps of 1024
    expect(second.body.task.step_order).toBe(2048)
    expect(h.interpreter.calls).toHaveLength(0) // zero AI calls (AC-14)
  })

  it('a create SUPPLYING `step_order` keeps it — AC-14`s offline replay', async () => {
    const h = await buildHarness()
    const user = uid()
    const parent = await createTask(h, user, 'Ship the release')
    // The unconditional reading — *server always assigns* — silently voids the
    // offline replay while every AC still reads as satisfied, which is why ADR-015
    // states it in BOTH directions. A server that reassigns on replay overwrites a
    // position AFTER the user has seen the list and possibly reordered it.
    const replayed = await addStep(h, user, parent.id as string, 'Replayed step', {
      id: uid(),
      step_order: 512,
    })
    expect(replayed.status).toBe(201)
    expect(replayed.body.task.step_order).toBe(512)
  })

  it('`parent_id` must name a live, non-step row of the caller`s', async () => {
    const h = await buildHarness()
    const user = uid()
    const other = uid()
    const mine = await createTask(h, user, 'Ship the release')
    const theirs = await createTask(h, other, 'Their task')

    const unknown = await addStep(h, user, uid(), 'x')
    expect(unknown.status).toBe(400)
    expect(unknown.body.error.field).toBe('parent_id')

    const crossAccount = await addStep(h, user, theirs.id as string, 'x')
    expect(crossAccount.status).toBe(400)
    expect(crossAccount.body.error.field).toBe('parent_id')

    await h.agent.delete(`/tasks/${mine.id}`).set('X-User-Id', user).expect(200)
    const onDeleted = await addStep(h, user, mine.id as string, 'x')
    expect(onDeleted.status).toBe(400)
  })

  it('AC-18 — a step has no steps of its own: deeper nesting is REFUSED, not flattened', async () => {
    const h = await buildHarness()
    const user = uid()
    const parent = await createTask(h, user, 'Ship the release')
    const step = await addStep(h, user, parent.id as string, 'Write the notes')
    const grandchild = await addStep(h, user, step.body.task.id as string, 'Proofread')
    // *"Not expressible"* without an outcome leaves a test author three choices —
    // 400, ignored, coerced — and the wrong guess passes against a system that
    // silently drops the field (tester T10)
    expect(grandchild.status).toBe(400)
    expect(grandchild.body.error.field).toBe('parent_id')
    expect((await listTasks(h, user)).filter((t) => t.parent_id !== null)).toHaveLength(1)
  })

  it('AC-18 — a step may carry no repeat, and the refusal names the rule', async () => {
    const h = await buildHarness()
    const user = uid()
    const parent = await createTask(h, user, 'Ship the release')
    const withRepeat = await addStep(h, user, parent.id as string, 'Write the notes', {
      repeat_frequency: 'week',
      repeat_interval: 1,
    })
    expect(withRepeat.status).toBe(400)
    expect(withRepeat.body.error.field).toBe('repeat_frequency')

    const step = await addStep(h, user, parent.id as string, 'Write the notes')
    const patched = await h.agent
      .patch(`/tasks/${step.body.task.id}`)
      .set('X-User-Id', user)
      .send({ repeat_frequency: 'week', repeat_interval: 1 })
    expect(patched.status).toBe(400)
  })

  it('`parent_id` is deliberately NOT patchable — a step does not change parents this phase', async () => {
    const h = await buildHarness()
    const user = uid()
    const parent = await createTask(h, user, 'Ship the release')
    const other = await createTask(h, user, 'Another task')
    const step = await addStep(h, user, parent.id as string, 'Write the notes')
    // re-parenting is a gesture no AC describes and no control offers, so the field is
    // out of `TASK_PATCH_FIELDS` and the one unknown-field policy answers it
    const res = await h.agent
      .patch(`/tasks/${step.body.task.id}`)
      .set('X-User-Id', user)
      .send({ parent_id: other.id })
    expect(res.status).toBe(400)
    expect(res.body.error.field).toBe('parent_id')
    expect(h.store.read((s) => s.tasks[step.body.task.id as string]!.parent_id)).toBe(parent.id)
  })

  it('AC-14 — any bound on the number of steps is STATED and refused', async () => {
    const h = await buildHarness()
    const user = uid()
    const parent = await createTask(h, user, 'Ship the release')
    h.store.transact((s) => {
      // 200 is the bound (api-contracts § Validation bounds); seeded rather than
      // POSTed 200 times, because the assertion is about the refusal and not about
      // the loop
      for (let i = 0; i < 200; i += 1) {
        const id = uid()
        s.tasks[id] = {
          id,
          user_id: user,
          title: `step ${i}`,
          due_at: null,
          reminder_at: null,
          priority: null,
          status: 'inbox',
          parent_id: parent.id as string,
          step_order: (i + 1) * 1024,
          created_at: '2026-08-17T00:00:00.000Z',
          updated_at: '2026-08-17T00:00:00.000Z',
          deleted_at: null,
        }
      }
    })
    const over = await addStep(h, user, parent.id as string, 'the 201st')
    expect(over.status).toBe(400)
    expect(over.body.error.message).toMatch(/200 steps/)
  })
})

describe('AC-15 / ADR-015 — the order is the user`s, and a move is ONE write', () => {
  const threeSteps = async (h: Harness, user: string) => {
    const parent = await createTask(h, user, 'Ship the release')
    const a = await addStep(h, user, parent.id as string, 'A')
    const b = await addStep(h, user, parent.id as string, 'B')
    const c = await addStep(h, user, parent.id as string, 'C')
    return {
      parentId: parent.id as string,
      ids: [a.body.task.id, b.body.task.id, c.body.task.id] as string[],
    }
  }

  it('moving one step among three changes exactly ONE row, and carries its prior position', async () => {
    const h = await buildHarness()
    const user = uid()
    const { ids } = await threeSteps(h, user)
    // C to the front: the midpoint below A's 1024
    const moved = await h.agent.patch(`/tasks/${ids[2]}`).set('X-User-Id', user).send({ step_order: 512 })
    expect(moved.status).toBe(200)
    expect(moved.body.task.step_order).toBe(512)
    // N separate writes would make AC-43's single-action undo reverse N writes with
    // no stated grouping, and would render the intermediate orders to every other
    // client through AC-3
    expect(moved.body.changed).toEqual([])
    // **The prior position comes from the move's own response and from nowhere
    // else** (ADR-015) — no new record is owed, and the undo's write path is the
    // move's write path
    expect(moved.body.prior).toEqual({ step_order: 3072 })
  })

  it('the reorder undo replays `prior.step_order` through the same PATCH', async () => {
    const h = await buildHarness()
    const user = uid()
    const { ids } = await threeSteps(h, user)
    const moved = await h.agent.patch(`/tasks/${ids[2]}`).set('X-User-Id', user).send({ step_order: 512 })
    const back = await h.agent
      .patch(`/tasks/${ids[2]}`)
      .set('X-User-Id', user)
      .send({ step_order: moved.body.prior.step_order })
    expect(back.status).toBe(200)
    expect(back.body.task.step_order).toBe(3072)
  })

  it('a drop where the step ALREADY WAS writes nothing, and `prior` is `{}`', async () => {
    const h = await buildHarness()
    const user = uid()
    const { ids } = await threeSteps(h, user)
    const before = h.store.read((s) => s.tasks[ids[1]!]!.updated_at)
    h.clock.advance(60_000)
    const noop = await h.agent.patch(`/tasks/${ids[1]}`).set('X-User-Id', user).send({ step_order: 2048 })
    expect(noop.status).toBe(200)
    // the observable AC-43's *no undo entry* and AC-16's *announces nothing* are
    // asserted against, rather than depending on the client noticing
    expect(noop.body.prior).toEqual({})
    expect(noop.body.changed).toEqual([])
    expect(h.store.read((s) => s.tasks[ids[1]!]!.updated_at)).toBe(before)
  })

  it('an EXHAUSTED gap renumbers every sibling in one transaction and returns every row it changed', async () => {
    const h = await buildHarness()
    const user = uid()
    const { ids } = await threeSteps(h, user)
    // land C exactly on B's position — the gap is gone, so the server renumbers
    const collided = await h.agent
      .patch(`/tasks/${ids[2]}`)
      .set('X-User-Id', user)
      .send({ step_order: 2048 })
    expect(collided.status).toBe(200)
    // it is still ONE request and is undone as one unit; no client sees an
    // intermediate order (ADR-015 § Consequences). Every sibling is renumbered to a
    // fresh multiple of 1024 — and a sibling whose new number equals its old one is
    // not "changed", so `changed` carries the rows the write actually touched and
    // nothing else.
    const orders = (await listTasks(h, user))
      .filter((t) => t.parent_id !== null)
      .map((t) => [t.id, t.step_order] as [string, number])
      .sort((a, b) => a[1] - b[1])
    expect(orders.map(([, o]) => o)).toEqual([1024, 2048, 3072])
    // C sorts BEFORE the sibling it landed on, which is what a drop onto an
    // occupied position means
    expect(orders[1]![0]).toBe(ids[2])
    // B was pushed down and is returned; A was already at 1024 and is not
    expect(collided.body.changed.map((t: { id: string }) => t.id)).toEqual([ids[1]])
    expect(collided.body.prior).toEqual({ step_order: 3072 })
  })

  it('a DONE step keeps its position and can still be moved', async () => {
    const h = await buildHarness()
    const user = uid()
    const { ids } = await threeSteps(h, user)
    await h.agent.patch(`/tasks/${ids[0]}`).set('X-User-Id', user).send({ status: 'done' }).expect(200)
    // "finished" does not mean "no longer part of this list" (AC-15)
    const moved = await h.agent.patch(`/tasks/${ids[0]}`).set('X-User-Id', user).send({ step_order: 4096 })
    expect(moved.status).toBe(200)
    expect(moved.body.task.step_order).toBe(4096)
    expect(moved.body.task.status).toBe('done')
  })

  it('`step_order` is never derived from a date — a step with a deadline does not jump', async () => {
    const h = await buildHarness()
    const user = uid()
    const parent = await createTask(h, user, 'Ship the release')
    const a = await addStep(h, user, parent.id as string, 'A')
    const b = await addStep(h, user, parent.id as string, 'B', {
      due_at: '2020-01-01T00:00:00.000Z',
    })
    expect(a.body.task.step_order).toBe(1024)
    expect(b.body.task.step_order).toBe(2048) // an earlier date, a later position
  })
})

describe('AC-19 — what happens to a step when its parent moves', () => {
  const parentWithSteps = async (h: Harness, user: string, n = 3) => {
    const parent = await createTask(h, user, 'Ship the release')
    const ids: string[] = []
    for (let i = 0; i < n; i += 1) {
      const res = await addStep(h, user, parent.id as string, `step ${i}`)
      ids.push(res.body.task.id as string)
    }
    return { parentId: parent.id as string, stepIds: ids }
  }

  it('parent COMPLETED — the steps are completed with it, and which ones is RECORDED', async () => {
    const h = await buildHarness()
    const user = uid()
    const { parentId, stepIds } = await parentWithSteps(h, user)
    const done = await h.agent.patch(`/tasks/${parentId}`).set('X-User-Id', user).send({ status: 'done' })
    expect(done.status).toBe(200)
    // **any write that changes more than one row returns every row it changed**
    expect(done.body.changed).toHaveLength(3)
    for (const step of done.body.changed) {
      expect(step.status).toBe('done')
      // the cascade sets the flag on each step it ticks — the plausible invention
      // (compare a step's `updated_at` to the parent's) is wrong for the exact case
      // the rule exists to protect (product F1)
      expect(step.completed_by_parent).toBe(true)
    }
    expect(stepIds).toHaveLength(3)
  })

  it('parent completed with steps OUTSTANDING is allowed — the count informs, it never gates', async () => {
    const h = await buildHarness()
    const user = uid()
    const { parentId } = await parentWithSteps(h, user)
    const done = await h.agent.patch(`/tasks/${parentId}`).set('X-User-Id', user).send({ status: 'done' })
    expect(done.status).toBe(200) // a todo app that refuses to let you finish something is arguing with its user
  })

  it('parent UN-COMPLETED — the cascade is undone, and ONLY the cascade', async () => {
    const h = await buildHarness()
    const user = uid()
    const { parentId, stepIds } = await parentWithSteps(h, user)
    // shut the other door explicitly: the user ticks step 0 BY HAND first, so the
    // only way it can stay ticked is the `completed_by_parent` record. A shared
    // setup that ticked nothing by hand is what hides this case (L-005, L-012).
    const byHand = await h.agent
      .patch(`/tasks/${stepIds[0]}`)
      .set('X-User-Id', user)
      .send({ status: 'done' })
    expect(byHand.body.task.completed_by_parent).toBe(false)

    await h.agent.patch(`/tasks/${parentId}`).set('X-User-Id', user).send({ status: 'done' }).expect(200)
    const undone = await h.agent
      .patch(`/tasks/${parentId}`)
      .set('X-User-Id', user)
      .send({ status: 'inbox' })
    expect(undone.status).toBe(200)

    const rows = await listTasks(h, user)
    const byId = new Map(rows.map((r) => [r.id as string, r]))
    // tick a step, tick the parent a second later, and you keep your own tick
    expect(byId.get(stepIds[0]!)!.status).toBe('done')
    expect(byId.get(stepIds[1]!)!.status).toBe('inbox')
    expect(byId.get(stepIds[2]!)!.status).toBe('inbox')
    expect(byId.get(stepIds[1]!)!.completed_by_parent).toBe(false)
  })

  it('a hand tick or untick of a step CLEARS `completed_by_parent`', async () => {
    const h = await buildHarness()
    const user = uid()
    const { parentId, stepIds } = await parentWithSteps(h, user, 1)
    await h.agent.patch(`/tasks/${parentId}`).set('X-User-Id', user).send({ status: 'done' }).expect(200)
    expect(h.store.read((s) => s.tasks[stepIds[0]!]!.completed_by_parent)).toBe(true)
    // the flag records the cascade, so a hand action ends its claim
    const untick = await h.agent
      .patch(`/tasks/${stepIds[0]}`)
      .set('X-User-Id', user)
      .send({ status: 'inbox' })
    expect(untick.body.task.completed_by_parent).toBe(false)
    // …and the parent's un-complete no longer re-ticks it
    const undone = await h.agent
      .patch(`/tasks/${parentId}`)
      .set('X-User-Id', user)
      .send({ status: 'inbox' })
    expect(undone.body.changed).toEqual([])
  })

  it('parent DELETED — its steps go with it, under ONE gesture id', async () => {
    const h = await buildHarness()
    const user = uid()
    const { parentId, stepIds } = await parentWithSteps(h, user)
    const del = await h.agent.delete(`/tasks/${parentId}`).set('X-User-Id', user)
    expect(del.status).toBe(200)
    expect(del.body.changed).toHaveLength(3)
    expect(await listTasks(h, user)).toHaveLength(0)
    // ADR-012: one id per gesture, on every row it trashed, in the same
    // transaction as `deleted_at` — that is what restore replays
    const gestures = h.store.read((s) =>
      new Set([parentId, ...stepIds].map((id) => s.tasks[id]!.delete_gesture_id)),
    )
    expect(gestures.size).toBe(1)
    expect([...gestures][0]).not.toBeNull()
  })
})

describe('AC-35 — a step is not a handle', () => {
  it('a task with three steps contributes ONE handle, not four', async () => {
    const h = await buildHarness()
    const user = uid()
    const parent = await createTask(h, user, 'Buy milk')
    for (const title of ['Buy eggs', 'Buy bread', 'Team meeting']) {
      await addStep(h, user, parent.id as string, title)
    }
    // 'delete the shopping tasks' targets three titles, two of which are now STEPS.
    // With steps in the handle list this would be a bulk delete naming step titles
    // aloud in a confirmation; without them it resolves to the one top-level task,
    // which the single-task path applies immediately.
    const res = await sendTurn(h, user, 'delete the shopping tasks')
    expect(res.status).toBe(200)
    const ctxTitles = h.interpreter.calls.map((c) => c.transcript)
    expect(ctxTitles).toHaveLength(1)
    expect(res.body.turn.outcome.kind).toBe('applied')
    expect(res.body.turn.outcome.deleted_titles).toEqual(['Buy milk'])
    // and the steps went with their parent (AC-19), never named
    expect(res.body.turn.outcome.deleted_titles).not.toContain('Buy eggs')
  })

  it('a turn cannot address a step even when its title is unique', async () => {
    const h = await buildHarness()
    const user = uid()
    const parent = await createTask(h, user, 'Ship the release')
    await addStep(h, user, parent.id as string, 'Team meeting')
    const res = await sendTurn(h, user, 'delete the meeting')
    expect(res.status).toBe(200)
    // no handle resolved, so the honest outcome is no_match quoting what was heard
    // (AC-14) — never a silent success on a row no list holds
    expect(res.body.turn.outcome.kind).toBe('no_match')
    expect((await listTasks(h, user)).filter((t) => t.parent_id !== null)).toHaveLength(1)
  })
})
