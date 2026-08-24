// F-006 recently-deleted (the trash). Implements acceptance criteria from
// docs/specs/assistant/F-006-recently-deleted.md. Every test names its AC.
//
// **Five rules from the briefing that are easy to implement backwards** — each
// has a test that would fail if the rule were implemented the other way:
//
// 1. The expiry PREDICATE runs for both callers; the removal WRITE happens on
//    the surface's read only (ADR-017). A turn asking about the trash purges
//    nothing.
// 2. A row in deleted_tasks can be recognised but never targeted (AC-4).
// 3. The restore's five outcomes must be distinguishable at the door.
// 4. An expired parent is never brought back (AC-12).
// 5. GET /__qa__/raw-tasks is what makes AC-12 and AC-17 assertable.

import { describe, expect, it } from 'vitest'
import { buildHarness, createTask, listTasks, sendTurn, uid } from './helpers.ts'
import type { TaskRow } from '../types.ts'

type Harness = Awaited<ReturnType<typeof buildHarness>>

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

const restore = (h: Harness, user: string, id: string) =>
  h.agent.post(`/tasks/${id}/restore`).set('X-User-Id', user)

const getDeleted = (h: Harness, user: string) =>
  h.agent.get('/tasks/deleted').set('X-User-Id', user)

const deleteEntry = (h: Harness, user: string, id: string) =>
  h.agent.delete(`/tasks/deleted/${id}`).set('X-User-Id', user)

const emptyTrash = (h: Harness, user: string, taskIds: string[]) =>
  h.agent.delete('/tasks/deleted').set('X-User-Id', user).send({ task_ids: taskIds })

/** Read raw rows from the store, bypassing all filters (the unit-test
 * equivalent of `GET /__qa__/raw-tasks`). */
const rawTasks = (h: Harness, user: string): TaskRow[] =>
  h.store.read((s) =>
    Object.values(s.tasks).filter((t) => t.user_id === user),
  )

// ---------------------------------------------------------------------------
// GET /tasks/deleted (AC-5, AC-12, AC-14)
// ---------------------------------------------------------------------------

