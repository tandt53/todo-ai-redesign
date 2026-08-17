// F-003 AC-5 (kill while listening), AC-6 (kill while thinking + replay),
// AC-7 (audio interruption), AC-8 (foreground read).
//
// These are the two ACs F-001 reserved and the two the OS forces, so the
// assertions are about survival rather than about rendering. A real process
// kill cannot happen under node — and does not need to: what AC-5 and AC-6
// actually claim is that the STORE's contents outlive the model, so
// `relaunch()` (a brand-new controller over the same storage backend)
// reproduces the observable exactly.

import { describe, expect, it } from 'vitest'
import { AUDIO_INTERRUPTION_REASONS, FOREGROUND_SEQUENCE } from '../model/lifecycle.ts'
import { FakeConnectivity } from '../ports/app-lifecycle.ts'
import {
  appliedTurn,
  askedTurn,
  boundary,
  mobileHarness,
  requestLog,
  session,
  settle,
  task,
  turn,
  turnResponse,
} from './_helpers.ts'

/** The `/assistant/*` half of the request log — AC-8 is about the order of
 * those, and `GET /tasks` legitimately sits among them. */
function assistantLog(paths: string[]): string[] {
  return paths.filter((p) => p.includes(' /assistant/'))
}

/**
 * A network that came back while the app was suspended.
 *
 * `FakeConnectivity.set()` always emits, which models the OS noticing the
 * transition and telling us — the one case that was never in doubt. The case
 * that matters is the other one: the app is backgrounded, wifi returns, and no
 * `onChange` callback is ever delivered because nothing was listening. Only
 * then does the foreground itself have to do the reconciling.
 */
class BackgroundedConnectivity extends FakeConnectivity {
  private returned = false

  override isOnline(): boolean {
    return this.returned ? true : super.isOnline()
  }

  /** Wifi came back with the app suspended: `isOnline()` flips, no callback. */
  cameBackSilently(): void {
    this.returned = true
  }
}

describe('AC-5 — backgrounding or kill while listening loses no words', () => {
  it('recognized-so-far text is in client.pending_input on the device, and reopens into the composer', async () => {
    const h = await mobileHarness({ platform: 'ios' })
    await h.controller.init()

    h.controller.tapMic()
    await settle()
    h.speech.feed(['mai họp team lúc 2'])

    // the OS takes the app away mid-sentence
    h.lifecycle.background()
    await settle(h.store)

    // capture stopped, nothing was sent, and the words are ON THE DEVICE
    expect(h.controller.state.surface).toBe('idle')
    expect(h.server.turnBodies()).toHaveLength(0)
    const onDevice = JSON.stringify(h.backend.snapshot())
    expect(onDevice).toContain('mai họp team lúc 2')

    // …and the app is killed. A fresh model over the same device:
    const reopened = await h.relaunch()
    await reopened.controller.init()
    expect(reopened.controller.state.composer).toBe('mai họp team lúc 2')
  })

  it('backgrounding while listening sends ZERO turns — it is a cancel, not a submit', async () => {
    const h = await mobileHarness({ platform: 'android' })
    await h.controller.init()
    h.controller.tapMic()
    await settle()
    h.speech.feed(['xóa hết mọi thứ'])

    h.lifecycle.background()
    await settle()

    expect(h.server.turnBodies()).toHaveLength(0)
    expect(h.controller.state.composer).toBe('xóa hết mọi thứ')
    expect(h.speech.listening()).toBe(false)
  })
})

