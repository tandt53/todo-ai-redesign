// The app shell — Tasks is home, Talk is summoned over it.
//
// `information-architecture.md § 4` (revised 2026-08-24): the task list is
// home at every width. Talk is reached by the mic in the bottom bar and
// dismissed by close or system back. A collection is a state of the list, not
// a place — picking Inbox then pressing back exits the app, it does not
// return to Today.
//
// A phone is always below `tokens.json breakpoints.split`
// (`docs/design/_shared/components.md § AppFrame`), so there is no two-pane
// layout on mobile at any width and no viewport branch anywhere in this file.
//
// Why the navigation state lives here rather than inside the screen: the same
// reason `surface.ts` exists. The components are React Native and cannot run in
// this project's node-only unit tier (platform mobile.md, "Unit tier = model +
// ports"), so a decision taken inside a component is a decision nothing can
// test until a device shows up. Every shell decision — what opens first, what
// back means, which control is on which bar, which view a surface renders — is
// a pure function here, and `components/` subscribes and arranges.

import type { AppState } from '../../_shared/model/reducer.ts'
import { DEFAULT_COLLECTION } from './tasks-view.ts'
import type { Collection } from './tasks-view.ts'

// ---------------------------------------------------------------------------
// The landing surface — Tasks is home (OQ9, settled 2026-08-24)
// ---------------------------------------------------------------------------

/**
 * The surface a phone opens on, cold open included.
 *
 * **F-001 Open Question 9 is settled: Tasks.** The task list is home at every
 * width (`information-architecture.md § 4`, owner decision 2026-08-24). The
 * capture affordance OQ9 predicted is already built: AC-37's TaskBottomBar
 * carries a mic-icon button that summons Talk in one tap from the list.
 *
 * This constant is the *only* place in `src/assistant/mobile/` that decides
 * which surface opens: `initialShellState()` reads it, every component reads
 * `initialShellState()`, and nothing else names a landing surface at all.
 * `__tests__/shell.test.ts` holds that claim as an executable one.
 */
export const LANDING_SURFACE: ShellSurface = 'tasks'

// ---------------------------------------------------------------------------
// The shape of the shell
// ---------------------------------------------------------------------------

/**
 * Tasks is home; Talk is summoned over it. The type keeps both values so the
 * shell knows which surface is on screen, but the relationship is asymmetric:
 * back from Talk returns to Tasks, back from Tasks exits the app.
 */
export type ShellSurface = 'talk' | 'tasks'

/** @deprecated Use `ShellSurface`. Kept as an alias for in-flight consumers. */
export type PeerSurface = ShellSurface

/**
 * What is stacked over a surface. `information-architecture.md § 4`: S3 (lists
 * menu) and S4 (settings) stack over Tasks and unwind with back. Talk itself
 * is an overlay over Tasks and dismisses to it. S5 (the new-list sheet) is
 * deliberately absent — it depends entirely on a `lists` table that does not
 * exist (§ 7).
 */
export type Overlay = 'none' | 'menu' | 'settings'

/**
 * F-001 AC-31's arrival cue. `taskId` is the row to bring into view; `seq`
 * makes two arrivals at the SAME row two distinct events, so the flash fires
 * again rather than being swallowed as "no change".
 */
export interface Reveal {
  taskId: string
  seq: number
}

export interface ShellState {
  surface: ShellSurface
  overlay: Overlay
  /** which built-in collection S2 renders (§ 3: these are `task.status`) */
  collection: Collection
  /** AC-31: the row to scroll into view and flash once, or null */
  reveal: Reveal | null
  /** monotonic, so `reveal` is never equal to a previous reveal of the same row */
  revealSeq: number
}

export function initialShellState(landing: ShellSurface = LANDING_SURFACE): ShellState {
  return {
    surface: landing,
    overlay: 'none',
    collection: DEFAULT_COLLECTION,
    reveal: null,
    revealSeq: 0,
  }
}