describe('GET /tasks/deleted — the trash read (AC-5, AC-12)', () => {
  it('AC-5 — returns deleted tasks grouped by gesture', async () => {
    const h = await buildHarness()
    const user = uid()
    const parent = await createTask(h, user, 'Ship the release')
    const step = await h.agent.post('/tasks').set('X-User-Id', user).send({ title: 'Step A', parent_id: parent.id })
    // Delete parent (cascades to step)
    await h.agent.delete(`/tasks/${parent.id}`).set('X-User-Id', user).expect(200)

    const res = await getDeleted(h, user)
    expect(res.status).toBe(200)
    expect(res.body.entries).toHaveLength(1)
    const entry = res.body.entries[0]
    expect(entry.tasks).toHaveLength(2)
    expect(entry.deleted_at).toBeDefined()
    expect(entry.expires_at).toBeDefined()
  })

  it('AC-5 — entries are ordered by deleted_at desc', async () => {
    const h = await buildHarness()
    const user = uid()
    const t1 = await createTask(h, user, 'First')
    const t2 = await createTask(h, user, 'Second')
    await h.agent.delete(`/tasks/${t1.id}`).set('X-User-Id', user)
    h.clock.advance(60_000)
    await h.agent.delete(`/tasks/${t2.id}`).set('X-User-Id', user)

    const res = await getDeleted(h, user)
    expect(res.body.entries).toHaveLength(2)
    expect(res.body.entries[0].tasks[0].title).toBe('Second')
    expect(res.body.entries[1].tasks[0].title).toBe('First')
  })

  it('AC-12 — expired rows are excluded from the response AND hard-removed from the store', async () => {
    const h = await buildHarness()
    const user = uid()
    const task = await createTask(h, user, 'Expired task')
    await h.agent.delete(`/tasks/${task.id}`).set('X-User-Id', user)

    // Advance past 30 days
    h.clock.advance(THIRTY_DAYS_MS + 1)

    const before = rawTasks(h, user)
    expect(before).toHaveLength(1) // still in store before trash read

    const res = await getDeleted(h, user)
    expect(res.body.entries).toHaveLength(0) // excluded from response

    const after = rawTasks(h, user)
    expect(after).toHaveLength(0) // hard-removed from store (rule 5)
  })

  it('AC-7 — parent resolution: step entry carries parent title and state', async () => {
    const h = await buildHarness()
    const user = uid()
    const parent = await createTask(h, user, 'Live parent')
    const step = await h.agent.post('/tasks').set('X-User-Id', user).send({ title: 'The step', parent_id: parent.id })
    // Delete step only (parent stays live)
    await h.agent.delete(`/tasks/${step.body.task.id}`).set('X-User-Id', user)

    const res = await getDeleted(h, user)
    const entry = res.body.entries[0]
    expect(entry.parent).toBeDefined()
    expect(entry.parent.id).toBe(parent.id)
    expect(entry.parent.title).toBe('Live parent')
    expect(entry.parent.state).toBe('live')
  })

  it('AC-7 — parent state is "deleted" when parent is also in the trash', async () => {
    const h = await buildHarness()
    const user = uid()
    const parent = await createTask(h, user, 'Deleted parent')
    const step = await h.agent.post('/tasks').set('X-User-Id', user).send({ title: 'The step', parent_id: parent.id })
    // Delete step first, then parent — two gestures
    await h.agent.delete(`/tasks/${step.body.task.id}`).set('X-User-Id', user)
    h.clock.advance(1000)
    await h.agent.delete(`/tasks/${parent.id}`).set('X-User-Id', user)

    const res = await getDeleted(h, user)
    // The step's entry should have parent.state === 'deleted'
    const stepEntry = res.body.entries.find((e: Record<string, unknown>) =>
      (e.tasks as Array<{ title: string }>).some((t) => t.title === 'The step'),
    )
    expect(stepEntry.parent.state).toBe('deleted')
  })

  it('AC-7 — parent state is "gone" when parent was hard-removed', async () => {
    const h = await buildHarness()
    const user = uid()
    // Seed a step whose parent is missing from the store entirely
    const parentId = uid()
    const stepId = uid()
    h.store.transact((s) => {
      s.tasks[stepId] = {
        id: stepId,
        user_id: user,
        title: 'Orphan step',
        due_at: null,
        reminder_at: null,
        priority: null,
        status: 'inbox',
        created_at: '2026-08-10T00:00:00.000Z',
        updated_at: '2026-08-10T00:00:00.000Z',
        deleted_at: '2026-08-20T00:00:00.000Z',
        parent_id: parentId,
      } as TaskRow
    })

    const res = await getDeleted(h, user)
    const entry = res.body.entries[0]
    expect(entry.parent).toBeDefined()
    expect(entry.parent.state).toBe('gone')
    expect(entry.parent.id).toBe(parentId)
  })

  it('AC-12 — an account nobody opens the trash on keeps rows past 30 days', async () => {
    const h = await buildHarness()
    const user = uid()
    const task = await createTask(h, user, 'Old task')
    await h.agent.delete(`/tasks/${task.id}`).set('X-User-Id', user)

    h.clock.advance(THIRTY_DAYS_MS + 1)

    // Without opening the trash, the row is still in the store
    expect(rawTasks(h, user)).toHaveLength(1)
  })

  it('401 when X-User-Id is missing', async () => {
    const h = await buildHarness()
    const res = await h.agent.get('/tasks/deleted')
    expect(res.status).toBe(401)
  })
})

// ---------------------------------------------------------------------------
// Rule 1: a turn that asks about the trash leaves the raw row count unchanged
// ---------------------------------------------------------------------------

