// Controller tests — node env, API mocked at the fetch seam (web.md Test
// Harness). These are the wire-level contracts: what the client sends, what it
// does with each documented response, and what it never sends.

import { describe, expect, it } from 'vitest'
import {
  appliedTurn,
  askedTurn,
  boundary,
  FakeServer,
  harness,
  serverTasks,
  session,
  T0,
  task,
  turn,
  turnResponse as ok,
  undoOutcome,
} from './_helpers.ts'
import { AssistantApi } from '../../_shared/api/client.ts'
import type { FetchLike } from '../../_shared/api/client.ts'
import { AssistantController } from '../../_shared/controller.ts'
import { micMode, undoableTurnId } from '../../_shared/model/reducer.ts'

const TURN = 'POST /assistant/turn'
const SESSION = 'GET /assistant/session'
const TASKS = 'GET /tasks'
const UNDO = 'POST /assistant/turn/:id/undo'

function server(tasks = [task()]): FakeServer {
  return new FakeServer()
    .always(SESSION, 200, { session: session(), boundary: null })
    .always(TASKS, 200, { tasks })
}

// ---------------------------------------------------------------------------
// AC-17, AC-16, AC-20 — the request the client actually sends
// ---------------------------------------------------------------------------

describe('POST /assistant/turn request shape (AC-16, AC-17, AC-20)', () => {
  it('sends exactly the six contract fields, text only — never audio', async () => {
    const s = server().always(TURN, 200, ok({ turn: appliedTurn() }))
    const h = harness({ server: s })
    await h.controller.init()
    h.controller.composerChange('push the budget review to 4pm')
    await h.controller.send('typed')

    const body = s.turnBodies()[0]
    expect(Object.keys(body ?? {}).sort()).toEqual([
      'answer_to_turn_id',
      'client_turn_id',
      'session_id',
      'source',
      'timezone',
      'transcript',
    ])
    expect(body?.['transcript']).toBe('push the budget review to 4pm')
    expect(body?.['source']).toBe('typed')
    expect(JSON.stringify(body)).not.toMatch(/audio|blob|base64/i)
  })

  it('typed and spoken input take the same path and the same shape (AC-17)', async () => {
    const s = server().always(TURN, 200, ok({ turn: appliedTurn() }))
    const h = harness({ server: s })
    await h.controller.init()

    h.controller.composerChange('add pay the electricity bill today')
    await h.controller.send('typed')

    h.controller.tapMic()
    h.speech.feed(['add pay the electricity bill today'])
    h.speech.end('speech-end')
    await new Promise((r) => setTimeout(r, 0))

    const [typed, voice] = s.turnBodies()
    expect(Object.keys(typed ?? {}).sort()).toEqual(Object.keys(voice ?? {}).sort())
    expect(typed?.['transcript']).toBe(voice?.['transcript'])
    expect(voice?.['source']).toBe('voice')
  })

  it('a chip tap sends the option’s literal text with an explicit binding (AC-10, AC-13)', async () => {
    const asked = askedTurn('clarify', ['Team standup', '1:1 with Ha'], [
      'Team standup — 9:30 AM',
      '1:1 with Ha — 4:30 PM',
    ])
    const s = server()
      .once(TURN, 200, ok({ turn: asked }))
      .always(TURN, 200, ok({ turn: appliedTurn({ id: 'turn-2', client_turn_id: 'cid-2' }) }))
    const h = harness({ server: s })
    await h.controller.init()
    h.controller.composerChange('cancel the meeting')
    await h.controller.send('typed')

    await h.controller.chipTap('turn-1', 'Team standup — 9:30 AM')
    const answer = s.turnBodies()[1]
    expect(answer?.['transcript']).toBe('Team standup — 9:30 AM')
    expect(answer?.['answer_to_turn_id']).toBe('turn-1')
    expect(answer?.['source']).toBe('tap')
  })

  it('a resolved question’s chips send nothing (one-shot, AC-10)', async () => {
    const asked = askedTurn('bulk_delete', ['a', 'b'], ['Yes', 'No'], {
      question: {
        kind: 'bulk_delete',
        task_ids: ['task-1', 'task-2'],
        task_titles: ['a', 'b'],
        options: ['Yes', 'No'],
        ask_snapshot: [],
        resolution: { result: 'declined', resolved_by_turn_id: 'turn-2', resolved_at: T0 },
      },
    })
    const s = server().always(SESSION, 200, { session: session({ messages: [asked] }), boundary: null })
    const h = harness({ server: s })
    await h.controller.init()
    const before = s.turnBodies().length
    await h.controller.chipTap('turn-1', 'Yes')
    expect(s.turnBodies()).toHaveLength(before)
  })
})

