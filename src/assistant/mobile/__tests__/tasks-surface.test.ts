// S2 Tasks driven through the real controller.
//
// Three things are settled here and they are deliberately kept apart:
//
//   AC-18  all FOUR manual operations, by touch, with zero AI calls. Mobile
//          shipped two of the four (add, toggle) while `F-003 ## Parity` listed
//          AC-18 among the ACs that "hold identically" — `uc-coverage-map.md`
//          D8. The shared controller has had `editTask` and `removeTask` all
//          along and web called both.
//
//   AC-32  the rendered list is not stale after a turn. **Weaker than AC-1 and
//          never a substitute for it**: "if AC-32 fails and AC-1 passes, the
//          user has still seen what changed; if AC-1 fails and AC-32 passes,
//          they have not." A test for one is never coverage of the other, which
//          is why the AC-1 assertions below read the MESSAGE and never the
//          list, and the AC-32 assertions read the LIST and never the message.
//
//   AC-1   one mechanism, no viewport condition — asserted here as: the applied
//          message carries the same full per-field diff whichever surface the
//          user happens to be on.

import { describe, expect, it } from 'vitest'
import type { Message } from '../../_shared/types.ts'
import { initialShellState, shellReducer } from '../model/shell.ts'
import { tasksSurfaceView } from '../model/tasks-view.ts'
import { appliedTurn, mobileHarness, requestLog, settle, task, turnResponse } from './_helpers.ts'
import type { MobileHarness } from './_helpers.ts'

const aiCalls = (h: MobileHarness) =>
  requestLog(h).filter((r) => r.startsWith('POST /assistant/turn')).length

const titles = (h: MobileHarness) => h.controller.state.tasks.map((t) => t.title)

/** A harness whose `GET /tasks` is scripted per read. The harness's own quiet
 * default (`{ tasks: [] }`) is a `default` reply, and defaults beat the fake
 * server's stateful store — so the read-back a create produces is scripted
 * here rather than left to a store that never gets consulted. */
async function withTasks(seed: ReturnType<typeof task>[] = []): Promise<MobileHarness> {
  const h = await mobileHarness({ platform: 'ios' })
  h.server.once('GET /tasks', 200, { tasks: seed })
  await h.controller.init()
  await settle()
  return h
}

/** `deliver` kicks the post-turn task read with `void this.refreshTasks()`, so
 * the read is deliberately not awaited by the turn — drain twice. */
async function drain(): Promise<void> {
  await settle()
  await settle()
  await settle()
}

// ---------------------------------------------------------------------------
// AC-18 — all four, by hand, with zero AI calls
// ---------------------------------------------------------------------------

describe('F-001 AC-18 — every list operation is doable by direct touch, with zero AI calls', () => {
  // One test per operation, not one parameterised over four: the two that
  // matter are the two that were missing, and a shared driver is exactly what
  // would let a missing one hide behind its siblings (L-005).

  it('create', async () => {
    const h = await withTasks()
    h.server.once('POST /tasks', 201, { task: task({ id: 'srv-1', title: 'qamob-shell-create' }) })
    h.server.once('GET /tasks', 200, { tasks: [task({ id: 'srv-1', title: 'qamob-shell-create' })] })
    await h.controller.addTask('qamob-shell-create')
    await drain()
    expect(titles(h)).toContain('qamob-shell-create')
    expect(requestLog(h)).toContain('POST /tasks')
    expect(aiCalls(h)).toBe(0)
  })

  it('complete', async () => {
    const h = await withTasks([task({ id: 'task-1', title: 'qamob-shell-toggle' })])
    const t = h.controller.state.tasks.find((x) => x.title === 'qamob-shell-toggle')!
    await h.controller.toggleTask(t.id)
    await settle()
    expect(h.controller.state.tasks.find((x) => x.id === t.id)?.status).toBe('done')
    expect(aiCalls(h)).toBe(0)
  })

  it('rename — D8 CLOSING, not new behaviour', async () => {
    // `editTask` is the shared controller's, unchanged, and web has called it
    // since F-001. What was missing on mobile was the control: there is no
    // hover on a phone, so rename is entered by TAPPING THE TITLE
    // (components.md § Platform variants).
    const h = await withTasks([task({ id: 'task-1', title: 'qamob-shell-old' })])
    const t = h.controller.state.tasks.find((x) => x.title === 'qamob-shell-old')!
    await h.controller.editTask(t.id, 'qamob-shell-new')
    await settle()
    expect(titles(h)).toContain('qamob-shell-new')
    expect(titles(h)).not.toContain('qamob-shell-old')
    expect(requestLog(h)).toContain(`PATCH /tasks/${t.id}`)
    expect(aiCalls(h)).toBe(0)
  })

  it('delete — D8 CLOSING, not new behaviour', async () => {
    // The delete control is ALWAYS VISIBLE in the row's trailing slot: a
    // hover-revealed control does not exist on touch, and hiding it would
    // publish an id no user can reach.
    const h = await withTasks([task({ id: 'task-1', title: 'qamob-shell-doomed' })])
    const t = h.controller.state.tasks.find((x) => x.title === 'qamob-shell-doomed')!
    await h.controller.removeTask(t.id)
    await settle()
    expect(titles(h)).not.toContain('qamob-shell-doomed')
    expect(requestLog(h)).toContain(`DELETE /tasks/${t.id}`)
    expect(aiCalls(h)).toBe(0)
  })

  it('a hand edit is never attributed to a turn (AC-4)', async () => {
    const h = await withTasks([task({ id: 'task-1', title: 'qamob-shell-unmarked' })])
    const t = h.controller.state.tasks.find((x) => x.title === 'qamob-shell-unmarked')!
    await h.controller.editTask(t.id, 'qamob-shell-unmarked-2')
    await settle()
    expect(h.controller.state.marks?.byTask[t.id] ?? null).toBe(null)
  })
})

