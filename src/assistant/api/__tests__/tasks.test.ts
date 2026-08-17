// Prototype task CRUD — the manual path (AC-18: zero AI calls, proven by the
// harness AI-call counter) and the read-back observable other suites depend
// on. Strict shapes: unknown fields rejected on every endpoint (TC-34).

import { describe, expect, it } from 'vitest'
import { buildHarness, createTask, listTasks, uid } from './helpers.ts'

describe('prototype task CRUD', () => {
  it('POST → GET → PATCH → DELETE round-trip with soft delete, zero AI calls (AC-18)', async () => {
    const h = await buildHarness()
    const user = uid()

    const created = await h.agent
      .post('/tasks')
      .set('X-User-Id', user)
      .send({ title: 'Buy milk', due_at: '2026-08-20T10:00:00.000Z', priority: 'high', status: 'today' })
    expect(created.status).toBe(201)
    expect(created.body.task).toMatchObject({
      title: 'Buy milk',
      due_at: '2026-08-20T10:00:00.000Z',
      reminder_at: null,
      priority: 'high',
      status: 'today',
      deleted_at: null,
    })
    expect(created.body.task).not.toHaveProperty('user_id') // task wire shape has no user_id
    const id = created.body.task.id as string

    const patched = await h.agent
      .patch(`/tasks/${id}`)
      .set('X-User-Id', user)
      .send({ status: 'done', reminder_at: '2026-08-19T08:00:00.000Z' })
    expect(patched.status).toBe(200)
    expect(patched.body.task.status).toBe('done')
    expect(patched.body.task.reminder_at).toBe('2026-08-19T08:00:00.000Z')

    const deleted = await h.agent.delete(`/tasks/${id}`).set('X-User-Id', user)
    expect(deleted.status).toBe(200)
    expect(deleted.body.task.deleted_at).not.toBeNull() // soft delete
    expect(await listTasks(h, user)).toHaveLength(0)

    // deleting again behaves as not found
    const again = await h.agent.delete(`/tasks/${id}`).set('X-User-Id', user)
    expect(again.status).toBe(404)

    // none of this touched the Interpreter (AC-18, AC-25 local path)
    expect(h.interpreter.calls).toHaveLength(0)
  })

  it('validation: missing title, bad status, unknown fields (create shape is {title, due_at?, priority?, status?})', async () => {
    const h = await buildHarness()
    const user = uid()
    const noTitle = await h.agent.post('/tasks').set('X-User-Id', user).send({})
    expect(noTitle.status).toBe(400)
    expect(noTitle.body.error.field).toBe('title')
    const badStatus = await h.agent
      .post('/tasks')
      .set('X-User-Id', user)
      .send({ title: 'x', status: 'someday' })
    expect(badStatus.status).toBe(400)
    expect(badStatus.body.error.field).toBe('status')
    // unknown fields → 400 naming the field, zero side effects (TC-34);
    // reminder_at is not part of the create shape
    const unknown = await h.agent
      .post('/tasks')
      .set('X-User-Id', user)
      .send({ title: 'x', reminder_at: '2026-08-19T08:00:00.000Z' })
    expect(unknown.status).toBe(400)
    expect(unknown.body.error.field).toBe('reminder_at')
    expect(await listTasks(h, user)).toHaveLength(0)

    const task = await createTask(h, user, 'Buy milk')
    const badPatch = await h.agent
      .patch(`/tasks/${task.id}`)
      .set('X-User-Id', user)
      .send({ frobnicate: 1 })
    expect(badPatch.status).toBe(400)
    expect(badPatch.body.error.field).toBe('frobnicate')
    const emptyPatch = await h.agent.patch(`/tasks/${task.id}`).set('X-User-Id', user).send({})
    expect(emptyPatch.status).toBe(400)
  })

  it('offline replay (AC-25): POST /tasks accepts a client-generated id; replaying the create gets 409 TASK_ID_EXISTS as its ack', async () => {
    const h = await buildHarness()
    const user = uid()
    const clientId = uid()
    const created = await h.agent
      .post('/tasks')
      .set('X-User-Id', user)
      .send({ id: clientId, title: 'Offline task' })
    expect(created.status).toBe(201)
    expect(created.body.task.id).toBe(clientId) // client id used verbatim, no temp-id mapping
    // reconnect replay of the same create → 409 = already-synced ack
    const replay = await h.agent
      .post('/tasks')
      .set('X-User-Id', user)
      .send({ id: clientId, title: 'Offline task' })
    expect(replay.status).toBe(409)
    expect(replay.body.error.code).toBe('TASK_ID_EXISTS')
    expect(await listTasks(h, user)).toHaveLength(1) // created exactly once
    // id format is validated
    const badId = await h.agent
      .post('/tasks')
      .set('X-User-Id', user)
      .send({ id: 'not-a-uuid', title: 'x' })
    expect(badId.status).toBe(400)
    expect(badId.body.error.field).toBe('id')
    expect(h.interpreter.calls).toHaveLength(0) // still zero AI calls (AC-18)
  })

  it('account isolation: tasks are invisible and untouchable across accounts (404, never 200)', async () => {
    const h = await buildHarness()
    const userA = uid()
    const userB = uid()
    const task = await createTask(h, userA, 'Secret task')
    expect(await listTasks(h, userB)).toHaveLength(0)
    const patch = await h.agent
      .patch(`/tasks/${task.id}`)
      .set('X-User-Id', userB)
      .send({ title: 'stolen' })
    expect(patch.status).toBe(404)
    const del = await h.agent.delete(`/tasks/${task.id}`).set('X-User-Id', userB)
    expect(del.status).toBe(404)
    expect((await listTasks(h, userA))[0]!.title).toBe('Secret task')
  })

  it('401 UNAUTHENTICATED without X-User-Id on every CRUD route', async () => {
    const h = await buildHarness()
    for (const req of [
      h.agent.get('/tasks'),
      h.agent.post('/tasks').send({ title: 'x' }),
      h.agent.patch(`/tasks/${uid()}`).send({ title: 'x' }),
      h.agent.delete(`/tasks/${uid()}`),
    ]) {
      const res = await req
      expect(res.status).toBe(401)
      expect(res.body.error.code).toBe('UNAUTHENTICATED')
    }
  })

  it('unknown routes get the error envelope, not a stack trace', async () => {
    const h = await buildHarness()
    const res = await h.agent.get('/nope').set('X-User-Id', uid())
    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('NOT_FOUND')
    expect(JSON.stringify(res.body)).not.toMatch(/\bat\s+.*\.ts:\d/) // no stack frames
  })
})