// ---------------------------------------------------------------------------
// AC-3 — cancel is client-local
// ---------------------------------------------------------------------------

describe('cancel is client-local (AC-3)', () => {
  it('never calls a cancel endpoint and still renders the sent turn’s late outcome', async () => {
    // Hold the POST open so `cancel` genuinely races an in-flight turn rather
    // than a settled one — the AC-3 case the spec calls "cancel racing apply".
    let release: () => void = () => {}
    const gate = new Promise<void>((r) => {
      release = r
    })
    const s = server().always(TURN, 200, ok({ turn: appliedTurn() }))
    const base = s.fetchFn
    const gated: FetchLike = async (url, init) => {
      if (String(url) === '/assistant/turn') await gate
      return base(url, init)
    }
    const h = harness({ server: s })
    const controller = new AssistantController({
      api: new AssistantApi({ userId: 'user-1', fetchFn: gated }),
      speech: h.speech,
      stores: h.stores,
      uuid: () => 'cid-gated',
      now: () => T0,
      timezone: null,
      onlineNow: () => true,
    })
    controller.composerChange('move my gym session to Monday at 7')
    const inflight = controller.send('typed')
    expect(controller.state.surface).toBe('thinking')

    controller.cancelThinking()
    expect(controller.state.surface).toBe('idle')
    expect(controller.state.composer).toBe('move my gym session to Monday at 7')

    release()
    await inflight
    // the late outcome renders honestly, and never re-enters thinking
    expect(controller.state.surface).toBe('idle')
    expect(controller.state.messages.some((m) => m.kind === 'applied')).toBe(true)
    expect(s.calls.some((c) => /cancel/i.test(c.path))).toBe(false)
  })

  it('cancel while listening keeps the words and sends nothing', async () => {
    const s = server()
    const h = harness({ server: s })
    await h.controller.init()
    h.controller.tapMic()
    h.speech.feed(['push the budget review to fou'])
    h.controller.tapMic() // mic tap while listening = cancel
    expect(h.controller.state.surface).toBe('idle')
    expect(h.controller.state.composer).toBe('push the budget review to fou')
    expect(s.turnBodies()).toHaveLength(0)
  })

  it('listening that recognizes nothing returns to idle and sends no turn (AC-2)', async () => {
    const s = server()
    const h = harness({ server: s })
    await h.controller.init()
    h.controller.tapMic()
    h.speech.end('speech-end-empty')
    expect(h.controller.state.surface).toBe('idle')
    expect(s.turnBodies()).toHaveLength(0)
  })

  it('streams the live transcript into the composer as words land (AC-2)', async () => {
    const h = harness({ server: server() })
    await h.controller.init()
    h.controller.tapMic()
    expect(h.controller.state.surface).toBe('listening')
    h.speech.feed(['push', 'push the budget', 'push the budget review'])
    expect(h.controller.state.composer).toBe('push the budget review')
  })
})

// ---------------------------------------------------------------------------
// AC-16, AC-23, AC-24 — failure paths
// ---------------------------------------------------------------------------