// ---------------------------------------------------------------------------
// AC-32 — the rendered list is not stale
// ---------------------------------------------------------------------------

describe('F-001 AC-32 — the task list tells the truth after a turn', () => {
  // TWO cases, and they are structurally different rather than one driver run
  // twice: the AC names two situations ("a list already on screen when the turn
  // applies" and "a list opened afterwards") and a shared setup is what hides
  // the door nobody guarded.

  it('a list ALREADY ON SCREEN updates within that turn, with no navigation at all', async () => {
    const h = await withTasks()
    // the user is on Tasks and stays there — the other door (arriving at the
    // surface after the fact) is shut by never taking it
    const shell = shellReducer(initialShellState('talk'), { type: 'go', surface: 'tasks' })

    h.server.always('GET /tasks', 200, { tasks: [task({ id: 'task-1', title: 'grown in the turn' })] })
    h.server.always(
      'POST /assistant/turn',
      200,
      turnResponse({ turn: appliedTurn({}, { changed_task_ids: ['task-1'] }) }),
    )
    h.controller.composerChange('rename it')
    await h.controller.send('typed')
    await drain()

    const view = tasksSurfaceView(h.controller.state, shell.collection)
    expect(view.tasks.map((t) => t.title)).toContain('grown in the turn')
    // nothing navigated: the shell is the object it was before the turn
    expect(h.controller.shellState().surface).toBe('talk')
  })

  it('a list OPENED AFTERWARDS opens showing the applied state, and opening it is not a refresh', async () => {
    const h = await withTasks()
    h.server.always('GET /tasks', 200, { tasks: [task({ id: 'task-1', title: 'applied while away' })] })
    h.server.always(
      'POST /assistant/turn',
      200,
      turnResponse({ turn: appliedTurn({}, { changed_task_ids: ['task-1'] }) }),
    )
    h.controller.composerChange('rename it')
    await h.controller.send('typed')
    await drain()

    // Only NOW does the user go to Tasks. The reads are counted across the
    // navigation, so a list that were stale until the switch re-fetched it
    // would show up here as an extra GET rather than passing quietly — which is
    // the whole point of separating this case from the one above.
    const before = requestLog(h).filter((r) => r === 'GET /tasks').length
    h.controller.shellDispatch({ type: 'go', surface: 'tasks' })
    await settle()
    const after = requestLog(h).filter((r) => r === 'GET /tasks').length
    expect(after).toBe(before)

    const shell = h.controller.shellState()
    const view = tasksSurfaceView(h.controller.state, shell.collection)
    expect(view.tasks.map((t) => t.title)).toContain('applied while away')
  })
})

// ---------------------------------------------------------------------------
// AC-1 — one mechanism, and it has no viewport (or surface) condition
// ---------------------------------------------------------------------------

describe('F-001 AC-1 — acceptance is read off the applied message ALONE', () => {
  it('the message carries its full per-field diff, identically on either surface', async () => {
    // A phone is always below the split, so there is no width to branch on —
    // but there IS a surface, and this is the mobile shape of the same trap:
    // if the diff were ever thinned because "the list is right there", AC-1
    // would have acquired a second mechanism selected by where the user
    // happens to be standing.
    const diffs: unknown[] = []
    for (const landing of ['talk', 'tasks'] as const) {
      const h = await withTasks()
      h.controller.shellDispatch({ type: 'go', surface: landing })
      h.server.always(
        'POST /assistant/turn',
        200,
        turnResponse({ turn: appliedTurn({ client_turn_id: 'cid-diff' }) }),
      )
      h.controller.composerChange('push the budget review to 4pm')
      await h.controller.send('typed')
      await settle()

      const applied = h.controller.state.messages.find(
        (m): m is Extract<Message, { kind: 'applied' }> => m.kind === 'applied',
      )
      expect(applied, `no applied message on ${landing}`).toBeDefined()
      // read off the MESSAGE — not the list, not the `Tasks · N` count
      expect(applied!.lines).toHaveLength(1)
      expect(applied!.lines[0]?.chips).toContainEqual({
        field: 'due_at',
        old: '2:00 PM',
        new: '4:00 PM',
      })
      diffs.push(applied!.lines)
    }
    expect(diffs[0]).toEqual(diffs[1])
  })
})
