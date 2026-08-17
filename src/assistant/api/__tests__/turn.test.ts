// POST /assistant/turn — interpret + apply atomically (AC-1), attribution
// (AC-4), honesty (AC-14, AC-15), failure paths (AC-23, AC-24), serial
// per-account processing (AC-10), validation and error envelope.

import { describe, expect, it } from 'vitest'
import {
  buildHarness,
  createTask,
  getSession,
  listTasks,
  sendTurn,
  sleep,
  uid,
} from './helpers.ts'

describe('POST /assistant/turn — validation & auth', () => {
  it('401 UNAUTHENTICATED without X-User-Id', async () => {
    const h = await buildHarness()
    const res = await h.agent.post('/assistant/turn').send({})
    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('UNAUTHENTICATED')
  })

  it('400 VALIDATION on missing/empty transcript, missing client_turn_id, bad uuid, bad source', async () => {
    const h = await buildHarness()
    const user = uid()
    const base = {
      session_id: null,
      client_turn_id: uid(),
      transcript: 'hello',
      source: 'typed',
      answer_to_turn_id: null,
      timezone: null,
    }
    const cases: [Record<string, unknown>, string][] = [
      [{ ...base, transcript: undefined }, 'transcript'],
      [{ ...base, transcript: '   ' }, 'transcript'],
      [{ ...base, client_turn_id: undefined }, 'client_turn_id'],
      [{ ...base, client_turn_id: 'not-a-uuid' }, 'client_turn_id'],
      [{ ...base, session_id: 'nope' }, 'session_id'],
      [{ ...base, source: 'telepathy' }, 'source'],
      [{ ...base, answer_to_turn_id: '123' }, 'answer_to_turn_id'],
      // unknown request fields are rejected, naming the field (TC-34)
      [{ ...base, frobnicate: true }, 'frobnicate'],
    ]
    for (const [body, field] of cases) {
      const res = await h.agent.post('/assistant/turn').set('X-User-Id', user).send(body)
      expect(res.status, field).toBe(400)
      expect(res.body.error.code).toBe('VALIDATION')
      expect(res.body.error.field).toBe(field)
    }
  })

  it('404 NOT_FOUND for unknown session_id and unknown answer_to_turn_id', async () => {
    const h = await buildHarness()
    const user = uid()
    const res1 = await sendTurn(h, user, 'add a task to buy milk', { session_id: uid() })
    expect(res1.status).toBe(404)
    expect(res1.body.error.code).toBe('NOT_FOUND')
    const res2 = await sendTurn(h, user, 'add a task to buy milk', { answer_to: uid() })
    expect(res2.status).toBe(404)
  })
})

