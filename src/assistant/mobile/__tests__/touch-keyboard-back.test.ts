// F-003 AC-9 (touch targets), AC-10 (software keyboard), AC-11 (system back).
//
// The node-testable halves only, and the split is deliberate. AC-9's hit areas
// are computed here from the painted sizes the mockup declares; whether a
// finger lands on them is device-lab debt. AC-10 and AC-11 are decisions —
// "does this event change conversation state?" — and a decision is exactly
// what a unit tier can hold.

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { backAction, keyboardChangeAffectsConversation } from '../model/lifecycle.ts'
import { A11Y_IDS } from '../model/a11y.ts'
import {
  ALL_INTERACTIVE_IDS,
  areaOf,
  hitArea,
  hitSlopFor,
  INTERACTIVE_IDS,
  isInteractive,
  meetsMinimum,
  MIN_TOUCH_TARGET,
  PAINTED,
  paintedBox,
  touchProps,
} from '../model/touch.ts'
import type { InteractiveId } from '../model/touch.ts'
import { mobileHarness, settle, turnResponse, undoOutcome, appliedTurn } from './_helpers.ts'

describe('AC-9 — every interactive element reaches the platform minimum as HIT AREA', () => {
  it('iOS 44pt and Android 48dp are the numbers the AC names', () => {
    expect(MIN_TOUCH_TARGET.ios).toBe(44)
    expect(MIN_TOUCH_TARGET.android).toBe(48)
  })

  for (const platform of ['ios', 'android'] as const) {
    // ALL of them — the conversation's controls and the app shell's. The two
    // lists are separate because QA asserts the first against the conversation
    // mockup (see `SHELL_INTERACTIVE_IDS`); AC-9 is about fingers and does not
    // care which mockup drew the control.
    it(`${platform}: all ${ALL_INTERACTIVE_IDS.length} interactive ids meet the minimum`, () => {
      for (const id of ALL_INTERACTIVE_IDS) {
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
    // .mic { var(--h-md) } → 44×44 (T-255: was 52×52 before the redesign).
    // On iOS 44 = platform minimum, so slop is zero.
    expect(PAINTED[A11Y_IDS.micButton]).toEqual({ width: 44, height: 44 })
    expect(hitSlopFor(PAINTED[A11Y_IDS.micButton], 'ios')).toEqual({
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
    })
    // .cbx { calc(var(--icon-size-md) * 1px) } → 20×20 (T-255: was 22×22)
    // — the case AC-9 exists for: painted below both minima, extended by slop
    expect(PAINTED[A11Y_IDS.taskCheckbox]).toEqual({ width: 20, height: 20 })
    const slop = hitSlopFor(PAINTED[A11Y_IDS.taskCheckbox], 'android')
    expect(slop.top).toBe(14) // (48 - 20) / 2
    expect(areaOf(PAINTED[A11Y_IDS.taskCheckbox], slop)).toEqual({ width: 48, height: 48 })
    expect(hitArea(A11Y_IDS.taskCheckbox, 'android')).toEqual({ width: 48, height: 48 })
  })

  it('the published content-width floors match the table design published — parsed, not retyped', () => {
    // These have no mockup CSS rule to read (a full-bleed row, and controls
    // whose width is their label), so design published them in components.md.
    // Parsing that table is what makes PAINTED a consumer of the number rather
    // than a second declaration of it.
    const md = readFileSync(
      resolve(dirname(fileURLToPath(import.meta.url)), '../../../../docs/design/_shared/components.md'),
      'utf8',
    )
    const section = md.split('## Touch — minimum content widths')[1]
    expect(section, 'the published width table is missing').toBeDefined()
    const published = new Map<string, number>()
    for (const line of (section as string).split('\n## ')[0]!.split('\n')) {
      const m = /^\|\s*`([a-z-]+)`\s*\|\s*\*\*(\d+)\*\*\s*\|/.exec(line)
      if (m !== null) published.set(m[1] as string, Number(m[2]))
    }
    // Every row design publishes must be adopted here — including rows added
    // after this test was written, which is how the retry and permission-CTA
    // corrections both arrived. Asserted as a superset rather than an exact
    // list so a NEW floor fails as "PAINTED has not adopted it" (actionable)
    // rather than as "the expected list is stale" (noise), while a row that
    // DISAPPEARS still fails.
    for (const id of [
      'assistant-add-task-button',
      'assistant-task-row',
      'assistant-undo-button',
      'assistant-retry-button',
      'assistant-permission-cta',
    ]) {
      expect(published.has(id), `${id} is missing from the published table`).toBe(true)
    }
    for (const [id, width] of published) {
      expect(isInteractive(id as InteractiveId), `${id} is not a known interactive id`).toBe(true)
      expect(PAINTED[id as InteractiveId].width, `${id} floor`).toBe(width)
    }
    // The rounding rule the table states, checked as a property rather than
    // trusted: a floor is a multiple of 4 at or below the rendered width. It
    // must UNDER-state, because an over-stated one under-computes slop and
    // fails silently in the safe-looking direction — which is what retry's 96
    // (add-task's number) and the permission CTA's 140 (neither of its labels)
    // both were.
    for (const width of published.values()) expect(width % 4).toBe(0)
  })

  describe('the painted dimensions have exactly one declaration', () => {
    // AC-9's numbers used to live in three places — the mockup CSS, `PAINTED`,
    // and the RN StyleSheet — all agreeing. Three copies that agree are
    // indistinguishable from one source until someone edits one of them. QA
    // closed mockup↔PAINTED by parsing the CSS at test time; these close
    // PAINTED↔StyleSheet, which could not be closed from the test side because
    // `components/styles.ts` imports react-native and cannot load in this tier.
    const DERIVED: [constName: string, idKey: keyof typeof A11Y_IDS][] = [
      ['drawerBox', 'drawerButton'],
      ['checkboxBox', 'taskCheckbox'],
      ['composerInputBox', 'composerInput'],
      ['micBox', 'micButton'],
      ['sendBox', 'composerSend'],
    ]

    it('paintedBox is PAINTED — the value the stylesheet spreads is the value the hit-area maths measures', () => {
      for (const id of INTERACTIVE_IDS) {
        expect(paintedBox(id), id).toEqual(PAINTED[id])
      }
      // …and a fresh object each time, since StyleSheet.create may freeze it.
      const first = paintedBox(A11Y_IDS.micButton)
      expect(first).not.toBe(PAINTED[A11Y_IDS.micButton])
      first.width = 999
      expect(PAINTED[A11Y_IDS.micButton].width).not.toBe(999)
    })

    it('the RN stylesheet reads every box from PAINTED and restates no number', () => {
      const src = readFileSync(
        resolve(dirname(fileURLToPath(import.meta.url)), '../components/styles.ts'),
        'utf8',
      )
      let checked = 0
      for (const [constName, idKey] of DERIVED) {
        // Declared by derivation, from the id it claims to be about.
        expect(src, `${constName} is not derived from PAINTED[${A11Y_IDS[idKey]}]`).toContain(
          `const ${constName} = paintedBox(A11Y_IDS.${idKey})`,
        )
        checked += 1
      }
      // …and the style blocks that used to hold literals now spread the box.
      for (const key of ['iconButton', 'checkbox', 'mic', 'send'] as const) {
        const block = new RegExp(`(^|\\n)\\s*${key}:\\s*\\{([\\s\\S]*?)\\n\\s*\\},`).exec(src)
        expect(block, `style key "${key}" not found — this map is stale`).not.toBeNull()
        const body = block![2] as string
        expect(body, `styles.${key} still declares a literal dimension`).not.toMatch(
          /(?:^|[,{\s])(?:width|height):\s*\d/,
        )
        checked += 1
      }
      // Non-vacuity: a dead regex or a renamed file must fail loudly rather
      // than pass over an empty set. This is the same guard QA put on the
      // drift detector this replaces.
      expect(checked, 'no derivation was actually checked').toBe(DERIVED.length + 4)
    })
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
    h.controller.composerChange('move the meeting')
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
    h.controller.composerChange('team meeting tomorrow at 2')
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
    h.controller.composerChange('team meeting tomorrow at 2')
    await settle(h.store)

    h.lifecycle.keyboard(true)
    h.lifecycle.keyboard(false)
    // rotation re-mounts the view; the text lives in the model and on the
    // device, never in a component's local state
    expect(h.controller.state.composer).toBe('team meeting tomorrow at 2')
    expect(JSON.stringify(h.backend.snapshot())).toContain('team meeting tomorrow at 2')
  })

  it('the keyboard’s own send action and the send button produce the same request', async () => {
    const h = await mobileHarness({ platform: 'ios' })
    h.server.always('POST /assistant/turn', 200, turnResponse())
    await h.controller.init()

    // keyboard action
    h.controller.composerChange('add buy milk')
    await h.controller.send('typed')
    // send button
    h.controller.composerChange('add buy milk')
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
    h.controller.composerChange('half a sentence')
    h.lifecycle.keyboard(true)

    const consumed = h.lifecycle.pressBack()

    expect(consumed).toBe(true) // handled: the view stays
    expect(h.controller.keyboardIsVisible()).toBe(false)
    expect(h.controller.state.composer).toBe('half a sentence')
    expect(backAction({ keyboardVisible: true })).toBe('dismiss-keyboard')
  })

  it('a second back leaves the view — and that is a background transition, nothing more', async () => {
    const h = await mobileHarness({ platform: 'android' })
    h.server.always('POST /assistant/turn', 200, turnResponse())
    await h.controller.init()
    h.controller.composerChange('move the meeting to 4')

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
    h.speech.feed(['call the bank'])

    h.lifecycle.pressBack()
    await settle(h.store)

    expect(h.controller.state.surface).toBe('idle')
    expect(h.controller.state.composer).toBe('call the bank')
    expect(h.server.turnBodies()).toHaveLength(0)
    expect(JSON.stringify(h.backend.snapshot())).toContain('call the bank')
  })

  it('an in-flight turn survives leaving the view and still renders on return', async () => {
    const h = await mobileHarness({ platform: 'ios' })
    h.server.always('POST /assistant/turn', 200, turnResponse({ turn: appliedTurn() }))
    await h.controller.init()
    h.controller.composerChange('move the meeting to 4')

    const inFlight = h.controller.send('typed')
    h.lifecycle.pressBack() // user leaves mid-turn
    await inFlight
    await settle()

    expect(h.controller.state.messages.some((m) => m.kind === 'applied')).toBe(true)
  })
})
