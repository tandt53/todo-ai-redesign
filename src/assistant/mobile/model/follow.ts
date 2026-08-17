// Following new messages — F-001 AC-30, the REACT NATIVE half. BUG-004's fix.
//
// ── What is NOT here, and why ───────────────────────────────────────────────
// The threshold, the arithmetic on a viewport sample, and every published
// string live in `src/assistant/_shared/model/follow.ts`, which is DOM-free and
// is the one home for them. AC-30(a) says in its own words that 48 is "the same
// number on both clients", so writing it twice would be L-004's shape — and, in
// the form this file briefly had, L-004 with its usual detection removed: the
// two constants had DIFFERENT NAMES (`AT_BOTTOM_SLACK` here, `BOTTOM_SLACK`
// there), so a grep for either returned one clean site and nothing anywhere
// would have reported them when they stopped agreeing.
//
// ── What IS here ────────────────────────────────────────────────────────────
// The state transitions, as pure functions, because this tier cannot render a
// React Native component (platform mobile.md: "Unit tier = model + ports"). The
// web client keeps the equivalent logic inline in its hook, where a DOM render
// test can reach it; a predicate inside an RN component is a decision nothing
// can test until a device shows up, so on this side it has to be extractable.
// Plus the two things that are genuinely platform-specific: reduce-motion
// arrives from a port rather than `matchMedia`, and the below-the-fold slice is
// needed by `expectedIds`, which has no DOM to ask.
//
// ── The clause that is easy to get subtly wrong ─────────────────────────────
// (a)'s sample is taken **before** the append. Appending grows `content_height`,
// so a post-append sample reports every user as not-at-bottom and (b) never
// fires — the feature would look like it "just doesn't work sometimes".
// `onMessagesAppended` therefore takes the sample as an ARGUMENT rather than
// reading it: a caller that hands it a fresh post-append measurement has to
// write that down at the call site, where a reviewer can see it.

import { isAtBottom, newMessageAffordance, userIsAtBottom } from '../../_shared/model/follow.ts'
import type { AffordanceView, ScrollMetrics } from '../../_shared/model/follow.ts'
import type { Message } from '../../_shared/types.ts'

export type { AffordanceRow, AffordanceView, ScrollMetrics } from '../../_shared/model/follow.ts'

/** A viewport that has not been measured yet. First render starts at the bottom
 * (AC-30(b)), so an unmeasured surface counts as at the bottom rather than as
 * scrolled away — the same answer web reaches from a null scroller. */
export const UNMEASURED: ScrollMetrics = { contentHeight: 0, scrollOffset: 0, viewportHeight: 0 }

export interface AppendOutcome {
  /** how many messages are now waiting below the fold */
  unseen: number
  /** true → `scrollToNewest()` (the one scroll routine). */
  follow: boolean
}

// ── A scroll of ours that is still travelling — BUG-006 ─────────────────────
//
// The shared `userIsAtBottom(live, ourScrollInFlight)` answers (a) for a
// surface whose own scroll may still be moving. It needs one bit from the
// platform layer: is one of ours in flight? On web that bit lives in the hook,
// where the DOM listeners are. Here it cannot: the hook is a React Native
// component and this tier cannot render one, so a flag maintained inside it
// would be a decision nothing can check until a device shows up — which is
// exactly how mobile's AC-30 stayed green for the whole period web's browser
// tier was reporting the reply to your own turn below the fold.
//
// So the bookkeeping is here, as transitions over a value, and the hook only
// routes RN's callbacks into them. Both tiers can then see it: this one drives
// the transitions directly, and `follow-in-flight.test.tsx` drives the hook
// that calls them against a ScrollView double with a real animation window.

export interface ScrollFlight {
  /** true while a scroll THIS AC started is still travelling to the bottom */
  inFlight: boolean
  /** the offset at the last sample. A scroll of ours only ever travels TOWARD
   * the bottom, so this is how the animation's own progress is told from the
   * surface being moved away by someone else. */
  lastOffset: number
}

export const NOT_IN_FLIGHT: ScrollFlight = { inFlight: false, lastOffset: 0 }

/**
 * The one scroll routine has issued a scroll.
 *
 * An **instant** scroll is never in flight: it has already arrived when the
 * call returns. That is why reduced motion (clause (g), TC-046) never had
 * BUG-006 — and why reduce-motion coverage cannot catch a regression of it.
 */
export function onScrollIssued(animated: boolean, from: number): ScrollFlight {
  return { inFlight: animated, lastOffset: from }
}

export interface FlightSample {
  flight: ScrollFlight
  /** the surface was taken from us mid-flight — clause (c) owns the view now,
   * and any remaining frames of our animation would move a view that must hold
   * still. See the hook for what React Native can and cannot do about it. */
  takenOver: boolean
}

/**
 * Every viewport sample, applied to the flight.
 *
 * Three deterministic events end it and there is no timer among them:
 *
 * - **arrival** — a sample within the threshold. The scroll is where it was
 *   going, so it is no longer going anywhere. Applied to every sample rather
 *   than to a single settle callback, so the flag cannot outlive the scroll
 *   because an end-of-scroll signal was missing, late, or never emitted.
 * - **taken over** — an offset that moved AWAY from the bottom. Ours only ever
 *   moves toward it, so someone else moved this one.
 * - a user gesture, which is `onUserTookHold` below rather than a sample,
 *   because it happens before anything has moved.
 *
 * The one-unit tolerance is the same residue AC-30(a)'s slack exists for:
 * fractional device-pixel rounding must not read as a takeover.
 */
