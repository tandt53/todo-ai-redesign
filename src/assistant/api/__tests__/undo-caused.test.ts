// A row the server CAUSES belongs to the turn's undo record (F-005 AC-46, AC-34,
// ADR-013).
//
// > Undo reverses the whole of what the turn caused, or it reverses none of it; a
// > turn whose consequences are half-reverted is worse than one that cannot be
// > undone, **because the user believes it was.** (AC-46)
//
// Generation (AC-26) and the parent→step cascade (AC-19) both happen server-side,
// outside `applyCreate`/`applyEdit`, so before ADR-013 they landed in **neither
// `created_ids`, nor `undo_snapshot`, nor `post_apply`** — and a voice turn CAN set
// `status: 'done'`, because `status` is in `DIFF_FIELDS`.
//
// **Two cases and one absence** (platform doc § Tests): a turn that completes a
// repeating task and a turn that completes a parent, each undone — as structurally
// distinct cases, because the natural test for this AC uses a repeating completion,
// which is the class revision 3's single rule DID cover.

import { describe, expect, it } from 'vitest'
import { buildHarness, createTask, listTasks, sendTurn, uid, undoTurn } from './helpers.ts'
import type { TaskRow } from '../types.ts'

type Harness = Awaited<ReturnType<typeof buildHarness>>

const repeating = (h: Harness, user: string) =>
  h.agent.post('/tasks').set('X-User-Id', user).send({
    title: 'Water the plants',
    due_at: '2026-08-20T07:00:00.000Z',
    repeat_frequency: 'week',
    repeat_interval: 1,
  })

const parentWithSteps = async (h: Harness, user: string, n: number) => {
  const parent = await createTask(h, user, 'Ship the release')
  const ids: string[] = []
  for (let i = 0; i < n; i += 1) {
    const res = await h.agent
      .post('/tasks')
      .set('X-User-Id', user)
      .send({ title: `step ${i}`, parent_id: parent.id })
    ids.push(res.body.task.id as string)
  }
  return { parentId: parent.id as string, stepIds: ids }
}

describe('AC-46 — a turn that completes a REPEATING task, undone', () => {
  it('the successor joins `created_ids` and the undo takes it with the reopened occurrence', async () => {
    const h = await buildHarness()
    const user = uid()
    const created = await repeating(h, user)
    const id = created.body.task.id as string

    const turn = await sendTurn(h, user, 'mark water the plants done')
    expect(turn.status).toBe(200)
    expect(turn.body.turn.outcome.kind).toBe('applied')
    const successorId = (await listTasks(h, user)).find((t) => t.id !== id)!.id as string

    // the successor's identity is knowable BEFORE the write executes, so capture can
    // record it: it is in `created_ids` like any create (ADR-013's record-to-row map)
    expect(turn.body.turn.undo_snapshot).not.toBeNull()
    expect(h.store.read((s) => s.turns[turn.body.turn.id as string]!.created_ids)).toEqual([
      successorId,
    ])
    // …and the MESSAGE anatomy still describes only what the user asked for: one
    // changed task, one diff row. The undo record and the anatomy differ deliberately.
    expect(turn.body.turn.changed_task_ids).toEqual([id])
    expect(turn.body.turn.outcome.created_titles).toEqual([])

    const undo = await undoTurn(h, user, turn.body.turn.id as string)
    expect(undo.status).toBe(200)
    expect(undo.body.nothing_reverted).toBe(false)
    // without ADR-013 this reopened the completed occurrence and left the successor
    // standing: **two open occurrences of one series**
    const after = await listTasks(h, user)
    expect(after.map((t) => t.id)).toEqual([id])
    expect(after[0]!.status).toBe('inbox')
  })

  it('a successor whose STEP the user has worked on is NOT removed, and its top-level row is named', async () => {
    const h = await buildHarness()
    const user = uid()
    const created = await repeating(h, user)
    const id = created.body.task.id as string
    await h.agent.post('/tasks').set('X-User-Id', user).send({ title: 'Fill the can', parent_id: id })

    const turn = await sendTurn(h, user, 'mark water the plants done')
    const successor = (await listTasks(h, user)).find(
      (t) => t.id !== id && t.parent_id === null,
    )!
    const successorStep = (await listTasks(h, user)).find((t) => t.parent_id === successor.id)!

    h.clock.advance(60_000)
    // the successor's OWN row is untouched, so the whole-row `taskEquals(current,
    // post_apply)` comparison still passes for it. **AC-28's fifth condition touches
    // the STEP's row, not the successor's** — left at the whole-row comparison, undo
    // HARD-DELETES a successor whose steps the user has worked on, in exactly the
    // case AC-28 exists to protect, and the natural test for this AC passes.
    await h.agent
      .patch(`/tasks/${successorStep.id}`)
      .set('X-User-Id', user)
      .send({ status: 'done' })
      .expect(200)

    const undo = await undoTurn(h, user, turn.body.turn.id as string)
    expect(undo.status).toBe(200)
    expect(h.store.read((s) => s.tasks[successor.id as string])).toBeDefined()
    // it stays and is NAMED (F-001 AC-7: zero silent overwrites, every skipped task
    // named) — and by its own top-level title, never by the step's
    expect(undo.body.skipped.map((r: { title: string }) => r.title)).toEqual(['Water the plants'])
    expect(JSON.stringify(undo.body)).not.toContain('Fill the can')
  })
})

