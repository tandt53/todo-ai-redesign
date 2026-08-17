// F-001 AC-31 — a task named in a message is a door to that task.
//
// And, in the same file because they are the same claim seen from two sides,
// the two controls D8 was missing: the row's delete button and its rename
// input. Both are id-level facts at this tier — the components are React
// Native and this tier is node-only — so what is asserted is that the surface
// DECLARES them for a state that has rows, and `a11y.test.ts` separately
// asserts a component references each id by name. The device observable stays
// QA's (`qa/assistant/F-003/mobile/`).

import { describe, expect, it } from 'vitest'
import { initialState } from '../../_shared/model/reducer.ts'
import type { AppState } from '../../_shared/model/reducer.ts'
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
import { task } from './_helpers.ts'

const AT = '2026-08-17T09:00:00.000Z'

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
  return { ...initialState('available'), sessionId: 'sess-1', ...over }
}

const LOAD = { session: 'ready', tasks: 'ready' } as const

describe('AC-31 — the door, when the list holds the row', () => {
  const held = task({ id: 'task-1', title: 'Review the Q3 budget draft', status: 'today' })

  it('a named task the current collection holds is a control', () => {
    expect(taskLinkState('task-1', [held], 'today')).toBe('link')
  })

  it('activating it brings the row into view on the Tasks surface', () => {
    const state = stateWith({ tasks: [held], messages: [appliedMessage('task-1', held.title)] })
    const next = revealTask(initialShellState('talk'), 'task-1', state)
    expect(next.surface).toBe('tasks')
    expect(revealTarget(next)).toBe('task-1')
  })

  it('the surface declares the link id only when a named task is openable', () => {
    const openable = stateWith({ tasks: [held], messages: [appliedMessage('task-1', held.title)] })
    expect(expectedShellIds(initialShellState('talk'), openable, LOAD)).toContain(
      SHELL_A11Y_IDS.talkTaskLink,
    )
  })
})

describe('AC-31 — a task the list does not hold is NOT ACTIVATABLE AT ALL', () => {
  // "Rendered as an inert control it would be an affordance that does nothing,
  // which is worse than none; rendered as plain text it is honest."
  //
  // Two causes, two tests, and they are not the same case. Written apart on
  // purpose: a single parameterised test over "the row is missing" would pass
  // with either cause unimplemented (L-005).

  it('the task was DELETED — the message names it by title and there is no id to open', () => {
    const state = stateWith({ tasks: [], messages: [deleteOutcome()] })
    // nothing in a delete outcome is linkable, so there is no id to guard
    expect(linkableTaskIds(deleteOutcome())).toEqual([])
    expect(expectedShellIds(initialShellState('talk'), state, LOAD)).not.toContain(
      SHELL_A11Y_IDS.talkTaskLink,
    )
  })

  it('the task is FILTERED OUT of the collection currently shown', () => {
    // The row exists. The list on screen does not hold it, so the
    // postcondition — that row is on screen and has flashed once — could not
    // be met by navigating there, and the title is plain text.
    const elsewhere = task({ id: 'task-9', title: 'Buy milk', status: 'inbox' })
    const state = stateWith({
      tasks: [elsewhere],
      messages: [appliedMessage('task-9', elsewhere.title)],
    })
    const shell = initialShellState('talk') // collection: 'today'
    expect(taskLinkState('task-9', state.tasks, shell.collection)).toBe('inert')
    expect(expectedShellIds(shell, state, LOAD)).not.toContain(SHELL_A11Y_IDS.talkTaskLink)

    // …and it becomes a control again once the collection that holds it is the
    // one on screen. Same row, same message, different list — which is what
    // makes the rule about the LIST rather than about the task.
    const onInbox = shellReducer(shell, { type: 'select-collection', collection: 'inbox' })
    expect(taskLinkState('task-9', state.tasks, onInbox.collection)).toBe('link')
  })

  it('the routine refuses an inert target rather than navigating to a row that is not there', () => {
    const elsewhere = task({ id: 'task-9', status: 'inbox' })
    const state = stateWith({ tasks: [elsewhere] })
    const shell = initialShellState('talk')
    expect(revealTask(shell, 'task-9', state)).toBe(shell)
    expect(revealTask(shell, 'no-such-task', state)).toBe(shell)
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
      { type: 'open-settings' },
      { type: 'back' },
      { type: 'close-menu' },
    ] as const) {
      s = shellReducer(s, action)
      expect(revealTarget(s), `${action.type} set a reveal target`).toBe(null)
    }
    expect(revealTarget(revealTask(s, 'task-1', state))).toBe('task-1')
  })

  it('the same row arrived at twice is two events, so the second flash still fires', () => {
    const held = task({ id: 'task-1' })
    const state = stateWith({ tasks: [held] })
    const first = revealTask(initialShellState('tasks'), 'task-1', state)
    const consumed = shellReducer(first, { type: 'reveal-consumed' })
    expect(revealTarget(consumed)).toBe(null)
    const second = revealTask(consumed, 'task-1', state)
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
  const rows = stateWith({ tasks: [task({ id: 'task-1', status: 'today' })] })
  const onTasks = initialShellState('tasks')

  it('delete is declared whenever the list has rows — always visible, never hover-revealed', () => {
    // "A hover-revealed control does not exist on touch, and hiding it would
    // publish an id no user can reach" (components.md § Platform variants). So
    // the id's condition is the presence of rows and nothing else: there is no
    // focus, hover or long-press term for it to be gated on.
    expect(expectedShellIds(onTasks, rows, LOAD)).toContain(SHELL_A11Y_IDS.tasksDeleteButton)
    expect(expectedShellIds(onTasks, stateWith(), LOAD)).not.toContain(
      SHELL_A11Y_IDS.tasksDeleteButton,
    )
  })

  it('rename is entered by tapping the title, so its input appears only for the tapped row', () => {
    expect(expectedShellIds(onTasks, rows, LOAD)).not.toContain(SHELL_A11Y_IDS.tasksRenameInput)
    expect(
      expectedShellIds(onTasks, rows, { ...LOAD, renaming: 'task-1' }),
    ).toContain(SHELL_A11Y_IDS.tasksRenameInput)
    // a row that is not in the collection on screen cannot be the one being
    // renamed
    expect(
      expectedShellIds(onTasks, rows, { ...LOAD, renaming: 'task-9' }),
    ).not.toContain(SHELL_A11Y_IDS.tasksRenameInput)
  })
})