export function onFlightSample(f: ScrollFlight, m: ScrollMetrics): FlightSample {
  const lastOffset = m.scrollOffset
  if (!f.inFlight) return { flight: { inFlight: false, lastOffset }, takenOver: false }
  if (m.scrollOffset < f.lastOffset - 1) return { flight: { inFlight: false, lastOffset }, takenOver: true }
  return { flight: { inFlight: !isAtBottom(m), lastOffset }, takenOver: false }
}

/**
 * The user took hold of the surface. (c) is about the USER's position, so the
 * moment they take it, the app's claim on their intent ends — whether or not
 * anything has moved yet.
 */
export function onUserTookHold(f: ScrollFlight): ScrollFlight {
  return { inFlight: false, lastOffset: f.lastOffset }
}

/**
 * The whole of (b), (c), (d) and (h) in one decision, because they are one
 * decision: what happens to the surface when the message list changes.
 *
 * - **(b)** at the bottom → the newest message is scrolled into view, and
 *   nothing is left below the fold, so no affordance appears. A change that is
 *   NOT a pure append — history replaced on a session sync or a clean start
 *   (F-001 AC-28) — is a first render, and "first render of a session's history
 *   also starts at the bottom" whatever the old viewport said.
 * - **(c)** not at the bottom → `follow` is false and the caller starts no
 *   scroll at all. A shorter or gentler scroll does not satisfy the clause.
 * - **(d)** arrivals ACCUMULATE into one count. N appends grow the number the
 *   single affordance reports; they never produce N affordances.
 * - **(h)** the user's own submit scrolls to the bottom wherever it was —
 *   **anchored to the append of the user's message, not to the gesture.** F-001
 *   renders the turn optimistically, so at gesture time the message is not in
 *   the content yet and a scroll fired then lands short by exactly that row.
 *   Expressed here as "a `user` message is among the arrivals", which is that
 *   append and nothing else: AC-3's cancel-before-send appends nothing and
 *   therefore scrolls nothing.
 *
 * `sampleTakenBeforeAppend` is (a)'s measurement and the parameter name is the
 * contract: it must be the last sample taken BEFORE this append grew the
 * content.
 *
 * `ourScrollInFlight` is the second half of (a) — BUG-006. A pre-append sample
 * is still the wrong answer if it was taken while a scroll of ours was moving:
 * it reports where the surface is passing through, and the question is where
 * the user is. The shared `userIsAtBottom` decides that, so web and this client
 * answer it identically rather than twice. It defaults to `false`, which is the
 * honest default — a caller with no notion of a scroll in flight is telling the
 * truth about not having one, and every existing non-animated path is unchanged.
 */
export function onMessagesAppended(
  unseen: number,
  sampleTakenBeforeAppend: ScrollMetrics,
  arrived: readonly Message[],
  opts: { replacedHistory?: boolean; ourScrollInFlight?: boolean } = {},
): AppendOutcome {
  if (opts.replacedHistory === true) return { unseen: 0, follow: true }
  if (arrived.length === 0) return { unseen, follow: false }
  const ownTurn = arrived.some((m) => m.kind === 'user')
  const atBottom = userIsAtBottom(sampleTakenBeforeAppend, opts.ourScrollInFlight === true)
  if (ownTurn || atBottom) return { unseen: 0, follow: true }
  return { unseen: unseen + arrived.length, follow: false }
}

/**
 * (f), second half: "Reaching the bottom by scrolling manually dismisses it
 * identically — the dismissal condition is **being at the bottom**, not the
 * gesture that got there." So this is driven by every sample, not by a scroll
 * handler that knows who caused the scroll.
 */
export function onScrolled(unseen: number, m: ScrollMetrics): number {
  return isAtBottom(m) ? 0 : unseen
}

/**
 * AC-30(g) is written as a QUANTIFIER, not a list: *every* scroll the AC
 * mandates completes without animation when reduce-motion is on. That is why
 * the answer lives in one function called by the one scroll routine, rather
 * than as a guard repeated per trigger — an enumeration of triggers is the
 * shape that leaves one door unguarded (L-005, and both F-003 bugs).
 *
 * The web half asks `matchMedia('(prefers-reduced-motion: reduce)')`; this half
 * takes the answer from the `ReduceMotion` port over
 * `AccessibilityInfo.isReduceMotionEnabled()`. AC-30(g) names both by name, so
 * the two sources are the AC's own, not a divergence.
 *
 * The observable is the ABSENCE of animation, not a shortened duration.
 */
export function scrollAnimated(reduceMotionEnabled: boolean): boolean {
  return !reduceMotionEnabled
}

/** The messages that arrived below the fold — the slice AC-30(e) asks about.
 * They are the tail of the list, because messages only ever append. */
export function belowFoldSlice(unseen: number, messages: readonly Message[]): readonly Message[] {
  if (unseen <= 0) return []
  return messages.slice(Math.max(0, messages.length - unseen))
}

/**
 * The control this surface is currently showing, or `null` for NMA-HIDDEN.
 *
 * A thin adapter over the shared builder, which owns the row choice and every
 * published string — the count and the tail are what this side has to supply.
 * `expectedIds` calls it too, so the accessibility-id contract and the
 * rendering read the same answer rather than agreeing by coincidence.
 */
export function affordanceFor(
  unseen: number,
  messages: readonly Message[],
): AffordanceView | null {
  return newMessageAffordance(unseen, belowFoldSlice(unseen, messages))
}
