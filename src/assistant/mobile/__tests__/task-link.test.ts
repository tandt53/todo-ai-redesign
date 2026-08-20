// F-001 AC-31 — a task named in a message is a door to that task.
//
// And, in the same file because they are the same claim seen from two sides,
// the two controls D8 was missing: the row's delete button and its rename
// input. Both are id-level facts at this tier — the components are React
// Native and this tier is node-only — so what is asserted is that the surface
// DECLARES them for a state that has rows, and `a11y.test.ts` separately
// asserts a component references each id by name. The device observable stays
// QA's (`docs/qa/assistant/F-003/mobile/`).

import { describe, expect, it } from 'vitest'
import { initialState } from '../../_shared/model/reducer.ts'
import type { AppState } from '../../_shared/model/reducer.ts'
import { collectionTasks } from '../../_shared/model/tasks.ts'
import type { Message } from '../../_shared/types.ts'
import { SHELL_A11Y_IDS, expectedShellIds } from '../model/a11y.ts'
import { initialShellState, shellReducer } from '../model/shell.ts'
import type { ShellState } from '../model/shell.ts'
import {
  flashDurationMs,
  linkableTaskIds,
  revealTask,
  revealTarget,
  taskLinkState,
} from '../model/task-link.ts'
import { motion } from '../model/theme.ts'
import { T0, task, todayTask } from './_helpers.ts'

const AT = '2026-08-17T09:00:00.000Z'
/**
 * ONE instant for the fixtures and for every predicate under test (L-023). The
 * `_shared` fixtures build their dates from `T0`, so reading the wall clock here
 * would assert the agreement of two clocks rather than the behaviour — and this
 * file's subject is a predicate that used to read the wall clock by default.
 */
const NOW = new Date(T0)

function appliedMessage(taskId: string, title: string): Message {
  return {
    id: 'm1',
    kind: 'applied',
    turnId: 'turn-1',
    head: 'Edited 1 task',
    lines: [
      { taskId, title, label: 'edit', chips: [{ field: 'due_at', old: '2:00 PM', new: '4:00 PM' }] },
    ],
    deletedTitles: [],
    mutated: true,
    undone: false,
    at: AT,
  } as Message
}

function deleteOutcome(): Message {
  return {
    id: 'm2',
    kind: 'applied',
    turnId: 'turn-2',
    head: 'Deleted 1 task',
    lines: [],
    // a deleted task is named by TITLE and carries no id — there is no row to
    // open, by construction rather than by a guard
    deletedTitles: ['Order the cake'],
    mutated: true,
    undone: false,
    at: AT,
  } as Message
}

function stateWith(over: Partial<AppState> = {}): AppState {
  return {
    ...initialState('available'),
    sessionId: 'sess-1',
    sessionLoad: 'ok',
    tasksLoad: 'ok',
    ...over,
  }
}

describe('AC-31 rev 7 — the door, when the task exists', () => {
  // Dated today — after ADR-009 that is the ONLY thing that puts a row in the
  // Today collection; `status: 'today'` would leave it in Inbox and make every
  // assertion below quietly about a different list.
  const held = todayTask({ id: 'task-1', title: 'Review the Q3 budget draft' })

  it('a named task the current collection holds is a control', () => {
    expect(taskLinkState('task-1', [held])).toBe('link')
  })

  it('activating it brings the row into view on the Tasks surface', () => {
    const state = stateWith({ tasks: [held], messages: [appliedMessage('task-1', held.title)] })
    const next = revealTask(initialShellState('talk'), 'task-1', state, NOW)
    expect(next.surface).toBe('tasks')
    expect(revealTarget(next)).toBe('task-1')
  })

  it('the surface declares the link id only when a named task is openable', () => {
    const openable = stateWith({ tasks: [held], messages: [appliedMessage('task-1', held.title)] })
    expect(expectedShellIds(initialShellState('talk'), openable)).toContain(
      SHELL_A11Y_IDS.talkTaskLink,
    )
  })
})

