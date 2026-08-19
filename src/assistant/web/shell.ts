// The app shell — which surface is showing, which collection the list renders,
// whether the Lists menu is open, and AC-31's door from a message to a row.
//
// THE LAYOUT BRANCH IS NOT IN HERE, AND THAT IS THE POINT. There is exactly one
// branch — `tokens.json breakpoints.split` — and it is a CONTAINER QUERY on the
// app root in styles.css, never a width read in JavaScript. Two consequences,
// both deliberate:
//
//   1. Every surface is mounted at every width. Below the split CSS shows one;
//      at or above it, Tasks holds the centre and Talk holds the right panel and
//      both are permanently on screen (components.md § AppFrame). No behaviour
//      here selects on viewport, so nothing in this file can grow the
//      width-selected second mechanism `owner-decision-2026-08-17-desktop-list-
//      is-primary.md` constraint 2 forbids.
//   2. `revealTask` below is ONE routine with two entry points, not two
//      implementations of one postcondition (AC-31, and the discipline AC-30(h)
//      already imposes on (f)/(h) — L-005). Below the split it navigates first;
//      at or above it the navigation is a no-op because the centre is already
//      the list. Same call, same postcondition: the row is on screen and has
//      flashed exactly once.

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { nowDate } from '../_shared/model/clock.ts'
import { DEFAULT_COLLECTION, inCollection } from '../_shared/model/tasks.ts'
import type { Collection } from '../_shared/model/tasks.ts'
import type { AppState } from '../_shared/model/reducer.ts'
import { prefersReducedMotion } from './follow.ts'

/**
 * The surfaces this shell can show. S3 (Lists menu) is a slide-over and S5 (New
 * list) is a sheet — neither is a surface, and S5 is not built at all: it depends
 * entirely on a `lists` table that does not exist (IA §7).
 *
 * **`'detail'` is F-005 AC-45's fourth value, and adding a value is the whole of
 * the change.** The AC's own words: *"It is a single application state placed by
 * CSS at both widths — never two states selected by a measured width."* So the
 * detail is not a second layout mechanism, a modal, a route or a panel: it is one
 * more value of the enum this file already had, and `styles.css`'s single
 * container query decides where it lands.
 *
 * **`settings` is the shipped precedent** — *replaces the centre, never the panel*
 * (`.app[data-surface="settings"] .s-tasks { display: none }` inside the one
 * `@container` block). The detail follows it exactly, which is what keeps the
 * conversation rendered beside it above the split so AC-3's arriving change keeps
 * a subject.
 *
 * **The runtime observable is that crossing `breakpoints.split` changes nothing
 * the detail holds** — same task, focused field, dirty value, uncommitted repeat
 * preview, outstanding notice (tester W10). A two-state implementation that resets
 * on the crossing passes every other test AC-45 supports while a source grep for a
 * width read stays clean, because a width read can live in a hook, a media-query
 * listener or a resize observer. There is none here, and the enum having one more
 * value rather than one more mechanism is why there cannot be.
 */
export type ShellSurface = 'talk' | 'tasks' | 'settings' | 'detail'

/**
 * How long the arrival flash lasts: `motion.duration_ms.diffFlashHold` +
 * `diffFlashFade` from `design/_shared/tokens.json`. AC-4's existing treatment,
 * re-attached by AC-31 from "whenever a turn applies" to "on arrival from the
 * message that changed it".
 *
 * `shell.test.ts` parses tokens.json and asserts this number, so a token change
 * fails the suite instead of silently leaving the JS and the CSS disagreeing
 * (L-008 — the test reads the owning artifact, not a retyped copy).
 */
export const FLASH_MS = 2000

