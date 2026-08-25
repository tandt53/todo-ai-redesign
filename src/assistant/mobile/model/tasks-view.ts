// S2 Tasks — which of the five drawn views renders, and the copy each carries.
//
// `information-architecture.md § 2`: "The whole todo, by hand, working
// identically when the assistant is off, broken or offline." Everything here is
// a pure selection, for the same reason `shell.ts` is pure: the components are
// React Native and this project's unit tier is node-only.
//
// **Collections, counts and day grouping are NOT here** — they live in
// `src/assistant/_shared/model/tasks.ts` and are imported. Both clients render
// the same four collections and publish the same counts, and F-003 AC-1's
// parity claim is only true if that is one implementation rather than two that
// agree today. This file re-exports the shared names so mobile callers have one
// import, and adds only what is genuinely the mobile shell's: which view
// renders, and the copy rows.
//
// SCOPE BOUNDARY, stated once and enforced by what is absent: **personal lists
// do not exist.** `task` has no `list_id` and there is no `lists` table
// (`information-architecture.md § 7`), so `Collection` is a closed union of the
// four built-in collections — two date views, the Done gate, and Inbox, which
// is the filing axis's one built-in cell — and a personal list cannot be
// represented here at all. `COLLECTION_GROUPS` is re-exported with the rest
// because the Lists menu's group break is part of that order, not a mobile
// rendering choice (ADR-009 § Amendment 2; components.md § ListsMenu).

import { nowDate } from '../../_shared/model/clock.ts'
import type { AppState, LoadState } from '../../_shared/model/reducer.ts'
import {
  COLLECTIONS,
  COLLECTION_GROUPS,
  DEFAULT_COLLECTION,
  collectionCount,
  collectionName,
  collectionTasks,
  groupTasks,
  groupsByDay,
  openTodayCount,
} from '../../_shared/model/tasks.ts'
import type { Collection, DayGroup } from '../../_shared/model/tasks.ts'
import type { TaskView } from '../../_shared/types.ts'

export {
  COLLECTIONS,
  COLLECTION_GROUPS,
  DEFAULT_COLLECTION,
  collectionCount,
  collectionName,
  collectionTasks,
  groupTasks,
  groupsByDay,
  openTodayCount,
}
export type { Collection, DayGroup }

// T-344: `tasksHeadline` removed — the count line below the bar title is gone.
// Owner decision: the list already shows what is in it, and a number in the
// title brings a tail of cases (zero, singular/plural, live updating) for no
// new information. The badge's accessible name (`Tasks, 3 left today`) stays —
// it labels a control, not a surface, and is a different thing.

// ---------------------------------------------------------------------------
// Which of the five drawn views renders
// ---------------------------------------------------------------------------

/** The five drawn Tasks views (`app-shell-ios.html` / `-android.html`). */
export type TasksView = 'default' | 'empty-first' | 'empty-collection' | 'loading' | 'error'

/** The strip above the list, if any. Both can be true at once in principle;
 * offline wins, because it is the more specific and more actionable fact. */
export type TasksBanner = 'none' | 'retry' | 'offline'

export interface TasksSurfaceView {
  view: TasksView
  banner: TasksBanner
  /** the rows to render, already filtered to the collection */
  tasks: TaskView[]
  /** which empty-state row of components.md § Empty states applies, if any */
  empty: EmptyRow | null
}

export type EmptyRow = 'ET-FIRST' | 'ET-COLLECTION' | 'ET-DONE'

