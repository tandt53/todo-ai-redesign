// The reminder (F-005 AC-38, AC-10, AC-27) — `POST /tasks/{id}/reminder-ack`.
//
// AC-38's ONE falsifiable clause is a **server-persistence** assertion observable
// at no other layer: *an **acknowledged** reminder does not reappear on the next
// launch, on the next device, or after a reload*. Revision 2 tagged the AC for two
// client tiers, both of which pass against an in-memory flag. That is why the AC
// carries `(api)` and why these cases exist.
//
// **Render is not resolution** (product P1, design D16). `reminder_shown_at` is
// written when the user ACKNOWLEDGES the surfacing, not when it renders — a user
// who opens the app, is interrupted and closes it must not have spent their only
// delivery, on every device, permanently, while the task is still undone.

import { describe, expect, it } from 'vitest'
import { buildHarness, createTask, listTasks, sendTurn, uid } from './helpers.ts'

type Harness = Awaited<ReturnType<typeof buildHarness>>
const AT = '2026-08-19T08:00:00.000Z'

const ack = (h: Harness, user: string, id: string, reminderAt: string) =>
  h.agent.post(`/tasks/${id}/reminder-ack`).set('X-User-Id', user).send({ reminder_at: reminderAt })

describe('AC-38 — the server writes `reminder_shown_at`, on an acknowledgement', () => {
  it('an acknowledgement is stored, and an UNacknowledged reminder is not', async () => {
    const h = await buildHarness()
    const user = uid()
    const task = await createTask(h, user, 'Call the dentist', { reminder_at: AT })
    // the negative case first, because it is what makes this assertable: a surfacing
    // that is not acknowledged leaves nothing behind, so the reminder is still there
    // at the next open (tester-web R5). Revision 3 could not support this case,
    // because *"do not acknowledge"* was not a constructible precondition.
    expect((await listTasks(h, user))[0]!.reminder_shown_at).toBeNull()

    const res = await ack(h, user, task.id as string, AT)
    expect(res.status).toBe(200)
    expect(res.body.acknowledged).toBe(true)
    expect(res.body.task.reminder_shown_at).not.toBeNull()
    // …and it survives the read, which is the whole claim: not a session fact
    expect((await listTasks(h, user))[0]!.reminder_shown_at).toBe(res.body.task.reminder_shown_at)
  })

  it('acknowledging is per reminder, and idempotent on the SAME instant', async () => {
    const h = await buildHarness()
    const user = uid()
    const task = await createTask(h, user, 'Call the dentist', { reminder_at: AT })
    const first = await ack(h, user, task.id as string, AT)
    h.clock.advance(60_000)
    const second = await ack(h, user, task.id as string, AT)
    expect(second.status).toBe(200)
    expect(second.body.acknowledged).toBe(true)
    // ten surfaced together of which three were acted on do not silently retire the
    // other seven — only what the user acknowledges is marked
    expect(Date.parse(second.body.task.reminder_shown_at as string)).toBeGreaterThan(
      Date.parse(first.body.task.reminder_shown_at as string),
    )
  })

  it('a reminder that MOVED underneath is 409 REMINDER_MOVED, and nothing is written', async () => {
    const h = await buildHarness()
    const user = uid()
    const task = await createTask(h, user, 'Call the dentist', { reminder_at: AT })
    const moved = '2026-08-19T09:00:00.000Z'
    await h.agent
      .patch(`/tasks/${task.id}`)
      .set('X-User-Id', user)
      .send({ reminder_at: moved })
      .expect(200)
    const res = await ack(h, user, task.id as string, AT)
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('REMINDER_MOVED')
    // acknowledging the OLD instant must not retire the new one
    expect((await listTasks(h, user))[0]!.reminder_shown_at).toBeNull()
    // …and the new instant acknowledges fine
    expect((await ack(h, user, task.id as string, moved)).body.acknowledged).toBe(true)
  })

  it('acknowledging on a DONE or DELETED row is a no-op returning `acknowledged: false`', async () => {
    const h = await buildHarness()
    const user = uid()
    const done = await createTask(h, user, 'Done task', { reminder_at: AT })
    await h.agent.patch(`/tasks/${done.id}`).set('X-User-Id', user).send({ status: 'done' }).expect(200)
    const onDone = await ack(h, user, done.id as string, AT)
    expect(onDone.status).toBe(200)
    expect(onDone.body.acknowledged).toBe(false)
    expect(h.store.read((s) => s.tasks[done.id as string]!.reminder_shown_at ?? null)).toBeNull()

    const deleted = await createTask(h, user, 'Deleted task', { reminder_at: AT })
    await h.agent.delete(`/tasks/${deleted.id}`).set('X-User-Id', user).expect(200)
    const onDeleted = await ack(h, user, deleted.id as string, AT)
    expect(onDeleted.status).toBe(200)
    expect(onDeleted.body.acknowledged).toBe(false)
  })

  it('`reminder_at` is required and validated, and unknown fields are rejected', async () => {
    const h = await buildHarness()
    const user = uid()
    const task = await createTask(h, user, 'Call the dentist', { reminder_at: AT })
    const missing = await h.agent
      .post(`/tasks/${task.id}/reminder-ack`)
      .set('X-User-Id', user)
      .send({})
    expect(missing.status).toBe(400)
    expect(missing.body.error.field).toBe('reminder_at')
    const garbage = await ack(h, user, task.id as string, 'not-an-instant')
    expect(garbage.status).toBe(400)
    const extra = await h.agent
      .post(`/tasks/${task.id}/reminder-ack`)
      .set('X-User-Id', user)
      .send({ reminder_at: AT, reminder_shown_at: AT })
    expect(extra.status).toBe(400)
    expect(extra.body.error.field).toBe('reminder_shown_at')
  })

  it('caller scoping is explicit: another account`s id behaves as 404', async () => {
    const h = await buildHarness()
    const user = uid()
    const other = uid()
    const task = await createTask(h, user, 'Call the dentist', { reminder_at: AT })
    const cross = await ack(h, other, task.id as string, AT)
    expect(cross.status).toBe(404)
    expect(await ack(h, user, uid(), AT)).toMatchObject({ status: 404 })
    expect((await listTasks(h, user))[0]!.reminder_shown_at).toBeNull()
  })
})