export interface ShellHandle {
  surface: ShellSurface
  collection: Collection
  menuOpen: boolean
  /** the row currently flashing from an AC-31 arrival, or null */
  flashTaskId: string | null
  /** alternates per activation so the CSS animation restarts on a repeat tap */
  flashPhase: 'a' | 'b'
  /** the Tasks surface's scroll viewport — what `revealTask` scrolls */
  tasksRef: RefObject<HTMLDivElement | null>
  go: (s: ShellSurface) => void
  setMenuOpen: (open: boolean) => void
  pickCollection: (c: Collection) => void
  openSettings: () => void
  backFromSettings: () => void
  /**
   * **F-001 AC-31 revision 7 — the gate is the task EXISTING.**
   *
   * It read *"is this task one the list currently holds?"*, justified by
   * *"rendered as an inert control it would be an affordance that does nothing,
   * which is worse than none"*. **That reason was true when it was written** — it
   * holds only while the postcondition is *bring the row into view in the list*,
   * which a filtered-out row genuinely could not satisfy, because no collection
   * change had been specified anywhere.
   *
   * Two later decisions falsified it. **Rev 6** gave the door a second
   * postcondition that needs nothing from the list at all (the open detail changes
   * subject — `F-005 AC-48`), and the owner's direction of 2026-08-19 supplies the
   * collection change the first postcondition was missing: activating the door
   * **switches to a collection that holds the row**.
   *
   * **Why it was urgent rather than a tidy-up:** `DEFAULT_COLLECTION` is Today and
   * the assistant creates dateless tasks, which are in Inbox — so under the old
   * gate **the task the assistant has just created was the one task in the message
   * that was not a door**, with nothing on screen saying why. That is the common
   * case, and it disabled the very receipt the answer to
   * `owner-question-2026-08-18-assistant-created-tasks-are-invisible.md` rests on.
   * Compounding it: while the detail is open the old gate consulted a collection
   * `F-005 AC-45` puts on screen **at no width**.
   *
   * **The deleted task stays inert, and still for its own reason** — no row exists
   * anywhere to bring into view, so no collection change and no layout can meet
   * the postcondition. Plain text, never a disabled or inert control.
   *
   * **One condition, two client predicates** (L-005): this and
   * `mobile/model/task-link.ts`'s `taskLinkState`. Amending only one leaves the
   * door meaning two different things on two clients, decided by a filter the user
   * cannot see on either — which is why F-001 AC-31 names both by path. The mobile
   * half is mobile-agent's; the spec names both so a later grep returns every door.
   *
   * **No clock is read here any more, and that is a consequence rather than a
   * saving:** the old predicate called `inCollection`, which needs a `now`, and it
   * was deliberately not memoised because *"a link answered from a cached clock is
   * the inert case pretending to be live"*. Existence is not a function of the
   * clock, so the inline `new Date()` this file used to mint is simply gone —
   * one of the five inline sites AC-44 counts.
   */
  canReveal: (taskId: string) => boolean
  /** AC-31's one scroll-and-flash routine. A grep for this name returns every
   * caller, which is the property L-005 asks for. */
  revealTask: (taskId: string) => void

  // ── F-005 AC-45 / AC-48 — the task detail ───────────────────────────────────

  /** The task whose detail is open, or `null`. Held even while another surface is
   * showing? **No** — leaving the Tasks surface closes it (AC-45's edge list, IA
   * §4): `Tasks · N` returns the user to their list, not to a detail they had
   * forgotten. `go`, `pickCollection` and `openSettings` all clear it. */
  detailTaskId: string | null
  /** AC-1 — activating a task row opens its detail in **one action**. */
  openDetail: (taskId: string) => void
  /** AC-45 — closing is **unconditionally available**: never held over an
   * in-flight or failed write (the owner's narrowing of AC-2, and what F-001
   * AC-24 rev 6's *neither hidden nor disabled* condition needs). */
  closeDetail: () => void
}

