// Prototype task CRUD — the manual path (AC-18: zero AI calls, proven by the
// harness AI-call counter) and the read-back observable other suites depend
// on. Strict shapes: unknown fields rejected on every endpoint (TC-34).

import { describe, expect, it } from 'vitest'
import { buildHarness, createTask, listTasks, uid } from './helpers.ts'

describe('prototype task CRUD', () => {
  it('POST → GET → PATCH → DELETE round-trip with soft delete, zero AI calls (AC-18)', async () => {
    const h = await buildHarness()
    const user = uid()

    // `status: 'done'` on create, not `'today'`: ADR-009 narrowed the write
    // vocabulary to `inbox | done | archived`, and this is the non-default
    // member the round-trip below actually moves through.
    const created = await h.agent
      .post('/tasks')
      .set('X-User-Id', user)
      .send({ title: 'Buy milk', due_at: '2026-08-20T10:00:00.000Z', priority: 'high', status: 'done' })
    expect(created.status).toBe(201)
    expect(created.body.task).toMatchObject({
      title: 'Buy milk',
      due_at: '2026-08-20T10:00:00.000Z',
      reminder_at: null,
      priority: 'high',
      status: 'done',
      deleted_at: null,
    })
    expect(created.body.task).not.toHaveProperty('user_id') // task wire shape has no user_id
    const id = created.body.task.id as string

    // the un-complete write (ADR-009 §3): `inbox`, and `due_at` is NOT sent, so
    // the date the task carried survives the round trip — which is the whole
    // reason UC-45 AC-45.2 needs no `doneFrom` field
    const patched = await h.agent
      .patch(`/tasks/${id}`)
      .set('X-User-Id', user)
      .send({ status: 'inbox', reminder_at: '2026-08-19T08:00:00.000Z' })
    expect(patched.status).toBe(200)
    expect(patched.body.task.status).toBe('inbox')
    expect(patched.body.task.due_at).toBe('2026-08-20T10:00:00.000Z')
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
    // ---- THE INVERSION, and why it is not a regression --------------------
    //
    // This assertion used to read `expect(unknown.status).toBe(400)` on
    // `reminder_at`, and it was correct for F-001: `POST /tasks` refused the
    // field. **F-005 closes exactly that gap** — `reminder_at` is in
    // `TASK_CREATE_FIELDS` (api-contracts § `POST /tasks`, which names this very
    // line: *"that assertion must now be inverted — it pins the gap F-005
    // closes"*), because *"add a task to call the dentist and remind me at
    // nine"* is the most natural sentence for the field the owner's decision
    // exists to make reachable, and `applyCreate` used to hard-code
    // `reminder_at: null`.
    //
    // It is inverted rather than weakened: the write is asserted to LAND and to
    // be observable on read-back, which is a stronger claim than the 400 it
    // replaces. The unknown-field policy it used to exercise keeps its own case
    // below, on a field that is genuinely not in the create shape.
    const withReminder = await h.agent
      .post('/tasks')
      .set('X-User-Id', user)
      .send({ title: 'Call the dentist', reminder_at: '2026-08-19T08:00:00.000Z' })
    expect(withReminder.status).toBe(201)
    expect(withReminder.body.task.reminder_at).toBe('2026-08-19T08:00:00.000Z')
    expect((await listTasks(h, user))[0]!.reminder_at).toBe('2026-08-19T08:00:00.000Z')

    // the policy itself is unchanged (TC-34): a field that is NOT in the create
    // shape is still 400 naming the field, with zero side effects
    const unknown = await h.agent
      .post('/tasks')
      .set('X-User-Id', user)
      .send({ title: 'x', reminder_shown_at: '2026-08-19T08:00:00.000Z' })
    expect(unknown.status).toBe(400)
    expect(unknown.body.error.field).toBe('reminder_shown_at')
    expect(await listTasks(h, user)).toHaveLength(1) // only the create above landed

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

  // -------------------------------------------------------------------------
  // ADR-009 — the write vocabulary is narrower than the union, and the union
  // keeps its fourth member because the STORE already contains it.
  // -------------------------------------------------------------------------

  it("rejects status 'today' on both write endpoints — it is retired, not renamed (ADR-009 §2)", async () => {
    const h = await buildHarness()
    const user = uid()

    const created = await h.agent
      .post('/tasks')
      .set('X-User-Id', user)
      .send({ title: 'x', status: 'today' })
    expect(created.status).toBe(400)
    // `VALIDATION`, not `INVALID_INPUT`. DRIFT, recorded rather than papered
    // over: ADR-009 and api-contracts.md § `status` on the wire (line 328) both
    // say `400 INVALID_INPUT`, but the same file's error tables — the ones that
    // OWN the envelope — say `400 VALIDATION` for every bad field on every
    // endpoint (lines 16, 18, 227), and that is what ships. Renaming the code
    // for one field would split the module's error vocabulary in two; the
    // narrower fix belongs in the spec.
    expect(created.body.error.code).toBe('VALIDATION')
    expect(created.body.error.field).toBe('status')
    expect(await listTasks(h, user), 'a rejected create must have zero side effects').toHaveLength(0)

    const task = await createTask(h, user, 'Buy milk')
    const patched = await h.agent
      .patch(`/tasks/${task.id}`)
      .set('X-User-Id', user)
      .send({ status: 'today' })
    expect(patched.status).toBe(400)
    expect(patched.body.error.field).toBe('status')
    expect((await listTasks(h, user))[0]!.status, 'the row is untouched').toBe('inbox')

    // …and it is `today` specifically, not a general tightening: the other
    // three members are still accepted. Without this the test would also pass
    // against an endpoint that rejected every status.
    for (const status of ['inbox', 'done', 'archived']) {
      const ok = await h.agent
        .patch(`/tasks/${task.id}`)
        .set('X-User-Id', user)
        .send({ status })
      expect(ok.status, `PATCH status=${status}`).toBe(200)
      expect(ok.body.task.status).toBe(status)
    }
  })

  it("GET /tasks still SERVES a stored 'today' — the union keeps four members (ADR-009 §2)", async () => {
    // The 4 pre-ADR-009 rows in `data/assistant.json` are deliberately not
    // migrated, and `undo_snapshot` replays such rows verbatim. So the read
    // path must carry a value the write path refuses. Seeded through the store
    // rather than the API precisely because the API is where it is now stopped.
    const h = await buildHarness()
    const user = uid()
    const id = uid()
    h.store.transact((state) => {
      state.tasks[id] = {
        id,
        user_id: user,
        title: 'a row from before ADR-009',
        due_at: null,
        reminder_at: null,
        priority: null,
        status: 'today',
        created_at: '2026-08-17T00:00:00.000Z',
        updated_at: '2026-08-17T00:00:00.000Z',
        deleted_at: null,
      }
    })
    const rows = await listTasks(h, user)
    expect(rows).toHaveLength(1)
    expect(rows[0]!.status).toBe('today')
    // and it is still editable — the row is not bricked by the narrowing, it
    // simply cannot be written BACK to `today`
    const patched = await h.agent
      .patch(`/tasks/${id}`)
      .set('X-User-Id', user)
      .send({ status: 'inbox' })
    expect(patched.status).toBe(200)
    expect(patched.body.task.status).toBe('inbox')
  })

  it('unknown routes get the error envelope, not a stack trace', async () => {
    const h = await buildHarness()
    const res = await h.agent.get('/nope').set('X-User-Id', uid())
    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('NOT_FOUND')
    expect(JSON.stringify(res.body)).not.toMatch(/\bat\s+.*\.ts:\d/) // no stack frames
  })
})