describe('AC-46 — a turn that completes a PARENT, undone', () => {
  it('the eight cascade-ticked steps are reverted AS THEIR OWN ROWS, by the guard', async () => {
    const h = await buildHarness()
    const user = uid()
    const { parentId, stepIds } = await parentWithSteps(h, user, 8)

    const turn = await sendTurn(h, user, 'mark ship the release done')
    expect(turn.body.turn.outcome.kind).toBe('applied')
    // a cascade-ticked step is a change to a row that already existed, so it joins
    // `undo_snapshot` (pre) + `post_apply` (post) like any edit
    const snapshotIds = (turn.body.turn.undo_snapshot as { id: string }[]).map((r) => r.id)
    expect(snapshotIds.sort()).toEqual([parentId, ...stepIds].sort())

    const undo = await undoTurn(h, user, turn.body.turn.id as string)
    expect(undo.status).toBe(200)
    const rows = await listTasks(h, user)
    // `undo.ts` is a whole-row replacement, so reverting the PARENT bypasses AC-19's
    // `completed_by_parent` logic entirely: the cascade's steps must be reverted as
    // their own rows, by the guard, never as a side effect of the parent's row being
    // replaced. Read literally, revision 3's single rule reverted NO cascaded step —
    // undoing a voice "done" on a parent with eight steps would reopen the parent and
    // leave all eight ticked.
    expect(rows.filter((t) => t.status === 'done')).toHaveLength(0)
    for (const step of rows.filter((t) => t.parent_id !== null)) {
      expect(step.completed_by_parent).toBe(false)
    }
  })

  it('the absence: NO step title appears in the reverted turn`s outcome message', async () => {
    const h = await buildHarness()
    const user = uid()
    const { parentId } = await parentWithSteps(h, user, 8)
    const turn = await sendTurn(h, user, 'mark ship the release done')
    await undoTurn(h, user, turn.body.turn.id as string).expect(200)

    // A voice "done" on a parent with eight steps **reverts nine rows and renders ONE
    // diff** (ADR-013). `ApplyResult` emitted anatomy, snapshot, `post_apply` and
    // `created_ids` from one loop, so this is the first time the two can differ and
    // the default route makes the choice invisibly: nine diff lines naming step
    // titles the user has never seen, since a step is neither drawn (AC-35) nor
    // addressable (AC-36).
    const outcome = turn.body.turn.outcome as {
      changed_task_ids: string[]
      diff: { task_id: string; field: string }[]
      created_titles: string[]
      deleted_titles: string[]
    }
    expect(outcome.changed_task_ids).toEqual([parentId])
    expect(outcome.diff).toEqual([
      { task_id: parentId, field: 'status', old: 'inbox', new: 'done' },
    ])
    expect(JSON.stringify(outcome)).not.toContain('step ')
  })

  it('a step the user hand-ticked AFTER the turn is reported THROUGH ITS PARENT, never by title', async () => {
    const h = await buildHarness()
    const user = uid()
    const { parentId, stepIds } = await parentWithSteps(h, user, 3)
    const turn = await sendTurn(h, user, 'mark ship the release done')

    h.clock.advance(60_000)
    // the user unticks one cascaded step by hand, which clears `completed_by_parent`
    // — so its current state no longer matches `post_apply` and it must not be
    // reverted (that is the case the guard exists to distinguish; reverting it would
    // overwrite a hand action, L-012's shape)
    await h.agent
      .patch(`/tasks/${stepIds[0]}`)
      .set('X-User-Id', user)
      .send({ status: 'inbox' })
      .expect(200)

    const undo = await undoTurn(h, user, turn.body.turn.id as string)
    expect(undo.status).toBe(200)
    // **`skipped` names top-level tasks only** — it carries a `title`, so the rule
    // unqualified would put step titles the user has never seen into the message
    expect(undo.body.skipped).toEqual([
      { task_id: parentId, title: 'Ship the release', reason: 'modified_since_apply' },
    ])
    expect(JSON.stringify(undo.body.skipped)).not.toContain('step ')
  })
})

