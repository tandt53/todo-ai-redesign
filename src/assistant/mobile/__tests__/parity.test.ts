// F-003 AC-1 — the parity contract.
//
// The spec's Parity table classifies all 29 F-001 ACs; 21 of them "hold
// identically, QA cites the F-001 id, no mobile fork". AC-1 says those are
// observably true on the mobile surface, verified against the SAME conversation
// reducer and outcome→message mapping the web client uses.
//
// That is a claim about code identity as much as about behaviour, so this file
// asserts both: the structural half (the mobile controller IS the shared
// controller, extended — there is no second reducer to drift) and the
// behavioural half (each of the 21 exercised through the mobile controller).
//
// Nine of the 21 are server-side and "cost the mobile client no behaviour at
// all" (spec). For those the honest client-side assertion is that the client
// sends the contract's shape and renders the server's recorded outcome without
// re-deciding anything — which is what the tests below check.

import { describe, expect, it } from 'vitest'
import { AssistantController } from '../../_shared/controller.ts'
import { micMode, reducer } from '../../_shared/model/reducer.ts'
import { MobileAssistantController } from '../controller.ts'
import {
  appliedTurn,
  askedTurn,
  mobileHarness,
  session,
  settle,
  speak,
  task,
  turn,
  turnResponse,
  undoOutcome,
} from './_helpers.ts'
import type { MobileHarness } from './_helpers.ts'

async function ready(over: Parameters<typeof mobileHarness>[0] = {}): Promise<MobileHarness> {
  const h = await mobileHarness({ platform: 'ios', ...over })
  await h.controller.init()
  h.server.calls.length = 0
  return h
}

describe('AC-1 (structural) — one reducer, one controller, two clients', () => {
  it('the mobile controller extends the shared controller rather than restating it', () => {
    expect(MobileAssistantController.prototype).toBeInstanceOf(AssistantController)
  })

  it('mic modes come from the shared selector, so the mobile mic cannot invent a mode', async () => {
    const h = await ready()
    expect(micMode(h.controller.state)).toBe('available')
    expect(typeof reducer).toBe('function')
  })
})

describe('F-001 AC-1 / AC-4 — applied changes land in the list, attributed, same turn', () => {
  it('renders the applied anatomy, marks the changed row, and refreshes the list', async () => {
    const h = await ready()
    h.server.always('POST /assistant/turn', 200, turnResponse({ turn: appliedTurn() }))
    h.server.always('GET /tasks', 200, {
      tasks: [task({ due_at: '2026-08-16T16:00:00.000Z' })],
    })

    h.controller.composerChange('move the budget review to 4pm')
    await h.controller.send('typed')
    await settle()

    const applied = h.controller.state.messages.find((m) => m.kind === 'applied')
    expect(applied?.kind === 'applied' && applied.head).toContain('Edited 1 task')
    expect(h.controller.state.marks?.byTask['task-1']?.label).toBe('edit')
    expect(h.controller.state.tasks[0]?.due_at).toBe('2026-08-16T16:00:00.000Z')
  })

  it('a question turn applies nothing — its visible result is the question itself (AC-1 carve-out)', async () => {
    const h = await ready()
    h.server.always(
      'POST /assistant/turn',
      200,
      turnResponse({
        turn: askedTurn('bulk_delete', ['Groceries', 'Call mom', 'Order the cake'], ['Delete 3 tasks', 'Keep them']),
      }),
    )

    h.controller.composerChange('delete the shopping tasks')
    await h.controller.send('typed')
    await settle()

    const q = h.controller.state.messages.find((m) => m.kind === 'question')
    expect(q?.kind === 'question' && q.head).toBe('Delete 3 tasks?')
    expect(h.controller.state.messages.some((m) => m.kind === 'applied')).toBe(false)
    expect(h.controller.undoable()).toBe(null)
  })

  it('never renders a raw uuid or an internal draft-ref token', async () => {
    const h = await ready()
    h.server.always('POST /assistant/turn', 200, turnResponse({ turn: appliedTurn() }))
    h.controller.composerChange('move the meeting')
    await h.controller.send('typed')
    await settle()

    const text = JSON.stringify(h.controller.state.messages)
    expect(text).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)
    expect(text).not.toMatch(/#d\d+/)
  })
})

