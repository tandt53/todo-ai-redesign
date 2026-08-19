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
// 2. **A task that does not exist is not activatable AT ALL.** Not a disabled
//    control, not a control that silently does nothing: plain text. "Rendered as
//    an inert control it would be an affordance that does nothing, which is worse
//    than none; rendered as plain text it is honest" (AC-31).
//
//    **The gate is the task EXISTING — F-001 AC-31 revision 7, and this file is
//    one of the two predicates that revision names by path.** It used to be
//    membership of the collection currently shown, on the ground that navigating
//    to a list without the row could not meet the postcondition. Two later
//    decisions falsified that reason: rev 6 gave the door a second postcondition
//    that needs nothing from the list (F-005 AC-48), and the owner's direction of
//    2026-08-19 supplies what the first one was missing — **activating a task
//    named in a message switches to a collection that holds it**. That switch is
//    ROUTE and belongs to the single `revealTask` routine above, **not to a
//    second gate beside it**, which is the whole of what rev 7 moved.
//
//    So one case is left, and it stays inert **for its own reason**: the task was
//    DELETED — by this turn (a delete outcome names it by title) or by a later
//    one — and no row exists anywhere to bring into view.
//
//    Amending only the web predicate (`web/shell.ts`'s `canReveal`) would leave
//    the phone holding a collection filter the user cannot see, so AC-31's door
//    would mean **two different things on two clients**. That is **L-005** on the
//    very file L-005 names in its scope line, and it is why rev 7 states the
//    condition once and binds both sites. A grep for either predicate's name
//    returns every door.

import { nowDate } from '../../_shared/model/clock.ts'
import type { AppState } from '../../_shared/model/reducer.ts'
import { collectionHolding } from '../../_shared/model/tasks.ts'
import type { Message, TaskView } from '../../_shared/types.ts'
import { shellReducer } from './shell.ts'
import type { ShellState } from './shell.ts'
import { motion } from './theme.ts'

/** What a task title inside a message renders as. */
export type TaskLinkState = 'link' | 'inert'

/**
 * `link` iff **the task still exists** — F-001 AC-31 revision 7. Nothing about
 * the collection on screen: the route switches to a collection that holds the
 * row (`revealTask`), so a filter here would be a second gate answering a
 * question the route already answers.
 *
 * `deleted_at` is checked as well as membership in `tasks`, exactly as web's
 * `canReveal` does: a row the client still holds but the server has soft-deleted
 * is the delete case, and that one is inert **for its own reason** — no row
 * exists anywhere to bring into view.
 *
 * **No clock parameter, and its absence is the point.** This used to carry a
 * `now: Date = new Date()` default — the ninth of the nine defaulted `now`
 * parameters F-005 AC-44 counts, and the one that decided this door's
 * `link`/`inert` answer from the wall clock. Existence is not a date question, so
 * the seam is not needed rather than merely injected.
 */
export function taskLinkState(taskId: string, tasks: readonly TaskView[]): TaskLinkState {
  return tasks.some((t) => t.id === taskId && t.deleted_at === null) ? 'link' : 'inert'
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
  now: Date = nowDate(),
): ShellState {
  if (taskLinkState(taskId, state.tasks) === 'inert') return shell
  // ── AC-31 rev 7 — the collection switch is ROUTE, not postcondition ────────
  // *"At either width the route first switches to a collection that holds the
  // row, when the one on screen does not."* It belongs to this single routine and
  // not to a second gate beside it. `collectionHolding` is `_shared/`'s, so both
  // clients answer "which collection holds it" the same way — Open Question 12
  // asks the owner which one to prefer when several do, and until it is answered
  // the preference must at least not be two different preferences.
  const target = collectionHolding(state.tasks, taskId, shell.collection, now)
  const routed =
    target === null ? shell : shellReducer(shell, { type: 'select-collection', collection: target })
  return shellReducer(routed, { type: 'reveal', taskId })
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
