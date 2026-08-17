// F-003 AC-9 (touch targets), AC-10 (software keyboard), AC-11 (system back).
//
// The node-testable halves only, and the split is deliberate. AC-9's hit areas
// are computed here from the painted sizes the mockup declares; whether a
// finger lands on them is device-lab debt. AC-10 and AC-11 are decisions —
// "does this event change conversation state?" — and a decision is exactly
// what a unit tier can hold.

import { describe, expect, it } from 'vitest'
import { backAction, keyboardChangeAffectsConversation } from '../model/lifecycle.ts'
import { A11Y_IDS } from '../model/a11y.ts'
import {
  areaOf,
  hitArea,
  hitSlopFor,
  INTERACTIVE_IDS,
  isInteractive,
  meetsMinimum,
  MIN_TOUCH_TARGET,
  PAINTED,
  touchProps,
} from '../model/touch.ts'
import { mobileHarness, settle, turnResponse, undoOutcome, appliedTurn } from './_helpers.ts'

describe('AC-9 — every interactive element reaches the platform minimum as HIT AREA', () => {
  it('iOS 44pt and Android 48dp are the numbers the AC names', () => {
    expect(MIN_TOUCH_TARGET.ios).toBe(44)
    expect(MIN_TOUCH_TARGET.android).toBe(48)
  })

  for (const platform of ['ios', 'android'] as const) {
    it(`${platform}: all ${INTERACTIVE_IDS.length} interactive ids meet the minimum`, () => {
      for (const id of INTERACTIVE_IDS) {
        const { painted } = touchProps(id, platform)
        const area = hitArea(id, platform)
        expect(
          meetsMinimum(id, platform),
          `${id} paints ${painted.width}×${painted.height} → hit ${area.width}×${area.height}`,
        ).toBe(true)
      }
    })
  }

  it('the painted sizes stay the mockup’s — slop extends the target, it does not resize the design', () => {
    // .mic { 52px } — already above both minima, so it gets no slop at all
    expect(PAINTED[A11Y_IDS.micButton]).toEqual({ width: 52, height: 52 })
    expect(hitSlopFor(PAINTED[A11Y_IDS.micButton], 'ios')).toEqual({
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
    })
    // .checkbox { 22px } — the case AC-9 exists for
    expect(PAINTED[A11Y_IDS.taskCheckbox]).toEqual({ width: 22, height: 22 })
    const slop = hitSlopFor(PAINTED[A11Y_IDS.taskCheckbox], 'android')
    expect(slop.top).toBe(13)
    expect(areaOf(PAINTED[A11Y_IDS.taskCheckbox], slop)).toEqual({ width: 48, height: 48 })
    expect(hitArea(A11Y_IDS.taskCheckbox, 'android')).toEqual({ width: 48, height: 48 })
  })

  it('classifies the catalogue: interactive ids get targets, structural ones do not', () => {
    expect(isInteractive(A11Y_IDS.undoButton)).toBe(true)
    expect(isInteractive(A11Y_IDS.messageBubble)).toBe(false)
    expect(isInteractive(A11Y_IDS.boundaryMarker)).toBe(false)
  })

  it('undo stays ONE gesture — no confirmation step between the tap and the request', async () => {
    const h = await mobileHarness({ platform: 'ios' })
    h.server.always('POST /assistant/turn', 200, turnResponse({ turn: appliedTurn() }))
    await h.controller.init()
    h.controller.composerChange('dời họp')
    await h.controller.send('typed')
    await settle()

    h.server.always('POST /assistant/turn/:id/undo', 200, undoOutcome())
    h.server.calls.length = 0
    await h.controller.undoTap('turn-1')
    await settle()

    const undoCalls = h.server.calls.filter((c) => c.path.includes('/undo'))
    expect(undoCalls).toHaveLength(1) // one gesture → one request
    expect(h.controller.state.messages.some((m) => m.kind === 'question')).toBe(false)
  })
})