export type ShellAction =
  | { type: 'go'; surface: ShellSurface }
  | { type: 'open-menu' }
  | { type: 'close-menu' }
  | { type: 'open-settings' }
  | { type: 'select-collection'; collection: Collection }
  /** AC-31 — see `task-link.ts`; this action is that routine's only writer */
  | { type: 'reveal'; taskId: string }
  | { type: 'reveal-consumed' }
  | { type: 'back' }

export function shellReducer(state: ShellState, action: ShellAction): ShellState {
  switch (action.type) {
    case 'go':
      // Going to Talk opens it over Tasks. Going to Tasks dismisses Talk.
      // Either way, stacked overlays (menu, settings) are closed.
      if (state.surface === action.surface) return state
      return { ...state, surface: action.surface, overlay: 'none' }

    case 'open-menu':
      return { ...state, overlay: 'menu' }

    case 'close-menu':
      return { ...state, overlay: 'none' }

    case 'open-settings':
      return { ...state, overlay: 'settings' }

    case 'select-collection':
      // "tap the row; the menu closes" (§ 4)
      return { ...state, collection: action.collection, overlay: 'none' }

    case 'reveal': {
      const seq = state.revealSeq + 1
      return {
        ...state,
        surface: 'tasks',
        overlay: 'none',
        reveal: { taskId: action.taskId, seq },
        revealSeq: seq,
      }
    }

    case 'reveal-consumed':
      return { ...state, reveal: null }

    case 'back': {
      const { state: next } = shellBack(state)
      return next
    }
  }
}

/**
 * System back — "up one level" (`information-architecture.md § 4`).
 *
 * `consumed` follows Android's `BackHandler` contract: true means the app
 * handled the press.
 *
 * **Four levels, each stated in F-001 `## Impact` §2:**
 *   from Talk              → the list (dismiss overlay)
 *   from the list          → exits the app; it is home, nothing is behind it
 *   collection then back   → does NOT return to the previous collection
 *   from Settings / detail → one level, to its parent
 *
 * The third is the one to get wrong. A collection is a state of the list, not
 * a destination, so it must not be pushed onto the back stack. Pick Inbox,
 * press back, and the app exits — it does not return to Today.
 *
 * Returned as a value rather than dispatched so the caller (F-003 AC-11's
 * non-destructive back, which also has a keyboard branch) composes it instead
 * of duplicating it.
 */
export function shellBack(state: ShellState): { state: ShellState; consumed: boolean } {
  if (state.overlay === 'settings') {
    // S4 → S3, the edge § 4 draws ("back control", 1 tap)
    return { state: { ...state, overlay: 'menu' }, consumed: true }
  }
  if (state.overlay === 'menu') {
    return { state: { ...state, overlay: 'none' }, consumed: true }
  }
  if (state.surface === 'talk') {
    // Talk → Tasks. Talk is summoned over the list; dismissing it returns there.
    return { state: { ...state, surface: 'tasks', overlay: 'none' }, consumed: true }
  }
  // Tasks with no overlay: home. Not consumed → the OS exits the app.
  // A collection is a state of the list, not a destination — back from Inbox
  // exits the app, it does not return to Today.
  return { state, consumed: false }
}

// ---------------------------------------------------------------------------
// AC-24 / AC-25 — the reachability bound
// ---------------------------------------------------------------------------

/**
 * F-001 AC-24, rev 4/11: "from **every** conversation failure state the
 * by-hand list is reachable in **at most one action**, and whatever affordance
 * reaches it is neither hidden nor disabled by the failure that is being
 * recovered from."
 *
 * Under the overlay model (§ 4, 2026-08-24) the bound is discharged by the
 * close button on Talk: pressing it or system back dismisses Talk to the list.
 * The control is always present and never disabled — `shellBack` returns
 * `consumed: true` for Talk unconditionally. These two functions are total
 * over the shell state rather than over an enumeration of failures, which is
 * why a failure state added later cannot quietly fall outside them.
 */
