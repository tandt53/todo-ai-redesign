// The view half of F-001 AC-30 — the wiring that turns `model/follow.ts`'s
// decisions into a real React Native ScrollView. The web counterpart is
// `src/assistant/web/follow.ts`; both sit over the one DOM-free
// `_shared/model/follow.ts`, which owns the threshold, the arithmetic and every
// published string.
//
// BUG-004's root cause was that `ConversationList` rendered a plain
// `<ScrollView>` with no ref and no scroll effect, so nothing scrolled, ever.
// This hook supplies the three things it was missing — a ref, `onScroll` and
// `onContentSizeChange` — and holds the two facts the AC needs that are not in
// `AppState` (the AC adds no model state): the last viewport sample, and how
// many messages arrived while the user was away from the bottom.
//
// ── The one scroll routine ──────────────────────────────────────────────────
// `scrollToNewest` is called from THREE places and there is no fourth
// implementation: (b) an append while at the bottom, (f) activating the
// affordance, and (h) the user's own submit. (f) and (h) share a postcondition
// (`distance_from_bottom ≤ 48`, no affordance), and two implementations of one
// postcondition drift — L-005 is that shape twice over. A grep for
// `scrollToNewest` returns every caller.
//
// ── Where this DIFFERS from web, and why ────────────────────────────────────
// Web samples the scroller during render, because the DOM element still holds
// the pre-append content at that moment. React Native has no synchronously
// readable geometry: measurements arrive as events, and `onScroll` is throttled.
// So the sample is kept in a ref, and the append decision runs in a layout
// effect — which is still before RN's native `onContentSizeChange` callback for
// the new content, so `sample.current` is the pre-append measurement at exactly
// the moment the decision is made. Nothing here measures the scroll view
// directly. Sampling after the append instead would report every user as
// not-at-bottom and switch the whole follow behaviour off (AC-30(a)).
//
// The scroll itself is also re-driven on `onContentSizeChange`: on the (b)/(h)
// path the routine runs in the same commit as the append, when the new row has
// not been laid out yet, and a scroll fired then lands short by exactly that
// row — the same defect (h) warns about at the gesture, one layer down.
//
// ── BUG-006: a scroll of ours that is still travelling ──────────────────────
// An animated scroll takes time. Messages arrive during it. Until this hook
// kept the fact, "where is the surface right now" and "where does the user want
// to be" were answered by one number, so the reply to the user's own turn read
// as arriving while they were away from the bottom and clause (c) held it below
// the fold. The flag is raised by the one scroll routine, lowered on arrival,
// on a user gesture, and on the surface being moved away from us; it is read
// through `userIsAtBottom` inside `onMessagesAppended`.
//
// WHAT A MID-FLIGHT `scrollToEnd` CAN BE CANCELLED BY, and what this file does
// about it. React Native has no cancel API, and the two ways a running
// animation is actually interrupted are both handled by the platform rather
// than by us: a touch stops it natively on both iOS and Android, and a later
// programmatic scroll supersedes it. So the takeover case here **lowers the
// flag and disarms — it does not issue a counter-scroll.** Web has to issue one
// (an instant `scrollTo` to the current offset) because a browser keeps a
// smooth scroll running when the surface is moved out from under it; there is
// no path on this platform where a counter-scroll would be the thing that
// stops us, and adding an unverifiable native call on the strength of the
// analogy would be worse than the asymmetry. That reading is from React
// Native's documented behaviour, not from a device run — it is one of the rows
// this feature still owes a device.

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type {
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollViewInstance,
} from 'react-native'
import type { AppState } from '../../_shared/model/reducer.ts'
import type { Message } from '../../_shared/types.ts'
import type { MobileAssistantController } from '../controller.ts'
import {
  NOT_IN_FLIGHT,
  UNMEASURED,
  affordanceFor,
  onFlightSample,
  onMessagesAppended,
  onScrollIssued,
  onScrolled,
  onUserTookHold,
  scrollAnimated,
} from '../model/follow.ts'
import type { AffordanceView, ScrollFlight, ScrollMetrics } from '../model/follow.ts'