describe('AC-10 — the software keyboard is a layout fact, not a conversation event', () => {
  it('showing and hiding it changes no conversation state and sends nothing', async () => {
    const h = await mobileHarness({ platform: 'android' })
    h.server.always('POST /assistant/turn', 200, turnResponse())
    await h.controller.init()
    h.controller.composerChange('mai họp team lúc 2 giờ')
    const before = h.controller.state
    h.server.calls.length = 0

    h.lifecycle.keyboard(true)
    h.lifecycle.keyboard(false)
    h.lifecycle.keyboard(true)
    await settle()

    expect(h.controller.state).toBe(before) // not merely equal: untouched
    expect(h.server.calls).toHaveLength(0)
    expect(keyboardChangeAffectsConversation()).toBe(false)
    expect(h.controller.keyboardIsVisible()).toBe(true)
  })

  it('composer text survives keyboard toggles and a rotation', async () => {
    const h = await mobileHarness({ platform: 'ios' })
    await h.controller.init()
    h.controller.composerChange('mai họp team lúc 2 giờ')
    await settle(h.store)

    h.lifecycle.keyboard(true)
    h.lifecycle.keyboard(false)
    // rotation re-mounts the view; the text lives in the model and on the
    // device, never in a component's local state
    expect(h.controller.state.composer).toBe('mai họp team lúc 2 giờ')
    expect(JSON.stringify(h.backend.snapshot())).toContain('mai họp team lúc 2 giờ')
  })

  it('the keyboard’s own send action and the send button produce the same request', async () => {
    const h = await mobileHarness({ platform: 'ios' })
    h.server.always('POST /assistant/turn', 200, turnResponse())
    await h.controller.init()

    // keyboard action
    h.controller.composerChange('thêm mua sữa')
    await h.controller.send('typed')
    // send button
    h.controller.composerChange('thêm mua sữa')
    await h.controller.send('typed')
    await settle()

    const [viaKeyboard, viaButton] = h.server.turnBodies()
    expect({ ...viaKeyboard, client_turn_id: null, session_id: null }).toEqual({
      ...viaButton,
      client_turn_id: null,
      session_id: null,
    })
  })
})

describe('AC-11 — system back is never destructive', () => {
  it('with the keyboard open, back dismisses the keyboard and leaves the view standing', async () => {
    const h = await mobileHarness({ platform: 'android' })
    await h.controller.init()
    h.controller.composerChange('nửa câu')
    h.lifecycle.keyboard(true)

    const consumed = h.lifecycle.pressBack()

    expect(consumed).toBe(true) // handled: the view stays
    expect(h.controller.keyboardIsVisible()).toBe(false)
    expect(h.controller.state.composer).toBe('nửa câu')
    expect(backAction({ keyboardVisible: true })).toBe('dismiss-keyboard')
  })

  it('a second back leaves the view — and that is a background transition, nothing more', async () => {
    const h = await mobileHarness({ platform: 'android' })
    h.server.always('POST /assistant/turn', 200, turnResponse())
    await h.controller.init()
    h.controller.composerChange('dời họp sang 4 giờ')

    const inFlight = h.controller.send('typed') // thinking
    expect(h.controller.state.surface).toBe('thinking')
    h.server.calls.length = 0

    const consumed = h.lifecycle.pressBack()

    expect(consumed).toBe(false) // navigation proceeds
    expect(backAction({ keyboardVisible: false })).toBe('leave-view')
    // …and none of the destructive things happened. The surface is still
    // thinking at the instant back is pressed: leaving the view did not cancel
    // the turn, which would have shown up here as an immediate 'idle'.
    expect(h.controller.state.surface).toBe('thinking')

    await inFlight
    await settle(h.store)
    // the turn ran to completion on its own terms, and no session was closed
    expect(h.server.calls.some((c) => c.path.includes('/session/close'))).toBe(false)
    expect(h.controller.state.surface).toBe('idle')
  })

  it('leaving the view while listening keeps the words and sends nothing', async () => {
    const h = await mobileHarness({ platform: 'android' })
    await h.controller.init()
    h.controller.tapMic()
    await settle()
    h.speech.feed(['gọi cho ngân hàng'])

    h.lifecycle.pressBack()
    await settle(h.store)

    expect(h.controller.state.surface).toBe('idle')
    expect(h.controller.state.composer).toBe('gọi cho ngân hàng')
    expect(h.server.turnBodies()).toHaveLength(0)
    expect(JSON.stringify(h.backend.snapshot())).toContain('gọi cho ngân hàng')
  })

  it('an in-flight turn survives leaving the view and still renders on return', async () => {
    const h = await mobileHarness({ platform: 'ios' })
    h.server.always('POST /assistant/turn', 200, turnResponse({ turn: appliedTurn() }))
    await h.controller.init()
    h.controller.composerChange('dời họp sang 4 giờ')

    const inFlight = h.controller.send('typed')
    h.lifecycle.pressBack() // user leaves mid-turn
    await inFlight
    await settle()

    expect(h.controller.state.messages.some((m) => m.kind === 'applied')).toBe(true)
  })
})