describe('AC-31 rev 7 — a task that DOES NOT EXIST is not activatable at all', () => {
  // "Rendered as an inert control it would be an affordance that does nothing,
  // which is worse than none; rendered as plain text it is honest."
  //
  // Revision 7 left ONE cause of inertness — the task not existing — and it has
  // two structurally different shapes. Written apart on purpose: a single
  // parameterised test over "the row is missing" passes with either shape
  // unimplemented (L-005), and the second shape had no test at all before, so the
  // `deleted_at` half of the predicate was asserted by nobody.

  it('the task was DELETED and the client holds NO row for it — no id to open', () => {
    const state = stateWith({ tasks: [], messages: [deleteOutcome()] })
    // nothing in a delete outcome is linkable, so there is no id to guard
    expect(linkableTaskIds(deleteOutcome())).toEqual([])
    expect(expectedShellIds(initialShellState('talk'), state)).not.toContain(
      SHELL_A11Y_IDS.talkTaskLink,
    )
  })

  it('the client STILL HOLDS the row but the server soft-deleted it — inert for its own reason', () => {
    // Structurally distinct from the case above, and this is the one the
    // existence predicate is actually about: `tasks` contains the row, so a
    // membership-only gate would answer `link`. `deleted_at` is what makes it
    // inert — no row exists anywhere to bring into view — and web's `canReveal`
    // checks exactly the same two things, which is what keeps AC-31's door meaning
    // ONE thing on two clients (L-005, and rev 7 binds both predicates by path).
    const gone = todayTask({ id: 'task-7', title: 'Order the cake' })
    const state = stateWith({
      tasks: [{ ...gone, deleted_at: AT }],
      messages: [appliedMessage('task-7', gone.title)],
    })
    expect(taskLinkState('task-7', state.tasks)).toBe('inert')
    expect(expectedShellIds(initialShellState('talk'), state)).not.toContain(
      SHELL_A11Y_IDS.talkTaskLink,
    )
    // and the routine refuses it rather than navigating to a row that is not there
    const shell = initialShellState('talk')
    expect(revealTask(shell, 'task-7', state, NOW)).toBe(shell)
  })

  it('the routine refuses a task the client has never heard of', () => {
    const state = stateWith({ tasks: [] })
    const shell = initialShellState('talk')
    expect(revealTask(shell, 'no-such-task', state, NOW)).toBe(shell)
  })
})

describe('AC-31 rev 7 — the collection is ROUTE, not a gate', () => {
  // This is the behaviour revision 7 REPLACED, and the replacement is the reason
  // these assertions are inverted rather than deleted. Rev 4 gated the door on the
  // task being in the collection currently shown, justified by *"rendered as an
  // inert control it would be an affordance that does nothing"*. Two later
  // decisions falsified that reason — rev 6 gave the door a postcondition needing
  // nothing from the list (F-005 AC-48), and the owner's direction of 2026-08-19
  // supplies the switch. The gate is now the task existing; the switch belongs to
  // the single reveal routine.
  //
  // The row Today does not hold is an UNDATED one: the date axis splits the open
  // tasks into Today / Upcoming / Inbox and exactly one holds an undated row.
  const elsewhere = task({ id: 'task-9', title: 'Buy milk', status: 'inbox', due_at: null })

  function stateElsewhere(): AppState {
    return stateWith({
      tasks: [elsewhere],
      messages: [appliedMessage('task-9', elsewhere.title)],
    })
  }

  it('a task the collection on screen does NOT hold is still a control', () => {
    const state = stateElsewhere()
    const onToday = shellReducer(initialShellState('talk'), {
      type: 'select-collection',
      collection: 'today',
    })
    expect(taskLinkState('task-9', state.tasks)).toBe('link')
    expect(expectedShellIds(onToday, state)).toContain(SHELL_A11Y_IDS.talkTaskLink)
  })

  it('activating it switches to a collection that holds the row, THEN reveals it', () => {
    // The postcondition — "that task's row is on screen and has flashed exactly
    // once" — is what this asserts, and it is only reachable because the routine
    // switched the collection. Asserting the reveal target alone would pass
    // against a routine that revealed a row the list does not draw, which is the
    // defect the switch exists to remove.
    const state = stateElsewhere()
    const onToday = shellReducer(initialShellState('talk'), {
      type: 'select-collection',
      collection: 'today',
    })
    const next = revealTask(onToday, 'task-9', state, NOW)
    expect(next.collection).toBe('inbox')
    expect(next.surface).toBe('tasks')
    expect(revealTarget(next)).toBe('task-9')
    // and the row is genuinely drawn by the collection the route chose
    expect(collectionTasks(state.tasks, next.collection, NOW).map((t) => t.id)).toContain('task-9')
  })

  it('a collection that already holds the row is not switched away from', () => {
    const held = todayTask({ id: 'task-1', title: 'Review the Q3 budget draft' })
    const state = stateWith({ tasks: [held], messages: [appliedMessage('task-1', held.title)] })
    const onToday = shellReducer(initialShellState('talk'), {
      type: 'select-collection',
      collection: 'today',
    })
    const next = revealTask(onToday, 'task-1', state, NOW)
    expect(next.collection).toBe('today')
    expect(revealTarget(next)).toBe('task-1')
  })

  it('one predicate, no clock — existence is not a date question', () => {
    // The ninth of AC-44's nine defaulted `now` parameters used to live on
    // `taskLinkState` and decided this door's link/inert answer from the wall
    // clock. Its absence is assertable: the function takes two arguments.
    expect(taskLinkState.length).toBe(2)
  })
})