export function reachesListAffordance(shell: ShellState): boolean {
  // On Tasks the list IS the surface — zero actions, nothing to reach.
  // On Talk the close button / system back dismisses to Tasks.
  return shell.overlay === 'none'
}

/** Never disabled — not by an error, not by offline, not by the session read
 * being in flight. A fallback control that greys out with the surface it is
 * meant to escape is not a fallback. */
export function listAffordanceEnabled(_state: AppState): boolean {
  return true
}

/** How many actions the by-hand list is from here. AC-24's bound is `<= 1`. */
export function actionsToList(shell: ShellState): number {
  if (shell.surface === 'tasks' && shell.overlay === 'none') return 0
  return 1
}

// ---------------------------------------------------------------------------
// S1 Talk — which of the four drawn views renders
// ---------------------------------------------------------------------------

/** The four Talk views the mockups draw (`app-shell-ios.html`, `-android.html`). */
export type TalkView = 'idle' | 'empty' | 'loading' | 'failed'

/**
 * `information-architecture.md § 6`, S1.
 *
 * Two clauses are load-bearing and both are about NOT rendering the empty
 * invitation: a returning user who reads "Say it. I'll write it down." while
 * their history is still loading reads it as history lost, and the same line
 * after a failed read is a lie about what happened. So `empty` requires a read
 * that actually completed.
 *
 * The status comes from `AppState.sessionLoad`, which the SHARED controller
 * dispatches (`_shared/controller.ts`) — mobile keeps no second copy of it, and
 * both clients therefore answer this question the same way.
 *
 * `failed` additionally requires an empty thread, because SE-SESSION is the
 * failure that "has nothing to attach to" (components.md § SurfaceError) — with
 * messages on screen there IS a thread, and a failed refresh belongs in an
 * error bubble (AC-16 / AC-24), not on the whole surface.
 */
export function talkView(state: AppState): TalkView {
  if (state.messages.length > 0) return 'idle'
  // `idle` is "no read attempted yet" and renders as loading for the same
  // reason `loading` does: the invitation must not appear before the answer.
  if (state.sessionLoad === 'loading' || state.sessionLoad === 'idle') return 'loading'
  if (state.sessionLoad === 'failed') return 'failed'
  return 'empty'
}

/** SE-SESSION, components.md § SurfaceError — literals cited by row ID, never
 * composed (L-008). The Retry control is `talk-session-retry-button`. */
export const SURFACE_ERROR = {
  'SE-SESSION': {
    line1: "Couldn't load your conversation",
    line2: 'Your tasks are unaffected. Try again, or carry on by hand.',
  },
  'SE-TASKS': {
    line1: "Couldn't load your tasks",
    line2: 'Nothing is saved on this device yet. You can still add one by hand.',
  },
} as const

/**
 * `§ SurfaceError` rows this client deliberately does NOT carry, each with the
 * thing that makes it unreachable here — the same shape as `a11y.ts`'s
 * `SHELL_IDS_BLOCKED`, and for the same reason: **an absent row and an
 * unimplemented row look identical**, so the difference between a scope boundary
 * and an oversight has to be written down.
 *
 * `shell.test.ts` reads this map. Every row design publishes must be either a
 * literal above **or** recorded here, so design adding a row fails loudly rather
 * than passing quietly (which is what happened when SE-DETAIL landed and the
 * assertion was a hardcoded `rows.size === 2`), and building a surface without
 * removing its row here fails too.
 */
export const SURFACE_ERRORS_NOT_ON_PHONE: Record<string, string> = {
  'SE-DETAIL':
    'the task detail (S6) is web-only this phase — "There is no detail surface on the phone" (F-005 ## Out of Scope, platform/mobile.md § F-005), so there is no read for it to fail and no column for it to take',
}