describe('`reminder_shown_at` is writable through THAT door and no other', () => {
  it('it is not in `TASK_CREATE_FIELDS` and not in `TASK_PATCH_FIELDS`', async () => {
    const h = await buildHarness()
    const user = uid()
    const onCreate = await h.agent
      .post('/tasks')
      .set('X-User-Id', user)
      .send({ title: 'x', reminder_shown_at: AT })
    expect(onCreate.status).toBe(400)
    expect(onCreate.body.error.field).toBe('reminder_shown_at')

    const task = await createTask(h, user, 'Call the dentist', { reminder_at: AT })
    const onPatch = await h.agent
      .patch(`/tasks/${task.id}`)
      .set('X-User-Id', user)
      .send({ reminder_shown_at: AT })
    expect(onPatch.status).toBe(400)
    expect(onPatch.body.error.field).toBe('reminder_shown_at')
  })

  it('a TURN may not set it — a turn that could would silently retire a reminder the user never saw', async () => {
    const h = await buildHarness()
    const user = uid()
    await createTask(h, user, 'Buy milk', { reminder_at: AT })
    // AC-36 permits `note`, `priority`, `due_at` and `reminder_at` — and nothing
    // else. The recorded question is answered in the direction it has to be.
    const res = await sendTurn(h, user, 'push the reminder on buy milk an hour later')
    expect(res.status).toBe(200)
    expect(res.body.turn.outcome.kind).toBe('applied')
    const row = (await listTasks(h, user))[0]!
    expect(row.reminder_at).toBe('2026-08-20T10:00:00.000Z')
    // AC-10: writing `reminder_at` CLEARS `reminder_shown_at`, so a reminder moved to
    // a new moment is a new reminder and surfaces again
    expect(row.reminder_shown_at).toBeNull()
  })
})

describe('AC-10 — writing or clearing `reminder_at` clears `reminder_shown_at`', () => {
  it('moving the reminder clears the marker, so the SECOND reminder a user sets is not dead on arrival', async () => {
    const h = await buildHarness()
    const user = uid()
    const task = await createTask(h, user, 'Call the dentist', { reminder_at: AT })
    await ack(h, user, task.id as string, AT).expect(200)
    expect((await listTasks(h, user))[0]!.reminder_shown_at).not.toBeNull()

    // Without this rule the second reminder a user ever sets on a task is dead on
    // arrival, INVISIBLY — nothing renders the marker and the happy path passes in
    // every variant (tester T20, architect F6).
    const moved = await h.agent
      .patch(`/tasks/${task.id}`)
      .set('X-User-Id', user)
      .send({ reminder_at: '2026-08-19T09:00:00.000Z' })
    expect(moved.status).toBe(200)
    expect(moved.body.task.reminder_shown_at).toBeNull()
  })

  it('CLEARING the reminder clears the marker too, and stores no value', async () => {
    const h = await buildHarness()
    const user = uid()
    const task = await createTask(h, user, 'Call the dentist', { reminder_at: AT })
    await ack(h, user, task.id as string, AT).expect(200)
    const cleared = await h.agent
      .patch(`/tasks/${task.id}`)
      .set('X-User-Id', user)
      .send({ reminder_at: null })
    expect(cleared.status).toBe(200)
    // clearing stores no value — not a zero date, not an empty string (AC-10)
    expect(cleared.body.task.reminder_at).toBeNull()
    expect(cleared.body.task.reminder_shown_at).toBeNull()
    expect(cleared.body.prior).toEqual({ reminder_at: AT })
  })

  it('a write that does NOT touch `reminder_at` leaves the marker alone', async () => {
    const h = await buildHarness()
    const user = uid()
    // without this case the two above pass against an implementation that clears the
    // marker on every write
    const task = await createTask(h, user, 'Call the dentist', { reminder_at: AT })
    const acked = await ack(h, user, task.id as string, AT)
    const renamed = await h.agent
      .patch(`/tasks/${task.id}`)
      .set('X-User-Id', user)
      .send({ title: 'Call the dentist back' })
    expect(renamed.body.task.reminder_shown_at).toBe(acked.body.task.reminder_shown_at)
  })

  it('re-sending the SAME `reminder_at` is a no-op and does not clear the marker', async () => {
    const h = await buildHarness()
    const user = uid()
    const task = await createTask(h, user, 'Call the dentist', { reminder_at: AT })
    const acked = await ack(h, user, task.id as string, AT)
    const same = await h.agent
      .patch(`/tasks/${task.id}`)
      .set('X-User-Id', user)
      .send({ reminder_at: AT })
    expect(same.status).toBe(200)
    // the marker is keyed to the INSTANT that was surfaced; the instant did not move,
    // so the reminder is not a new reminder
    expect(same.body.prior).toEqual({})
    expect(same.body.task.reminder_shown_at).toBe(acked.body.task.reminder_shown_at)
  })
})
