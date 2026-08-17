// Session lifecycle (AC-28, ADR-003/004/005): resume, lazy idle close, the
// single boundary message (close marker + declined questions + late
// outcomes), explicit close, one open session per account.

import { describe, expect, it } from 'vitest'
import {
  buildHarness,
  closeSessionReq,
  createTask,
  getSession,
  listTasks,
  sendTurn,
  uid,
} from './helpers.ts'

describe('GET /assistant/session', () => {
  it('clean start: no session, no boundary', async () => {
    const h = await buildHarness()
    const res = await getSession(h, uid())
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ session: null, boundary: null })
  })

  it('resumes the open session with messages in seq order, failed turns included (AC-23, AC-28)', async () => {
    const h = await buildHarness()
    const user = uid()
    await sendTurn(h, user, 'add a task to buy milk')
    await sendTurn(h, user, 'cause an ai error')
    const res = await getSession(h, user)
    expect(res.body.session).not.toBeNull()
    expect(res.body.boundary).toBeNull()
    const messages = res.body.session.messages
    expect(messages.map((m: { seq: number }) => m.seq)).toEqual([1, 2])
    expect(messages.map((m: { status: string }) => m.status)).toEqual(['applied', 'failed'])
    expect(messages[1].transcript_raw).toBe('cause an ai error')
  })

  it('one open session per account: consecutive turns share one session (ADR-005)', async () => {
    const h = await buildHarness()
    const user = uid()
    const r1 = await sendTurn(h, user, 'add a task to buy milk')
    const r2 = await sendTurn(h, user, 'plan the week')
    expect(r2.body.session_id).toBe(r1.body.session_id)
    expect(r2.body.turn.seq).toBe(2)
  })
})

describe('lazy idle close (ADR-004, AC-28)', () => {
  it('a session idle >= 180 s is closed lazily with reason idle; GET returns the boundary, never a stale open session', async () => {
    const h = await buildHarness()
    const user = uid()
    const turn = await sendTurn(h, user, 'add a task to buy milk')
    h.clock.advance(180_000)
    const res = await getSession(h, user)
    expect(res.body.session).toBeNull()
    expect(res.body.boundary).toMatchObject({
      session_id: turn.body.session_id,
      close_reason: 'idle',
    })
    expect(typeof res.body.boundary.closed_at).toBe('string')
  })

  it('a turn to an explicitly-named closed session gets 409 SESSION_CLOSED; the re-sent id then processes fresh', async () => {
    const h = await buildHarness()
    const user = uid()
    const first = await sendTurn(h, user, 'add a task to buy milk')
    const oldSession = first.body.session_id as string
    h.clock.advance(180_000)
    const ctid = uid()
    const stale = await sendTurn(h, user, 'plan the week', { ctid, session_id: oldSession })
    expect(stale.status).toBe(409)
    expect(stale.body.error.code).toBe('SESSION_CLOSED')
    // client re-syncs and replays the same client_turn_id against session: null
    const replay = await sendTurn(h, user, 'plan the week', { ctid, session_id: null })
    expect(replay.status).toBe(200)
    expect(replay.body.session_id).not.toBe(oldSession)
    expect(replay.body.turn.status).toBe('applied')
  })

  it('idle close resolves unanswered questions as declined, visible in the boundary by name (D2, AC-28)', async () => {
    const h = await buildHarness()
    const user = uid()
    for (const t of ['Buy milk', 'Buy eggs', 'Buy bread']) await createTask(h, user, t)
    const asked = await sendTurn(h, user, 'delete the shopping tasks')
    expect(asked.body.turn.status).toBe('asked')
    h.clock.advance(180_000)
    const res = await getSession(h, user)
    expect(res.body.session).toBeNull()
    expect(res.body.boundary.declined_questions).toEqual([
      {
        turn_id: asked.body.turn.id,
        kind: 'bulk_delete',
        task_titles: ['Buy milk', 'Buy eggs', 'Buy bread'],
      },
    ])
    expect(await listTasks(h, user)).toHaveLength(3) // declined = never executed
  })

  it('boundary late_outcomes carries turns resolved after the last foreground; seen outcomes do not reappear (AC-28)', async () => {
    const h = await buildHarness()
    const user = uid()
    const t1 = await sendTurn(h, user, 'add a task to buy milk')
    await getSession(h, user) // foreground: t1's outcome has been seen
    h.clock.advance(1_000)
    const t2 = await sendTurn(h, user, 'plan the week') // resolves after last foreground
    h.clock.advance(180_000)
    const res = await getSession(h, user)
    expect(res.body.session).toBeNull()
    const late = res.body.boundary.late_outcomes
    expect(late.map((l: { turn_id: string }) => l.turn_id)).toEqual([t2.body.turn.id])
    expect(late[0].status).toBe('applied')
    expect(late[0].outcome.kind).toBe('applied')
    expect(late.map((l: { turn_id: string }) => l.turn_id)).not.toContain(t1.body.turn.id)
  })
})

describe('POST /assistant/session/close', () => {
  it('closes with reason user_closed, declining unanswered questions (AC-28, AC-8)', async () => {
    const h = await buildHarness()
    const user = uid()
    for (const t of ['Buy milk', 'Buy eggs', 'Buy bread']) await createTask(h, user, t)
    const asked = await sendTurn(h, user, 'delete the shopping tasks')
    const res = await closeSessionReq(h, user, asked.body.session_id as string)
    expect(res.status).toBe(200)
    expect(res.body.session).toMatchObject({
      id: asked.body.session_id,
      status: 'closed',
      close_reason: 'user_closed',
    })
    expect(res.body.declined_question_turn_ids).toEqual([asked.body.turn.id])
    expect(res.body.already_closed).toBe(false)
    expect(await listTasks(h, user)).toHaveLength(3)
  })

  it('closing an already-closed session is an idempotent no-op', async () => {
    const h = await buildHarness()
    const user = uid()
    const turn = await sendTurn(h, user, 'add a task to buy milk')
    const sessionId = turn.body.session_id as string
    await closeSessionReq(h, user, sessionId)
    const again = await closeSessionReq(h, user, sessionId)
    expect(again.status).toBe(200)
    expect(again.body.already_closed).toBe(true)
    expect(again.body.session.close_reason).toBe('user_closed')
  })

  it('validation: reason must be user_closed (idle is server-only), session must exist, unknown fields rejected', async () => {
    const h = await buildHarness()
    const user = uid()
    const turn = await sendTurn(h, user, 'add a task to buy milk')
    const sessionId = turn.body.session_id as string
    const badReason = await h.agent
      .post('/assistant/session/close')
      .set('X-User-Id', user)
      .send({ session_id: sessionId, reason: 'idle' })
    expect(badReason.status).toBe(400)
    expect(badReason.body.error.field).toBe('reason')
    const unknownSession = await closeSessionReq(h, user, uid())
    expect(unknownSession.status).toBe(404)
    const unknownField = await h.agent
      .post('/assistant/session/close')
      .set('X-User-Id', user)
      .send({ session_id: sessionId, reason: 'user_closed', force: true })
    expect(unknownField.status).toBe(400)
    expect(unknownField.body.error.field).toBe('force')
    // zero side effects: the session is still open
    const still = await getSession(h, user)
    expect(still.body.session).not.toBeNull()
  })

  it("another user's session id behaves as 404 (no cross-account access)", async () => {
    const h = await buildHarness()
    const userA = uid()
    const turn = await sendTurn(h, userA, 'add a task to buy milk')
    const res = await closeSessionReq(h, uid(), turn.body.session_id as string)
    expect(res.status).toBe(404)
  })
})