describe('AC-6 — the outgoing turn survives until the server acks its client_turn_id', () => {
  it('is held in the durable store while the surface is thinking', async () => {
    const h = await mobileHarness({ platform: 'ios' })
    h.server.always('POST /assistant/turn', 200, turnResponse())
    await h.controller.init()
    h.controller.composerChange('dời họp sang 4 giờ')

    const inFlight = h.controller.send('typed') // deliberately not awaited
    expect(h.controller.state.surface).toBe('thinking')
    const held = h.stores.outgoingTurn()
    expect(held?.body.transcript).toBe('dời họp sang 4 giờ')
    expect(held?.body.client_turn_id).toBe(h.ids[h.ids.length - 1])
    await inFlight
  })

  it('a kill mid-flight replays under the SAME client_turn_id and applies exactly once', async () => {
    const h = await mobileHarness({ platform: 'ios' })
    await h.controller.init()
    h.controller.composerChange('dời họp sang 4 giờ')

    // The request left the device; the response never came back (killed).
    h.server.failOnce('POST /assistant/turn')
    await h.controller.send('typed')
    await settle(h.store)
    const sentId = h.stores.outgoingTurn()?.body.client_turn_id
    expect(sentId).toBeDefined()

    // Cold open. The session read does not show the turn (it landed in a
    // session that has since closed), so the client replays it.
    const reopened = await h.relaunch()
    reopened.server.calls.length = 0
    reopened.server.always('GET /assistant/session', 200, {
      session: null,
      boundary: boundary(),
    })
    reopened.server.always(
      'POST /assistant/turn',
      200,
      turnResponse({
        session_id: 'sess-2',
        replayed: true, // the server recognised the id and re-served its outcome
        turn: appliedTurn({ id: 'turn-9', client_turn_id: sentId }),
      }),
    )
    await reopened.controller.init()
    await settle(reopened.store)

    const replays = reopened.server.turnBodies()
    expect(replays).toHaveLength(1)
    expect(replays[0]?.['client_turn_id']).toBe(sentId) // SAME id — dedupe re-serves
    // the outcome renders once, not twice
    expect(reopened.controller.state.messages.filter((m) => m.kind === 'applied')).toHaveLength(1)
    // and the acked turn is cleared from the store
    expect(reopened.stores.outgoingTurn()).toBe(null)
    expect(reopened.controller.counters.killSurvivingReplays).toBe(1)
  })

  it('when the session read already contains the turn, that read IS the ack — no second send', async () => {
    const h = await mobileHarness({ platform: 'android' })
    await h.controller.init()
    h.controller.composerChange('thêm mua sữa')
    h.server.failOnce('POST /assistant/turn')
    await h.controller.send('typed')
    await settle(h.store)
    const sentId = h.stores.outgoingTurn()?.body.client_turn_id

    const reopened = await h.relaunch()
    reopened.server.calls.length = 0
    reopened.server.always('GET /assistant/session', 200, {
      session: session({
        messages: [appliedTurn({ id: 'turn-3', client_turn_id: sentId })],
      }),
      boundary: null,
    })
    await reopened.controller.init()
    await settle(reopened.store)

    expect(reopened.server.turnBodies()).toHaveLength(0) // never re-sent
    expect(reopened.stores.outgoingTurn()).toBe(null) // but cleared
    expect(reopened.controller.state.messages.filter((m) => m.kind === 'applied')).toHaveLength(1)
  })

  it('an unanswered question and the undo affordance rebuild from the server read, not from local state', async () => {
    const h = await mobileHarness({ platform: 'ios' })
    h.server.always('GET /assistant/session', 200, {
      session: session({
        messages: [
          appliedTurn({ id: 'turn-1', client_turn_id: 'cid-a', seq: 1 }),
          askedTurn('bulk_delete', ['Đi chợ', 'Gọi mẹ'], ['Xóa 2 việc', 'Giữ lại'], {
            id: 'turn-2',
            client_turn_id: 'cid-b',
            seq: 2,
          }),
        ],
      }),
      boundary: null,
    })
    h.server.always('GET /tasks', 200, { tasks: [task()] })
    await h.controller.init()

    const kinds = h.controller.state.messages.map((m) => m.kind)
    expect(kinds).toContain('question')
    expect(kinds).toContain('applied')
    // the undo window is the shared selector's answer, not a mobile re-derivation
    expect(h.controller.undoable()).toBe('turn-1')
  })
})

describe('AC-7 — audio interruption is cancel-while-listening', () => {
  for (const reason of AUDIO_INTERRUPTION_REASONS) {
    it(`${reason}: capture stops, words kept, no turn sent, audio session released`, async () => {
      const h = await mobileHarness({ platform: 'ios' })
      await h.controller.init()
      h.controller.tapMic()
      await settle()
      h.speech.feed(['gọi cho ngân hàng'])

      const releasesBefore = h.speech.log.audioSessionReleases
      h.lifecycle.interrupt(reason)
      await settle()

      expect(h.controller.state.surface).toBe('idle') // visibly back to idle
      expect(h.controller.state.composer).toBe('gọi cho ngân hàng') // preserved (AC-5)
      expect(h.server.turnBodies()).toHaveLength(0) // NO turn sent
      expect(h.speech.log.audioSessionReleases).toBe(releasesBefore + 1)
      expect(h.controller.counters.audioInterruptions).toBe(1)
    })
  }

  it('the mic returns to available when focus comes back — with no new permission prompt', async () => {
    const h = await mobileHarness({ platform: 'ios' })
    await h.controller.init()
    h.controller.tapMic()
    await settle()
    const promptsAfterFirstTalk = h.speech.log.prompts

    h.lifecycle.interrupt('call')
    h.lifecycle.interruptEnded('call')
    await settle()

    h.controller.tapMic()
    await settle()

    expect(h.controller.state.surface).toBe('listening')
    expect(h.speech.log.prompts).toBe(promptsAfterFirstTalk) // never re-prompted
  })
})

