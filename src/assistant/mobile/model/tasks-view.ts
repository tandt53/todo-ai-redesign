// S2 Tasks — the whole todo, by hand, as its own surface.
//
// `information-architecture.md § 2`: "The whole todo, by hand, working
// identically when the assistant is off, broken or offline." Everything in this
// file is a pure selection over `AppState.tasks` plus the mobile client's own
// task-read status, for the same reason `shell.ts` is pure: the components are
// React Native and this project's unit tier is node-only.
//
// SCOPE BOUNDARY, stated once and enforced by what is absent: **personal lists
// do not exist.** `task` has no `list_id` and there is no `lists` table
// (`information-architecture.md § 7`), so the only grouping available is
// `status`, and the three collections below are exactly that field's three
// user-facing values. `Collection` is deliberately a closed union of the three
// rather than `string`: a personal list cannot be represented here at all,
// which is what stops half of § 7's blocked table being built by accident.

import type { AppState } from '../../_shared/model/reducer.ts'
import type { TaskView } from '../../_shared/types.ts'

// ---------------------------------------------------------------------------
// Collections — LM-COLLECTION, and nothing else (components.md § ListsMenu)
// ---------------------------------------------------------------------------

/** The three built-in collections. They ARE `task.status` values; no personal
 * list can be named here because no field carries one. */
export type Collection = 'today' | 'inbox' | 'done'

export const COLLECTIONS: readonly Collection[] = ['today', 'inbox', 'done']

/** The menu row's own name for a collection. Design's capitalisation
 * (`app-shell-ios.html`, the LM-COLLECTION rows). */
export const COLLECTION_NAME: Record<Collection, string> = {
  today: 'Today',
  inbox: 'Inbox',
  done: 'Done',
}

export function tasksIn(collection: Collection, tasks: readonly TaskView[]): TaskView[] {
  return tasks.filter((t) => t.status === collection)
}

/**
 * The count PS-TASKS publishes and the count S2's header publishes — ONE
 * function, because components.md § PathSwitch fixes it as "the same number
 * § TaskList's header publishes, never a second definition of it".
 *
 * "Open tasks due today" is `status === 'today'`: the status enum has no
 * separate done flag, so a task that is done is no longer in `today`.
 */
export function openToday(tasks: readonly TaskView[]): number {
  return tasks.filter((t) => t.status === 'today').length
}

/** The header line above the rows. The mockup's own wording. */
export function tasksHeadline(count: number): string {
  return count === 1 ? '1 task left today' : `${count} tasks left today`
}

// ---------------------------------------------------------------------------
// The mobile client's task-read status
// ---------------------------------------------------------------------------

/**
 * `ready` means a read completed (or none was owed — offline never attempts
 * one, and the offline banner carries that news instead). `failed` means the
 * server read was attempted and did not land, which is the ONE fact that
 * decides between the two failure renderings below.
 */
export type TasksLoad = 'loading' | 'ready' | 'failed'

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
 *    § Skeletons). Skeletons only when there is nothing yet to draw.
 * 4. Empty is three different facts and gets three different messages.
 */
export function tasksSurfaceView(
  state: AppState,
  load: TasksLoad,
  collection: Collection,
): TasksSurfaceView {
  const inCollection = tasksIn(collection, state.tasks)
  const banner: TasksBanner =
    state.offline ? 'offline' : load === 'failed' && state.tasks.length > 0 ? 'retry' : 'none'

  if (state.tasks.length > 0) {
    if (inCollection.length > 0) return { view: 'default', banner, tasks: inCollection, empty: null }
    // the collection is empty while others are not — a different fact, and it
    // must never borrow ET-FIRST's wording
    const empty: EmptyRow = collection === 'done' ? 'ET-DONE' : 'ET-COLLECTION'
    return { view: 'empty-collection', banner, tasks: [], empty }
  }

  if (load === 'loading') return { view: 'loading', banner, tasks: [], empty: null }
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
  'ET-FIRST': {
    head: 'No tasks yet',
    body: 'Add one by hand and it lands right here.',
    action: 'Add task',
    secondDoor: 'Or say one, on Talk.',
  },
  'ET-COLLECTION': {
    head: 'Nothing in {list}',
    body: 'This list is empty. Your other tasks are still where you left them.',
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
  return text.replace('{list}', COLLECTION_NAME[collection])
}

/** components.md § InlineRetryBanner — the failure that must not take the
 * surface. Literal, cited here rather than composed. */
export const INLINE_RETRY_BANNER =
  "Couldn't refresh your tasks — showing what's on this device"

// ---------------------------------------------------------------------------
// Day grouping (IA § 3, "Grouping by day | list pane | S2")
// ---------------------------------------------------------------------------

export interface DayGroup {
  /** stable key: the local calendar day, or `nodate` */
  key: string
  /** "Today · Sat, Aug 16" — the mockup's own shape */
  head: string
  tasks: TaskView[]
}

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

function dayDate(d: Date): string {
  return `${WEEKDAY[d.getDay()]}, ${MONTH[d.getMonth()]} ${d.getDate()}`
}

/** Day headers "stack above their rows at every width" (components.md
 * § AppFrame — the T-101 right-aligned gutter is withdrawn). */
export function dayGroups(tasks: readonly TaskView[], now: Date = new Date()): DayGroup[] {
  const today = dayKey(now)
  const tomorrowDate = new Date(now.getTime())
  tomorrowDate.setDate(tomorrowDate.getDate() + 1)
  const tomorrow = dayKey(tomorrowDate)

  const groups = new Map<string, DayGroup>()
  const order: string[] = []
  for (const t of tasks) {
    const due = t.due_at === null ? null : new Date(t.due_at)
    const valid = due !== null && !Number.isNaN(due.getTime())
    const key = valid ? dayKey(due) : 'nodate'
    const head = !valid
      ? 'No date'
      : key === today
        ? `Today · ${dayDate(due)}`
        : key === tomorrow
          ? `Tomorrow · ${dayDate(due)}`
          : dayDate(due)
    let g = groups.get(key)
    if (g === undefined) {
      g = { key, head, tasks: [] }
      groups.set(key, g)
      order.push(key)
    }
    g.tasks.push(t)
  }
  return order.map((k) => groups.get(k) as DayGroup)
}
