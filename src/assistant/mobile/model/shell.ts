// The app shell — S1 Talk and S2 Tasks as two PEER surfaces, one at a time.
//
// A phone is always below `tokens.json breakpoints.split`
// (`design/_shared/components.md § AppFrame`), so there is no two-pane layout
// on mobile at any width and no viewport branch anywhere in this file. What the
// wide web frame expresses by POSITION (Tasks in the centre, Talk in a right
// panel) a phone expresses by ORDER, and the reciprocal one-tap control between
// them is § PathSwitch.
//
// Why the navigation state lives here rather than inside the screen: the same
// reason `surface.ts` exists. The components are React Native and cannot run in
// this project's node-only unit tier (platform mobile.md, "Unit tier = model +
// ports"), so a decision taken inside a component is a decision nothing can
// test until a device shows up. Every shell decision — what opens first, what
// back means, which control is on which bar, which view a surface renders — is
// a pure function here, and `components/` subscribes and arranges.

import type { AppState } from '../../_shared/model/reducer.ts'
import { DEFAULT_COLLECTION, openTodayCount } from './tasks-view.ts'
import type { Collection } from './tasks-view.ts'

// ---------------------------------------------------------------------------
// OQ9 — what a phone lands on. ONE declared value, in ONE place.
// ---------------------------------------------------------------------------

/**
 * The surface a phone opens on, cold open included.
 *
 * **This is F-001 Open Question 9 and it is NOT settled.** Design proposes
 * `talk` and argues it (`information-architecture.md § 12`); the desktop
 * decision explicitly did not ask or answer it; the owner has the call.
 *
 * The one thing the build owes that question is that answering it costs one
 * line. So this constant is the *only* place in `src/assistant/mobile/` that
 * decides which surface opens: `initialShellState()` reads it, every component
 * reads `initialShellState()`, and nothing else names a landing surface at all.
 * `__tests__/shell.test.ts` holds that claim as an executable one — it scans the
 * module for a second decision and fails on one, because "one line to change"
 * is worthless if it is one line plus a mount path nobody remembered.
 *
 * If the answer comes back `tasks`, change this value and nothing else — but
 * note that the answer also owes a **capture affordance on the Tasks surface**
 * (OQ9's own cost analysis), which is a new control with its own AC and is not
 * this constant's job.
 */
export const LANDING_SURFACE: PeerSurface = 'talk'

// ---------------------------------------------------------------------------
// The shape of the shell
// ---------------------------------------------------------------------------

/** The two peers. Neither is "home"; neither is reached through the other. */
export type PeerSurface = 'talk' | 'tasks'

/**
 * What is stacked over the peer. `information-architecture.md § 4`: S1 ⇄ S2 is
 * a switch between peers and has no back; S3 (lists menu) and S4 (settings) are
 * stacked and do. S5 (the new-list sheet) is deliberately absent — it depends
 * entirely on a `lists` table that does not exist (§ 7).
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
  surface: PeerSurface
  overlay: Overlay
  /** which built-in collection S2 renders (§ 3: these are `task.status`) */
  collection: Collection
  /** AC-31: the row to scroll into view and flash once, or null */
  reveal: Reveal | null
  /** monotonic, so `reveal` is never equal to a previous reveal of the same row */
  revealSeq: number
}

export function initialShellState(landing: PeerSurface = LANDING_SURFACE): ShellState {
  return {
    surface: landing,
    overlay: 'none',
    collection: DEFAULT_COLLECTION,
    reveal: null,
    revealSeq: 0,
  }
}

export type ShellAction =
  | { type: 'go'; surface: PeerSurface }
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
      // Switching peers dismisses nothing stacked over the *other* peer,
      // because nothing can be: S3/S4 only ever stack over Tasks, and leaving
      // Tasks closes them (§ 4, "Back always means up one level").
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
 * System back — "up one level", never "the previous surface"
 * (`information-architecture.md § 4`).
 *
 * `consumed` follows Android's `BackHandler` contract: true means the app
 * handled the press. **A phone's system back on S1 or S2 exits the app** — the
 * peers are not stacked, so there is no level above them and the press is not
 * consumed. That is deliberate and it is what stops back from becoming a
 * fourth, undocumented edge in § 4's navigation map.
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
  return { state, consumed: false }
}

// ---------------------------------------------------------------------------
// PathSwitch (components.md § PathSwitch)
// ---------------------------------------------------------------------------

export interface PathSwitchView {
  /** row ID from components.md § PathSwitch */
  row: 'PS-TASKS' | 'PS-TALK'
  label: string
  /** null renders NO badge — "a badge reading 0 is a number pretending to be news" */
  badge: number | null
  /** the accessible name is the visible label plus the count AS A SENTENCE */
  accessibleName: string
}

/**
 * The reciprocal control for the surface currently on screen.
 *
 * The count is **open tasks due today** — `openToday`, the same function
 * § TaskList's header publishes, "never a second definition of it". It is a
 * second, cheaper confirmation of an applied turn and is deliberately NOT what
 * F-001 AC-1 is verified against: a number cannot say *which* task changed
 * (AC-1 rev 4, and `owner-decision-2026-08-17-desktop-list-is-primary.md`
 * constraint 2).
 */
export function pathSwitch(surface: PeerSurface, tasks: AppState['tasks']): PathSwitchView {
  if (surface === 'tasks') {
    return { row: 'PS-TALK', label: 'Talk', badge: null, accessibleName: 'Talk' }
  }
  const count = openTodayCount(tasks)
  return {
    row: 'PS-TASKS',
    label: 'Tasks',
    badge: count === 0 ? null : count,
    accessibleName: count === 0 ? 'Tasks' : `Tasks, ${count} left today`,
  }
}

// ---------------------------------------------------------------------------
// AC-24 / AC-25 — the reachability bound
// ---------------------------------------------------------------------------

/**
 * F-001 AC-24, rev 4: "from **every** conversation failure state the by-hand
 * list is reachable in **at most one action**, and whatever affordance reaches
 * it is neither hidden nor disabled by the failure that is being recovered
 * from."
 *
 * The AC states a BOUND and names no control, deliberately: above the split the
 * list is already on screen (zero actions) and PathSwitch does not exist at
 * all. On a phone there is no width at which the list is simply there, so the
 * bound is discharged by PS-TASKS being present and enabled — in every Talk
 * state, failures included. These two functions are total over the shell state
 * rather than over an enumeration of failures, which is why a failure state
 * added later cannot quietly fall outside them (L-005: attach the obligation to
 * the transition, not to a list of its callers).
 */
export function reachesListAffordance(shell: ShellState): boolean {
  // On Tasks the list IS the surface — zero actions, nothing to reach.
  // On Talk the affordance is PS-TASKS, and it is always mounted.
  return shell.overlay === 'none'
}

/** Never disabled — not by an error, not by offline, not by the session read
 * being in flight. A fallback control that greys out with the surface it is
 * meant to escape is not a fallback (components.md § PathSwitch). */
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
