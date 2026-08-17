// Undo contract (AC-5..8, ADR-006): revert shapes, mechanical window rule,
// visible refusals, idempotency, snapshot-comparison skips, one-transaction
// atomicity, and the voice-undo guard.

import { describe, expect, it } from 'vitest'
import {
  buildHarness,
  closeSessionReq,
  createTask,
  getSession,
  listTasks,
  sendTurn,
  uid,
  undoTurn,
} from './helpers.ts'

describe('POST /assistant/turn/{turn_id}/undo — revert shapes (AC-6)', () => {
  it('edit → prior field values restored, observable on task-list read-back', async () => {
    const h = await buildHarness()
    const user = uid()
    await createTask(h, user, 'Buy milk')
    const turn = (await sendTurn(h, user, 'rename buy milk to buy oat milk')).body.turn
    const res = await undoTurn(h, user, turn.id as string)
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      turn_id: turn.id,
      undone: true,
      already_undone: false,
      nothing_reverted: false,
      skipped: [],
      via: 'tap',
    })
    expect(res.body.reverted).toEqual([{ task_id: turn.changed_task_ids[0], title: 'Buy milk' }])
    expect((await listTasks(h, user))[0]!.title).toBe('Buy milk')
    // the undone turn stays visible, marked undone
    const session = await getSession(h, user)
    const undoneTurn = session.body.session.messages.find((m: { id: string }) => m.id === turn.id)
    expect(undoneTurn.status).toBe('undone')
    expect(undoneTurn.undo_result.nothing_reverted).toBe(false)
  })

  it('create → created tasks removed, and staying removed on a fresh read', async () => {
    const h = await buildHarness()
    const user = uid()
    const turn = (await sendTurn(h, user, 'plan the week')).body.turn
    expect(await listTasks(h, user)).toHaveLength(4)
    const res = await undoTurn(h, user, turn.id as string)
    expect(res.body.reverted).toHaveLength(4) // undo covers the whole turn (AC-5)
    expect(await listTasks(h, user)).toHaveLength(0)
  })

  it('delete → tasks restored with all fields intact', async () => {
    const h = await buildHarness()
    const user = uid()
    await createTask(h, user, 'Team meeting', {
      due_at: '2026-08-20T10:00:00.000Z',
      priority: 'high',
      status: 'today',
    })
    const turn = (await sendTurn(h, user, 'delete the meeting')).body.turn
    expect(await listTasks(h, user)).toHaveLength(0)
    await undoTurn(h, user, turn.id as string)
    const restored = (await listTasks(h, user))[0]!
    expect(restored).toMatchObject({
      title: 'Team meeting',
      due_at: '2026-08-20T10:00:00.000Z',
      priority: 'high',
      status: 'today',
      deleted_at: null,
    })
  })
})

describe('undo refusals — visible outcomes, never silence (AC-6, AC-8)', () => {
  it('409 not_newest for a turn that is not the newest applied turn', async () => {
    const h = await buildHarness()
    const user = uid()
    const t1 = (await sendTurn(h, user, 'add a task to buy milk')).body.turn
    const t2 = (await sendTurn(h, user, 'plan the week')).body.turn
    const res = await undoTurn(h, user, t1.id as string)
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('UNDO_REFUSED')
    expect(res.body.error.detail).toEqual({ reason: 'not_newest', turn_id: t1.id })
    // after undoing the newest, the previous applied turn becomes newest again
    await undoTurn(h, user, t2.id as string)
    const again = await undoTurn(h, user, t1.id as string)
    expect(again.status).toBe(200)
    expect(await listTasks(h, user)).toHaveLength(0)
  })

  it('409 session_closed after the session closes (close ends the undo window)', async () => {
    const h = await buildHarness()
    const user = uid()
    const t = (await sendTurn(h, user, 'add a task to buy milk')).body.turn
    await closeSessionReq(h, user, t.session_id as string)
    const res = await undoTurn(h, user, t.id as string)
    expect(res.status).toBe(409)
    expect(res.body.error.detail.reason).toBe('session_closed')
  })

  it('409 not_undoable for a turn that is asked or failed', async () => {
    const h = await buildHarness()
    const user = uid()
    for (const title of ['Buy milk', 'Buy eggs', 'Buy bread']) await createTask(h, user, title)
    const asked = (await sendTurn(h, user, 'delete the shopping tasks')).body.turn
    const res1 = await undoTurn(h, user, asked.id as string)
    expect(res1.status).toBe(409)
    expect(res1.body.error.detail.reason).toBe('not_undoable')
    const failed = (await sendTurn(h, user, 'cause an ai error')).body.turn
    const res2 = await undoTurn(h, user, failed.id as string)
    expect(res2.status).toBe(409)
    expect(res2.body.error.detail.reason).toBe('not_undoable')
  })

  it('404 for a turn belonging to another account', async () => {
    const h = await buildHarness()
    const userA = uid()
    const userB = uid()
    const t = (await sendTurn(h, userA, 'add a task to buy milk')).body.turn
    const res = await undoTurn(h, userB, t.id as string)
    expect(res.status).toBe(404)
  })
})