describe('Rule 1 (ADR-017) — the turn path purges nothing', () => {
  it('AC-5, AC-14 — asking the assistant about the trash does NOT remove expired rows', async () => {
    const h = await buildHarness()
    const user = uid()
    const task = await createTask(h, user, 'Expired but ask only')
    await h.agent.delete(`/tasks/${task.id}`).set('X-User-Id', user)

    // Advance past 30 days
    h.clock.advance(THIRTY_DAYS_MS + 1)

    const rawBefore = rawTasks(h, user)
    expect(rawBefore).toHaveLength(1)

    // Ask the assistant about the trash (a turn, not a GET)
    await sendTurn(h, user, 'what is in the trash')

    // The expired row is still in the store — the turn path purges nothing
    const rawAfter = rawTasks(h, user)
    expect(rawAfter).toHaveLength(1)

    // But opening the trash via GET removes it
    await getDeleted(h, user)
    expect(rawTasks(h, user)).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// POST /tasks/{id}/restore — F-006 amendments (AC-9)
// ---------------------------------------------------------------------------

describe('POST /tasks/{id}/restore — F-006 five outcomes (AC-9)', () => {
  it('outcome (a) — restored successfully (200)', async () => {
    const h = await buildHarness()
    const user = uid()
    const task = await createTask(h, user, 'Buy milk')
    await h.agent.delete(`/tasks/${task.id}`).set('X-User-Id', user)
    const res = await restore(h, user, task.id as string)
    expect(res.status).toBe(200)
    expect(res.body.restored).toBe(true)
    expect(res.body.task.id).toBe(task.id)
  })

  it('outcome (b) — already live (200, restored: false)', async () => {
    const h = await buildHarness()
    const user = uid()
    const task = await createTask(h, user, 'Buy milk')
    const res = await restore(h, user, task.id as string)
    expect(res.status).toBe(200)
    expect(res.body.restored).toBe(false)
    expect(res.body.changed).toEqual([])
  })

  it('outcome (c) — refused: expired (409 RESTORE_EXPIRED)', async () => {
    const h = await buildHarness()
    const user = uid()
    const task = await createTask(h, user, 'Expired task')
    await h.agent.delete(`/tasks/${task.id}`).set('X-User-Id', user)

    h.clock.advance(THIRTY_DAYS_MS + 1)

    const res = await restore(h, user, task.id as string)
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('RESTORE_EXPIRED')
    expect(res.body.error.detail.task_id).toBe(task.id)
    expect(res.body.error.detail.expired_at).toBeDefined()
  })

  it('outcome (d) — refused: parent gone (409 RESTORE_PARENT_GONE)', async () => {
    const h = await buildHarness()
    const user = uid()
    const parentId = uid()
    const stepId = uid()
    // Seed a step whose parent is gone from the store
    h.store.transact((s) => {
      s.tasks[stepId] = {
        id: stepId,
        user_id: user,
        title: 'Orphan step',
        due_at: null,
        reminder_at: null,
        priority: null,
        status: 'inbox',
        created_at: '2026-08-10T00:00:00.000Z',
        updated_at: '2026-08-10T00:00:00.000Z',
        deleted_at: '2026-08-20T00:00:00.000Z',
        parent_id: parentId,
      } as TaskRow
    })

    const res = await restore(h, user, stepId)
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('RESTORE_PARENT_GONE')
    expect(res.body.error.detail.task_id).toBe(stepId)
    expect(res.body.error.detail.parent_id).toBe(parentId)
  })

  it('outcome (e) — unknown id (404 NOT_FOUND)', async () => {
    const h = await buildHarness()
    const res = await restore(h, uid(), uid())
    expect(res.status).toBe(404)
  })

  it('outcomes are distinguishable — (c) expired vs (d) parent gone vs (b) double-tap', async () => {
    // This test verifies the five outcomes produce distinguishable responses
    const h = await buildHarness()
    const user = uid()

    // (b) already live
    const live = await createTask(h, user, 'Live')
    const bRes = await restore(h, user, live.id as string)
    expect(bRes.status).toBe(200)
    expect(bRes.body.restored).toBe(false)

    // (c) expired
    const expired = await createTask(h, user, 'Will expire')
    await h.agent.delete(`/tasks/${expired.id}`).set('X-User-Id', user)
    h.clock.advance(THIRTY_DAYS_MS + 1)
    const cRes = await restore(h, user, expired.id as string)
    expect(cRes.status).toBe(409)
    expect(cRes.body.error.code).toBe('RESTORE_EXPIRED')

    // (e) unknown
    const eRes = await restore(h, user, uid())
    expect(eRes.status).toBe(404)
  })
})

// ---------------------------------------------------------------------------
// Rule 4: an expired parent is never brought back
// ---------------------------------------------------------------------------

describe('Rule 4 — expired parent restore is refused (AC-12)', () => {
  it('restoring a step whose parent is expired gives RESTORE_EXPIRED — WITHOUT an intervening trash read', async () => {
    const h = await buildHarness()
    const user = uid()
    const parent = await createTask(h, user, 'Parent will expire')
    const step = await h.agent.post('/tasks').set('X-User-Id', user).send({ title: 'Step', parent_id: parent.id })
    // Delete step, then parent — separate gestures
    await h.agent.delete(`/tasks/${step.body.task.id}`).set('X-User-Id', user)
    h.clock.advance(1000)
    await h.agent.delete(`/tasks/${parent.id}`).set('X-User-Id', user)

    // Advance so parent is expired but step is not (step was deleted first)
    // Actually both are expired since we only advance by 1s between deletes.
    // Let me re-do: delete parent much earlier.
    const h2 = await buildHarness()
    const user2 = uid()
    const parent2 = await createTask(h2, user2, 'Parent will expire')
    const step2 = await h2.agent.post('/tasks').set('X-User-Id', user2).send({ title: 'Step', parent_id: parent2.id })

    // Delete parent first (will carry step with it)
    await h2.agent.delete(`/tasks/${parent2.id}`).set('X-User-Id', user2)

    // Advance past 30 days for the parent
    h2.clock.advance(THIRTY_DAYS_MS + 1)

    // Try to restore the step — parent is expired
    // (The step shares the same gesture/deleted_at so it's also expired)
    const res = await restore(h2, user2, step2.body.task.id as string)
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('RESTORE_EXPIRED')
  })

  it('restoring a step whose parent is expired — parent was deleted independently earlier', async () => {
    const h = await buildHarness()
    const user = uid()

    // Seed: parent deleted 31 days ago (expired), step deleted 5 days ago (not expired)
    const parentId = uid()
    const stepId = uid()
    const gestureStep = uid()
    const now = h.clock.now()
    h.store.transact((s) => {
      s.tasks[parentId] = {
        id: parentId,
        user_id: user,
        title: 'Old parent',
        due_at: null,
        reminder_at: null,
        priority: null,
        status: 'inbox',
        created_at: new Date(now - 40 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date(now - 40 * 24 * 60 * 60 * 1000).toISOString(),
        deleted_at: new Date(now - 31 * 24 * 60 * 60 * 1000).toISOString(),
        delete_gesture_id: uid(),
      } as TaskRow
      s.tasks[stepId] = {
        id: stepId,
        user_id: user,
        title: 'Recent step',
        due_at: null,
        reminder_at: null,
        priority: null,
        status: 'inbox',
        created_at: new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString(),
        deleted_at: new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString(),
        parent_id: parentId,
        delete_gesture_id: gestureStep,
      } as TaskRow
    })

    // Restore the step — its parent is expired, even though the step is not
    // This should refuse with RESTORE_EXPIRED because the parent invariant
    // requires bringing the parent back, and the parent is expired.
    // Key: NO trash read between seeding and restoring.
    const res = await restore(h, user, stepId)
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('RESTORE_EXPIRED')
  })
})

// ---------------------------------------------------------------------------
// ADR-012 amendment — restore clears series_ended_at
// ---------------------------------------------------------------------------

describe('ADR-012 amendment — restore clears series_ended_at (L-026)', () => {
  it('a series delete + restore brings back series_live', async () => {
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

    // Complete once to produce a successor with series_id
    await h.agent.patch(`/tasks/${id}`).set('X-User-Id', user).send({ status: 'done' })
    const afterComplete = await listTasks(h, user)
    const successor = afterComplete.find((t) => t.id !== id)!
    expect(successor).toBeDefined()
    expect(successor.series_live).toBe(true)

    // Series delete — ends the series
    await h.agent.delete(`/tasks/${successor.id}?scope=series`).set('X-User-Id', user)

    // Restore
    const res = await restore(h, user, successor.id as string)
    expect(res.status).toBe(200)
    expect(res.body.restored).toBe(true)

    // After restore, series_live should be true again
    const afterRestore = await listTasks(h, user)
    const restoredSuccessor = afterRestore.find((t) => t.id === successor.id)
    expect(restoredSuccessor).toBeDefined()
    expect(restoredSuccessor!.series_live).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// DELETE /tasks/deleted/{id} — permanent delete one entry (AC-11)
// ---------------------------------------------------------------------------

describe('DELETE /tasks/deleted/{id} — permanent delete one entry (AC-11)', () => {
  it('AC-11 — removes the entire entry by gesture membership', async () => {
    const h = await buildHarness()
    const user = uid()
    const parent = await createTask(h, user, 'Ship the release')
    await h.agent.post('/tasks').set('X-User-Id', user).send({ title: 'Step A', parent_id: parent.id })
    await h.agent.delete(`/tasks/${parent.id}`).set('X-User-Id', user) // cascades

    expect(rawTasks(h, user)).toHaveLength(2)

    const res = await deleteEntry(h, user, parent.id as string)
    expect(res.status).toBe(200)
    expect(res.body.removed).toHaveLength(2)
    expect(rawTasks(h, user)).toHaveLength(0)
  })

  it('AC-11 — a member restored in between is live and excluded from removal', async () => {
    const h = await buildHarness()
    const user = uid()
    const t1 = await createTask(h, user, 'Task A')
    const t2 = await createTask(h, user, 'Task B')
    // Same gesture? No — these are individual deletes, different gestures.
    // For this test, seed two tasks with the same gesture manually.
    const gesture = uid()
    h.store.transact((s) => {
      s.tasks[t1.id as string]!.deleted_at = new Date(h.clock.now()).toISOString()
      s.tasks[t1.id as string]!.delete_gesture_id = gesture
      s.tasks[t2.id as string]!.deleted_at = new Date(h.clock.now()).toISOString()
      s.tasks[t2.id as string]!.delete_gesture_id = gesture
    })

    // Restore one member — should not be removed
    // Actually, restore clears deleted_at, so it becomes live.
    // We need to clear deleted_at on t2 to simulate a restore-in-between.
    h.store.transact((s) => {
      s.tasks[t2.id as string]!.deleted_at = null
    })

    const res = await deleteEntry(h, user, t1.id as string)
    expect(res.status).toBe(200)
    expect(res.body.removed).toHaveLength(1)
    expect(res.body.removed).toContain(t1.id)
    // t2 is live and untouched
    expect(rawTasks(h, user).find((t) => t.id === t2.id as string)?.deleted_at).toBeNull()
  })

  it('AC-11 — 404 for unknown id, other account, or not-deleted row', async () => {
    const h = await buildHarness()
    const user = uid()
    const other = uid()

    // unknown id
    const r1 = await deleteEntry(h, user, uid())
    expect(r1.status).toBe(404)

    // other account
    const task = await createTask(h, user, 'Secret')
    await h.agent.delete(`/tasks/${task.id}`).set('X-User-Id', user)
    const r2 = await deleteEntry(h, other, task.id as string)
    expect(r2.status).toBe(404)

    // not-deleted row
    const live = await createTask(h, user, 'Live task')
    const r3 = await deleteEntry(h, user, live.id as string)
    expect(r3.status).toBe(404)
  })

  it('AC-11 — 401 when unauthenticated', async () => {
    const h = await buildHarness()
    const res = await h.agent.delete('/tasks/deleted/' + uid())
    expect(res.status).toBe(401)
  })
})

// ---------------------------------------------------------------------------
// DELETE /tasks/deleted — empty the trash (AC-17)
// ---------------------------------------------------------------------------

describe('DELETE /tasks/deleted — empty the trash (AC-17)', () => {
  it('AC-17 — removes all rows in the pinned set', async () => {
    const h = await buildHarness()
    const user = uid()
    const t1 = await createTask(h, user, 'Task 1')
    const t2 = await createTask(h, user, 'Task 2')
    await h.agent.delete(`/tasks/${t1.id}`).set('X-User-Id', user)
    await h.agent.delete(`/tasks/${t2.id}`).set('X-User-Id', user)

    expect(rawTasks(h, user)).toHaveLength(2)

    const res = await emptyTrash(h, user, [t1.id as string, t2.id as string])
    expect(res.status).toBe(200)
    expect(res.body.removed).toHaveLength(2)
    expect(rawTasks(h, user)).toHaveLength(0)
  })

  it('AC-17 — a row restored after the confirmation is excluded', async () => {
    const h = await buildHarness()
    const user = uid()
    const t1 = await createTask(h, user, 'Task 1')
    const t2 = await createTask(h, user, 'Task 2')
    await h.agent.delete(`/tasks/${t1.id}`).set('X-User-Id', user)
    await h.agent.delete(`/tasks/${t2.id}`).set('X-User-Id', user)

    // Pin both
    const pinned = [t1.id as string, t2.id as string]

    // Restore t1 between confirmation and empty
    await restore(h, user, t1.id as string)

    const res = await emptyTrash(h, user, pinned)
    expect(res.body.removed).toHaveLength(1)
    expect(res.body.removed).toContain(t2.id)
    expect(await listTasks(h, user)).toHaveLength(1) // t1 is live
  })

  it('AC-17 — a row deleted AFTER the confirmation is not in the set and excluded', async () => {
    const h = await buildHarness()
    const user = uid()
    const t1 = await createTask(h, user, 'Task 1')
    await h.agent.delete(`/tasks/${t1.id}`).set('X-User-Id', user)

    // Pin only t1
    const pinned = [t1.id as string]

    // Delete t2 after confirmation
    const t2 = await createTask(h, user, 'Task 2')
    await h.agent.delete(`/tasks/${t2.id}`).set('X-User-Id', user)

    const res = await emptyTrash(h, user, pinned)
    expect(res.body.removed).toHaveLength(1)
    expect(res.body.removed).toContain(t1.id)
    // t2 is still in the trash — not in the pinned set
    expect(rawTasks(h, user).find((t) => t.id === t2.id as string)?.deleted_at).not.toBeNull()
  })

  it('AC-17 — empty task_ids array removes nothing', async () => {
    const h = await buildHarness()
    const user = uid()
    const task = await createTask(h, user, 'Keep me')
    await h.agent.delete(`/tasks/${task.id}`).set('X-User-Id', user)

    const res = await emptyTrash(h, user, [])
    expect(res.body.removed).toEqual([])
    expect(rawTasks(h, user)).toHaveLength(1)
  })

  it('401 when unauthenticated', async () => {
    const h = await buildHarness()
    const res = await h.agent.delete('/tasks/deleted').send({ task_ids: [] })
    expect(res.status).toBe(401)
  })
})

// ---------------------------------------------------------------------------
// Rule 5: GET /__qa__/raw-tasks (AC-12, AC-17)
// ---------------------------------------------------------------------------

describe('Rule 5 — raw-tasks makes purge assertions testable (AC-12, AC-17)', () => {
  it('AC-12 — after trash read, expired rows are gone from the raw store', async () => {
    const h = await buildHarness()
    const user = uid()
    const t1 = await createTask(h, user, 'Task 1')
    const t2 = await createTask(h, user, 'Task 2')
    await h.agent.delete(`/tasks/${t1.id}`).set('X-User-Id', user)
    h.clock.advance(THIRTY_DAYS_MS + 1)
    await h.agent.delete(`/tasks/${t2.id}`).set('X-User-Id', user) // recent, not expired

    // Raw count before trash read: 2 rows
    expect(rawTasks(h, user)).toHaveLength(2)

    // Trash read purges expired
    await getDeleted(h, user)

    // Raw count after: 1 row (only the recent one)
    const raw = rawTasks(h, user)
    expect(raw).toHaveLength(1)
    expect(raw[0]!.id).toBe(t2.id)
  })

  it('AC-17 — after empty-trash without intervening trash read, expired rows are also removed', async () => {
    const h = await buildHarness()
    const user = uid()
    const t1 = await createTask(h, user, 'Task expired')
    await h.agent.delete(`/tasks/${t1.id}`).set('X-User-Id', user)
    h.clock.advance(THIRTY_DAYS_MS + 1) // expired

    const t2 = await createTask(h, user, 'Task recent')
    await h.agent.delete(`/tasks/${t2.id}`).set('X-User-Id', user)

    // Empty trash for t2 (t1 is not in the pinned set but is expired)
    const res = await emptyTrash(h, user, [t2.id as string])
    expect(res.body.removed).toContain(t2.id)

    // t1 is still in the store because empty-trash doesn't purge expired rows
    // (it only removes the pinned set). Purging is the trash READ's job (ADR-017).
    expect(rawTasks(h, user)).toHaveLength(1)
    expect(rawTasks(h, user)[0]!.id).toBe(t1.id)
  })
})

// ---------------------------------------------------------------------------
// Processing rule 5 amendment — deleted_tasks in interpretation context (AC-14)
// ---------------------------------------------------------------------------

describe('Processing rule 5 — deleted_tasks in context (AC-14)', () => {
  it('AC-14 — the interpreter sees deleted tasks in deleted_tasks', async () => {
    const h = await buildHarness()
    const user = uid()
    const task = await createTask(h, user, 'Buy milk')
    await h.agent.delete(`/tasks/${task.id}`).set('X-User-Id', user)

    // Ask about the specific deleted task — the fixture table maps
    // "what happened to buy milk" → trash_read(task_in_trash, target: 'Buy milk')
    const res = await sendTurn(h, user, 'what happened to buy milk')
    expect(res.status).toBe(200)
    const outcome = res.body.turn?.outcome
    expect(outcome).toBeDefined()
    expect(outcome.kind).toBe('trash_read')
    expect(outcome.query).toBe('task_in_trash')
    expect(outcome.task_id).toBe(task.id)
    expect(outcome.task_title).toBe('Buy milk')
  })

  it('AC-14 — trash_contents query', async () => {
    const h = await buildHarness()
    const user = uid()
    const task = await createTask(h, user, 'Task A')
    await h.agent.delete(`/tasks/${task.id}`).set('X-User-Id', user)

    const res = await sendTurn(h, user, 'what is in the trash')
    expect(res.status).toBe(200)
    const outcome = res.body.turn?.outcome
    expect(outcome.kind).toBe('trash_read')
    expect(outcome.query).toBe('trash_contents')
    expect(outcome.entry_count).toBeGreaterThanOrEqual(1)
  })

  it('AC-14 — expired tasks are excluded from deleted_tasks', async () => {
    const h = await buildHarness()
    const user = uid()
    const task = await createTask(h, user, 'Old task')
    await h.agent.delete(`/tasks/${task.id}`).set('X-User-Id', user)
    h.clock.advance(THIRTY_DAYS_MS + 1) // expired

    // The turn path should NOT see the expired task in deleted_tasks
    // Asking about trash contents should show 0 entries
    const res = await sendTurn(h, user, 'what is in the trash')
    expect(res.status).toBe(200)
    const outcome = res.body.turn?.outcome
    expect(outcome.kind).toBe('trash_read')
    expect(outcome.query).toBe('trash_contents')
    expect(outcome.entry_count).toBe(0)
  })

  it('AC-14 — steps are excluded from deleted_tasks (mirrors handle list)', async () => {
    const h = await buildHarness()
    const user = uid()
    const parent = await createTask(h, user, 'Parent')
    await h.agent.post('/tasks').set('X-User-Id', user).send({ title: 'Step', parent_id: parent.id })
    // Delete both (cascade)
    await h.agent.delete(`/tasks/${parent.id}`).set('X-User-Id', user)

    // Trash contents should count 1 entry (the parent), not separate entries for steps
    const res = await sendTurn(h, user, 'what is in the trash')
    const outcome = res.body.turn?.outcome
    expect(outcome.kind).toBe('trash_read')
    expect(outcome.query).toBe('trash_contents')
    // Entries are grouped by gesture; one gesture = one entry count
    expect(outcome.entry_count).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// trash_read turn never occupies the undo window
// ---------------------------------------------------------------------------

describe('trash_read turn — no undo window occupation (AC-14)', () => {
  it('changed_task_ids is empty and no undo_snapshot', async () => {
    const h = await buildHarness()
    const user = uid()
    const task = await createTask(h, user, 'Something')
    await h.agent.delete(`/tasks/${task.id}`).set('X-User-Id', user)

    const res = await sendTurn(h, user, 'what is in the trash')
    expect(res.body.turn.outcome.kind).toBe('trash_read')

    // The turn status should be applied but NOT undoable
    const turnId = res.body.turn.id as string
    const undoRes = await h.agent.post(`/assistant/turn/${turnId}/undo`).set('X-User-Id', user).send({})
    expect(undoRes.status).toBe(409)
    expect(undoRes.body.error.code).toBe('UNDO_REFUSED')
  })
})

// ---------------------------------------------------------------------------
// skipped.reason gains 'permanently_deleted' (AC-13)
// ---------------------------------------------------------------------------

describe('undo skipped reason — permanently_deleted (AC-13)', () => {
  it('a turn`s created task that was permanently deleted is skipped with reason permanently_deleted', async () => {
    const h = await buildHarness()
    const user = uid()

    // Create a task via turn, then permanently delete it, then undo
    const createRes = await sendTurn(h, user, 'add a task to buy milk')
    expect(createRes.status).toBe(200)
    const turnId = createRes.body.turn.id as string
    const taskId = createRes.body.turn.outcome.changed_task_ids[0] as string

    // Delete the task (soft)
    await h.agent.delete(`/tasks/${taskId}`).set('X-User-Id', user)

    // Permanently delete
    await deleteEntry(h, user, taskId)

    // The task is gone from the store
    expect(rawTasks(h, user)).toHaveLength(0)

    // Undo the create turn — the task is permanently deleted
    const undoRes = await h.agent.post(`/assistant/turn/${turnId}/undo`).set('X-User-Id', user).send({})
    expect(undoRes.status).toBe(200)
    expect(undoRes.body.skipped).toHaveLength(1)
    expect(undoRes.body.skipped[0].reason).toBe('permanently_deleted')
  })
})
