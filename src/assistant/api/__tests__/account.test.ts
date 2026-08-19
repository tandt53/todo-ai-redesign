// The `account` entity and the zone (F-005 AC-44, AC-13, AC-32, ADR-010).
//
// ADR-005 decided on 2026-08-16 that *the account* is the scope for sessions and
// dedupe, and **there had never been a row**. These cases are that premise
// acquiring an entity, plus the three things the spec deliberately left open and
// ADR-010 answered: who writes the zone, what refreshes it, and what a READ does
// when there is none.

import { describe, expect, it } from 'vitest'
import { buildHarness, createTask, listTasks, sendTurn, uid } from './helpers.ts'

const account = (h: Awaited<ReturnType<typeof buildHarness>>, user: string, zone?: string) => {
  const req = h.agent.get('/account').set('X-User-Id', user)
  return zone === undefined ? req : req.set('X-Timezone', zone)
}

describe('the account and the zone (ADR-010)', () => {
  it('the row is created lazily on the first authenticated request, from the first report', async () => {
    const h = await buildHarness()
    const user = uid()
    // the account row does not exist until a request arrives — measured: before
    // F-005 the store's top-level keys were sessions, turns, tasks, undo_records
    expect(h.store.read((s) => s.accounts?.[user])).toBeUndefined()

    const res = await account(h, user, 'Asia/Bangkok')
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      user_id: user,
      timezone: 'Asia/Bangkok',
      timezone_source: 'first-report',
      timezone_last_report: 'Asia/Bangkok',
    })
    expect(res.body.timezone_set_at).not.toBeNull()
  })

  it('a LATER report never overwrites an established zone — it is recorded so a client can OFFER the change', async () => {
    const h = await buildHarness()
    const user = uid()
    await account(h, user, 'Asia/Bangkok').expect(200)

    // the same user, a second device, a different zone. If each request upserted
    // before serving its own read, device A would resolve rows in UTC and device
    // B in UTC+7 IN THE SAME SECOND — the *one row, three answers* defect AC-44
    // was rewritten against, arriving through the WRITER instead of the reader.
    const second = await account(h, user, 'Europe/Berlin')
    expect(second.body.timezone).toBe('Asia/Bangkok') // unchanged
    expect(second.body.timezone_source).toBe('first-report')
    expect(second.body.timezone_last_report).toBe('Europe/Berlin')
    expect(second.body.timezone_last_report_at).not.toBeNull()
  })

  it('PATCH /account is the ONLY way to change an established zone, and it validates the zone', async () => {
    const h = await buildHarness()
    const user = uid()
    await account(h, user, 'Asia/Bangkok').expect(200)

    const patched = await h.agent
      .patch('/account')
      .set('X-User-Id', user)
      .send({ timezone: 'Europe/Berlin' })
    expect(patched.status).toBe(200)
    expect(patched.body).toMatchObject({ timezone: 'Europe/Berlin', timezone_source: 'user' })

    const bad = await h.agent
      .patch('/account')
      .set('X-User-Id', user)
      .send({ timezone: 'Mars/Olympus_Mons' })
    expect(bad.status).toBe(400)
    expect(bad.body.error.field).toBe('timezone')
    // the rejected write left the established zone alone
    expect((await account(h, user)).body.timezone).toBe('Europe/Berlin')

    const unknownField = await h.agent
      .patch('/account')
      .set('X-User-Id', user)
      .send({ timezone: 'Europe/Berlin', locale: 'en' })
    expect(unknownField.status).toBe(400)
    expect(unknownField.body.error.field).toBe('locale')
  })

  it('a malformed report is ignored entirely — recorded as nothing, never stored', async () => {
    const h = await buildHarness()
    const user = uid()
    const res = await account(h, user, 'Not/A_Zone')
    expect(res.body.timezone).toBeNull()
    expect(res.body.timezone_last_report).toBeNull() // a report, never a stored value
  })

  it('the turn body`s `timezone` is the SECOND channel into the SAME installer', async () => {
    const h = await buildHarness()
    const user = uid()
    // this client sends no header — the only channel it uses is the turn body,
    // which is the pre-existing one, kept so existing clients do not break
    const res = await h.zonelessAgent
      .post('/assistant/turn')
      .set('X-User-Id', user)
      .send({
        session_id: null,
        client_turn_id: uid(),
        transcript: 'add a task to buy milk',
        source: 'typed',
        answer_to_turn_id: null,
        timezone: 'Asia/Bangkok',
      })
    expect(res.status).toBe(200)
    const acct = await h.zonelessAgent.get('/account').set('X-User-Id', user)
    expect(acct.body.timezone).toBe('Asia/Bangkok')
    expect(acct.body.timezone_source).toBe('first-report')
  })

  it('the zone is per account, never global: two accounts resolve the same instant differently', async () => {
    const h = await buildHarness()
    const utc = uid()
    const bangkok = uid()
    // 17:00Z is the local start of 2026-08-21 in UTC+7 and a timed 17:00 in UTC.
    // ONE instant, two accounts, two correct answers — which is the case AC-13's
    // *one answer per ROW* clause is about, and the reason the zone is on the
    // account rather than on the request.
    const instant = '2026-08-20T17:00:00.000Z'
    await h.agent.post('/tasks').set('X-User-Id', utc).send({ title: 'a', due_at: instant })
    await h.agent
      .post('/tasks')
      .set('X-User-Id', bangkok)
      .set('X-Timezone', 'Asia/Bangkok')
      .send({ title: 'a', due_at: instant })
    expect((await listTasks(h, utc))[0]!.due_all_day).toBe(false)
    expect((await listTasks(h, bangkok))[0]!.due_all_day).toBe(true)
  })
})