export function useShell(state: AppState): ShellHandle {
  // Below the split the app opens on Talk — what it does today, what the three
  // mockups draw, and what design proposes (IA §12). It is F-001 Open Question
  // 9 and the OWNER has the call; nothing else in this file assumes it, because
  // every other behaviour here is a postcondition rather than an entry point.
  const [surface, setSurface] = useState<ShellSurface>('talk')
  const [collection, setCollection] = useState<Collection>(DEFAULT_COLLECTION)
  const [menuOpen, setMenuOpen] = useState(false)
  const [flash, setFlash] = useState<{ taskId: string; phase: 'a' | 'b' } | null>(null)
  // AC-45 — the detail's subject. One piece of state, no width in sight.
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null)
  const tasksRef = useRef<HTMLDivElement | null>(null)
  /** set by `revealTask`, consumed by the layout effect after the surface and
   * the menu have actually committed — the row may not be in the DOM yet at
   * call time, because below the split the click that reveals it is also the
   * click that navigates to the list. */
  const pendingReveal = useRef<string | null>(null)

  // Every navigation off the Tasks surface closes the detail (AC-45's edge list,
  // IA §4: "leaving the Tasks surface closes it, and `Tasks · N` returns the user
  // to their list, not to a detail they had forgotten"). Closing here rather than
  // in each caller is what stops one door forgetting (L-005) — and it is safe
  // unconditionally, because AC-2 no longer holds the detail open over an
  // unresolved write and AC-47 carries whatever a close would otherwise lose.
  const go = useCallback((s: ShellSurface) => {
    setSurface(s)
    setMenuOpen(false)
    if (s !== 'detail') setDetailTaskId(null)
  }, [])

  const pickCollection = useCallback((c: Collection) => {
    setCollection(c)
    setSurface('tasks')
    setMenuOpen(false)
    setDetailTaskId(null)
  }, [])

  const openSettings = useCallback(() => {
    setSurface('settings')
    setMenuOpen(false)
    setDetailTaskId(null)
  }, [])

  // "Back always means up one level" (IA §4): S4 is stacked on S3, so back
  // returns to the menu rather than to whichever peer was last on screen.
  const backFromSettings = useCallback(() => {
    setSurface('tasks')
    setMenuOpen(true)
  }, [])

  // F-001 AC-31 rev 7 — **the task existing**, and nothing about the collection on
  // screen. See `ShellHandle.canReveal` for why the old gate's reason was true
  // when written and is false now.
  //
  // `deleted_at` is checked as well as membership in `state.tasks`: a row the
  // client still holds but the server has soft-deleted is the delete case, and
  // that one is still inert **for its own reason** — no row exists anywhere to
  // bring into view.
  const canReveal = (taskId: string): boolean =>
    state.tasks.some((t) => t.id === taskId && t.deleted_at === null)

  const revealTask = useCallback(
    (taskId: string) => {
      // ── AC-31 rev 6 — the swap door ────────────────────────────────────────
      // At or above the split the conversation renders beside the detail (F-005
      // AC-45), so the door is activatable while a DIFFERENT task's detail is
      // open, and activating it **replaces the open detail with the named task's**
      // — one context change instead of two, leaving the user in the surface they
      // were already working in. **When the named task is the one the detail
      // already holds, nothing is replaced and the postcondition is already true.**
      //
      // The condition is `detailTaskId !== null` and not a width read: below the
      // split S1 and S6 are never on screen together, so there is no door to
      // activate and this branch is unreachable there. That is what lets one
      // routine serve both widths without asking how wide it is.
      if (detailTaskId !== null) {
        if (detailTaskId === taskId) return
        setDetailTaskId(taskId)
        // The arrival cue is AC-3's re-subjected one — constants inherited, subject
        // re-attached — because the diff flash is specified as a tint across a row
        // BACKGROUND and a detail is not a row.
        setFlash((prev) => ({ taskId, phase: prev?.phase === 'a' ? 'b' : 'a' }))
        return
      }
      // ── AC-31 rev 7 — the collection switch is ROUTE, not postcondition ────
      // *"At either width the route first switches to a collection that holds the
      // row, when the one on screen does not."* It belongs to this single routine
      // and not to a second gate beside it, which is the whole of what rev 7 moved.
      const target = collectionHolding(state, taskId, collection)
      if (target !== null) setCollection(target)
      // Entry point 1 (below the split) navigates; entry point 2 (at or above it)
      // finds the list already in the centre and this is inert. One call.
      setSurface('tasks')
      setMenuOpen(false)
      pendingReveal.current = taskId
      setFlash((prev) => ({ taskId, phase: prev?.phase === 'a' ? 'b' : 'a' }))
    },
    [state, collection, detailTaskId],
  )

  // F-005 AC-1 — one action from a row to its detail.
  const openDetail = useCallback((taskId: string) => {
    setDetailTaskId(taskId)
    setSurface('detail')
    setMenuOpen(false)
  }, [])

  // F-005 AC-45 / F-001 AC-24 rev 6 — **unconditional**. There is no guard here
  // and there must not be one: an unresponsive server is exactly where *"closing
  // waits for in-flight writes to resolve"* and *"the detail cannot be closed"*
  // are the same behaviour, and the user cannot tell which one they are in.
  const closeDetail = useCallback(() => {
    setDetailTaskId(null)
    setSurface('tasks')
  }, [])

  useLayoutEffect(() => {
    const taskId = pendingReveal.current
    if (taskId === null) return
    pendingReveal.current = null
    const root = tasksRef.current
    if (root === null) return
    // Walked rather than selected by id: a task id is server-generated and a
    // selector built from it would need escaping to be correct for every value
    // it can hold. A walk cannot be wrong about that.
    let row: HTMLElement | null = null
    for (const el of root.querySelectorAll('[data-task-id]')) {
      if (el.getAttribute('data-task-id') === taskId) {
        row = el as HTMLElement
        break
      }
    }
    if (row === null || typeof row.scrollIntoView !== 'function') return
    row.scrollIntoView({
      block: 'center',
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    })
  })

  // "Flashed ONCE" is the acceptance, so the cue has to end. Clearing it also
  // makes a second activation observable as a second flash rather than as a
  // tint that was already there.
  useEffect(() => {
    if (flash === null) return
    const id = setTimeout(() => setFlash(null), FLASH_MS)
    return () => clearTimeout(id)
  }, [flash])

  return {
    surface,
    collection,
    menuOpen,
    flashTaskId: flash?.taskId ?? null,
    flashPhase: flash?.phase ?? 'a',
    tasksRef,
    go,
    setMenuOpen,
    pickCollection,
    openSettings,
    backFromSettings,
    canReveal,
    revealTask,
    detailTaskId,
    openDetail,
    closeDetail,
  }
}

