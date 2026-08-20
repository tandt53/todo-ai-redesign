// AC-30 (BUG-004 · owner decision 2026-08-17) — "is the conversation following
// the newest message?" reduced to arithmetic, with **no DOM in it**, so web and
// React Native answer it identically instead of twice.
//
// Nothing here is model or persisted state: AC-30's preamble is explicit that
// "every term below is a measurement of the scroll viewport". The platform
// layer takes the measurement and hands it in; this file only does the sums and
// picks the published copy.
//
// Copy is transcribed from docs/design/_shared/components.md §NewMessageAffordance
// (rows NMA-HIDDEN / NMA-NEW / NMA-WAITING) — never composed here. The two
// NMA-NEW forms are stored as two literals rather than one interpolated
// template, because a template quietly serves combinations nobody enumerated
// (L-008); `follow.test.ts` parses the catalogue and asserts these against it,
// so drift in the *upstream* artifact fails the suite.

import type { Message } from '../types.ts'

/**
 * AC-30(a) — the same number on both clients, in the platform's logical units
 * (CSS pixels on web, density-independent points in React Native).
 *
 * The slack is deliberate and not "near enough": momentum scrolling, fractional
 * device-pixel rounding and keyboard-driven layout shifts leave a few units of
 * residue, and an exact-zero test would flip the surface between following and
 * not-following during ordinary use.
 */
export const BOTTOM_SLACK = 48

/** A sample of the scroll viewport. Taken by the platform layer, **immediately
 * before a message is appended** — never after. Appending grows
 * `contentHeight`, so a post-append sample reports every user as not-at-bottom
 * and AC-30(b)'s follow would never fire. */
export interface ScrollMetrics {
  contentHeight: number
  scrollOffset: number
  viewportHeight: number
}

export function distanceFromBottom(m: ScrollMetrics): number {
  return m.contentHeight - (m.scrollOffset + m.viewportHeight)
}

export function isAtBottom(m: ScrollMetrics): boolean {
  return distanceFromBottom(m) <= BOTTOM_SLACK
}

/**
 * AC-30(a) asked of a surface whose **own** scroll may still be moving —
 * BUG-006.
 *
 * (a)'s sample answers one question: *is the user at the bottom?* A live offset
 * answers a different one — where the surface happens to be at this instant —
 * and the two come apart for exactly as long as an animated scroll is in
 * flight. That gap is BUG-006: clause (h)'s smooth scroll was still moving when
 * the reply to the user's own turn arrived, the live sample read 270 units from
 * the bottom, the reply took clause (c)'s hold-still branch, and the answer to
 * what the user had just said was left below the fold — BUG-004's symptom
 * returning through a race.
 *
 * The answer this file gives: **while a scroll this AC started is in flight,
 * the user's position is the bottom.** Two things it deliberately is not:
 *
 * - not the offset the animation is passing through — that is the app's
 *   position, not the user's, and the user asked to be at the bottom;
 * - not the target the animation was given either. That target was computed
 *   from the content *before* the arriving message existed and is stale by
 *   exactly the row that just landed (the report's 623, where the bottom had
 *   moved to 744). Sampling it would reproduce the same 121-unit shortfall with
 *   more ceremony.
 *
 * Every scroll this AC mandates goes to the bottom, and the platform routine
 * re-aims it at the bottom on each append until it lands, so "in flight" and
 * "heading for the bottom" are one fact rather than two.
 *
 * The flag belongs to the platform layer, which is the half that knows about
 * animation: set when the routine starts an **animated** scroll, lowered when
 * the surface arrives or when the user takes hold of it. An instant scroll is
 * never in flight — which is why reduced motion (clause (g), TC-046) never had
 * this defect, and why reduce-motion coverage cannot catch a regression of it.
 */
export function userIsAtBottom(live: ScrollMetrics, ourScrollInFlight: boolean): boolean {
  return ourScrollInFlight || isAtBottom(live)
}

/** The two rendered rows of §NewMessageAffordance. NMA-HIDDEN is the absence of
 * a view, not a third row — it holds no layout, so nothing reflows when it
 * goes. */
export type AffordanceRow = 'NMA-NEW' | 'NMA-WAITING'

export interface AffordanceView {
  row: AffordanceRow
  /** the visible label */
  label: string
  /** the visible label followed by the action — the visible text is always a
   * prefix of the accessible name, never a replacement (WCAG 2.5.3) */
  accessibleName: string
}

/**
 * The newest unresolved question among the messages that arrived below the
 * fold, by its own published head.
 *
 * AC-30(e) is load-bearing: because the bulk-delete confirmation gets no
 * priority (owner decision rule 5), a user who has scrolled up can be asked
 * "Delete 3 tasks?" and never see it, and this control is then the only
 * indication that the app is waiting on them. So the affordance names its
 * newest reason. `{question}` is verbatim — the question's own head as
 * §Message bubbles publishes it, never re-worded for the pill.
 *
 * A question that has resolved — answered, or declined by a later unrelated
 * turn — is no longer pending, so it is skipped and the control falls back to
 * NMA-NEW (§NewMessageAffordance, "Precedence is one rule").
 */
export function pendingQuestionHead(arrived: readonly Message[]): string | null {
  for (let i = arrived.length - 1; i >= 0; i--) {
    const m = arrived[i]
    if (m !== undefined && m.kind === 'question' && !m.resolved) return m.head
  }
  return null
}

/**
 * The whole control, from two inputs: how many messages arrived while the user
 * was away from the bottom, and which of them arrived.
 *
 * `null` is NMA-HIDDEN. One control however many messages arrived (AC-30(d)) —
 * the count lives here, so there is nothing to stack.
 */
export function newMessageAffordance(
  unseen: number,
  arrived: readonly Message[],
): AffordanceView | null {
  if (unseen <= 0) return null

  const question = pendingQuestionHead(arrived)
  if (question !== null) {
    // NMA-WAITING. The label already ends in a question mark, so the action is
    // a new sentence rather than a clause — two literals, because the
    // punctuation differs and a template would guess.
    const label = `Waiting for your answer — ${question}`
    return { row: 'NMA-WAITING', label, accessibleName: `${label} Scroll to newest` }
  }

  // NMA-NEW. Singular and plural are the whole set — not a template over a noun.
  const label = unseen === 1 ? '1 new message' : `${unseen} new messages`
  return { row: 'NMA-NEW', label, accessibleName: `${label}, scroll to newest` }
}