describe('when the zone is absent', () => {
  it('a WRITE that needs a date computation refuses — 409 TIMEZONE_UNKNOWN naming the header', async () => {
    const h = await buildHarness()
    const user = uid()
    const res = await h.zonelessAgent
      .post('/tasks')
      .set('X-User-Id', user)
      .send({ title: 'Buy milk', due_at: '2026-08-20T10:00:00.000Z' })
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('TIMEZONE_UNKNOWN')
    // addressed to the CLIENT, not to the user: it is reachable only for a client
    // that has never sent the header on any request, because the installer runs
    // in the auth step before routing
    expect(res.body.error.detail).toEqual({ header: 'X-Timezone' })
    expect(await listTasks(h, user)).toHaveLength(0) // a refused write writes nothing
  })

  it('a write that needs NO date computation succeeds without a zone', async () => {
    const h = await buildHarness()
    const user = uid()
    // the refusal is scoped to the computation, not to the endpoint. Without this
    // case the test above passes against a server that refuses every write.
    const res = await h.zonelessAgent
      .post('/tasks')
      .set('X-User-Id', user)
      .send({ title: 'Buy milk', priority: 'high' })
    expect(res.status).toBe(201)
    expect(res.body.task.due_all_day).toBeNull()
  })

  it('a client may supply `due_all_day` itself and the write lands — the offline mobile create`s answer', async () => {
    const h = await buildHarness()
    const user = uid()
    // ADR-010 (tester-mobile M14): a task created offline while viewing Today is
    // written locally as ALL-DAY and the replay carries the flag, so the row never
    // needs re-deriving and the three-answers case cannot arise for it. The device
    // zone decides only which DAY the user meant.
    const res = await h.zonelessAgent
      .post('/tasks')
      .set('X-User-Id', user)
      .send({ title: 'Offline today', due_at: '2026-08-20T17:00:00.000Z', due_all_day: true })
    expect(res.status).toBe(201)
    expect(res.body.task.due_all_day).toBe(true)
  })

  it('a READ never refuses: `due_all_day: null` means NOT DETERMINED, and the row still renders', async () => {
    const h = await buildHarness()
    const user = uid()
    const id = uid()
    // a row that predates the field — 0 of 790 live rows carry it, so on day one
    // this is EVERY row of every account
    h.store.transact((s) => {
      s.tasks[id] = {
        id,
        user_id: user,
        title: 'a row from before F-005',
        due_at: '2026-08-20T10:00:00.000Z',
        reminder_at: null,
        priority: null,
        status: 'inbox',
        created_at: '2026-08-17T00:00:00.000Z',
        updated_at: '2026-08-17T00:00:00.000Z',
        deleted_at: null,
      }
    })
    const res = await h.zonelessAgent.get('/tasks').set('X-User-Id', user)
    expect(res.status).toBe(200) // refusing here would make the list unrenderable
    expect(res.body.tasks).toHaveLength(1)
    expect(res.body.tasks[0].due_all_day).toBeNull()
  })

  it('a stored flag is authoritative even when the zone would resolve it the OTHER way', async () => {
    const h = await buildHarness()
    const user = uid()
    const id = uid()
    h.store.transact((s) => {
      s.tasks[id] = {
        id,
        user_id: user,
        title: 'stored flag wins',
        // 10:00Z is NOT the local start of any UTC day, so resolution would say
        // `false`; the stored `true` must win on every tier (rule 1 of three)
        due_at: '2026-08-20T10:00:00.000Z',
        due_all_day: true,
        reminder_at: null,
        priority: null,
        status: 'inbox',
        created_at: '2026-08-17T00:00:00.000Z',
        updated_at: '2026-08-17T00:00:00.000Z',
        deleted_at: null,
      }
    })
    expect((await listTasks(h, user))[0]!.due_all_day).toBe(true)
  })

  it('AC-32 — the by-hand user is safe: an ordinary request establishes the zone', async () => {
    const h = await buildHarness()
    const user = uid()
    // the zone is established by an ordinary request such as GET /tasks, so a user
    // who never sends a turn — and an assistant that is erroring — change nothing
    // about whether dates compute. This is what makes the header the chosen door
    // rather than the turn body.
    await h.agent.get('/tasks').set('X-User-Id', user).expect(200)
    expect(h.interpreter.calls).toHaveLength(0)
    const res = await h.agent
      .post('/tasks')
      .set('X-User-Id', user)
      .send({ title: 'Buy milk', due_at: '2026-08-20T10:00:00.000Z' })
    expect(res.status).toBe(201)
  })

  it('a TURN that needs a date computation is refused with the `refused` outcome, not a 409', async () => {
    const h = await buildHarness()
    const user = uid()
    // the SAME rule, the outcome stated PER PATH: the HTTP door answers a client
    // that sent a bad body, the turn door answers a person who spoke a
    // well-formed sentence.
    const res = await h.zonelessAgent
      .post('/assistant/turn')
      .set('X-User-Id', user)
      .send({
        session_id: null,
        client_turn_id: uid(),
        transcript: 'add a task to call mom tomorrow',
        source: 'typed',
        answer_to_turn_id: null,
        timezone: null,
      })
    expect(res.status).toBe(200)
    expect(res.body.turn.outcome).toMatchObject({
      kind: 'refused',
      reason: 'timezone_unknown',
      field: 'due_at',
    })
    expect(res.body.turn.changed_task_ids).toEqual([])
    expect(await listTasks(h, user)).toHaveLength(0)
  })
})