describe('undo idempotency + snapshot comparison (AC-6, AC-7)', () => {
  it('undo of an already-undone turn is idempotent: same success outcome, no second revert', async () => {
    const h = await buildHarness()
    const user = uid()
    await createTask(h, user, 'Buy milk')
    const turn = (await sendTurn(h, user, 'rename buy milk to buy oat milk')).body.turn
    await undoTurn(h, user, turn.id as string)
    // hand-edit after the undo; the replay must NOT clobber it
    const taskId = turn.changed_task_ids[0] as string
    await h.agent.patch(`/tasks/${taskId}`).set('X-User-Id', user).send({ title: 'Hand edited' })
    const replay = await undoTurn(h, user, turn.id as string)
    expect(replay.status).toBe(200)
    expect(replay.body.already_undone).toBe(true)
    expect(replay.body.reverted).toHaveLength(1) // the recorded outcome, re-served
    expect((await listTasks(h, user))[0]!.title).toBe('Hand edited')
  })

  it('AC-7: a task modified after the turn is skipped by name; others revert', async () => {
    const h = await buildHarness()
    const user = uid()
    for (const title of ['Buy milk', 'Buy eggs', 'Buy bread']) await createTask(h, user, title)
    const turn = (await sendTurn(h, user, 'mark the shopping done')).body.turn
    expect(turn.changed_task_ids).toHaveLength(3)
    // hand-edit one of the three after the turn applied
    const eggsId = (await listTasks(h, user)).find((t) => t.title === 'Buy eggs')!.id as string
    await h.agent.patch(`/tasks/${eggsId}`).set('X-User-Id', user).send({ status: 'archived' })
    const res = await undoTurn(h, user, turn.id as string)
    expect(res.body.nothing_reverted).toBe(false)
    expect(res.body.reverted.map((r: { title: string }) => r.title).sort()).toEqual([
      'Buy bread',
      'Buy milk',
    ])
    expect(res.body.skipped).toEqual([
      { task_id: eggsId, title: 'Buy eggs', reason: 'modified_since_apply' },
    ])
    const byTitle = Object.fromEntries(
      (await listTasks(h, user)).map((t) => [t.title as string, t.status]),
    )
    expect(byTitle['Buy milk']).toBe('inbox') // reverted
    expect(byTitle['Buy bread']).toBe('inbox') // reverted
    expect(byTitle['Buy eggs']).toBe('archived') // skipped — zero silent overwrites
  })

  it('AC-7 / TC-22: an all-skipped undo says nothing was reverted, still consumes the undo, and replays idempotently', async () => {
    const h = await buildHarness()
    const user = uid()
    await createTask(h, user, 'Buy milk')
    const turn = (await sendTurn(h, user, 'rename buy milk to buy oat milk')).body.turn
    const taskId = turn.changed_task_ids[0] as string
    await h.agent.patch(`/tasks/${taskId}`).set('X-User-Id', user).send({ priority: 'low' })
    const res = await undoTurn(h, user, turn.id as string)
    expect(res.status).toBe(200)
    expect(res.body.nothing_reverted).toBe(true) // never renders as a successful revert
    expect(res.body.reverted).toEqual([])
    expect(res.body.skipped).toHaveLength(1)
    expect((await listTasks(h, user))[0]!.priority).toBe('low')
    // the undo is consumed: applied → undone even though nothing reverted
    const session = await getSession(h, user)
    const turnNow = session.body.session.messages.find((m: { id: string }) => m.id === turn.id)
    expect(turnNow.status).toBe('undone')
    // retry = AC-6 idempotent replay of the same nothing-reverted outcome
    const retry = await undoTurn(h, user, turn.id as string)
    expect(retry.status).toBe(200)
    expect(retry.body.already_undone).toBe(true)
    expect(retry.body.nothing_reverted).toBe(true)
    expect(retry.body.reverted).toEqual([])
    expect((await listTasks(h, user))[0]!.priority).toBe('low') // still untouched
  })

  it('AC-6: the window check and revert are one transaction — a mid-revert failure reverts nothing', async () => {
    const h = await buildHarness()
    const user = uid()
    const turn = (await sendTurn(h, user, 'plan the week')).body.turn // 4 created tasks
    h.store.arm(2) // the 3rd task removal throws mid-revert
    const failed = await undoTurn(h, user, turn.id as string)
    expect(failed.status).toBe(500)
    h.store.disarm()
    // zero partial writes: all 4 tasks still present, turn still applied
    expect(await listTasks(h, user)).toHaveLength(4)
    const session = await getSession(h, user)
    const turnNow = session.body.session.messages.find((m: { id: string }) => m.id === turn.id)
    expect(turnNow.status).toBe('applied')
    // and the undo still works afterwards, in full
    const retry = await undoTurn(h, user, turn.id as string)
    expect(retry.status).toBe(200)
    expect(retry.body.reverted).toHaveLength(4)
    expect(await listTasks(h, user)).toHaveLength(0)
  })
})