describe('AC-34 — two records, two OPPOSITE treatments', () => {
  /** Rewrite a turn's records into the PRE-F-005 shape, which today's code cannot produce. */
  const ageTheRecords = (h: Harness, turnId: string): void => {
    h.store.transact((s) => {
      const turn = s.turns[turnId]!
      const old = (row: TaskRow): TaskRow => {
        const {
          id,
          user_id,
          title,
          due_at,
          reminder_at,
          priority,
          status,
          created_at,
          updated_at,
          deleted_at,
        } = row
        return {
          id,
          user_id,
          title,
          due_at,
          reminder_at,
          priority,
          status,
          created_at,
          updated_at,
          deleted_at,
        } as TaskRow
      }
      turn.undo_snapshot = (turn.undo_snapshot ?? []).map(old)
      turn.post_apply = Object.fromEntries(
        Object.entries(turn.post_apply ?? {}).map(([k, v]) => [k, old(v)]),
      )
    })
  }

  it('on COMPARISON, an absent key means NOT RECORDED and compares equal to whatever is live', async () => {
    const h = await buildHarness()
    const user = uid()
    await createTask(h, user, 'Buy milk')
    const turn = await sendTurn(h, user, 'rename buy milk to buy oat milk')
    expect(turn.body.turn.outcome.kind).toBe('applied')

    // **The record this AC is proven against cannot be produced by today's code** — a
    // snapshot captured by this build is already the new shape, so a test that
    // captures its own snapshot cannot fail AC-34 (tester T22).
    ageTheRecords(h, turn.body.turn.id as string)

    const undo = await undoTurn(h, user, turn.body.turn.id as string)
    expect(undo.status).toBe(200)
    // Widening the comparison WITHOUT this rule makes every pre-F-005 `post_apply`
    // record unequal to its live row — `undefined` stored versus `null` live — for
    // every new field at once, so the undo reverts nothing and reports EVERY task as
    // modified. That is louder and more wrong than the unset-field case.
    expect(undo.body.skipped).toEqual([])
    expect(undo.body.nothing_reverted).toBe(false)
    expect((await listTasks(h, user))[0]!.title).toBe('Buy milk')
  })

  it('on REPLAY, a field the record does not mention is left EXACTLY as it is', async () => {
    const h = await buildHarness()
    const user = uid()
    const task = await createTask(h, user, 'Buy milk', { note: 'Oat only' })
    const turn = await sendTurn(h, user, 'rename buy milk to buy oat milk')
    ageTheRecords(h, turn.body.turn.id as string)

    await undoTurn(h, user, turn.body.turn.id as string).expect(200)
    const after = (await listTasks(h, user))[0]!
    expect(after.title).toBe('Buy milk') // the recorded field IS restored
    // …and "no value" is never written over a value the user set. A whole-row
    // replacement would unset every field a pre-F-005 snapshot predates.
    expect(after.note).toBe('Oat only')
    expect(after.id).toBe(task.id)
  })

  it('a created task is still REMOVED across the change, not left standing', async () => {
    const h = await buildHarness()
    const user = uid()
    const turn = await sendTurn(h, user, 'add a task to buy milk')
    expect(turn.body.turn.outcome.kind).toBe('applied')
    ageTheRecords(h, turn.body.turn.id as string)
    const undo = await undoTurn(h, user, turn.body.turn.id as string)
    expect(undo.status).toBe(200)
    // F-001 AC-7's skip path firing on a task the user never touched would leave the
    // created task standing — the second half of the same defect
    expect(undo.body.skipped).toEqual([])
    expect(await listTasks(h, user)).toHaveLength(0)
  })

  it('a genuinely modified task is STILL skipped — the rule does not blunt the gate', async () => {
    const h = await buildHarness()
    const user = uid()
    await createTask(h, user, 'Buy milk')
    const turn = await sendTurn(h, user, 'rename buy milk to buy oat milk')
    ageTheRecords(h, turn.body.turn.id as string)
    const id = (await listTasks(h, user))[0]!.id as string
    h.clock.advance(60_000)
    // without this case the three above pass against a `taskEquals` that returns
    // `true` unconditionally
    await h.agent.patch(`/tasks/${id}`).set('X-User-Id', user).send({ priority: 'high' }).expect(200)
    const undo = await undoTurn(h, user, turn.body.turn.id as string)
    expect(undo.body.skipped).toEqual([
      { task_id: id, title: 'Buy oat milk', reason: 'modified_since_apply' },
    ])
    expect(undo.body.nothing_reverted).toBe(true)
  })
})