/**
 * **Which collection the door switches to** (F-001 AC-31 rev 7's route half).
 *
 * `null` means *no switch needed* — the collection on screen already holds the
 * row, which is the ordinary case and the one where switching would be a
 * gratuitous context change.
 *
 * F-001 **Open Question 12 is OPEN** and this implements its stated
 * recommendation, **(a) prefer the date collection, falling back to Inbox**, for
 * the reason the OQ gives: the collections overlap by design (`inCollection` is
 * explicitly not a partition — an unfiled task dated today is in **Today and Inbox
 * at once**, measured `|Inbox ∩ Today| = 7`), so *"the collection holding it"*
 * names exactly one collection only for a done task.
 *
 * **What is already binding, so nothing is left unowned while the OQ is open:**
 * AC-31's postcondition is satisfied by **any** collection that holds the row, so
 * the requirement stays falsifiable and the test is the same whichever answer the
 * owner picks. Candidate **(b) always Inbox** is one line and is correct today only
 * because Inbox is currently every open task — it stops being an answer the day
 * `lists` ships and Inbox narrows, which is already planned. Candidate **(c) never
 * switch** is revision 4's gate, and rejecting it is the whole of revision 7.
 *
 * Order: `done` first, because a done task is in Done and in no cell of either
 * axis, so the date preference has nothing to prefer for it.
 */
function collectionHolding(state: AppState, taskId: string, current: Collection): Collection | null {
  const task = state.tasks.find((t) => t.id === taskId)
  if (task === undefined) return null
  // No clock is read for membership here — `inCollection` needs one, so it is
  // taken from the same place every other date question on this client takes it.
  // `shell.ts` has no controller in scope, so the caller's `state` carries the
  // rows and the module clock carries the instant: ONE seam, the controller's,
  // installed by the bootstrap (`_shared/model/clock.ts`).
  const now = nowDate()
  if (inCollection(task, current, now)) return null
  const order: Collection[] = ['done', 'today', 'upcoming', 'inbox']
  for (const c of order) {
    if (inCollection(task, c, now)) return c
  }
  // A step is in no collection at all (F-005 AC-35) and is never named in a
  // message (AC-36 refuses it a handle), so this is unreachable through the door.
  // Returning `null` leaves the collection where it was rather than switching to
  // one that will not show the row.
  return null
}