describe('undo window — only mutating turns occupy or advance it (AC-8)', () => {
  it('a misheard utterance does not kill the undo: non-mutating turns neither hold nor end the window', async () => {
    const h = await buildHarness()
    const user = uid()
    const milk = (await sendTurn(h, user, 'add a task to buy milk')).body.turn
    // three non-mutating applied turns land after it
    const misheard = (await sendTurn(h, user, 'flurb the wibble')).body.turn // no_match
    expect(misheard.status).toBe('applied')
    expect(misheard.changed_task_ids).toEqual([])
    expect(misheard.undo_snapshot).toBeNull() // no snapshot captured
    await sendTurn(h, user, "what's on sunday?") // unsupported_query
    // undoing the non-mutating turn itself is refused not_undoable (never not_newest)
    const refused = await undoTurn(h, user, misheard.id as string)
    expect(refused.status).toBe(409)
    expect(refused.body.error.detail).toEqual({ reason: 'not_undoable', turn_id: misheard.id })
    // the mutating turn is still the newest in the window — undo succeeds
    const res = await undoTurn(h, user, milk.id as string)
    expect(res.status).toBe(200)
    expect(res.body.reverted).toHaveLength(1)
    expect(await listTasks(h, user)).toHaveLength(0)
  })

  it('voice undo after a misheard utterance targets the newest MUTATING applied turn', async () => {
    const h = await buildHarness()
    const user = uid()
    await sendTurn(h, user, 'add a task to buy milk')
    await sendTurn(h, user, 'flurb the wibble') // no_match — must not become the target
    const res = await sendTurn(h, user, 'undo', { source: 'voice' })
    expect(res.status).toBe(200)
    expect(res.body.kind).toBe('undo')
    expect(res.body.undo.reverted).toHaveLength(1)
    expect(await listTasks(h, user)).toHaveLength(0) // the create was reverted
  })
})

