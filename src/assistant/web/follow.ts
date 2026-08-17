// AC-30 on web — the DOM half of `_shared/model/follow.ts`.
//
// Three clauses mandate a scroll: (b) the follow, (f) the activation, (h) the
// submit. They share a postcondition — `distance_from_bottom <= 48`, no
// affordance — so they share ONE routine, `scrollToNewest`. Two implementations
// of one postcondition drift (L-005), and (g)'s reduced-motion obligation is
// written as a quantifier over *every* scroll this AC mandates, so it is
// attached to the routine rather than repeated at each call site. A later path
// that scrolls this surface inherits it by calling the routine.
//
// BUG-006 added the fourth fact this file has to keep: **whether a scroll of
// ours is still in flight.** An animated scroll takes time, messages arrive
// during it, and until that flag existed the two questions "where is the
// surface right now" and "where does the user want to be" were answered by one
// number — so the reply to the user's own turn read as arriving while they were
// away from the bottom, and clause (c) held it below the fold. The flag is
// raised by `scrollToNewest`, lowered on arrival or when the user takes hold,
// and read through `userIsAtBottom` in `_shared/model/follow.ts`.

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { isAtBottom, newMessageAffordance, userIsAtBottom } from '../_shared/model/follow.ts'
import type { AffordanceView, ScrollMetrics } from '../_shared/model/follow.ts'
import type { Message } from '../_shared/types.ts'

/** The viewport sample, in CSS pixels (AC-30(a)). */
export function metricsOf(el: HTMLElement): ScrollMetrics {
  return {
    contentHeight: el.scrollHeight,
    scrollOffset: el.scrollTop,
    viewportHeight: el.clientHeight,
  }
}

/** AC-30(g), read per scroll rather than cached, so turning the OS setting on
 * mid-session takes effect on the next scroll. Guarded: `matchMedia` is absent
 * in the unit environment, and absent means "no preference expressed". */