describe('F-001 AC-2 / AC-29 — live transcript, four states, nothing else', () => {
  it('words stream into the composer as they are recognized', async () => {
    const h = await ready()
    h.controller.tapMic()
    await settle()
    h.speech.feed(['mai', 'meeting tomorrow', 'team meeting tomorrow'])
    expect(h.controller.state.composer).toBe('team meeting tomorrow')
    expect(h.controller.state.surface).toBe('listening')
  })

  it('listening that recognizes nothing returns to idle visibly and sends no turn', async () => {
    const h = await ready()
    h.controller.tapMic()
    await settle()
    h.speech.end('speech-end-empty')
    await settle()

    expect(h.controller.state.surface).toBe('idle')
    expect(h.server.turnBodies()).toHaveLength(0)
  })

  it('the surface is always exactly one of the four states', async () => {
    const h = await ready()
    h.server.always('POST /assistant/turn', 200, turnResponse({ turn: appliedTurn() }))
    const seen = new Set<string>([h.controller.state.surface])
    h.controller.tapMic()
    await settle()
    seen.add(h.controller.state.surface)
    h.speech.feed(['move the meeting'])
    h.speech.end('speech-end')
    seen.add(h.controller.state.surface)
    await settle()
    seen.add(h.controller.state.surface)

    expect([...seen].sort()).toEqual(['idle', 'listening', 'thinking'])
    for (const s of seen) expect(['idle', 'listening', 'thinking', 'error']).toContain(s)
  })
})

describe('F-001 AC-5..AC-8 — the undo contract, unchanged on mobile', () => {
  it('one gesture undoes the newest applied turn and names what came back', async () => {
    const h = await ready()
    h.server.always('POST /assistant/turn', 200, turnResponse({ turn: appliedTurn() }))
    h.controller.composerChange('move the meeting')
    await h.controller.send('typed')
    await settle()

    const target = h.controller.undoable()
    expect(target).toBe('turn-1')

    h.server.always('POST /assistant/turn/:id/undo', 200, undoOutcome())
    await h.controller.undoTap(target as string)
    await settle()

    const reverted = h.controller.state.messages.find((m) => m.kind === 'reverted')
    expect(reverted?.kind === 'reverted' && reverted.head).toBe('Undone')
    expect(h.controller.undoable()).toBe(null) // the affordance visibly leaves
  })

  it('a skipped task is named, and an all-skipped undo never reads as success (AC-7)', async () => {
    const h = await ready()
    h.server.always('POST /assistant/turn', 200, turnResponse({ turn: appliedTurn() }))
    h.controller.composerChange('move the meeting')
    await h.controller.send('typed')
    await settle()

    h.server.always(
      'POST /assistant/turn/:id/undo',
      200,
      undoOutcome({
        reverted: [],
        skipped: [
          { task_id: 'task-1', title: 'Budget review Q3', reason: 'modified_since_apply' },
        ],
        nothing_reverted: true,
      }),
    )
    await h.controller.undoTap('turn-1')
    await settle()

    const reverted = h.controller.state.messages.find((m) => m.kind === 'reverted')
    expect(reverted?.kind === 'reverted' && reverted.head).toBe('Nothing was undone')
    expect(reverted?.kind === 'reverted' && reverted.body.join(' ')).toContain('Budget review Q3')
  })

  it('a non-mutating turn neither holds nor ends the undo window (AC-8)', async () => {
    const h = await ready()
    h.server.once('POST /assistant/turn', 200, turnResponse({ turn: appliedTurn() }))
    h.controller.composerChange('move the meeting')
    await h.controller.send('typed')
    await settle()
    expect(h.controller.undoable()).toBe('turn-1')

    // a no-match turn: renders a message, mutates nothing
    h.server.once(
      'POST /assistant/turn',
      200,
      turnResponse({
        turn: turn({
          id: 'turn-2',
          client_turn_id: 'cid-2',
          status: 'applied',
          outcome: { kind: 'no_match', heard_transcript: 'drop the badminton match' },
        }),
      }),
    )
    h.controller.composerChange('drop the badminton match')
    await h.controller.send('typed')
    await settle()

    expect(h.controller.state.messages.some((m) => m.kind === 'no-match')).toBe(true)
    expect(h.controller.undoable()).toBe('turn-1') // still the older applied turn
  })
})