describe('voice undo — guard before interpretation (AC-5, ADR-006)', () => {
  it('"undo" as a turn reverts the newest applied turn with zero interpretation calls and never becomes a task', async () => {
    const h = await buildHarness()
    const user = uid()
    await sendTurn(h, user, 'add a task to buy milk')
    const calls = h.interpreter.calls.length
    const res = await sendTurn(h, user, ' Undo. ', { source: 'voice' }) // normalization: trim/case/punctuation
    expect(res.status).toBe(200)
    expect(res.body.kind).toBe('undo')
    expect(res.body.turn).toBeNull() // no turn row created
    expect(res.body.undo.undone).toBe(true)
    expect(res.body.undo.via).toBe('voice')
    expect(h.interpreter.calls.length).toBe(calls) // the fixture tripwire row was never reached
    const tasks = await listTasks(h, user)
    expect(tasks).toHaveLength(0) // reverted, and no task named "undo"
    // no turn row appended to the session either
    const session = await getSession(h, user)
    expect(session.body.session.messages).toHaveLength(1)
  })

  // The Vietnamese undo phrase left the closed list with the rest of the
  // Vietnamese (ADR-008 / owner decision 2026-08-17: AC-5's undo vocabulary is
  // "undo"). Its old "behaves identically" case retired with it — T-069 had
  // already removed the fixture tripwire row behind it, leaving a test whose
  // "never becomes a task" half could not fail. What replaces it asserts the
  // behaviour *change*: the phrase is no longer guarded, so it reaches the
  // interpreter like any other utterance.
  it('"hoàn tác" is no longer a guarded phrase — it takes the normal turn path', async () => {
    const h = await buildHarness()
    const user = uid()
    await sendTurn(h, user, 'add a task to buy milk')
    const calls = h.interpreter.calls.length
    const res = await sendTurn(h, user, 'hoàn tác', { source: 'voice' })
    expect(res.status).toBe(200)
    expect(res.body.kind).toBe('turn') // not 'undo' — the guard no longer claims it
    expect(h.interpreter.calls.length).toBe(calls + 1) // interpreted, not short-circuited
    expect(res.body.turn.outcome.kind).toBe('no_match') // no fixture row for it
    // and nothing was undone: the earlier create still stands
    expect((await listTasks(h, user)).map((t) => t.title)).toEqual(['Buy milk'])
  })

  it('a voice undo with no applied turn is a visible refusal, not a task named undo (AC-8)', async () => {
    const h = await buildHarness()
    const user = uid()
    const res = await sendTurn(h, user, 'undo', { source: 'voice' })
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('UNDO_REFUSED')
    expect(res.body.error.detail.reason).toBe('not_undoable')
    expect(await listTasks(h, user)).toHaveLength(0)
  })

  it('TC-24: a guard refusal consumes the client_turn_id — a same-id retry re-serves the refusal, never undoing a turn applied in between', async () => {
    const h = await buildHarness()
    const user = uid()
    const ctid = uid()
    const refused = await sendTurn(h, user, 'undo', { source: 'voice', ctid })
    expect(refused.status).toBe(409)
    expect(refused.body.error.code).toBe('UNDO_REFUSED')
    // a turn applies in between; no turn row was created for the refusal
    const applied = await sendTurn(h, user, 'add a task to buy milk')
    expect(applied.body.turn.seq).toBe(1)
    const calls = h.interpreter.calls.length
    const retry = await sendTurn(h, user, 'undo', { source: 'voice', ctid })
    expect(retry.status).toBe(409) // recorded refusal re-served without re-evaluating
    expect(retry.body.error.code).toBe('UNDO_REFUSED')
    expect(retry.body.error.detail.reason).toBe('not_undoable')
    expect(h.interpreter.calls.length).toBe(calls)
    expect((await listTasks(h, user)).map((t) => t.title)).toEqual(['Buy milk']) // NOT undone
    // a fresh client_turn_id still undoes normally
    const fresh = await sendTurn(h, user, 'undo', { source: 'voice' })
    expect(fresh.status).toBe(200)
    expect(fresh.body.kind).toBe('undo')
    expect(await listTasks(h, user)).toHaveLength(0)
  })

  it('a voice undo replayed under the same client_turn_id re-serves the outcome without a second revert', async () => {
    const h = await buildHarness()
    const user = uid()
    await sendTurn(h, user, 'add a task to buy milk')
    const ctid = uid()
    const first = await sendTurn(h, user, 'undo', { source: 'voice', ctid })
    expect(first.body.kind).toBe('undo')
    // re-create a task; the replay must NOT undo it
    await createTask(h, user, 'Fresh task')
    const replay = await sendTurn(h, user, 'undo', { source: 'voice', ctid })
    expect(replay.body.kind).toBe('undo')
    expect(replay.body.replayed).toBe(true)
    expect(replay.body.undo).toEqual(first.body.undo)
    expect((await listTasks(h, user)).map((t) => t.title)).toEqual(['Fresh task'])
  })

  it('anything longer than the closed phrase list is a normal turn (ADR-006)', async () => {
    const h = await buildHarness()
    const user = uid()
    await sendTurn(h, user, 'add a task to buy milk')
    const res = await sendTurn(h, user, 'undo the last thing')
    expect(res.body.kind).toBe('turn')
    expect(res.body.turn.outcome.kind).toBe('no_match') // falls through to the model
    expect(await listTasks(h, user)).toHaveLength(1) // nothing undone
  })
})
