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
import { DEFAULT_COLLECTION, inCollection } from '../_shared/model/tasks.ts'
import type { Collection } from '../_shared/model/tasks.ts'
import type { AppState } from '../_shared/model/reducer.ts'
import { prefersReducedMotion } from './follow.ts'

/** The three surfaces this shell can show. S3 (Lists menu) is a slide-over and
 * S5 (New list) is a sheet — neither is a surface, and S5 is not built at all:
 * it depends entirely on a `lists` table that does not exist (IA §7). */
export type ShellSurface = 'talk' | 'tasks' | 'settings'

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
  /** AC-31: is this task one the list currently holds? A deleted task, or one
   * filtered out of the collection on screen, is NOT activatable — rendered as
   * an inert control it would be an affordance that does nothing, which is
   * worse than none. */
  canReveal: (taskId: string) => boolean
  /** AC-31's one scroll-and-flash routine. A grep for this name returns every
   * caller, which is the property L-005 asks for. */
  revealTask: (taskId: string) => void
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
  const tasksRef = useRef<HTMLDivElement | null>(null)
  /** set by `revealTask`, consumed by the layout effect after the surface and
   * the menu have actually committed — the row may not be in the DOM yet at
   * call time, because below the split the click that reveals it is also the
   * click that navigates to the list. */
  const pendingReveal = useRef<string | null>(null)

  const go = useCallback((s: ShellSurface) => {
    setSurface(s)
    setMenuOpen(false)
  }, [])

  const pickCollection = useCallback((c: Collection) => {
    setCollection(c)
    setSurface('tasks')
    setMenuOpen(false)
  }, [])

  const openSettings = useCallback(() => {
    setSurface('settings')
    setMenuOpen(false)
  }, [])

  // "Back always means up one level" (IA §4): S4 is stacked on S3, so back
  // returns to the menu rather than to whichever peer was last on screen.
  const backFromSettings = useCallback(() => {
    setSurface('tasks')
    setMenuOpen(true)
  }, [])

  // Deliberately NOT memoised: `now` is re-derived every render, because a
  // task's collection changes with the clock and a link answered from a cached
  // clock is the inert case pretending to be live.
  const canReveal = (taskId: string): boolean => {
    const now = new Date()
    return state.tasks.some((t) => t.id === taskId && inCollection(t, collection, now))
  }

  const revealTask = useCallback((taskId: string) => {
    // Entry point 1 (below the split) navigates; entry point 2 (at or above it)
    // finds the list already in the centre and this is inert. One call.
    setSurface('tasks')
    setMenuOpen(false)
    pendingReveal.current = taskId
    setFlash((prev) => ({ taskId, phase: prev?.phase === 'a' ? 'b' : 'a' }))
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
  }
}