describe('AC-44 — the date outcomes, not the seam', () => {
  it('a daily 09:00 repeat rolled across a DST boundary is still due at 09:00 WALL-CLOCK', async () => {
    const h = await buildHarness()
    const user = uid()
    const zone = 'Europe/Berlin' // CEST → CET on 2026-10-25
    // 2026-10-24T09:00 local is 07:00Z (UTC+2); the next day is CET (UTC+1), so
    // 09:00 local is 08:00Z. An implementation that adds 24 hours of MILLISECONDS
    // produces 07:00Z = 08:00 local — an hour either side, which is the outcome
    // this AC asserts and the reason revision 3 inverted it: an implementation
    // with a perfect seam and an hour of DST drift passed the old wording.
    const created = await h.agent
      .post('/tasks')
      .set('X-User-Id', user)
      .set('X-Timezone', zone)
      .send({
        title: 'Water the plants',
        due_at: '2026-10-24T07:00:00.000Z',
        repeat_frequency: 'day',
        repeat_interval: 1,
      })
    expect(created.status).toBe(201)
    const preview = await h.agent
      .post(`/tasks/${created.body.task.id}/repeat-preview`)
      .set('X-User-Id', user)
      .set('X-Timezone', zone)
      .send({ repeat_frequency: 'day', repeat_interval: 1 })
    expect(preview.status).toBe(200)

    h.clock.set('2026-10-24T09:00:00.000Z')
    const done = await h.agent
      .patch(`/tasks/${created.body.task.id}`)
      .set('X-User-Id', user)
      .set('X-Timezone', zone)
      .send({ status: 'done' })
    expect(done.status).toBe(200)
    const successor = done.body.changed.find((t: { series_id: string }) => t.series_id !== null)
    expect(successor.due_at).toBe('2026-10-25T08:00:00.000Z') // 09:00 CET, not 07:00Z
  })
})