describe('AC-8 — every foreground transition re-reads the session before accepting input', () => {
  it('GET /assistant/session is the first request of the foreground, and input waits for it', async () => {
    const h = await mobileHarness({ platform: 'android' })
    await h.controller.init()
    h.server.calls.length = 0
    h.server.always('POST /assistant/turn', 200, turnResponse())

    h.lifecycle.foreground()
    // input arrives immediately, before the read could have finished
    h.controller.composerChange('thêm mua sữa')
    const sending = h.controller.send('typed')
    expect(h.controller.acceptingInput()).toBe(false)
    await sending
    await settle()

    const paths = h.server.calls.map((c) => `${c.method} ${c.path}`)
    expect(paths[0]).toBe('GET /assistant/session')
    expect(paths.indexOf('POST /assistant/turn')).toBeGreaterThan(
      paths.indexOf('GET /assistant/session'),
    )
    expect(h.controller.acceptingInput()).toBe(true)
  })

  it('the documented foreground order is the order actually performed', async () => {
    expect([...FOREGROUND_SEQUENCE]).toEqual([
      'read-session',
      'restore-pending-input',
      'replay-outgoing-turn',
    ])

    const h = await mobileHarness({ platform: 'ios' })
    await h.controller.init()
    h.controller.composerChange('dời họp sang 4 giờ')
    h.server.failOnce('POST /assistant/turn')
    await h.controller.send('typed')
    await settle(h.store)

    const reopened = await h.relaunch()
    reopened.server.calls.length = 0
    reopened.server.always('GET /assistant/session', 200, { session: null, boundary: null })
    reopened.server.always('POST /assistant/turn', 200, turnResponse())
    await reopened.controller.init()
    await reopened.controller.onForeground()
    await settle(reopened.store)

    const paths = reopened.server.calls.map((c) => `${c.method} ${c.path}`)
    // read-session precedes the outgoing-turn replay every time
    expect(paths.indexOf('GET /assistant/session')).toBeLessThan(
      paths.indexOf('POST /assistant/turn'),
    )
  })

  it('an open session resumes visibly', async () => {
    const h = await mobileHarness({ platform: 'ios' })
    h.server.always('GET /assistant/session', 200, {
      session: session({
        messages: [turn({ id: 'turn-1', transcript_raw: 'thêm mua sữa', outcome: null })],
      }),
      boundary: null,
    })
    await h.controller.init()

    expect(h.controller.state.sessionId).toBe('sess-1')
    expect(h.controller.state.messages.some((m) => m.kind === 'user')).toBe(true)
  })

  it('a closed session renders exactly ONE boundary message and starts clean', async () => {
    const h = await mobileHarness({ platform: 'android' })
    h.server.always('GET /assistant/session', 200, { session: null, boundary: boundary() })
    await h.controller.init()

    expect(h.controller.state.messages.filter((m) => m.kind === 'boundary')).toHaveLength(1)
    expect(h.controller.state.sessionId).toBe(null)

    // a second foreground does not stack a second marker
    h.lifecycle.foreground()
    await settle()
    expect(h.controller.state.messages.filter((m) => m.kind === 'boundary')).toHaveLength(1)
  })

  it('local stores reconcile against the read — they never override the server history', async () => {
    const h = await mobileHarness({ platform: 'ios' })
    await h.controller.init()
    h.controller.composerChange('nửa câu chưa gửi')
    await settle(h.store)

    // the server says: that session is over
    h.server.always('GET /assistant/session', 200, { session: null, boundary: boundary() })
    h.lifecycle.foreground()
    await settle()

    // history is exactly what the server reported…
    expect(h.controller.state.messages.map((m) => m.kind)).toEqual(['boundary'])
    // …while the local survivor comes back where it belongs: the composer,
    // never as a conversation message.
    expect(h.controller.state.composer).toBe('nửa câu chưa gửi')
  })
})

