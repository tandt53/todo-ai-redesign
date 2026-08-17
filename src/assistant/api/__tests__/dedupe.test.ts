// Per-status dedupe, account scope (AC-16, ADR-005, processing rule 2):
// applied|asked|undone replay re-serves the recorded outcome; failed
// re-attempts; pending → 409 IN_FLIGHT; ids survive session close; scope is
// the account, not the session or device.

import { describe, expect, it } from 'vitest'
import {
  buildHarness,
  closeSessionReq,
  createTask,
  listTasks,
  sendTurn,
  sleep,
  uid,
  undoTurn,
} from './helpers.ts'

describe('dedupe — per status, account scope (AC-16)', () => {
  it('replay of an applied turn re-serves the outcome and applies nothing twice', async () => {
    const h = await buildHarness()
    const user = uid()
    const ctid = uid()
    const first = await sendTurn(h, user, 'add a task to buy milk', { ctid })
    expect(first.status).toBe(200)
    const calls = h.interpreter.calls.length
    const replay = await sendTurn(h, user, 'add a task to buy milk', { ctid })
    expect(replay.status).toBe(200)
    expect(replay.body.replayed).toBe(true)
    expect(replay.body.turn.id).toBe(first.body.turn.id)
    expect(h.interpreter.calls.length).toBe(calls) // nothing re-executed, not even interpretation
    expect(await listTasks(h, user)).toHaveLength(1)
  })

  it('replay of an asked turn re-serves the question without asking twice', async () => {
    const h = await buildHarness()
    const user = uid()
    for (const t of ['Buy milk', 'Buy eggs', 'Buy bread']) await createTask(h, user, t)
    const ctid = uid()
    const first = await sendTurn(h, user, 'delete the shopping tasks', { ctid })
    expect(first.body.turn.status).toBe('asked')
    const replay = await sendTurn(h, user, 'delete the shopping tasks', { ctid })
    expect(replay.body.replayed).toBe(true)
    expect(replay.body.turn.status).toBe('asked')
    expect(replay.body.turn.id).toBe(first.body.turn.id)
    expect(await listTasks(h, user)).toHaveLength(3) // still refused-to-apply
  })

  it('replay of an undone turn re-serves it without re-executing', async () => {
    const h = await buildHarness()
    const user = uid()
    const ctid = uid()
    const first = await sendTurn(h, user, 'add a task to buy milk', { ctid })
    await undoTurn(h, user, first.body.turn.id as string)
    expect(await listTasks(h, user)).toHaveLength(0)
    const replay = await sendTurn(h, user, 'add a task to buy milk', { ctid })
    expect(replay.body.replayed).toBe(true)
    expect(replay.body.turn.status).toBe('undone')
    expect(await listTasks(h, user)).toHaveLength(0) // not re-created
  })

  it('a failed turn re-attempts under the same id (failed → pending)', async () => {
    const h = await buildHarness()
    const user = uid()
    const ctid = uid()
    const first = await sendTurn(h, user, 'fail once then add wine', { ctid })
    expect(first.status).toBe(502)
    expect(first.body.error.code).toBe('AI_ERROR')
    const retry = await sendTurn(h, user, 'fail once then add wine', { ctid })
    expect(retry.status).toBe(200)
    expect(retry.body.replayed).toBe(false)
    expect(retry.body.turn.status).toBe('applied')
    const tasks = await listTasks(h, user)
    expect(tasks.map((t) => t.title)).toEqual(['Buy wine']) // exactly once
  })

  it('a concurrent duplicate of a still-processing turn gets 409 IN_FLIGHT', async () => {
    const h = await buildHarness()
    const user = uid()
    const ctid = uid()
    const p1 = sendTurn(h, user, 'add a task to buy cheese', { ctid }).then((r) => r)
    await sleep(15) // turn 1 is now pending inside its queue slot
    const dup = await sendTurn(h, user, 'add a task to buy cheese', { ctid })
    expect(dup.status).toBe(409)
    expect(dup.body.error.code).toBe('IN_FLIGHT')
    const r1 = await p1
    expect(r1.status).toBe(200)
    expect(await listTasks(h, user)).toHaveLength(1)
  })

  it('a replay arriving after session close is still recognized', async () => {
    const h = await buildHarness()
    const user = uid()
    const ctid = uid()
    const first = await sendTurn(h, user, 'add a task to buy milk', { ctid })
    await closeSessionReq(h, user, first.body.session_id as string)
    const replay = await sendTurn(h, user, 'add a task to buy milk', { ctid })
    expect(replay.status).toBe(200)
    expect(replay.body.replayed).toBe(true)
    expect(await listTasks(h, user)).toHaveLength(1)
  })

  it('TC-25: a same-id request with a divergent body is id reuse — 409 CLIENT_TURN_ID_REUSED, nothing executes', async () => {
    const h = await buildHarness()
    const user = uid()
    const ctid = uid()
    await sendTurn(h, user, 'add a task to buy milk', { ctid })
    // divergent transcript
    const r1 = await sendTurn(h, user, 'plan the week', { ctid })
    expect(r1.status).toBe(409)
    expect(r1.body.error.code).toBe('CLIENT_TURN_ID_REUSED')
    // divergent source
    const r2 = await sendTurn(h, user, 'add a task to buy milk', { ctid, source: 'voice' })
    expect(r2.status).toBe(409)
    expect(r2.body.error.code).toBe('CLIENT_TURN_ID_REUSED')
    // nothing executed either time
    expect((await listTasks(h, user)).map((t) => t.title)).toEqual(['Buy milk'])
  })

  it('TC-25: session_id is excluded from the divergence comparison (post-close replay)', async () => {
    const h = await buildHarness()
    const user = uid()
    const ctid = uid()
    const first = await sendTurn(h, user, 'add a task to buy milk', { ctid })
    const oldSession = first.body.session_id as string
    await closeSessionReq(h, user, oldSession)
    const replayed = await sendTurn(h, user, 'add a task to buy milk', { ctid, session_id: null })
    expect(replayed.status).toBe(200)
    expect(replayed.body.replayed).toBe(true)
  })

  it('dedupe scope is the account: another user with the same client_turn_id is not deduped', async () => {
    const h = await buildHarness()
    const userA = uid()
    const userB = uid()
    const ctid = uid()
    await sendTurn(h, userA, 'add a task to buy milk', { ctid })
    const other = await sendTurn(h, userB, 'add a task to buy milk', { ctid })
    expect(other.body.replayed).toBe(false)
    expect(await listTasks(h, userA)).toHaveLength(1)
    expect(await listTasks(h, userB)).toHaveLength(1)
  })
})