describe('POST /assistant/turn — apply outcomes', () => {
  it('AC-1: a create turn applies and the result lives in the task list', async () => {
    const h = await buildHarness()
    const user = uid()
    const res = await sendTurn(h, user, 'add a task to buy milk')
    expect(res.status).toBe(200)
    expect(res.body.kind).toBe('turn')
    expect(res.body.replayed).toBe(false)
    expect(res.body.undo).toBeNull()
    const turn = res.body.turn
    expect(turn.status).toBe('applied')
    expect(turn.outcome.kind).toBe('applied')
    expect(turn.outcome.created_titles).toEqual(['Buy milk'])
    expect(turn.changed_task_ids).toHaveLength(1)
    // the on-screen list is where the result lives — read-back observable
    const tasks = await listTasks(h, user)
    expect(tasks.map((t) => t.title)).toEqual(['Buy milk'])
  })

  it('AC-4: an edit shows an old → new diff per field', async () => {
    const h = await buildHarness()
    const user = uid()
    await createTask(h, user, 'Buy milk')
    const res = await sendTurn(h, user, 'rename buy milk to buy oat milk')
    expect(res.status).toBe(200)
    expect(res.body.turn.outcome.kind).toBe('applied')
    expect(res.body.turn.outcome.diff).toEqual([
      expect.objectContaining({ field: 'title', old: 'Buy milk', new: 'Buy oat milk' }),
    ])
    const tasks = await listTasks(h, user)
    expect(tasks[0]!.title).toBe('Buy oat milk')
  })

  it('AC-9: a single-task delete applies immediately, named by title', async () => {
    const h = await buildHarness()
    const user = uid()
    await createTask(h, user, 'Team meeting')
    const res = await sendTurn(h, user, 'delete the meeting')
    expect(res.status).toBe(200)
    expect(res.body.turn.status).toBe('applied')
    expect(res.body.turn.outcome.deleted_titles).toEqual(['Team meeting'])
    expect(await listTasks(h, user)).toHaveLength(0)
  })

  it('AC-14: no-match applies zero mutations and quotes the heard transcript', async () => {
    const h = await buildHarness()
    const user = uid()
    await createTask(h, user, 'Buy milk')
    const res = await sendTurn(h, user, 'flurb the wibble')
    expect(res.status).toBe(200)
    expect(res.body.turn.outcome).toEqual({
      kind: 'no_match',
      heard_transcript: 'flurb the wibble',
    })
    expect(res.body.turn.changed_task_ids).toEqual([])
    const tasks = await listTasks(h, user)
    expect(tasks).toHaveLength(1)
    expect(tasks[0]!.title).toBe('Buy milk')
  })

  it('AC-15: a list question gets the honest unsupported answer naming the alternative', async () => {
    const h = await buildHarness()
    const user = uid()
    await createTask(h, user, 'Buy milk')
    const res = await sendTurn(h, user, "what's on sunday?")
    expect(res.status).toBe(200)
    expect(res.body.turn.outcome).toEqual({
      kind: 'unsupported_query',
      alternative: 'the on-screen list and its filters',
    })
    expect(await listTasks(h, user)).toHaveLength(1)
  })

  it('AC-4 / ADR-002: no draft-ref tokens ever render in responses', async () => {
    const h = await buildHarness()
    const user = uid()
    await createTask(h, user, 'Buy milk')
    const responses = [
      await sendTurn(h, user, 'rename buy milk to buy oat milk'),
      await getSession(h, user),
    ]
    for (const res of responses) {
      expect(JSON.stringify(res.body)).not.toMatch(/#d\d/)
    }
  })
})

describe('POST /assistant/turn — failure paths', () => {
  it('AC-23/AC-24: interpretation failure → 502 AI_ERROR, transcript persisted, turn failed but kept in history', async () => {
    const h = await buildHarness()
    const user = uid()
    const res = await sendTurn(h, user, 'cause an ai error')
    expect(res.status).toBe(502)
    expect(res.body.error.code).toBe('AI_ERROR')
    expect(res.body.turn.status).toBe('failed')
    expect(res.body.turn.transcript_raw).toBe('cause an ai error')
    // the failed turn is recorded in session.messages too
    const session = await getSession(h, user)
    expect(session.body.session.messages).toHaveLength(1)
    expect(session.body.session.messages[0].status).toBe('failed')
  })

  it('AC-1 / TC-02: a mid-apply failure aborts atomically → 500 APPLY_FAILED with the failed turn, retryable', async () => {
    const h = await buildHarness()
    const user = uid()
    const ctid = uid()
    h.store.arm(2) // "plan the week" creates 4 tasks; the 3rd write throws
    const res = await sendTurn(h, user, 'plan the week', { ctid })
    expect(res.status).toBe(500)
    expect(res.body.error.code).toBe('APPLY_FAILED')
    expect(res.body.error).not.toHaveProperty('stack')
    // body carries {error, turn} — same shape as 502; transcript preserved (AC-23)
    expect(res.body.turn.status).toBe('failed')
    expect(res.body.turn.transcript_raw).toBe('plan the week')
    h.store.disarm()
    expect(await listTasks(h, user)).toHaveLength(0) // all-or-nothing
    const session = await getSession(h, user)
    expect(session.body.session.messages[0].status).toBe('failed')
    // failed → pending under the same id: the retry completes the whole turn
    const retry = await sendTurn(h, user, 'plan the week', { ctid })
    expect(retry.status).toBe(200)
    expect(retry.body.turn.status).toBe('applied')
    expect(await listTasks(h, user)).toHaveLength(4)
  })
})

describe('POST /assistant/turn — serial per-account processing (AC-10)', () => {
  it('processes a session turns serially in receipt order', async () => {
    const h = await buildHarness()
    const user = uid()
    // "buy cheese" interprets slowly (fixture delay); "buy milk" is instant
    const p1 = sendTurn(h, user, 'add a task to buy cheese').then((r) => r)
    await sleep(10) // let turn 1 enter its queue slot
    const p2 = sendTurn(h, user, 'add a task to buy milk').then((r) => r)
    const [r1, r2] = await Promise.all([p1, p2])
    expect(r1.status).toBe(200)
    expect(r2.status).toBe(200)
    // receipt order preserved in seq
    expect(r1.body.turn.seq).toBe(1)
    expect(r2.body.turn.seq).toBe(2)
    // interpretation of turn 2 started only after turn 1 finished
    expect(h.interpreter.calls.map((c) => c.transcript)).toEqual([
      'add a task to buy cheese',
      'add a task to buy milk',
    ])
    expect(h.interpreter.calls[1]!.startedAt).toBeGreaterThanOrEqual(
      h.interpreter.calls[0]!.finishedAt,
    )
  })
})