export function prefersReducedMotion(): boolean {
  const mm = (globalThis as { matchMedia?: (q: string) => MediaQueryList }).matchMedia
  if (typeof mm !== 'function') return false
  try {
    return mm.call(globalThis, '(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

/**
 * A scroll this routine started that has not yet been seen to land — the state
 * BUG-006 turned on. `aimedAt` is the offset the running animation is carrying;
 * `null` means nothing of ours is in flight.
 *
 * It is a mutable box rather than React state on purpose: it is read during
 * render (where the (a) sample is taken) and written from a layout effect and
 * from DOM listeners, and a re-render on each of those transitions is exactly
 * the extra frame clause (c) forbids.
 */
export interface PendingScroll {
  aimedAt: number | null
  /** the offset at the last scroll event — how a movement AWAY from the bottom
   * is told from the animation's own progress toward it */
  lastOffset: number
}

/**
 * The one scroll routine AC-30 mandates. Callers: the follow in
 * `useFollowNewMessages` (b), the same hook's `activate` (f), and its submit
 * branch (h) — a grep for this name returns every door.
 *
 * Under reduced motion the final position is identical and there are no
 * intermediate frames; the observable is the absence of animation, not a
 * shortened duration.
 *
 * The routine also owns the in-flight flag, for the same reason (g)'s
 * reduce-motion check lives here rather than at each call site: a fact every
 * caller must record is a fact the routine should record once (L-005). An
 * instant scroll has already arrived when it returns, so it lowers the flag;
 * an animated one raises it and records where it is heading.
 */
export function scrollToNewest(el: HTMLElement | null, pending: PendingScroll): void {
  if (el === null) return
  const top = el.scrollHeight
  pending.lastOffset = el.scrollTop
  if (prefersReducedMotion() || typeof el.scrollTo !== 'function') {
    el.scrollTop = top
    pending.aimedAt = null
    return
  }
  el.scrollTo({ top, behavior: 'smooth' })
  pending.aimedAt = top
}

/**
 * Stop a scroll of ours that is still running, leaving the surface exactly
 * where it now is. An instant `scrollTo` to the current offset is how a smooth
 * scroll is cancelled — there is no cancel API — and it is a no-op for a
 * surface that is not moving.
 */
function abandonScroll(el: HTMLElement, pending: PendingScroll): void {
  pending.aimedAt = null
  if (typeof el.scrollTo === 'function') el.scrollTo({ top: el.scrollTop, behavior: 'auto' })
}

/**
 * The viewport sample, plus the one thing that has to happen wherever the
 * position is read: a surface that is **at** the bottom is no longer on its way
 * there, so the flight ends. Doing it here rather than in a single settle
 * handler means the flag cannot outlive the scroll just because the browser's
 * end-of-scroll signal is missing, late, or unsupported.
 */
function sample(el: HTMLElement, pending: PendingScroll): ScrollMetrics {
  const live = metricsOf(el)
  if (pending.aimedAt !== null && isAtBottom(live)) pending.aimedAt = null
  return live
}

/** What the render pass decided, handed to the layout effect that commits it. */
interface Commit {
  scroll: boolean
  nextUnseen: number
}

export interface FollowHandle {
  /** attach to the scrolling conversation element */
  scrollerRef: RefObject<HTMLDivElement | null>
  /** attach to its `onScroll` — reaching the bottom by hand dismisses (f) */
  onScroll: () => void
  /** null = NMA-HIDDEN */
  affordance: AffordanceView | null
  /** the affordance's activation (f) */
  activate: () => void
}

/**
 * Follow-or-hold, for one conversation surface.
 *
 * The sample that decides it is taken **during render** — React runs the render
 * pass before it mutates the DOM, so at that moment the element still holds the
 * pre-append content. Sampling in an effect instead would read the grown
 * `content_height`, report every user as not-at-bottom, and switch the whole
 * follow behaviour off; that is the defect that ships looking like "the feature
 * just doesn't work sometimes" (AC-30(a)).
 */
export function useFollowNewMessages(messages: readonly Message[]): FollowHandle {
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const seen = useRef<{ count: number; lastId: string | null }>({ count: 0, lastId: null })
  const commit = useRef<Commit | null>(null)
  const pending = useRef<PendingScroll>({ aimedAt: null, lastOffset: 0 })
  const [unseen, setUnseen] = useState(0)

  const count = messages.length
  const lastId = count === 0 ? null : (messages[count - 1] as Message).id

  if (count !== seen.current.count || lastId !== seen.current.lastId) {
    const before = seen.current
    seen.current = { count, lastId }

    // A pure append leaves everything before it untouched. Anything else — the
    // history being replaced on a session sync or a clean start — is a first
    // render, which starts at the bottom with no affordance (AC-30(b)).
    const appended =
      before.count > 0 &&
      count > before.count &&
      messages[before.count - 1]?.id === before.lastId

    if (!appended) {
      commit.current = { scroll: true, nextUnseen: 0 }
    } else {
      const el = scrollerRef.current
      // (a) asks whether the USER is at the bottom, and while a scroll of ours
      // is still moving toward it the live offset answers a different question
      // (BUG-006 — see `userIsAtBottom`).
      const atBottomBefore =
        el === null || userIsAtBottom(sample(el, pending.current), pending.current.aimedAt !== null)
      const arrived = messages.slice(before.count)
      // (h) The moment is the append of the user's own message, not the submit
      // gesture: F-001 renders the turn optimistically, so at gesture time the
      // message is not in the content yet and a scroll fired then lands short
      // by exactly that row. A submit that appends nothing (AC-3's
      // cancel-before-send) reaches this branch never, and scrolls nothing.
      const ownSubmit = arrived.some((m) => m.kind === 'user')
      commit.current =
        ownSubmit || atBottomBefore
          ? { scroll: true, nextUnseen: 0 }
          : { scroll: false, nextUnseen: unseen + arrived.length }
    }
  }

  // Use the decision in THIS render, not one frame later: (c) says the view
  // does not move, and a pill that appears and then corrects itself has moved
  // something.
  const nextUnseen = commit.current === null ? unseen : commit.current.nextUnseen

  useLayoutEffect(() => {
    // A render that decided nothing touches nothing — not even a measurement.
    // Reading `scrollHeight` here forces a layout flush before paint, and doing
    // that on renders with nothing to commit moved a parked reader by 1–2 units
    // in TC-048 (Chromium settles scroll anchoring differently). TC-048 is
    // right to call that a move: "a submit that appends nothing scrolls
    // nothing" is the clause, and 2 units is not nothing.
    const c = commit.current
    if (c === null) return
    commit.current = null
    // (f)/(h) state the postcondition as an END STATE — `distance_from_bottom ≤
    // 48` — not as "a scroll was started". The re-aim that BUG-006 needs rides
    // on that same decision rather than on a timer or on every render: an
    // append landing mid-flight is what moves the bottom, it is exactly what
    // sets `scroll` above (through `userIsAtBottom`), and `scrollToNewest`
    // recomputes its target from the content as it is NOW.
    if (c.scroll) scrollToNewest(scrollerRef.current, pending.current)
    setUnseen(c.nextUnseen)
  })

  useEffect(() => {
    const el = scrollerRef.current
    if (el === null) return
    // (c) is about the USER's position, so the moment the user takes hold of
    // the surface, the app's claim on their intent ends. Chromium cancels a
    // smooth scroll on the first user gesture; a flag left raised past that
    // would drag the next arrival's reader to the bottom — (c) deleted rather
    // than BUG-006 fixed. Listened for here rather than handed to the pane as
    // four more props, so no call site can forget one.
    const release = (): void => {
      pending.current.aimedAt = null
    }
    const gestures = ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const
    for (const g of gestures) el.addEventListener(g, release, { passive: true })
    return () => {
      for (const g of gestures) el.removeEventListener(g, release)
    }
  }, [])

  const onScroll = useCallback(() => {
    const el = scrollerRef.current
    if (el === null) return
    const p = pending.current

    // A scroll of ours only ever travels TOWARD the bottom, so an offset that
    // has moved the other way was moved by someone else — the reader, or any
    // other repositioning of the surface. Clause (c) then owns the view, and an
    // animation still running would move a view that must hold still. There is
    // no cancel API, so cancelling means scrolling instantly to where we
    // already are.
    //
    // This is deliberately a comparison of positions and not a timer: it fires
    // on the first frame after the surface is taken away from us, on any
    // machine, rather than relying on the animation being over by the time
    // anyone looks. The gesture listeners above cover the other half — a user
    // taking hold without having moved anything yet.
    if (p.aimedAt !== null && el.scrollTop < p.lastOffset - 1) abandonScroll(el, p)
    p.lastOffset = el.scrollTop

    // (f) The dismissal condition is BEING at the bottom, not the gesture that
    // got there. `sample` also lowers the in-flight flag on arrival, which is
    // the ordinary way a scroll ends in a browser: it fires scroll events all
    // the way there.
    if (isAtBottom(sample(el, p))) setUnseen(0)
  }, [])

  const activate = useCallback(() => {
    scrollToNewest(scrollerRef.current, pending.current)
    setUnseen(0)
  }, [])

  // The messages that arrived below the fold — the slice AC-30(e) asks about.
  const arrived = nextUnseen <= 0 ? [] : messages.slice(Math.max(0, count - nextUnseen))

  return {
    scrollerRef,
    onScroll,
    affordance: newMessageAffordance(nextUnseen, arrived),
    activate,
  }
}