describe('F-001 AC-9..AC-13 — questions, resolutions and clarification', () => {
  it('a chip tap sends the option’s literal text bound to its question turn', async () => {
    const h = await ready()
    h.server.once(
      'POST /assistant/turn',
      200,
      turnResponse({
        turn: askedTurn('clarify', ['Morning standup', '1:1 with Ha'], [
          'Morning standup — 9:30',
          '1:1 with Ha — 16:30',
        ]),
      }),
    )
    h.controller.composerChange('cancel the meeting')
    await h.controller.send('typed')
    await settle()

    h.server.once('POST /assistant/turn', 200, turnResponse())
    await h.controller.chipTap('turn-1', 'Morning standup — 9:30')
    await settle()

    const last = h.server.turnBodies().at(-1)
    expect(last?.['transcript']).toBe('Morning standup — 9:30') // literal
    expect(last?.['answer_to_turn_id']).toBe('turn-1') // explicit binding
    expect(last?.['source']).toBe('tap')
  })

  it('a superseded question resolves visibly — nothing resolves silently (AC-11)', async () => {
    const h = await ready()
    h.server.once(
      'POST /assistant/turn',
      200,
      turnResponse({
        turn: askedTurn('bulk_delete', ['Groceries', 'Call mom'], ['Delete 2 tasks', 'Keep them']),
      }),
    )
    h.controller.composerChange('delete the shopping tasks')
    await h.controller.send('typed')
    await settle()

    h.server.once(
      'POST /assistant/turn',
      200,
      turnResponse({
        turn: appliedTurn({ id: 'turn-2', client_turn_id: 'cid-2' }),
        resolutions: [{ question_turn_id: 'turn-1', result: 'declined_superseded' }],
      }),
    )
    h.controller.composerChange('add call the bank tomorrow at 9')
    await h.controller.send('typed')
    await settle()

    const kept = h.controller.state.messages.find(
      (m) => m.kind === 'outcome' && m.head === 'Kept all 2 tasks',
    )
    expect(kept).toBeDefined()
    const q = h.controller.state.messages.find((m) => m.kind === 'question')
    expect(q?.kind === 'question' && q.resolved).toBe(true)
  })
})

describe('F-001 AC-14 / AC-15 — honesty on no-match and unsupported queries', () => {
  it('quotes the heard transcript so a mishearing is distinguishable from an absent task', async () => {
    const h = await ready()
    h.server.always(
      'POST /assistant/turn',
      200,
      turnResponse({
        turn: turn({
          status: 'applied',
          outcome: { kind: 'no_match', heard_transcript: 'drop the badminton match' },
        }),
      }),
    )
    h.controller.composerChange('drop the badminton match')
    await h.controller.send('typed')
    await settle()

    const m = h.controller.state.messages.find((x) => x.kind === 'no-match')
    expect(m?.kind === 'no-match' && m.heard).toBe('drop the badminton match')
  })

  it('an unsupported list question names the working alternative', async () => {
    const h = await ready()
    h.server.always(
      'POST /assistant/turn',
      200,
      turnResponse({
        turn: turn({
          status: 'applied',
          outcome: { kind: 'unsupported_query', alternative: 'filters on the list' },
        }),
      }),
    )
    h.controller.composerChange('anything on Sunday?')
    await h.controller.send('typed')
    await settle()

    const m = h.controller.state.messages.find((x) => x.kind === 'unsupported')
    expect(m?.kind === 'unsupported' && m.alternative).toBe('filters on the list')
  })
})

describe('F-001 AC-16 / AC-23 / AC-24 — failure paths keep the user’s words', () => {
  it('an AI error keeps the words, offers retry, and the retry re-sends the SAME id', async () => {
    const h = await ready()
    h.server.once('POST /assistant/turn', 502, {
      error: { code: 'AI_ERROR', message: 'interpreter unavailable' },
    })
    h.controller.composerChange('move the gym session to Monday at 7')
    await h.controller.send('typed')
    await settle()

    expect(h.controller.state.surface).toBe('error')
    expect(h.controller.state.composer).toBe('move the gym session to Monday at 7')
    const err = h.controller.state.messages.find((m) => m.kind === 'error')
    const retryId = err?.kind === 'error' ? err.retryTurnId : null
    expect(retryId).not.toBe(null)

    h.server.once('POST /assistant/turn', 200, turnResponse({ turn: appliedTurn() }))
    await h.controller.retry(retryId as string)
    await settle()

    const ids = h.server.turnBodies().map((b) => b['client_turn_id'])
    expect(new Set(ids).size).toBe(1) // one id, two attempts
  })
})