describe('AC-31 — ONE routine, and it flashes exactly once', () => {
  it('the reveal action is the only thing that sets a target', () => {
    // Every other shell transition leaves `reveal` alone, so there is no second
    // way to make a row flash — the postcondition has one implementation
    // (L-005: a grep for the routine's name returns every caller).
    const held = task({ id: 'task-1' })
    const state = stateWith({ tasks: [held] })
    let s: ShellState = initialShellState('talk')
    for (const action of [
      { type: 'go', surface: 'tasks' },
      { type: 'open-menu' },
      { type: 'select-collection', collection: 'today' },
      { type: 'select-collection', collection: 'inbox' },
      { type: 'open-settings' },
      { type: 'back' },
      { type: 'close-menu' },
    ] as const) {
      s = shellReducer(s, action)
      expect(revealTarget(s), `${action.type} set a reveal target`).toBe(null)
    }
    expect(revealTarget(revealTask(s, 'task-1', state, NOW))).toBe('task-1')
  })

  it('the same row arrived at twice is two events, so the second flash still fires', () => {
    // `initialShellState` opens on DEFAULT_COLLECTION, which is Today, so the
    // row has to be dated for the routine to accept it at all.
    const held = todayTask({ id: 'task-1' })
    const state = stateWith({ tasks: [held] })
    const first = revealTask(initialShellState('tasks'), 'task-1', state, NOW)
    const consumed = shellReducer(first, { type: 'reveal-consumed' })
    expect(revealTarget(consumed)).toBe(null)
    const second = revealTask(consumed, 'task-1', state, NOW)
    expect(revealTarget(second)).toBe('task-1')
    expect(second.reveal?.seq).toBeGreaterThan(first.reveal!.seq)
  })

  it('the flash is AC-4’s own treatment, read from tokens.json rather than chosen here', () => {
    expect(flashDurationMs()).toBe(
      motion.duration_ms.diffFlashHold + motion.duration_ms.diffFlashFade,
    )
  })
})

// ---------------------------------------------------------------------------
// D8 — the two controls mobile did not have
// ---------------------------------------------------------------------------

describe('D8 — the row carries a delete control and a rename input on touch', () => {
  const rows = stateWith({ tasks: [todayTask({ id: 'task-1' })] })
  const onTasks = initialShellState('tasks') // opens on Today (DEFAULT_COLLECTION)

  it('delete is declared whenever the list has rows — always visible, never hover-revealed', () => {
    // "A hover-revealed control does not exist on touch, and hiding it would
    // publish an id no user can reach" (components.md § Platform variants). So
    // the id's condition is the presence of rows and nothing else: there is no
    // focus, hover or long-press term for it to be gated on.
    expect(expectedShellIds(onTasks, rows)).toContain(SHELL_A11Y_IDS.tasksDeleteButton)
    expect(expectedShellIds(onTasks, stateWith())).not.toContain(
      SHELL_A11Y_IDS.tasksDeleteButton,
    )
  })

  it('rename is entered by tapping the title, so its input appears only for the tapped row', () => {
    expect(expectedShellIds(onTasks, rows)).not.toContain(SHELL_A11Y_IDS.tasksRenameInput)
    expect(
      expectedShellIds(onTasks, rows, { renaming: 'task-1' }),
    ).toContain(SHELL_A11Y_IDS.tasksRenameInput)
    // a row that is not in the collection on screen cannot be the one being
    // renamed
    expect(
      expectedShellIds(onTasks, rows, { renaming: 'task-9' }),
    ).not.toContain(SHELL_A11Y_IDS.tasksRenameInput)
  })
})