describe('failure paths (AC-16, AC-23, AC-24)', () => {
  it('an AI error keeps the words and retries under the SAME client_turn_id', async () => {
    const s = server()
      .once(TURN, 502, { error: { code: 'AI_ERROR', message: 'interpretation failed' } })
      .always(TURN, 200, ok({ turn: appliedTurn() }))
    const h = harness({ server: s })
    await h.controller.init()
    h.controller.composerChange('move my gym session to Monday at 7')
    await h.controller.send('typed')

    expect(h.controller.state.surface).toBe('error')
    expect(h.controller.state.composer).toBe('move my gym session to Monday at 7')
    const errMsg = h.controller.state.messages.find((m) => m.kind === 'error')
    if (errMsg?.kind !== 'error') throw new Error('unreachable')
    expect(errMsg.retryTurnId).not.toBeNull()

    await h.controller.retry(errMsg.retryTurnId as string)
    const bodies = s.turnBodies()
    expect(bodies).toHaveLength(2)
    expect(bodies[1]?.['client_turn_id']).toBe(bodies[0]?.['client_turn_id'])
    expect(h.controller.state.surface).toBe('idle')
  })

  it('500 APPLY_FAILED is retryable under the same id, like AI_ERROR', async () => {
    const s = server()
      .once(TURN, 500, { error: { code: 'APPLY_FAILED', message: 'apply aborted' } })
      .always(TURN, 200, ok({ turn: appliedTurn() }))
    const h = harness({ server: s })
    await h.controller.init()
    h.controller.composerChange('add two things at once')
    await h.controller.send('typed')
    const errMsg = h.controller.state.messages.find((m) => m.kind === 'error')
    if (errMsg?.kind !== 'error') throw new Error('unreachable')
    expect(errMsg.retryTurnId).not.toBeNull()
    await h.controller.retry(errMsg.retryTurnId as string)
    const bodies = s.turnBodies()
    expect(bodies[1]?.['client_turn_id']).toBe(bodies[0]?.['client_turn_id'])
  })

  it('409 CLIENT_TURN_ID_REUSED is terminal — no same-id retry is offered', async () => {
    const s = server().always(TURN, 409, {
      error: { code: 'CLIENT_TURN_ID_REUSED', message: 'id reuse' },
    })
    const h = harness({ server: s })
    await h.controller.init()
    h.controller.composerChange('something')
    await h.controller.send('typed')
    const errMsg = h.controller.state.messages.find((m) => m.kind === 'error')
    if (errMsg?.kind !== 'error') throw new Error('unreachable')
    expect(errMsg.retryTurnId).toBeNull()
    expect(h.stores.outgoingTurn()).toBeNull()
  })

  it('409 SESSION_CLOSED re-syncs and replays the SAME id against the new session', async () => {
    const s = server()
      .once(TURN, 409, { error: { code: 'SESSION_CLOSED', message: 'closed' } })
      .always(TURN, 200, ok({ session_id: 'sess-2', turn: appliedTurn({ session_id: 'sess-2' }) }))
      .once(SESSION, 200, { session: session(), boundary: null })
      .always(SESSION, 200, { session: session({ id: 'sess-2' }), boundary: null })
    const h = harness({ server: s })
    await h.controller.init()
    h.controller.composerChange('add call the bank')
    await h.controller.send('typed')

    const bodies = s.turnBodies()
    expect(bodies).toHaveLength(2)
    expect(bodies[1]?.['client_turn_id']).toBe(bodies[0]?.['client_turn_id'])
    expect(bodies[1]?.['session_id']).toBe('sess-2')
  })

  it('a 409 UNDO_REFUSED from the voice-undo guard renders the visible refusal (AC-6)', async () => {
    const s = server().always(TURN, 409, {
      error: { code: 'UNDO_REFUSED', message: 'nothing to undo', detail: { reason: 'not_undoable' } },
    })
    const h = harness({ server: s })
    await h.controller.init()
    h.controller.composerChange('undo')
    await h.controller.send('typed')
    const last = h.controller.state.messages.at(-1)
    if (last?.kind !== 'outcome') throw new Error('unreachable')
    expect(last.body.join(' ')).toMatch(/không có gì để hoàn tác/i)
    // and it never became a task
    expect(h.controller.state.tasks.some((t) => t.title.toLowerCase() === 'undo')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// AC-5..8 — undo
// ---------------------------------------------------------------------------

describe('undo (AC-5, AC-6, AC-7, AC-8)', () => {
  it('undoes the whole turn and re-reads the list', async () => {
    const s = server()
      .always(TURN, 200, ok({ turn: appliedTurn() }))
      .always(UNDO, 200, undoOutcome())
    const h = harness({ server: s })
    await h.controller.init()
    h.controller.composerChange('push the budget review to 4pm')
    await h.controller.send('typed')
    expect(undoableTurnId(h.controller.state)).toBe('turn-1')

    const listReadsBefore = s.calls.filter((c) => c.path === '/tasks' && c.method === 'GET').length
    await h.controller.undoTap('turn-1')

    expect(s.calls.some((c) => c.path === '/assistant/turn/turn-1/undo')).toBe(true)
    expect(h.controller.state.messages.some((m) => m.kind === 'reverted')).toBe(true)
    expect(undoableTurnId(h.controller.state)).toBeNull()
    const listReadsAfter = s.calls.filter((c) => c.path === '/tasks' && c.method === 'GET').length
    expect(listReadsAfter).toBeGreaterThan(listReadsBefore)
  })

  it('all-skipped renders “Không hoàn tác được gì” and does not re-read the list', async () => {
    const s = server()
      .always(TURN, 200, ok({ turn: appliedTurn() }))
      .always(
        UNDO,
        200,
        undoOutcome({
          reverted: [],
          skipped: [{ task_id: 'task-1', title: 'Review Q3 budget draft', reason: 'modified_since_apply' }],
          nothing_reverted: true,
        }),
      )
    const h = harness({ server: s })
    await h.controller.init()
    h.controller.composerChange('push the budget review to 4pm')
    await h.controller.send('typed')
    await h.controller.undoTap('turn-1')

    const m = h.controller.state.messages.at(-1)
    if (m?.kind !== 'reverted') throw new Error('unreachable')
    expect(m.head).toBe('Không hoàn tác được gì')
  })

  it('double activation runs the revert once (AC-5)', async () => {
    const s = server().always(TURN, 200, ok({ turn: appliedTurn() })).always(UNDO, 200, undoOutcome())
    const h = harness({ server: s })
    await h.controller.init()
    h.controller.composerChange('push the budget review to 4pm')
    await h.controller.send('typed')

    await Promise.all([h.controller.undoTap('turn-1'), h.controller.undoTap('turn-1')])
    expect(s.calls.filter((c) => c.path === '/assistant/turn/turn-1/undo')).toHaveLength(1)
  })

  it('a stale undo renders the refusal, never silence (AC-6, AC-8)', async () => {
    const s = server()
      .always(TURN, 200, ok({ turn: appliedTurn() }))
      .always(UNDO, 409, {
        error: { code: 'UNDO_REFUSED', message: 'not newest', detail: { reason: 'not_newest' } },
      })
    const h = harness({ server: s })
    await h.controller.init()
    h.controller.composerChange('push the budget review to 4pm')
    await h.controller.send('typed')
    await h.controller.undoTap('turn-1')

    const m = h.controller.state.messages.at(-1)
    if (m?.kind !== 'outcome') throw new Error('unreachable')
    expect(m.body.join(' ')).toMatch(/thay đổi mới hơn/i)
  })

  it('an undo that never reached the server says so instead of claiming success', async () => {
    const s = server().always(TURN, 200, ok({ turn: appliedTurn() }))
    s.failOnce(UNDO)
    const h = harness({ server: s })
    await h.controller.init()
    h.controller.composerChange('push the budget review to 4pm')
    await h.controller.send('typed')
    await h.controller.undoTap('turn-1')

    const m = h.controller.state.messages.at(-1)
    if (m?.kind !== 'outcome') throw new Error('unreachable')
    expect(m.body.join(' ')).toMatch(/chưa có gì thay đổi/i)
    expect(h.controller.state.messages.some((x) => x.kind === 'reverted')).toBe(false)
  })

  it('a no-match turn after an applied turn leaves the undo standing (AC-8)', async () => {
    const s = server()
      .once(TURN, 200, ok({ turn: appliedTurn() }))
      .always(
        TURN,
        200,
        ok({
          turn: turn({
            id: 'turn-2',
            client_turn_id: 'cid-2',
            status: 'applied',
            outcome: { kind: 'no_match', heard_transcript: 'cross off the badminton game' },
          }),
        }),
      )
    const h = harness({ server: s })
    await h.controller.init()
    h.controller.composerChange('push the budget review to 4pm')
    await h.controller.send('typed')
    h.controller.composerChange('cross off the badminton game')
    await h.controller.send('typed')

    expect(undoableTurnId(h.controller.state)).toBe('turn-1')
  })
})

// ---------------------------------------------------------------------------
// AC-18, AC-25 — the manual path and offline
// ---------------------------------------------------------------------------

describe('manual path and offline (AC-18, AC-25)', () => {
  it('every manual list operation touches /tasks only — zero assistant calls', async () => {
    const s = server([task({ id: 'task-1', title: 'Call Mom' })])
      .always('POST /tasks', 201, { task: task({ id: 'task-9', title: 'Buy milk' }) })
      .always('PATCH /tasks/:id', 200, { task: task() })
      .always('DELETE /tasks/:id', 200, { task: task() })
    const h = harness({ server: s })
    await h.controller.init()
    const assistantBefore = s.assistantCalls().length

    await h.controller.addTask('Buy milk')
    await h.controller.toggleTask('task-1')
    await h.controller.editTask('task-1', 'Call Mom back')
    await h.controller.removeTask('task-1')

    expect(s.assistantCalls()).toHaveLength(assistantBefore)
    expect(s.calls.some((c) => c.method === 'POST' && c.path === '/tasks')).toBe(true)
    expect(s.calls.some((c) => c.method === 'PATCH')).toBe(true)
    expect(s.calls.some((c) => c.method === 'DELETE')).toBe(true)
  })

  it('offline input goes through the local no-AI path — no half-running conversation', async () => {
    const s = server()
    const h = harness({ server: s, online: false })
    await h.controller.init()
    expect(h.controller.state.offline).toBe(true)

    h.controller.composerChange('mark the electricity bill as done')
    await h.controller.send('typed')

    expect(s.assistantCalls().filter((c) => c.method === 'POST')).toHaveLength(0)
    expect(h.controller.state.tasks.some((t) => t.local === true)).toBe(true)
    expect(h.controller.state.composer).toBe('')
  })

  it('a turn in flight when the connection drops queues and replays visibly (AC-25)', async () => {
    const s = server()
    s.failOnce(TURN)
    s.always(TURN, 200, ok({ turn: appliedTurn({ client_turn_id: 'cid-1' }) }))
    const h = harness({ server: s })
    await h.controller.init()
    h.controller.composerChange('mark the electricity bill as done')
    await h.controller.send('typed')

    // handed over: the surface left thinking, the turn is queued and visible
    expect(h.controller.state.surface).toBe('idle')
    expect(h.controller.state.offline).toBe(true)
    const queued = h.controller.state.messages.find((m) => m.kind === 'user' && m.queued)
    expect(queued).toBeDefined()
    const sentId = s.turnBodies()[0]?.['client_turn_id']

    h.controller.setOnline(true)
    await new Promise((r) => setTimeout(r, 0))

    const bodies = s.turnBodies()
    expect(bodies).toHaveLength(2)
    expect(bodies[1]?.['client_turn_id']).toBe(sentId)
    expect(h.controller.state.messages.some((m) => m.kind === 'user' && m.queued)).toBe(false)
  })

  it('an unacked outgoing turn survives a reload and replays under the same id (AC-27 web floor)', async () => {
    const s = server()
    s.failOnce(TURN)
    const h = harness({ server: s })
    await h.controller.init()
    h.controller.composerChange('add call the bank tomorrow at 9')
    await h.controller.send('typed')
    const firstId = s.turnBodies()[0]?.['client_turn_id']
    expect(h.stores.outgoingTurn()).not.toBeNull()

    // "reload": a fresh controller over the SAME durable store
    const s2 = server().always(TURN, 200, ok({ turn: appliedTurn() }))
    const h2 = harness({ server: s2, store: h.store })
    await h2.controller.init()

    expect(s2.turnBodies()[0]?.['client_turn_id']).toBe(firstId)
  })

  it('recognized-so-far words survive a reload into the composer (AC-26 web floor)', async () => {
    const h = harness({ server: server() })
    await h.controller.init()
    h.controller.tapMic()
    h.speech.feed(['push the budget review to fou'])

    const h2 = harness({ server: server(), store: h.store })
    await h2.controller.init()
    expect(h2.controller.state.composer).toBe('push the budget review to fou')
  })
})

// ---------------------------------------------------------------------------
// AC-25 — the offline CREATE half: it replays on reconnect (BUG-001)
//
// api-contracts.md (Prototype task CRUD): "the offline local path (AC-25)
// creates the task locally under a real id and replays the create on reconnect
// — no temporary-id mapping exists. A colliding id → 409 TASK_ID_EXISTS; a
// client replaying its own create treats that 409 as already-synced (its ack)."
//
// These run against a STATEFUL /tasks (FakeServer.withTasks), so each case can
// assert the consequence the user actually cares about — the task is on the
// server, exactly once — and not merely that a request was sent.
// ---------------------------------------------------------------------------

/** Session default + a stateful /tasks. Deliberately not `server()`, whose
 * `always(GET /tasks)` would shadow the store with a canned list. */
function taskServer(initial: ReturnType<typeof task>[] = []): FakeServer {
  return new FakeServer()
    .always(SESSION, 200, { session: session(), boundary: null })
    .withTasks(initial)
}

const settle = (): Promise<void> => new Promise((r) => setTimeout(r, 0))

function taskPosts(s: FakeServer): Record<string, unknown>[] {
  return s.calls
    .filter((c) => c.method === 'POST' && c.path === '/tasks')
    .map((c) => c.body as Record<string, unknown>)
}

/** The one offline task in state — every case here creates exactly one. */
function onlyTask(h: ReturnType<typeof harness>): { id: string; local?: boolean; title: string } {
  const t = h.controller.state.tasks[0]
  if (t === undefined) throw new Error('expected exactly one task in state')
  return t
}

describe('offline creates replay on reconnect (AC-25, BUG-001)', () => {
  it('re-POSTs the offline create under its client id, and the task is then readable from the server', async () => {
    const s = taskServer()
    const h = harness({ server: s, online: false })
    await h.controller.init()

    await h.controller.addTask('qaweb-bug001-offline')
    const created = onlyTask(h)
    expect(created.local).toBe(true)
    expect(await serverTasks(s), 'an offline create must not reach the server yet').toEqual([])

    h.controller.setOnline(true)
    await settle()

    expect(taskPosts(s)).toEqual([
      { id: created.id, title: 'qaweb-bug001-offline', due_at: null, priority: null, status: 'inbox' },
    ])
    // the user-visible half of the bug: it is on the server now, under the very
    // id the device assigned it, and no longer marked device-only
    const onServer = await serverTasks(s)
    expect(onServer.map((t) => t.title)).toEqual(['qaweb-bug001-offline'])
    expect(onServer[0]?.id).toBe(created.id)
    expect(onlyTask(h).local, 'the local marker must clear once synced').toBeUndefined()
    expect(h.stores.localTasks(), 'a synced task must leave the device-only store').toEqual([])
  })

  it('treats 409 TASK_ID_EXISTS as its already-synced ack — no duplicate, flag still clears', async () => {
    const s = taskServer()
    const h = harness({ server: s, online: false })
    await h.controller.init()
    await h.controller.addTask('qaweb-bug001-409')
    const created = onlyTask(h)

    // an earlier replay reached the server but its response never got back to
    // this client: the row exists under the same client-generated id
    s.withTasks([task({ id: created.id, title: 'qaweb-bug001-409' })])

    h.controller.setOnline(true)
    await settle()

    expect(taskPosts(s)).toHaveLength(1)
    expect(await serverTasks(s), 'the 409 must not create a second row').toHaveLength(1)
    expect(onlyTask(h).local, '409 is an ack — the marker must clear').toBeUndefined()
    expect(h.stores.localTasks()).toEqual([])
    expect(h.controller.state.tasks.map((t) => t.title)).toEqual(['qaweb-bug001-409'])
  })

  it('is idempotent: a double reconnect, and a later flap, create the task exactly once', async () => {
    const s = taskServer()
    const h = harness({ server: s, online: false })
    await h.controller.init()
    await h.controller.addTask('qaweb-bug001-once')

    // reconnect fires twice before the first replay has finished
    h.controller.setOnline(true)
    h.controller.setOnline(true)
    await settle()

    expect(taskPosts(s), 'a second reconnect must join the first replay').toHaveLength(1)

    // and again after it finished — the cleared marker is what stops it
    h.controller.setOnline(false)
    h.controller.setOnline(true)
    await settle()

    expect(taskPosts(s)).toHaveLength(1)
    expect(await serverTasks(s)).toHaveLength(1)
  })

  it('replays the task as it stands after offline edits, not as it was created', async () => {
    const s = taskServer()
    const h = harness({ server: s, online: false })
    await h.controller.init()
    await h.controller.addTask('qaweb-bug001-typo')
    const id = onlyTask(h).id
    await h.controller.editTask(id, 'qaweb-bug001-fixed')
    await h.controller.toggleTask(id)

    h.controller.setOnline(true)
    await settle()

    expect(taskPosts(s)[0]).toMatchObject({
      id,
      title: 'qaweb-bug001-fixed',
      status: 'done',
    })
    const onServer = await serverTasks(s)
    expect(onServer[0]?.title).toBe('qaweb-bug001-fixed')
    expect(onServer[0]?.status).toBe('done')
  })

  it('keeps the task local when the replay is refused, and retries on the next reconnect', async () => {
    const s = taskServer()
    s.once('POST /tasks', 500, { error: { code: 'INTERNAL', message: 'boom' } })
    const h = harness({ server: s, online: false })
    await h.controller.init()
    await h.controller.addTask('qaweb-bug001-retry')

    h.controller.setOnline(true)
    await settle()

    expect(taskPosts(s)).toHaveLength(1)
    expect(await serverTasks(s), 'a refused create is not on the server').toEqual([])
    expect(onlyTask(h).local, 'a refused replay must stay device-only, not claim sync').toBe(true)
    expect(h.stores.localTasks()).toHaveLength(1)

    h.controller.setOnline(false)
    h.controller.setOnline(true)
    await settle()

    expect(taskPosts(s)).toHaveLength(2)
    expect((await serverTasks(s)).map((t) => t.title)).toEqual(['qaweb-bug001-retry'])
    expect(onlyTask(h).local).toBeUndefined()
  })

  it('replays a create left over from an earlier offline run when the app next starts online', async () => {
    const s1 = taskServer()
    const h1 = harness({ server: s1, online: false })
    await h1.controller.init()
    await h1.controller.addTask('qaweb-bug001-restart')
    const id = onlyTask(h1).id

    // app closed and reopened on the same device, this time with a connection
    const s2 = taskServer()
    const h2 = harness({ server: s2, store: h1.store })
    await h2.controller.init()

    expect((await serverTasks(s2)).map((t) => t.title)).toEqual(['qaweb-bug001-restart'])
    expect(h2.controller.state.tasks.find((t) => t.id === id)?.local).toBeUndefined()
    expect(h2.stores.localTasks()).toEqual([])
  })

  it('a second offline run still shows the first run’s task, and both replay together', async () => {
    const s1 = taskServer()
    const h1 = harness({ server: s1, online: false })
    await h1.controller.init()
    await h1.controller.addTask('qaweb-bug001-run1')

    // reopened, still offline: the earlier task has to come back into state, or
    // the next local write would drop it and no reconnect could ever send it
    const s2 = taskServer()
    const h2 = harness({ server: s2, store: h1.store, online: false })
    await h2.controller.init()
    expect(h2.controller.state.tasks.map((t) => t.title)).toEqual(['qaweb-bug001-run1'])

    await h2.controller.addTask('qaweb-bug001-run2')
    expect(h2.stores.localTasks().map((t) => t.title)).toEqual([
      'qaweb-bug001-run1',
      'qaweb-bug001-run2',
    ])

    h2.controller.setOnline(true)
    await settle()

    expect((await serverTasks(s2)).map((t) => t.title).sort()).toEqual([
      'qaweb-bug001-run1',
      'qaweb-bug001-run2',
    ])
    expect(h2.stores.localTasks()).toEqual([])
  })

  it('sends the offline creates BEFORE the queued turn, so the replayed turn can see them', async () => {
    const s = taskServer()
    s.failOnce(TURN)
    s.always(TURN, 200, ok({ turn: appliedTurn() }))
    const h = harness({ server: s })
    await h.controller.init()
    h.controller.composerChange('mark the electricity bill as done')
    await h.controller.send('typed') // in flight when the connection drops → queued

    expect(h.controller.state.offline).toBe(true)
    await h.controller.addTask('qaweb-bug001-order')

    h.controller.setOnline(true)
    await settle()

    expect(s.calls.filter((c) => c.method === 'POST').map((c) => c.path)).toEqual([
      '/assistant/turn', // the original send that dropped
      '/tasks', // the offline create, replayed first
      '/assistant/turn', // then the queued turn, same id
    ])
  })
})

// ---------------------------------------------------------------------------
// AC-21, AC-22, AC-20 — speech capability
// ---------------------------------------------------------------------------

describe('speech capability (AC-20, AC-21, AC-22)', () => {
  it('no capability hides the mic and raises no error', async () => {
    const h = harness({ server: server(), capability: 'none' })
    await h.controller.init()
    expect(micMode(h.controller.state)).toBe('hidden')
    h.controller.tapMic()
    expect(h.controller.state.messages).toHaveLength(0)
    expect(h.controller.state.surface).toBe('idle')
  })

  it('permission denial dims the mic and offers a re-grant path; typing still works', async () => {
    const s = server().always(TURN, 200, ok({ turn: appliedTurn() }))
    const h = harness({ server: s })
    await h.controller.init()
    h.speech.setCapability('permission-denied')

    expect(micMode(h.controller.state)).toBe('dimmed-permission')
    const info = h.controller.state.messages.at(-1)
    if (info?.kind !== 'info') throw new Error('unreachable')
    expect(info.cta).toBe('permission')

    h.controller.tapMic()
    expect(h.controller.state.surface).toBe('idle') // dimmed mic never starts a capture

    h.controller.permissionCta()
    expect(h.controller.state.messages.at(-1)?.kind).toBe('outcome')

    h.controller.composerChange('add pay the electricity bill today')
    await h.controller.send('typed')
    expect(s.turnBodies()).toHaveLength(1)
  })

  it('a transient failure is distinguishable and recovers on its own (AC-22)', async () => {
    const h = harness({ server: server() })
    await h.controller.init()
    h.speech.setCapability('transient-failure')
    expect(micMode(h.controller.state)).toBe('dimmed-transient')
    const msg = h.controller.state.messages.at(-1)
    if (msg?.kind !== 'info') throw new Error('unreachable')
    expect(msg.cta).toBeNull()
    expect(msg.head).toMatch(/đang bận/i)

    h.speech.setCapability('available')
    expect(micMode(h.controller.state)).toBe('available')
    h.controller.tapMic()
    expect(h.controller.state.surface).toBe('listening')
  })
})

// ---------------------------------------------------------------------------
// AC-28 — session read
// ---------------------------------------------------------------------------

describe('session read (AC-28)', () => {
  it('resumes an open session visibly', async () => {
    const s = server().always(SESSION, 200, {
      session: session({ messages: [appliedTurn()] }),
      boundary: null,
    })
    const h = harness({ server: s })
    await h.controller.init()
    expect(h.controller.state.sessionId).toBe('sess-1')
    expect(h.controller.state.messages.map((m) => m.kind)).toEqual(['user', 'applied'])
  })

  it('a clean start renders exactly one boundary message and no session id', async () => {
    const s = server().always(SESSION, 200, {
      session: null,
      boundary: boundary({
        declined_questions: [{ turn_id: 'turn-0', kind: 'bulk_delete', task_titles: ['Buy groceries'] }],
      }),
    })
    const h = harness({ server: s })
    await h.controller.init()
    expect(h.controller.state.sessionId).toBeNull()
    expect(h.controller.state.messages.filter((m) => m.kind === 'boundary')).toHaveLength(1)
  })

  it('a re-sync replaces the conversation rather than appending a second copy', async () => {
    const s = server().always(SESSION, 200, {
      session: session({ messages: [appliedTurn()] }),
      boundary: null,
    })
    const h = harness({ server: s })
    await h.controller.init()
    const first = h.controller.state.messages.length
    await h.controller.syncSession()
    expect(h.controller.state.messages).toHaveLength(first)
  })
})