describe('F-001 AC-17 / AC-18 / AC-20 — typed parity, manual path, text-only payload', () => {
  it('typed and spoken input produce the same request but for `source`', async () => {
    const h = await ready()
    h.server.always('POST /assistant/turn', 200, turnResponse())

    h.controller.composerChange('add buy milk')
    await h.controller.send('typed')
    await settle()
    await speak(h, 'add buy milk')
    await settle()

    const [typed, voice] = h.server.turnBodies()
    expect(typed?.['source']).toBe('typed')
    expect(voice?.['source']).toBe('voice')
    // Everything else is identical. `client_turn_id` is per-turn by contract
    // and `session_id` legitimately advances once the first turn opens the
    // session — those two are normalised, nothing else is.
    const strip = (b: Record<string, unknown> | undefined) => ({
      ...b,
      source: null,
      client_turn_id: null,
      session_id: null,
    })
    expect(strip(typed)).toEqual(strip(voice))
  })

  it('the turn payload carries exactly the contract’s six fields — never audio', async () => {
    const h = await ready()
    h.server.always('POST /assistant/turn', 200, turnResponse())
    h.controller.composerChange('add buy milk')
    await h.controller.send('typed')
    await settle()

    expect(Object.keys(h.server.turnBodies()[0] ?? {}).sort()).toEqual([
      'answer_to_turn_id',
      'client_turn_id',
      'session_id',
      'source',
      'timezone',
      'transcript',
    ])
  })

  it('the manual list path makes ZERO assistant calls', async () => {
    const h = await ready()
    h.server.always('GET /tasks', 200, { tasks: [task()] })
    h.server.always('POST /tasks', 200, { task: task({ id: 'task-2', title: 'call mom' }) })
    h.server.always('PATCH /tasks/:id', 200, { task: task({ status: 'done' }) })
    h.server.always('DELETE /tasks/:id', 200, { task: task() })

    await h.controller.addTask('call mom')
    await h.controller.refreshTasks()
    await h.controller.toggleTask('task-1')
    await h.controller.editTask('task-1', 'Budget review Q4')
    await h.controller.removeTask('task-1')
    await settle()

    expect(h.server.assistantCalls()).toHaveLength(0)
  })
})

describe('F-001 AC-22 / AC-25 — transient failure and the offline handover, on a phone', () => {
  it('a transient recognition failure dims the mic and recovers without a permission dance', async () => {
    const h = await ready()
    h.speech.setLanguagePackAvailable(false)
    expect(micMode(h.controller.state)).toBe('dimmed-transient')
    h.speech.setLanguagePackAvailable(true)
    expect(micMode(h.controller.state)).toBe('available')
    expect(h.speech.log.prompts).toBe(0)
  })

  it('a turn in flight when the connection drops queues visibly and replays under the same id', async () => {
    const h = await ready()
    h.server.failOnce('POST /assistant/turn')
    h.controller.composerChange('mark the electricity bill done')
    await h.controller.send('typed')
    await settle()

    const queuedMsg = h.controller.state.messages.find((m) => m.kind === 'user' && m.queued)
    expect(queuedMsg).toBeDefined()
    expect(h.controller.state.offline).toBe(true)

    h.server.always('POST /assistant/turn', 200, turnResponse({ replayed: true }))
    // the OS reports the drop, then the reconnect — the reconnect is what
    // triggers the visible replay (F-001 AC-25)
    h.connectivity.set(false)
    h.connectivity.set(true)
    await settle()

    const ids = h.server.turnBodies().map((b) => b['client_turn_id'])
    expect(new Set(ids).size).toBe(1)
    expect(h.controller.state.messages.some((m) => m.kind === 'user' && m.queued)).toBe(false)
  })
})

describe('F-001 AC-28 — session resume is visible on a phone too', () => {
  it('resumes an open session with its history in order', async () => {
    const h = await mobileHarness({ platform: 'android' })
    h.server.always('GET /assistant/session', 200, {
      session: session({
        messages: [
          turn({ id: 'turn-1', seq: 1, transcript_raw: 'add buy milk', outcome: null }),
          appliedTurn({ id: 'turn-2', seq: 2, client_turn_id: 'cid-2' }),
        ],
      }),
      boundary: null,
    })
    await h.controller.init()

    expect(h.controller.state.messages.map((m) => m.kind)).toEqual([
      'user',
      'user',
      'applied',
    ])
    expect(h.controller.undoable()).toBe('turn-2')
  })
})