export interface NewMessageFollow {
  /** Spread onto the conversation `<ScrollView>`. */
  scrollProps: {
    ref: React.RefObject<ScrollViewInstance | null>
    onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => void
    onContentSizeChange: (width: number, height: number) => void
    onLayout: (e: LayoutChangeEvent) => void
    onScrollBeginDrag: () => void
    onTouchStart: () => void
    scrollEventThrottle: number
  }
  /** `null` = NMA-HIDDEN. */
  affordance: AffordanceView | null
  /** (f): activating the affordance scrolls to the bottom. Only scrolls. */
  activateAffordance: () => void
  /** how many messages are waiting below the fold — `expectedIds`' context */
  unseenBelowFold: number
}

/** A pure append leaves everything before it untouched. Anything else — the
 * history being replaced on a session sync or a clean start (F-001 AC-28) — is
 * a first render, which starts at the bottom with no affordance (AC-30(b)),
 * whatever the old viewport said. Same rule as the web half. */
function isPureAppend(previous: readonly string[], messages: readonly Message[]): boolean {
  if (previous.length === 0 || messages.length <= previous.length) return false
  return previous.every((id, i) => messages[i]?.id === id)
}

export function useNewMessageFollow(
  controller: MobileAssistantController,
  state: AppState,
): NewMessageFollow {
  const scrollRef = useRef<ScrollViewInstance | null>(null)
  const sample = useRef<ScrollMetrics>(UNMEASURED)
  const previousIds = useRef<readonly string[]>([])
  /** A scroll is owed as soon as the new content has been laid out. */
  const armed = useRef(false)
  /** …and a scroll already issued may still be travelling (BUG-006). The two
   * are different facts: `armed` is a scroll not yet started, `flight` is one
   * started and not yet arrived. The transitions live in `model/follow.ts`, so
   * the unit tier can see them; this hook only routes React Native's callbacks
   * into them. */
  const flight = useRef<ScrollFlight>(NOT_IN_FLIGHT)
  const [unseen, setUnseen] = useState(0)

  /** AC-30(g) binds EVERY scroll this AC mandates, so the guard lives here, in
   * the one routine, rather than being repeated per trigger — an enumeration of
   * triggers is the shape that leaves one door unguarded. Read at scroll time,
   * so flipping the OS switch mid-session takes effect on the next scroll.
   *
   * The routine owns the in-flight flag for the same reason it owns that guard:
   * a fact every caller would have to record is a fact the routine records once
   * (L-005). */
  const performScroll = useCallback(() => {
    const willAnimate = scrollAnimated(controller.reduceMotionEnabled())
    scrollRef.current?.scrollToEnd({ animated: willAnimate })
    flight.current = onScrollIssued(willAnimate, sample.current.scrollOffset)
  }, [controller])

  /** THE scroll routine. (b), (f) and (h) all end here. */
  const scrollToNewest = useCallback(() => {
    armed.current = true
    performScroll()
    setUnseen(0)
  }, [performScroll])

  useLayoutEffect(() => {
    const previous = previousIds.current
    const currentIds = state.messages.map((m) => m.id)
    const appended = isPureAppend(previous, state.messages)
    const seen = new Set(previous)
    const arrived = appended
      ? state.messages.slice(previous.length)
      : state.messages.filter((m) => !seen.has(m.id))
    const replacedHistory = !appended && arrived.length > 0
    previousIds.current = currentIds
    if (arrived.length === 0) return
    // (a): `sample.current` is the pre-append measurement — see the header. And
    // a pre-append sample taken while a scroll of ours is still travelling
    // reports where the surface is passing through, not where the user is
    // (BUG-006); `userIsAtBottom` inside the decision settles that.
    const outcome = onMessagesAppended(unseen, sample.current, arrived, {
      replacedHistory,
      ourScrollInFlight: flight.current.inFlight,
    })
    // (c): when the view must not move, nothing is armed, so the content-size
    // callback that follows this append starts no scroll at all.
    armed.current = outcome.follow
    if (outcome.follow) {
      scrollToNewest()
      return
    }
    setUnseen(outcome.unseen)
  }, [state.messages, unseen, scrollToNewest])

  const affordance = affordanceFor(unseen, state.messages)

  // components.md: the dock is a polite live region — the screen-reader user
  // hears the control arrive AND hears it change from NMA-NEW to NMA-WAITING.
  // React Native has no live region (web gets this from the DOM for free), so
  // it rides the Announcer port like every other announcement on this platform
  // (platform mobile.md).
  const announcedName = affordance === null ? null : affordance.accessibleName
  useEffect(() => {
    controller.announceAffordance(affordance)
    // `announcedName` is the identity that matters: a re-render with the same
    // words is not news, and the controller de-duplicates on it as well.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controller, announcedName])

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent
    const m: ScrollMetrics = {
      contentHeight: contentSize.height,
      scrollOffset: contentOffset.y,
      viewportHeight: layoutMeasurement.height,
    }
    sample.current = m
    // BUG-006: every sample is also applied to the flight — it ends on arrival,
    // and it ends if the surface moved AWAY from the bottom, which is the case
    // no gesture callback reports because there need not have been a gesture.
    const flown = onFlightSample(flight.current, m)
    flight.current = flown.flight
    // A scroll owed to an earlier trigger is not owed once the surface has been
    // taken; without this, unrelated content resizing later would yank the view.
    if (flown.takenOver) armed.current = false
    // (f), second half: the dismissal condition is BEING at the bottom, not the
    // gesture that got there, so it is applied to every sample.
    setUnseen((prev) => onScrolled(prev, m))
  }, [])

  const onContentSizeChange = useCallback(
    (_width: number, height: number) => {
      sample.current = { ...sample.current, contentHeight: height }
      if (!armed.current) return
      armed.current = false
      performScroll()
    },
    [performScroll],
  )

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    sample.current = { ...sample.current, viewportHeight: e.nativeEvent.layout.height }
  }, [])

  /** The user took over. Anything owed to an earlier tap is no longer owed —
   * without this, a tap followed by a manual scroll away could still yank the
   * view when unrelated content resized — and a scroll of ours still travelling
   * stops being the answer to "where is the user" the moment they take hold
   * (BUG-006).
   *
   * Two callbacks reach this, and the choice of which two is the mobile half of
   * web's `wheel` / `touchstart` / `pointerdown` / `keydown` listeners:
   *
   * - `onScrollBeginDrag` — a finger actually moving the list. React Native's
   *   own note is that it "also fires when *stopping* the scroll animation",
   *   which is not a false positive here: stopping our animation with a touch
   *   IS the user taking hold.
   * - `onTouchStart` — the finger landing, before anything has moved. This is
   *   the `pointerdown` half, and it is the only one that fires for a user who
   *   grabs the list to stop it and holds still. Like web's listener on the
   *   scroller, it also sees touches on the rows inside; that is the same
   *   trade web made, and the safe direction — an unnecessary release costs one
   *   arrival judged on the live sample, a missed one costs clause (c).
   *
   * **`onMomentumScrollBegin` is deliberately NOT one of them,** though it is
   * the obvious candidate. React Native emits momentum begin/end around
   * *programmatically animated* scrolls too — `ScrollView`'s own
   * `_isAnimating()` is defined as the interval between them, which is only
   * meaningful because our own `scrollToEnd` produces it. Releasing on it would
   * lower the flag on the very scroll that raised it, one frame later, and the
   * fix would read as present while doing nothing on a device. That reading is
   * from React Native's source and documented behaviour, not from a device run
   * — see this file's counterpart test for what remains device-owed. */
  const release = useCallback(() => {
    armed.current = false
    flight.current = onUserTookHold(flight.current)
  }, [])

  return {
    scrollProps: {
      ref: scrollRef,
      onScroll,
      onContentSizeChange,
      onLayout,
      onScrollBeginDrag: release,
      onTouchStart: release,
      // ~60 Hz. `onScroll` is throttled by nature, which is one more reason the
      // (a) sample is the stored pre-append one rather than a fresh read.
      scrollEventThrottle: 16,
    },
    affordance,
    activateAffordance: scrollToNewest,
    unseenBelowFold: unseen,
  }
}
