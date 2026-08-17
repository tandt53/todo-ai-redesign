// @vitest-environment jsdom
//
// F-001 AC-30 (a)/(b)/(h) on mobile — BUG-006, the clause-(h) scroll losing a
// race with the reply to that same turn.
//
// ── WHY THIS FILE EXISTS SEPARATELY FROM `follow.test.ts` ───────────────────
// `follow.test.ts` drives the DECISIONS (`onMessagesAppended`, `onScrolled`) as
// pure functions, one call at a time. Every one of those calls is
// instantaneous, so there is no interval during which anything can arrive
// *while a scroll is running* — and that interval is the whole of BUG-006. A
// suite that cannot open the window cannot catch the defect: mobile's AC-30
// pass was green throughout the period web's browser tier was reporting the
// reply to your own turn below the fold. This file opens the window.
//
// ── THE TIER, NAMED (owner decision 2026-08-17, mobile verification tier) ───
// This is the **hook tier**: the REAL `useNewMessageFollow` running under real
// React — real refs, real layout effect, real state — against a `ScrollView`
// DOUBLE. It settles which events raise and lower the in-flight flag and in
// what order, which the model tier cannot see because the flag lives in the
// hook.
//
// It is NOT a device run and it is not the browser render. What it cannot
// settle, and is not reported as if it did:
//   - that React Native's own animated `scrollToEnd` behaves like the double
//     below (the double is written from RN's documented behaviour, not
//     observed from it);
//   - that `onScrollBeginDrag` / `onTouchStart` are delivered by a real
//     `ScrollView` in the order assumed here;
//   - anything about pixels, momentum or the OS.
// Those stay device-owed — `qa/assistant/F-001/mobile/TC-009`, and BUG-006's
// own "standing debt" row in the owner decision.
//
// ── THE DOUBLE IS COPIED FROM THE PLATFORM, NOT MADE CONVENIENT ─────────────
// Two details decide whether the defect is expressible at all, and both are
// taken from the report's frame table rather than chosen:
//   - an ANIMATED scroll does not land inside the call. `scrollToEnd` returns
//     with the surface still where it was; the offset arrives later, as
//     `onScroll` events. A double that assigns the offset synchronously — which
//     is every scroll assertion in `follow.test.ts` — leaves nothing for a
//     reply to arrive during.
//   - the target is CLAMPED WHEN THE SCROLL IS ISSUED, from the content as it
//     is at that instant. Content appended mid-flight does not extend a running
//     animation. That staleness is the other half of the report: `1138 − 515 =
//     623`, landing 121 short of a bottom that had moved to 744.