/**
 * `information-architecture.md § 6`, S2 — and the ordering below is the whole
 * of it, so read it as a priority list rather than as a switch.
 *
 * 1. **A failed refresh with tasks on device is NOT an error view.** "The list
 *    is never replaced by an error" (components.md § InlineRetryBanner): S2 is
 *    the fallback surface for the whole app (F-001 AC-24 / AC-25), and a
 *    fallback that blanks itself on a network error has failed at its one job.
 *    It renders `default` + the retry banner.
 * 2. **A failed refresh with nothing anywhere IS the error view** (SE-TASKS) —
 *    there is genuinely nothing to show. `Add task` stays live there; the local
 *    no-AI path works offline and disabling a working control to look
 *    consistent is a lie about what the app can do.
 * 3. **A loading surface never renders its empty state** (components.md
 *    § Skeletons). `idle` — no read attempted yet — renders as loading for the
 *    same reason: the invitation must not appear before the answer does.
 * 4. Empty is three different facts and gets three different messages.
 *
 * The read status comes from `AppState.tasksLoad`, which the SHARED controller
 * dispatches — mobile does not track a second copy of it.
 */
export function tasksSurfaceView(
  state: AppState,
  collection: Collection,
  /**
   * F-005 AC-44 — **the installed seam, never a fresh `new Date()`.** This was
   * one of the two mobile inline clock sites the AC counts (`## Impact` names this
   * line); `nowDate()` resolves to `ControllerDeps.now` through the one provider
   * `boot.ts` installs, so a default here is a read of the seam rather than a
   * second clock (L-004). The day grouping this feeds is day-sensitive, so a wall
   * clock here and an injected one in the controller can put the same row under
   * two headings — L-023's defect, on the client.
   */
  now: Date = nowDate(),
): TasksSurfaceView {
  const load: LoadState = state.tasksLoad
  const inCollection = collectionTasks(state.tasks, collection, now)
  const banner: TasksBanner =
    state.offline ? 'offline' : load === 'failed' && state.tasks.length > 0 ? 'retry' : 'none'

  if (state.tasks.length > 0) {
    if (inCollection.length > 0) return { view: 'default', banner, tasks: inCollection, empty: null }
    const empty: EmptyRow = collection === 'done' ? 'ET-DONE' : 'ET-COLLECTION'
    return { view: 'empty-collection', banner, tasks: [], empty }
  }

  if (load === 'loading' || load === 'idle') {
    return { view: 'loading', banner, tasks: [], empty: null }
  }
  if (load === 'failed') return { view: 'error', banner: 'none', tasks: [], empty: null }
  const empty: EmptyRow = collection === 'done' ? 'ET-DONE' : 'ET-FIRST'
  return { view: 'empty-first', banner, tasks: [], empty }
}

/**
 * components.md § Empty states — Tasks. Literals cited by row ID (L-008): a
 * template that interpolated the varying part would serve plausible text for
 * combinations nobody enumerated, and the unenumerated combination is exactly
 * what this table is three rows long to prevent.
 *
 * `{list}` is design's own `verbatim` slot and is filled with the collection's
 * own name, never re-worded — see `fillListSlot`.
 */
export const EMPTY_TASKS = {
  // T-298: one statement of emptiness, not two. "Speaking must not read as
  // the fallback in a voice-first app" — the secondDoor framed the primary
  // path as the backup, and the body was a second statement. The CTA stands
  // on its own.
  'ET-FIRST': {
    head: 'No tasks yet',
    body: null,
    action: 'Add task',
    secondDoor: null,
  },
  // T-300 defect 5: the body sentence is dropped — one heading is enough.
  'ET-COLLECTION': {
    head: 'Nothing in {list}',
    body: null,
    action: 'Add task',
    secondDoor: null,
  },
  'ET-DONE': {
    head: 'Nothing completed yet',
    body: null,
    // "No action fills this list directly; inventing one would be a shrug
    // dressed as an invitation."
    action: null,
    secondDoor: null,
  },
} as const

/** The only substitution performed on published copy: design's `{list}`
 * verbatim slot, filled with the collection's own name. */
export function fillListSlot(text: string, collection: Collection): string {
  return text.replace('{list}', collectionName(collection))
}

/** components.md § InlineRetryBanner — the failure that must not take the
 * surface. Literal, cited here rather than composed. */
export const INLINE_RETRY_BANNER =
  "Couldn't refresh your tasks — showing what's on this device"

