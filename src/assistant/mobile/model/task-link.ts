// F-001 AC-31 — a task named in a message is a door to that task.
//
// components.md § MessageTaskLink. This is navigation OUT of the message onto a
// different surface; AC-4's attribution INSIDE the message is discharged
// entirely by `ConversationList`'s diff rows and is not this file's concern.
//
// TWO THINGS THIS FILE EXISTS TO KEEP SINGULAR
//
// 1. **One scroll-and-flash routine, however many entries.** AC-31 states the
//    postcondition once — "that task's row is on screen and has flashed exactly
//    once" — and requires one routine called from every entry rather than two
//    implementations of one postcondition, for the reason AC-30(h) gives about
//    (f)/(h) and L-005 gives generally: a grep for the routine's name must
//    return every caller. `revealTask` is that routine and
//    `{ type: 'reveal' }` is its only action. On a phone there is exactly one
//    entry today (a link inside a message) because a phone is always below the
//    split; the wide frame's second entry — the centre list scrolling without
//    navigating — is web's, and it calls the same shape there.
//
// 2. **A task the list does not hold is not activatable AT ALL.** Not a
//    disabled control, not a control that silently does nothing: plain text.
//    "Rendered as an inert control it would be an affordance that does nothing,
//    which is worse than none; rendered as plain text it is honest" (AC-31).
//    Two cases produce it, and they are not the same case:
//      - the task was DELETED — by this turn (a delete outcome names it by
//        title, and nothing remains anywhere to open) or by a later one;
//      - the task is FILTERED OUT of the collection currently shown, so
//        navigating there would land on a list that does not contain the row
//        and the postcondition could not be met.
//    The second is stricter than it needs to be — switching collection on
//    arrival would also satisfy the postcondition — and it is what AC-31 says,
//    so it is what this does. Widening it is a spec change, not a code change.

import type { AppState } from '../../_shared/model/reducer.ts'
import type { Message, TaskView } from '../../_shared/types.ts'
import { shellReducer } from './shell.ts'
import type { ShellState } from './shell.ts'
import { tasksIn } from './tasks-view.ts'
import type { Collection } from './tasks-view.ts'
import { motion } from './theme.ts'

/** What a task title inside a message renders as. */
export type TaskLinkState = 'link' | 'inert'

/**
 * `link` iff the list currently shown actually holds the row. `taskId` may be
 * a task that no longer exists at all (a delete), which is the same answer by
 * the same rule — the rule is about the LIST, not about the deletion.
 */
export function taskLinkState(
  taskId: string,
  tasks: readonly TaskView[],
  collection: Collection,
): TaskLinkState {
  return tasksIn(collection, tasks).some((t) => t.id === taskId) ? 'link' : 'inert'
}

/** Every task a message names with an id the list could open. Deleted tasks
 * appear in `deletedTitles` with no id at all, so they can never reach this —
 * the message names them and they render as text, by construction. */
export function linkableTaskIds(m: Message): string[] {
  if (m.kind !== 'applied') return []
  return m.lines.map((l) => l.taskId)
}

/**
 * THE routine (AC-31). Every entry that opens a task from a message goes
 * through this and nothing else duplicates its postcondition.
 *
 * Callers must check `taskLinkState` first: an inert title is not a control and
 * never reaches here. Calling it anyway is a no-op rather than a navigation to
 * a row that is not there.
 */
export function revealTask(
  shell: ShellState,
  taskId: string,
  state: AppState,
): ShellState {
  if (taskLinkState(taskId, state.tasks, shell.collection) === 'inert') return shell
  return shellReducer(shell, { type: 'reveal', taskId })
}

/** The row to bring into view and flash, or null. */
export function revealTarget(shell: ShellState): string | null {
  return shell.reveal === null ? null : shell.reveal.taskId
}

/**
 * The arrival flash is AC-4's existing treatment re-attached to the moment it
 * informs (components.md § MessageTaskLink) — `diffFlashHold` then
 * `diffFlashFade`, from `tokens.json`, never a number chosen here. The view
 * dispatches `reveal-consumed` after this long, which is what makes "flashed
 * exactly once" true rather than intended.
 */
export function flashDurationMs(): number {
  return motion.duration_ms.diffFlashHold + motion.duration_ms.diffFlashFade
}