// ---------------------------------------------------------------------------
// AC-8, cold open (regression — BUG-002)
// ---------------------------------------------------------------------------
//
// AC-8 names two foreground transitions, "resume OR COLD OPEN", and the
// assertions above only ever exercised the resume one: every test awaits
// `init()` before it does anything. BUG-002 lived in exactly that blind spot —
// `onForeground()` installed the `foregroundSync` gate and `init()` did not, so
// a turn typed while the app was still starting went out ahead of the session
// read. These tests drive `init()` WITHOUT awaiting it, which is the only way
// the window is observable at all.

describe('AC-8 — a cold open is a foreground transition too (BUG-002 regression)', () => {
  it('input is gated from the first synchronous instant of init, before any await', async () => {
    const h = await mobileHarness({ platform: 'ios' })

    const opening = h.controller.init() // deliberately not awaited
    // No await has run since `init()` was called: if the gate is installed even
    // one `await` late, this is already true and the race is open.
    expect(h.controller.acceptingInput()).toBe(false)

    await opening
    expect(h.controller.acceptingInput()).toBe(true)
  })

  it('the FIRST /assistant/* request of a cold open is the session read, and a turn typed during it is held, not dropped', async () => {
    const h = await mobileHarness({ platform: 'android' })
    h.server.always(
      'POST /assistant/turn',
      200,
      turnResponse({ turn: appliedTurn({ id: 'turn-1', client_turn_id: 'cid-cold' }) }),
    )

    const opening = h.controller.init()
    h.controller.composerChange('thêm mua sữa')
    const sending = h.controller.send('typed')
    await Promise.all([opening, sending])
    await settle(h.store)

    const paths = assistantLog(requestLog(h))
    expect(paths[0]).toBe('GET /assistant/session')
    // held, not dropped — the turn still lands
    expect(paths).toContain('POST /assistant/turn')
    expect(h.server.turnBodies()).toHaveLength(1)
    expect(h.controller.state.messages.filter((m) => m.kind === 'applied')).toHaveLength(1)
  })

  it('the held turn joins the session the read reported instead of forking a new one', async () => {
    const h = await mobileHarness({ platform: 'ios' })
    h.server.always('GET /assistant/session', 200, {
      session: session({ id: 'sess-7' }),
      boundary: null,
    })
    h.server.always('POST /assistant/turn', 200, turnResponse({ session_id: 'sess-7' }))

    const opening = h.controller.init()
    h.controller.composerChange('dời họp sang 4 giờ')
    const sending = h.controller.send('typed')
    await Promise.all([opening, sending])
    await settle(h.store)

    // The payload consequence of the ordering: a turn dispatched before the
    // read carries `session_id: null` and opens a NEW session.
    expect(h.server.turnBodies()[0]?.['session_id']).toBe('sess-7')
  })

  it('a cold open onto a CLOSED session still renders its boundary — exactly once, and above the racing turn', async () => {
    const h = await mobileHarness({ platform: 'android' })
    h.server.always('GET /assistant/session', 200, {
      session: null,
      boundary: boundary({
        declined_questions: [
          { turn_id: 'turn-2', kind: 'bulk_delete', task_titles: ['Đi chợ', 'Gọi mẹ'] },
        ],
      }),
    })
    h.server.always(
      'POST /assistant/turn',
      200,
      turnResponse({ session_id: 'sess-2', turn: appliedTurn({ id: 'turn-9' }) }),
    )

    const opening = h.controller.init()
    h.controller.composerChange('thêm mua sữa')
    const sending = h.controller.send('typed')
    await Promise.all([opening, sending])
    await settle(h.store)

    const kinds = h.controller.state.messages.map((m) => m.kind)
    // This is what BUG-002 actually cost the user: with the turn ahead of the
    // read, the closed session was never reconciled and this count was 0.
    expect(kinds.filter((k) => k === 'boundary')).toHaveLength(1)
    expect(kinds[0]).toBe('boundary') // rendered BEFORE the racing turn, not after
    expect(kinds).toContain('user')
    // and the boundary still carries its content, not just its marker
    const marker = h.controller.state.messages.find((m) => m.kind === 'boundary')
    expect(JSON.stringify(marker)).toContain('Đi chợ')
  })

  it('a foreground IS a reconnect: offline creates made before a background reach the server even when the OS never reported the transition (BUG-001)', async () => {
    const net = new BackgroundedConnectivity(true)
    const h = await mobileHarness({ platform: 'ios', connectivity: net })
    await h.controller.init()

    // The signal drops, and the create takes F-001 AC-25's local no-AI path.
    net.set(false)
    await settle(h.store)
    h.controller.composerChange('thêm mua sữa')
    await h.controller.send('typed')
    await settle(h.store)

    const taskId = h.ids[h.ids.length - 1] as string
    expect(h.controller.state.tasks.filter((t) => t.local === true)).toHaveLength(1)
    expect(h.stores.localTasks()).toHaveLength(1)
    expect(h.server.calls.filter((c) => c.method === 'POST' && c.path === '/tasks')).toHaveLength(0)

    // The user puts the app away, and wifi returns while it is suspended — so
    // `connectivity.onChange` never fires, and `setOnline(true)`'s reconnect
    // never runs. The foreground is the only thing left that can notice.
    h.lifecycle.background()
    await settle(h.store)
    net.cameBackSilently()
    const synced = { ...task({ id: taskId, title: 'thêm mua sữa' }) }
    h.server.always('POST /tasks', 201, { task: synced })
    h.server.always('GET /tasks', 200, { tasks: [synced] })

    h.lifecycle.foreground()
    await settle(h.store)

    // The create reached the server, under the id the client already assigned…
    const creates = h.server.calls.filter((c) => c.method === 'POST' && c.path === '/tasks')
    expect(creates).toHaveLength(1)
    const created = creates[0]?.body as Record<string, unknown> | undefined
    expect(created?.['id']).toBe(taskId)
    expect(created?.['title']).toBe('thêm mua sữa')
    // …and the task is no longer device-local, in state and durably.
    expect(h.controller.state.tasks.some((t) => t.local === true)).toBe(false)
    expect(h.controller.state.tasks.map((t) => t.title)).toContain('thêm mua sữa')
    expect(h.stores.localTasks()).toHaveLength(0)
  })

  it('the reconciling foreground holds input until the offline creates have landed, and replays them before the queued turn', async () => {
    const net = new BackgroundedConnectivity(true)
    const h = await mobileHarness({ platform: 'android', connectivity: net })
    await h.controller.init()

    net.set(false)
    await settle(h.store)
    h.controller.composerChange('thêm mua sữa')
    await h.controller.send('typed')
    await settle(h.store)
    const taskId = h.ids[h.ids.length - 1] as string

    h.lifecycle.background()
    await settle(h.store)
    net.cameBackSilently()
    h.server.calls.length = 0
    h.server.always('POST /tasks', 201, { task: task({ id: taskId, title: 'thêm mua sữa' }) })
    h.server.always('POST /assistant/turn', 200, turnResponse())

    const resuming = h.controller.onForeground() // deliberately not awaited
    // AC-8's gate covers the whole reconciliation, replay included.
    expect(h.controller.acceptingInput()).toBe(false)
    h.controller.composerChange('dời họp sang 4 giờ')
    const sending = h.controller.send('typed')
    await Promise.all([resuming, sending])
    await settle(h.store)

    const paths = requestLog(h)
    // The create is replayed before the turn: a turn interpreted against a task
    // list missing the offline creates is BUG-001's second consequence.
    expect(paths.indexOf('POST /tasks')).toBeGreaterThanOrEqual(0)
    expect(paths.indexOf('POST /tasks')).toBeLessThan(paths.indexOf('POST /assistant/turn'))
    expect(h.controller.acceptingInput()).toBe(true)
  })

  it('a cold open and a resume produce the same /assistant/* order', async () => {
    const cold = await mobileHarness({ platform: 'ios' })
    cold.server.always('POST /assistant/turn', 200, turnResponse())
    const opening = cold.controller.init()
    cold.controller.composerChange('thêm mua sữa')
    await Promise.all([opening, cold.controller.send('typed')])
    await settle(cold.store)

    const resumed = await mobileHarness({ platform: 'ios' })
    resumed.server.always('POST /assistant/turn', 200, turnResponse())
    await resumed.controller.init()
    resumed.server.calls.length = 0
    resumed.lifecycle.foreground()
    resumed.controller.composerChange('thêm mua sữa')
    await resumed.controller.send('typed')
    await settle(resumed.store)

    expect(assistantLog(requestLog(cold))).toEqual(assistantLog(requestLog(resumed)))
  })
})