import { act, cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { distanceFromBottom } from '../../_shared/model/follow.ts'
import type { AppState } from '../../_shared/model/reducer.ts'
import type { Message } from '../../_shared/types.ts'
import type { MobileAssistantController } from '../controller.ts'
import { useNewMessageFollow } from '../components/useNewMessageFollow.ts'
import type { NewMessageFollow } from '../components/useNewMessageFollow.ts'
import { mobileHarness } from './_helpers.ts'
import type { MobileHarness } from './_helpers.ts'

afterEach(cleanup)

const AT = '2026-08-17T09:00:00.000Z'

// The report's own measurements (`BUG-006 ## Actual`, and the frame table under
// `## Root cause`). Replaying the numbers rather than inventing round ones is
// what makes a failure here readable against the bug.
const VIEWPORT = 583
/** the thinking indicator shrinks the pane while the turn is in flight */
const VIEWPORT_THINKING = 515
const CONTENT_0 = 1007
/** the user's own message: 1007 -> 1138 */
const USER_ROW = 131
/** the reply: 1138 -> 1327, bottom moves to 744 */
const REPLY_ROW = 189

function userMessage(id: string): Message {
  return {
    id,
    kind: 'user',
    text: 'plan the week',
    via: 'typed',
    at: AT,
    queued: false,
    clientTurnId: 'cid-tc047',
  } as Message
}

function aiMessage(id: string): Message {
  return { id, kind: 'no-match', heard: 'plan the week', at: AT } as Message
}

// ---------------------------------------------------------------------------
// The ScrollView double — the window
// ---------------------------------------------------------------------------

interface IssuedScroll {
  animated: boolean
  /** where the animation is carrying the surface, clamped at issue time */
  target: number
}

/**
 * A `ScrollView` as far as this hook can tell: the two imperative methods it
 * calls, plus the geometry the four callbacks report back.
 *
 * Nothing here emits an event on its own. React Native delivers scroll and
 * content-size callbacks asynchronously, and a double that fired `onScroll`
 * from inside `scrollToEnd` would run the hook's handler *before* the line
 * after the call — inverting the exact ordering this file exists to check. So
 * the test says when each event arrives.
 */
function scrollViewDouble(props: () => NewMessageFollow['scrollProps']) {
  let contentHeight = CONTENT_0
  let viewportHeight = VIEWPORT
  let offset = 0
  let from = 0
  let target: number | null = null
  const calls: IssuedScroll[] = []

  const bottom = (): number => Math.max(0, contentHeight - viewportHeight)

  const emitScroll = (): void => {
    props().onScroll({
      nativeEvent: {
        contentOffset: { y: offset, x: 0 },
        contentSize: { height: contentHeight, width: 320 },
        layoutMeasurement: { height: viewportHeight, width: 320 },
      },
    } as never)
  }

  const view = {
    /** the hook's one call into React Native's scroll API */
    scrollToEnd(o?: { animated?: boolean }) {
      const animated = o?.animated !== false
      const t = bottom()
      calls.push({ animated, target: t })
      if (!animated) {
        // No animation, no window: the surface is already there when the call
        // returns. This is clause (g)'s path, and the reason reduce-motion
        // never had this defect (TC-046) — nor can it catch a regression of it.
        offset = t
        from = t
        target = null
        return
      }
      from = offset
      target = t
    },
    scrollTo(o: { y?: number; animated?: boolean }) {
      offset = o.y ?? offset
      from = offset
      target = null
    },
  }

  return {
    view,
    calls,
    offset: (): number => offset,
    target: (): number | null => target,
    metrics: () => ({ contentHeight, scrollOffset: offset, viewportHeight }),
    /** move part of the way to the target and report it, as RN would */
    advance(fraction: number) {
      if (target === null) throw new Error('advance() with nothing in flight')
      offset = Math.round(from + (target - from) * fraction)
      emitScroll()
    },
    /** let the running animation arrive */
    settle() {
      if (target !== null) offset = target
      target = null
      from = offset
      emitScroll()
    },
    /** someone other than us puts the reader somewhere — no gesture involved */
    moveTo(y: number) {
      offset = y
      emitScroll()
    },
    /** new content is laid out; RN reports it after the commit that appended */
    grow(by: number) {
      contentHeight += by
      props().onContentSizeChange(320, contentHeight)
    },
    /** the pane resizing — the thinking indicator taking room, or giving it back */
    resize(height: number) {
      viewportHeight = height
      props().onLayout({ nativeEvent: { layout: { height, width: 320, x: 0, y: 0 } } } as never)
    },
    emitScroll,
    distanceFromBottom: (): number =>
      distanceFromBottom({ contentHeight, scrollOffset: offset, viewportHeight }),
  }
}

type Surface = ReturnType<typeof scrollViewDouble>

// ---------------------------------------------------------------------------
// The hook, under real React
// ---------------------------------------------------------------------------

interface Rig {
  h: MobileHarness
  surface: Surface
  follow: () => NewMessageFollow
  /** append messages, the way the reducer would, and let React commit */
  push: (...arrived: Message[]) => void
}

async function openConversation(opts: { reduceMotion?: boolean } = {}): Promise<Rig> {
  const h = await mobileHarness({ reduceMotion: opts.reduceMotion ?? false })
  const base = h.controller.state
  let latest: NewMessageFollow | null = null
  let messages: Message[] = []

  function Probe({ list }: { list: Message[] }) {
    const state: AppState = { ...base, messages: list }
    latest = useNewMessageFollow(h.controller as MobileAssistantController, state)
    return null
  }

  const follow = (): NewMessageFollow => {
    if (latest === null) throw new Error('the hook has not run')
    return latest
  }
  const surface = scrollViewDouble(() => follow().scrollProps)

  const { rerender } = render(<Probe list={messages} />)
  // The ref React Native would attach on mount.
  ;(follow().scrollProps.ref as { current: unknown }).current = surface.view

  const push = (...arrived: Message[]): void => {
    messages = [...messages, ...arrived]
    act(() => {
      rerender(<Probe list={messages} />)
    })
  }

  // A session's history, which starts at the bottom (AC-30(b)).
  act(() => {
    surface.resize(VIEWPORT)
  })
  push(aiMessage('h1'), aiMessage('h2'), aiMessage('h3'))
  act(() => {
    surface.grow(0)
    surface.settle()
  })
  expect(surface.distanceFromBottom(), 'setup: the conversation must open at the bottom').toBe(0)
  expect(follow().affordance, 'setup: an affordance on first render').toBeNull()
  surface.calls.length = 0

  return { h, surface, follow, push }
}

/** (h): the user submits and F-001 renders the turn optimistically. The user's
 * message appends, the thinking indicator takes room from the pane, and the one
 * scroll routine starts — animated, so it has not landed when this returns. */
function submit(rig: Rig): void {
  rig.push(userMessage('u1'))
  act(() => {
    rig.surface.resize(VIEWPORT_THINKING)
    rig.surface.grow(USER_ROW)
  })
}

/** the reply to that same turn: the pane gets its room back and the row lands */
function reply(rig: Rig): void {
  rig.push(aiMessage('a1'))
  act(() => {
    rig.surface.resize(VIEWPORT)
    rig.surface.grow(REPLY_ROW)
  })
}

// ---------------------------------------------------------------------------

describe('AC-30(h) — BUG-006: the reply to your own turn, arriving mid-scroll', () => {
  it('is followed, not held below the fold', async () => {
    const rig = await openConversation()
    submit(rig)

    expect(rig.surface.calls.length, '(h) started no scroll at all').toBeGreaterThan(0)
    expect(
      rig.surface.calls.every((c) => c.animated),
      'setup: an instant scroll has no window, and nothing here would be testable',
    ).toBe(true)
    const firstTarget = rig.surface.target() as number
    expect(firstTarget, 'setup: the report’s stale target').toBe(CONTENT_0 + USER_ROW - VIEWPORT_THINKING)

    // Mid-flight — the report's t1. This is the sample clause (a) is about to be
    // asked for, and read literally it says the user is a long way from the
    // bottom.
    act(() => {
      rig.surface.advance(0.25)
    })
    expect(
      rig.surface.distanceFromBottom(),
      'setup: the live offset must read NOT at the bottom, or the race is not open',
    ).toBeGreaterThan(48)

    // …and here is the reply, landing in that window.
    reply(rig)

    // Clause (a) asks whether the USER is at the bottom. They asked to be there
    // and the app is on its way; the offset it is passing through is the app's
    // position, not theirs.
    expect(
      rig.follow().affordance,
      'the reply to your own turn raised an affordance — BUG-006',
    ).toBeNull()

    // (h)'s postcondition is an END STATE (`distance_from_bottom ≤ 48`), not "a
    // scroll was started". The reply moved the bottom, so the scroll is re-aimed
    // at where the bottom is NOW rather than left carrying a target computed
    // from content the reply did not exist in.
    expect(rig.surface.target(), 'the stale target was never re-aimed').toBeGreaterThan(firstTarget)

    act(() => {
      rig.surface.settle()
    })
    expect(rig.surface.distanceFromBottom()).toBeLessThanOrEqual(48)
    expect(rig.follow().affordance).toBeNull()
  })

  it('and the newest message is the one in view — not the row the stale target stopped at', async () => {
    // The same run, asserted as the user's complaint rather than as a flag: the
    // report's 623 against a bottom that had moved to 744.
    const rig = await openConversation()
    submit(rig)
    act(() => {
      rig.surface.advance(0.25)
    })
    reply(rig)
    act(() => {
      rig.surface.settle()
    })
    expect(rig.surface.offset()).toBe(CONTENT_0 + USER_ROW + REPLY_ROW - VIEWPORT)
  })
})

describe('AC-30(c) — the in-flight allowance ends, and these are the ways', () => {
  it('the user taking hold mid-scroll ends the app’s claim on their intent', async () => {
    const rig = await openConversation()
    submit(rig)
    act(() => {
      rig.surface.advance(0.25)
    })

    // A drag. Everything arriving after this is (c)'s: the user is reading where
    // they stopped, and a flag left raised would drag them to the bottom —
    // clause (c) deleted rather than BUG-006 fixed.
    act(() => {
      rig.follow().scrollProps.onScrollBeginDrag()
    })
    const held = rig.surface.offset()
    const callsBefore = rig.surface.calls.length

    reply(rig)

    expect(rig.surface.offset(), '(c) the view moved after the user took over').toBe(held)
    expect(rig.surface.calls.length, '(c) "no scroll animation is started at all"').toBe(callsBefore)
    expect(rig.follow().affordance).not.toBeNull()
  })

  it('a finger landing on the list ends it too, before anything has moved', async () => {
    // `onScrollBeginDrag` is the drag; this is the touch. A user who grabs the
    // list to stop it and then holds still produces the second and not the
    // first, and web's `pointerdown` listener covers exactly this case. Without
    // it, the next arrival would be followed while the user is holding the
    // surface — clause (c) with a gesture in it.
    const rig = await openConversation()
    submit(rig)
    act(() => {
      rig.surface.advance(0.25)
    })

    act(() => {
      rig.follow().scrollProps.onTouchStart()
    })
    const held = rig.surface.offset()
    const callsBefore = rig.surface.calls.length

    reply(rig)

    expect(rig.surface.offset(), '(c) the view moved after the user took hold').toBe(held)
    expect(rig.surface.calls.length, '(c) a scroll was started under the user’s finger').toBe(
      callsBefore,
    )
    expect(rig.follow().affordance).not.toBeNull()
  })

  it('a surface moved AWAY mid-scroll is no longer ours, with no gesture at all', async () => {
    const rig = await openConversation()
    submit(rig)
    act(() => {
      rig.surface.advance(0.25)
    })

    // Our scroll only ever travels TOWARD the bottom, so an offset that moved
    // the other way was moved by someone else. This is the case no platform
    // cancels for us, and the only signal is the comparison.
    act(() => {
      rig.surface.moveTo(0)
    })
    const callsBefore = rig.surface.calls.length

    reply(rig)

    expect(rig.surface.calls.length, '(c) a scroll was started for a surface we no longer own').toBe(
      callsBefore,
    )
    expect(rig.follow().affordance).not.toBeNull()
  })

  it('the ARRIVAL is what ends it — provably, with nothing else in the run that could', async () => {
    // The test below this one looks like it covers this, and does not: it moves
    // the surface back to 0, which ends the flight through the takeover branch
    // whether or not arriving at the bottom ever ended it. Mutating "lower the
    // flag on arrival" out of the model leaves that test green. So this run
    // contains no backwards movement at all — if the flag is down by the end,
    // only the arrival can have lowered it.
    const rig = await openConversation()
    submit(rig)
    act(() => {
      rig.surface.settle()
    })
    expect(rig.surface.distanceFromBottom(), 'setup: our scroll must have arrived').toBe(0)

    // Content grows underneath a reader who has not touched anything — a row
    // expanding, an indicator taking room. Clause (a) is a NUMBER, so they are
    // now away from the bottom without a gesture and without the offset moving.
    act(() => {
      rig.surface.grow(400)
    })
    const callsBefore = rig.surface.calls.length
    const held = rig.surface.offset()

    rig.push(aiMessage('a1'))
    act(() => {
      rig.surface.grow(REPLY_ROW)
    })

    expect(rig.surface.calls.length, 'a scroll of ours was still considered in flight').toBe(
      callsBefore,
    )
    expect(rig.surface.offset()).toBe(held)
    expect(rig.follow().affordance).not.toBeNull()
  })

  it('still holds for an arrival long after the scroll has landed', async () => {
    const rig = await openConversation()
    submit(rig)
    act(() => {
      rig.surface.settle()
    })

    // The scroll is over. The allowance must be over with it — a flag that is
    // never lowered turns "follow while we are on our way" into "follow always".
    act(() => {
      rig.surface.moveTo(0)
    })
    const callsBefore = rig.surface.calls.length

    rig.push(aiMessage('a1'))
    act(() => {
      rig.surface.grow(REPLY_ROW)
    })

    expect(rig.surface.offset()).toBe(0)
    expect(rig.surface.calls.length, 'a scroll was started for an arrival the user is away from').toBe(
      callsBefore,
    )
    expect(rig.follow().affordance).not.toBeNull()
  })
})

describe('AC-30(g) — an instant scroll is never in flight', () => {
  it('so reduce-motion judges the next arrival on the live sample, as it always did', async () => {
    const rig = await openConversation({ reduceMotion: true })
    submit(rig)

    expect(
      rig.surface.calls.every((c) => !c.animated),
      '(g) the observable is the ABSENCE of animation',
    ).toBe(true)
    // It has already arrived, so the user really is at the bottom and the reply
    // follows through (b) — the path that never had BUG-006 and cannot catch it.
    expect(rig.surface.distanceFromBottom()).toBeLessThanOrEqual(48)

    // Now take them away from the bottom, with nothing in flight to excuse it.
    act(() => {
      rig.surface.moveTo(0)
    })
    rig.push(aiMessage('a1'))
    act(() => {
      rig.surface.grow(REPLY_ROW)
    })
    expect(rig.surface.offset(), '(c) the view moved with no scroll of ours running').toBe(0)
    expect(rig.follow().affordance).not.toBeNull()
  })
})
