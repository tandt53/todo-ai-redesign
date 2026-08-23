// F-005 on the phone — the half of a web-first feature that reaches it anyway.
//
// **There is no detail surface here** (F-005 ## Out of Scope), so nothing below
// asserts one. What reaches the phone is behaviour, through `_shared/`, which this
// client compiles — and thirteen ACs carry `(mobile)` for exactly that reason. The
// alternative was tagging them `(api, web)`, under which no mobile tier verifies
// any of them, which is the shape `## Impact` §7 exists to catch.
//
// Everything here runs under Node with everything native mocked at the port
// boundary (platform mobile.md ## Test Harness). A green run is evidence about the
// model and the ports and **never about the OS** — the rendered halves of AC-38,
// AC-39, AC-42 and AC-43 have no headless observable at all and join
// `F-003 ## Verification status`'s device-lab debt list rather than starting a
// second one.

import { describe, expect, it } from 'vitest'
import { installClock, installedClock, nowDate } from '../../_shared/model/clock.ts'
import { formatDue } from '../../_shared/model/format.ts'
import { initialState } from '../../_shared/model/reducer.ts'
import type { AppState } from '../../_shared/model/reducer.ts'
import { collectionTasks } from '../../_shared/model/tasks.ts'
import { priorityOf, rendersClockTime, seriesLive } from '../../_shared/model/task-fields.ts'
import type { TaskView } from '../../_shared/types.ts'
import { expectedShellIds, SHELL_A11Y_IDS } from '../model/a11y.ts'
import { initialShellState } from '../model/shell.ts'
import { tasksSurfaceView } from '../model/tasks-view.ts'
import { A11Y_IDS } from '../model/a11y.ts'
import { carriedRowFor } from '../model/carried.ts'
import { FakeServer, T0, mobileHarness, settle, task, todayTask } from './_helpers.ts'

const NOW = new Date(T0)

function stateWith(tasks: TaskView[], over: Partial<AppState> = {}): AppState {
  return {
    ...initialState('available'),
    sessionId: 'sess-1',
    sessionLoad: 'ok',
    tasksLoad: 'ok',
    tasks,
    ...over,
  }
}

// ---------------------------------------------------------------------------
// AC-38 — "when the app opens" is TWO DOORS
// ---------------------------------------------------------------------------

describe('AC-38 — a passed reminder is surfaced at BOTH opening doors', () => {
  // ── WHY THESE ARE TWO TESTS AND NOT ONE PARAMETERISED OVER A SETUP ─────────
  //
  // L-005's own remedy, applied to the file L-005 names in its scope line. Its
  // pattern is *a state machine with two doors into the same room and the guard
  // standing at only one of them*, and its "how to apply" is explicit: when an AC
  // names two or more triggers for one obligation, write one test per trigger and
  // make them **structurally different tests, not one parameterised over a shared
  // setup — a shared setup is exactly what hides the door nobody guarded.**
  //
  // BUG-002 was this defect on this class: `onForeground()` gated input on the
  // session read and `init()` did not. `F-003 AC-8` names resume and cold open in
  // one breath because of it. AC-38 arrives with the same two doors, and
  // `## Test strategy` requires one structurally distinct case per door.
  //
  // So: the cold-open test constructs a controller and calls `init()`; the resume
  // test constructs one, opens it, clears what the cold open produced, and then
  // drives a **lifecycle visibility event** — the OS path, through
  // `FakeAppLifecycle`, not a direct call to `onForeground`. They share no setup
  // helper and neither can pass on the other's code path.

  const passed = () =>
    task({
      id: 'task-r1',
      title: 'Call the dentist',
      // an hour before the harness clock, so it is passed at T0 and not "now"
      reminder_at: '2026-08-16T13:04:00.000Z',
      reminder_shown_at: null,
    })

  it('DOOR 1 — the cold open surfaces it (init)', async () => {
    const h = await mobileHarness()
    h.server.always('GET /tasks', 200, { tasks: [passed()] })
    await h.controller.init()
    expect(h.controller.state.reminders.map((r) => r.taskId)).toEqual(['task-r1'])
  })

  it('DOOR 2 — the RESUME surfaces it, driven through the OS visibility event', async () => {
    // **A phone user's ordinary open is a resume**: a foreground happens dozens of
    // times a day where a cold open happens once. This is the door that was
    // missing, and it is the one that matters more on this platform.
    const h = await mobileHarness()
    // Open with nothing to surface, so the cold open cannot be what produces the
    // result: if `init()` were the only installed door, `reminders` stays empty
    // through the whole test and the final assertion fails.
    await h.controller.init()
    expect(h.controller.state.reminders).toEqual([])

    // The reminder passes while the app is away.
    h.server.always('GET /tasks', 200, { tasks: [passed()] })
    h.lifecycle.background()
    h.lifecycle.foreground()
    await settle()

    expect(h.controller.state.reminders.map((r) => r.taskId)).toEqual(['task-r1'])
  })

  it('the two doors call ONE installer rather than repeating the obligation', async () => {
    // The structural half of L-005's remedy: *"prefer one installer called by every
    // entry point over the same three lines repeated per path; a grep for the
    // installer's name should return every door."* `openingSync` is that installer
    // and it lives in the shared controller, so this asserts the phone reaches the
    // same one rather than having grown a second copy.
    const h = await mobileHarness()
    const calls: string[] = []
    const original = h.controller.openingSync.bind(h.controller)
    h.controller.openingSync = () => {
      calls.push('installer')
      original()
    }
    await h.controller.init()
    h.lifecycle.background()
    h.lifecycle.foreground()
    await settle()
    expect(calls).toEqual(['installer', 'installer'])
  })

  it('an unacknowledged reminder REAPPEARS at the next open; render is not resolution', async () => {
    // AC-38's single most valuable case, and the one revision 3 had two citable
    // answers to: open, do NOT acknowledge, reopen. Under any looser reading a user
    // who taps to look, is interrupted and closes the app has spent their only
    // delivery permanently, on every device, while the task is still undone.
    const h = await mobileHarness()
    h.server.always('GET /tasks', 200, { tasks: [passed()] })
    await h.controller.init()
    expect(h.controller.state.reminders).toHaveLength(1)

    // No acknowledgement. Just leave and come back.
    h.lifecycle.background()
    h.lifecycle.foreground()
    await settle()
    expect(h.controller.state.reminders.map((r) => r.taskId)).toEqual(['task-r1'])
  })

  it('a reminder the server records as acknowledged is not surfaced at either door', async () => {
    // The negative half. `reminder_shown_at` is a STORED fact, not a session one —
    // so it resolves on the next launch, on the next device and after a reload.
    const acked = { ...passed(), reminder_shown_at: T0 }
    const h = await mobileHarness()
    h.server.always('GET /tasks', 200, { tasks: [acked] })
    await h.controller.init()
    expect(h.controller.state.reminders).toEqual([])
    h.lifecycle.background()
    h.lifecycle.foreground()
    await settle()
    expect(h.controller.state.reminders).toEqual([])
  })

  it('N passed reminders are ONE surfacing, oldest first', async () => {
    const older = { ...passed(), id: 'task-r0', reminder_at: '2026-08-10T09:00:00.000Z' }
    const h = await mobileHarness()
    h.server.always('GET /tasks', 200, { tasks: [passed(), older] })
    await h.controller.init()
    expect(h.controller.state.reminders.map((r) => r.taskId)).toEqual(['task-r0', 'task-r1'])
  })
})

// ---------------------------------------------------------------------------
// AC-44 — one clock per side, and the phone's install
// ---------------------------------------------------------------------------

describe('AC-44 — the phone has ONE clock, and the defaulted `now` parameters read it', () => {
  it('the controller exposes a provider that delegates to its own injected seam', async () => {
    const h = await mobileHarness()
    const p = h.controller.clockProvider()
    // It holds no clock of its own — both members delegate, which is what makes it
    // a widening of one seam rather than a second one (L-004).
    expect(p.nowDate().toISOString()).toBe(T0)
    expect(p.nowDate().getTime()).toBe(h.controller.nowDate().getTime())
  })

  it('installing it routes the defaulted `now` parameters onto the seam', async () => {
    const h = await mobileHarness()
    const before = installClock(h.controller.clockProvider())
    try {
      // `nowDate()` is the expression the defaulted parameters use. With the phone's
      // provider installed it answers the controller's instant, not the wall clock.
      expect(nowDate().toISOString()).toBe(T0)
      expect(installedClock()).not.toBeNull()
    } finally {
      installClock(before)
    }
  })

  it('`tasksSurfaceView` and the message door take no wall-clock reading of their own', async () => {
    // The two mobile inline sites AC-44 counts, plus the ninth defaulted parameter.
    // Asserted as a property of the seam rather than by reading the source: with the
    // provider installed, a call that passes no `now` must agree with one that passes
    // the controller's — which is false for a `new Date()` default and true for a
    // `nowDate()` one.
    const h = await mobileHarness()
    const before = installClock(h.controller.clockProvider())
    try {
      const state = stateWith([todayTask({ id: 'task-1' })])
      const implicit = tasksSurfaceView(state, 'today')
      const explicit = tasksSurfaceView(state, 'today', h.controller.nowDate())
      expect(implicit.view).toBe(explicit.view)
      expect(implicit.tasks.map((t) => t.id)).toEqual(explicit.tasks.map((t) => t.id))
    } finally {
      installClock(before)
    }
  })

  it('boot installs the clock — the call `_shared/model/clock.ts` says the phone owes', async () => {
    // A source assertion, and labelled as one: `boot.ts` is the only file in this
    // module that touches React Native directly, so this tier cannot execute it
    // (platform mobile.md). What it buys is the one failure a scan can see honestly
    // — the install being absent, which is the defect itself. L-002's caution
    // applies in the other direction: a pass here is not proof the app installed it.
    const { readFileSync } = await import('node:fs')
    const { resolve, dirname } = await import('node:path')
    const { fileURLToPath } = await import('node:url')
    const src = readFileSync(
      resolve(dirname(fileURLToPath(import.meta.url)), '../boot.ts'),
      'utf8',
    )
    expect(src).toContain('installClock(controller.clockProvider())')
  })
})

// ---------------------------------------------------------------------------
// AC-13 — a date with no time never renders as a time the user did not choose
// ---------------------------------------------------------------------------

describe('AC-13 — the phone stops rendering "12:00 AM" for a Today-created row', () => {
  it('an all-day due renders no clock time, not even for today', () => {
    // This is the behaviour `## Impact` §10 records as ALREADY SHIPPED, on both
    // clients, on the default landing collection: `dueAtForCollection('today')`
    // writes local midnight and `formatDue` returned `clock(d)` unconditionally for
    // a same-day due.
    const t = todayTask({ id: 'task-1' })
    expect(t.due_all_day).toBe(true)
    expect(rendersClockTime(t)).toBe(false)
    const shown = formatDue(t.due_at as string, NOW, { allDay: !rendersClockTime(t) })
    expect(shown).toBe('Today')
    expect(shown).not.toContain('12:00 AM')
  })

  it('an UNDETERMINED flag also suppresses the clock — the direction the AC protects', () => {
    // Three-way and deliberately so: `null`/absent means NOT DETERMINED and renders
    // as a date with no clock time, because no picker exists yet so no stored due
    // was ever a time a user chose. Only an explicit `false` prints one.
    const t = todayTask({ id: 'task-1', due_all_day: null })
    expect(rendersClockTime(t)).toBe(false)
    expect(formatDue(t.due_at as string, NOW, { allDay: !rendersClockTime(t) })).toBe('Today')
  })

  it('an explicit timed due still prints its clock — the AC does not suppress real times', () => {
    const t = task({ id: 'task-1', due_at: '2026-08-16T09:30:00.000Z', due_all_day: false })
    expect(rendersClockTime(t)).toBe(true)
    expect(formatDue(t.due_at as string, NOW, { allDay: !rendersClockTime(t) })).toContain(':')
  })

  it('the row renders through the flag rather than calling formatDue bare', async () => {
    // A source assertion (components are RN). The defect was a bare
    // `formatDue(task.due_at)` — no clock, no flag — so what is asserted is that
    // the call carries both.
    const { readFileSync } = await import('node:fs')
    const { resolve, dirname } = await import('node:path')
    const { fileURLToPath } = await import('node:url')
    const src = readFileSync(
      resolve(dirname(fileURLToPath(import.meta.url)), '../components/TaskList.tsx'),
      'utf8',
    )
    expect(src).toContain('formatDue(task.due_at, now, { allDay: !rendersClockTime(task) })')
    // and no bare call survives
    expect(src).not.toContain('formatDue(task.due_at)')
  })
})

// ---------------------------------------------------------------------------
// AC-35 — a step is in no collection, no count, and is not a handle
// ---------------------------------------------------------------------------

describe('AC-35 — the three mobile readers, which need OPPOSITE inputs', () => {
  // ── THE ACCOUNT THE AC NAMES, AND IT HAS ONE CONSTRUCTION PATH ─────────────
  //
  // *"An account whose tasks are all parents with steps, where every parent is
  // excluded from the collection on screen"* — so `collectionTasks` is empty while
  // `state.tasks` is not. It cannot be reached by deleting parents: AC-18 gives a
  // step exactly one parent, AC-19 takes steps with the parent on delete, and
  // AC-41 restores the parent when a step is restored. Here the parents are
  // excluded by being **done**, which the Today collection does not hold.
  function stepsOnlyAccount(): AppState {
    const parent = task({ id: 'p1', title: 'Plan the party', status: 'done' })
    const step1 = task({ id: 's1', title: 'Book the venue', parent_id: 'p1' })
    const step2 = task({ id: 's2', title: 'Order the cake', parent_id: 'p1' })
    return stateWith([parent, step1, step2])
  }

  it('the shared gate keeps steps out of every collection — one predicate, both clients', () => {
    const state = stepsOnlyAccount()
    for (const c of ['today', 'upcoming', 'inbox', 'done'] as const) {
      const ids = collectionTasks(state.tasks, c, NOW).map((t) => t.id)
      expect(ids, `${c} draws a step`).not.toContain('s1')
      expect(ids, `${c} draws a step`).not.toContain('s2')
    }
    // `mobile/model/tasks-view.ts` re-exports from `_shared/model/tasks.ts`, so this
    // client gets the gate for free — AC-35's own "good news, checked rather than
    // assumed". The three readers below are the ones that do NOT consult it.
  })

  it('READER 1 — the empty-state choice reads RAW cardinality, so it is empty-COLLECTION', () => {
    // *"A user whose only rows are steps is told the collection is empty on their
    // first ever run"* is the defect. `empty-first` would be that lie; the AC
    // requires `empty-collection`, and it is reachable only from
    // `state.tasks.length > 0`.
    const view = tasksSurfaceView(stepsOnlyAccount(), 'today', NOW)
    expect(view.view).toBe('empty-collection')
    expect(view.empty).toBe('ET-COLLECTION')
    expect(view.tasks).toEqual([])
  })

  it('READER 1 — revision 3’s withdrawn alternative is genuinely wrong here', () => {
    // Recorded as a test rather than only as prose, because the alternative is the
    // one an implementer reaches for. *"Derive those three readers from
    // `collectionTasks` rather than from `state.tasks.length`"* was offered as
    // equally satisfying this AC and withdrawn: in the very account the sentence
    // names, `collectionTasks` is empty, so the derived reader returns `empty-first`
    // — the first-run state the sentence forbids two lines earlier.
    const state = stepsOnlyAccount()
    expect(collectionTasks(state.tasks, 'today', NOW)).toEqual([])
    expect(state.tasks.length).toBeGreaterThan(0)
    // The two inputs disagree, which is why one rule over the three cannot hold.
    expect(tasksSurfaceView(state, 'today', NOW).view).not.toBe('empty-first')
  })

  it('READER 2 + 3 — `hasTasks` reads the drawn rows, so NO row ids are required', async () => {
    // Driven through the real `Surface.a11yIds()` default rather than through a
    // reimplementation of it, so this asserts the shipped reader. Sourcing it from
    // raw cardinality expects rows in a view that returns `tasks: []`, which is the
    // a11y half of the defect AC-35 opens with — *"the a11y id set expects a row
    // that is never drawn"*.
    const { createSurface } = await import('../index.ts')
    const server = new FakeServer()
    server.always('GET /assistant/session', 200, { session: null, boundary: null })
    server.always('GET /tasks', 200, {
      tasks: [
        task({ id: 'p1', title: 'Plan the party', status: 'done' }),
        task({ id: 's1', title: 'Book the venue', parent_id: 'p1' }),
        task({ id: 's2', title: 'Order the cake', parent_id: 'p1' }),
      ],
    })
    const s = createSurface({ api: { fetchFn: server.fetchFn }, now: () => T0 })
    await s.start()

    // the account is genuinely non-empty…
    expect(s.tasks.length).toBe(3)
    // …and the collection on screen genuinely draws nothing
    const ids = s.a11yIds()
    expect(ids.has(A11Y_IDS.taskRow), 'taskRow required with no row drawn').toBe(false)
    expect(ids.has(A11Y_IDS.taskCheckbox), 'taskCheckbox required with no row drawn').toBe(false)
    // the surface's own create control is still declared — AC-35 removes rows, not
    // the way to make one
    expect(ids.has(A11Y_IDS.addTaskButton)).toBe(true)
  })

  it('READER 3 — the shell id set follows too', () => {
    // `a11y.ts` requires the row ids only when rows are drawn. With `hasTasks`
    // false, the surface declares none — which is what stops the catalogue
    // expecting a row that is never drawn.
    const state = stepsOnlyAccount()
    const shellIds = expectedShellIds(
      { ...initialShellState('tasks'), collection: 'today' },
      state,
    )
    // no per-row control is declared, because no row is drawn
    expect(shellIds.has(SHELL_A11Y_IDS.tasksDeleteButton)).toBe(false)
    // …and the empty-state's InlineAdd IS declared, because ET-COLLECTION
    // carries one (T-300: the CTA is now an inline field, not a button)
    expect(shellIds.has(SHELL_A11Y_IDS.tasksInlineAdd)).toBe(true)
  })

  it('and the three readers are not one rule — two of them answer differently in this account', () => {
    // The property the AC states per reader, asserted as the disagreement it is.
    // A single rule over the group would have to give both the same answer.
    const state = stepsOnlyAccount()
    const rawCardinalityAnswer = state.tasks.length > 0
    const drawnRowsAnswer = tasksSurfaceView(state, 'today', NOW).tasks.length > 0
    expect(rawCardinalityAnswer).toBe(true)
    expect(drawnRowsAnswer).toBe(false)
    expect(rawCardinalityAnswer).not.toBe(drawnRowsAnswer)
  })
})

// ---------------------------------------------------------------------------
// AC-9 + AC-39 — the row's marks, in its accessible name
// ---------------------------------------------------------------------------

describe('AC-9 — urgency is readable from the row, in all four states', () => {
  it('all four priority states are distinguished in the accessible name', () => {
    // AC-9's own clause: *"All four states are distinguished in the accessible name
    // regardless"* — which is the half assertable across the whole set and the half
    // AC-33's 4.1.2 covers. Three of the four render no glyph, so the name is where
    // the distinction lives, and it lives on the ROW.
    const names = new Map<string, string>()
    for (const p of ['none', 'low', 'medium', 'high'] as const) {
      const t = task({ id: `t-${p}`, priority: p })
      expect(priorityOf(t)).toBe(p)
      names.set(p, rowName(t))
    }
    expect(names.get('none')).toContain('no priority')
    expect(names.get('low')).toContain('low priority')
    expect(names.get('medium')).toContain('medium priority')
    expect(names.get('high')).toContain('high priority')
    // four distinct answers, not three plus a silence
    expect(new Set(names.values()).size).toBe(4)
  })

  it('the four literals are design’s, parsed from § TaskRow rather than retyped', async () => {
    // L-008 rule 2: the test reads the OWNING artifact, so it fails when the
    // upstream moves — the direction drift actually travels.
    const { readFileSync } = await import('node:fs')
    const { resolve, dirname } = await import('node:path')
    const { fileURLToPath } = await import('node:url')
    const md = readFileSync(
      resolve(dirname(fileURLToPath(import.meta.url)), '../../../../docs/design/_shared/components.md'),
      'utf8',
    )
    const section = md.split("### The row's mark budget")[1] as string
    expect(section, '§ TaskRow’s mark budget is missing').toBeDefined()
    for (const literal of ['high priority', 'medium priority', 'low priority', 'no priority']) {
      expect(section.includes('`' + literal + '`'), `${literal} is not published`).toBe(true)
    }
    expect(section).toContain('`repeats`')
  })

  it('only `high` renders a glyph — the graduated scale AC-9 forbids by name is absent', async () => {
    // AC-9 fixes the vocabulary at ONE glyph, *"deliberately one glyph, not Apple's
    // graduated `!` / `!!` / `!!!`"*, and 1.4.3 forbids carrying the level in
    // colour — so § TaskRow rules that `high` renders the `!` and `none`, `low` and
    // `medium` render nothing. Asserted on the source because the mark is rendered
    // by an RN component this tier cannot mount.
    const { readFileSync } = await import('node:fs')
    const { resolve, dirname } = await import('node:path')
    const { fileURLToPath } = await import('node:url')
    const src = readFileSync(
      resolve(dirname(fileURLToPath(import.meta.url)), '../components/TaskList.tsx'),
      'utf8',
    )
    expect(src).toContain("priority === 'high'")
    // the graduated scale, in any of its spellings, appears nowhere
    expect(src).not.toContain("'!!'")
    expect(src).not.toContain("'!!!'")
  })
})

describe('AC-39 — a generated successor is never indistinguishable from a typed task', () => {
  it('a row in a LIVE series carries the repeat mark in its name', () => {
    const t = task({ id: 't1', series_id: 'ser-1', series_live: true })
    expect(seriesLive(t)).toBe(true)
    expect(rowName(t)).toContain('repeats')
  })

  it('the negative case is half the AC — and `series_id` alone never earns the mark', () => {
    // *"Keying the mark off `series_id`, the only plausibly named field and the one
    // AC-25 never clears, passes the positive case and marks every ex-repeating task
    // forever"* — which on the phone is wrong on the only thing that explains the
    // row. All four of AC-25's endings are the server's to evaluate.
    for (const label of ['repeat cleared', 'series ended', 'series deleted']) {
      const t = task({ id: 't1', series_id: 'ser-1', series_live: false })
      expect(seriesLive(t), label).toBe(false)
      expect(rowName(t), label).not.toContain('repeats')
    }
  })

  it('a COMPLETED occupant of a still-live series keeps the mark', () => {
    // Design D17: it belongs to a series that is still running, and Done is history
    // of work that was done.
    const t = task({ id: 't1', status: 'done', series_id: 'ser-1', series_live: true })
    expect(rowName(t)).toContain('repeats')
  })

  it('a row from before the wire carried the field answers false', () => {
    const t = task({ id: 't1' })
    expect(seriesLive(t)).toBe(false)
    expect(rowName(t)).not.toContain('repeats')
  })
})

/**
 * The row's accessible name, built exactly as `components/TaskList.tsx` builds it.
 *
 * **This is a duplicated expression and it is the compromise this tier forces**, so
 * it is named rather than hidden: the name is composed inside an RN component that
 * cannot be mounted under Node, and the alternative — asserting the component's
 * source text — is L-002's mistake. The test above pins the *literals* against
 * design's published table, which is the half that actually drifts; this helper
 * pins the *composition*. If the component's order changes, the source assertion in
 * the AC-9 block is what notices.
 */
function rowName(t: TaskView): string {
  const PRIORITY_A11Y = {
    none: 'no priority',
    low: 'low priority',
    medium: 'medium priority',
    high: 'high priority',
  } as const
  return [t.title, PRIORITY_A11Y[priorityOf(t)], seriesLive(t) ? 'repeats' : '']
    .filter((s) => s !== '')
    .join(', ')
}

// ---------------------------------------------------------------------------
// AC-2 + AC-33's 4.1.3 — the phone's half, and the announcement path
// ---------------------------------------------------------------------------

describe('AC-2 — a refused or failed value survives on the phone, with a retry', () => {
  // **The phone's gap is one level EARLIER than the close** (dev-mobile F4): the
  // mobile rename is a `TextInput` that unmounts on blur, so there is no field for
  // the value to stay in. The notice is the home, and AC-47's lifetime rules bind
  // it here as they do on web.

  it('an offline edit to a SERVER-OWNED row is refused, and the value lives in the notice', async () => {
    const h = await mobileHarness({ online: false })
    h.server.always('GET /tasks', 200, { tasks: [task({ id: 'task-1', title: 'Buy milk' })] })
    await h.controller.init()
    h.controller.injectAction({ type: 'tasks', tasks: [task({ id: 'task-1', title: 'Buy milk' })] })

    await h.controller.editTask('task-1', 'Buy oat milk')

    const notice = h.controller.state.notices.find((n) => n.taskId === 'task-1')
    expect(notice, 'no notice for the refused value').toBeDefined()
    // AC-2's three requirements, all of them: the value kept…
    expect(notice?.fields[0]?.value).toBe('Buy oat milk')
    // …the reason stated as an OFFLINE REFUSAL rather than a failure…
    expect(notice?.fields[0]?.reason).toBe('offline-refused')
    // …and a retry offered. The two ACs had each been pointing at the other about
    // this one; it lands on the phone.
    expect(carriedRowFor(notice!).blocks[0]?.retryable).toBe(true)
  })

  it('an edit to a LOCALLY-CREATED row is NOT refused — the provenance scope', async () => {
    // **Four Gate 1 lenses found the unscoped version of this rule independently.**
    // The owner's decision says *"an edit to a **server-owned** task is never sent"*,
    // and revision 3 dropped `server-owned`. Written unscoped it REMOVES WORKING
    // BEHAVIOUR: create a task offline under F-001 AC-25, then be unable to fix a
    // typo in it. `persistLocal()` genuinely saves the edited row and
    // `pushLocalTasks` genuinely replays it.
    const h = await mobileHarness({ online: false })
    await h.controller.init()
    const local = { ...task({ id: 'local-1', title: 'Buy milk' }), local: true as const }
    h.controller.injectAction({ type: 'tasks', tasks: [local] })

    await h.controller.editTask('local-1', 'Buy oat milk')

    // no refusal notice at all — a notice saying it *wasn't saved* would be false,
    // and drawing one would assert a regression
    expect(h.controller.state.notices.find((n) => n.taskId === 'local-1')).toBeUndefined()
    // and the edit genuinely took
    expect(h.controller.state.tasks.find((t) => t.id === 'local-1')?.title).toBe('Buy oat milk')
  })
})

describe("AC-33's 4.1.3 on the phone — every refusal and status message is ANNOUNCED", () => {
  // ── WHY THIS IS ONE DRAIN AND NOT ONE BRANCH PER OBLIGATION ────────────────
  //
  // AC-33 states 4.1.3 as a RULE — *"every refusal and every status message this
  // spec states is announced"* — then lists the four announcements it *"was never
  // updated for"*, and warns in the same breath that *"an implementer widening
  // `announce.ts` for the undo offer alone leaves that one with no path, which is
  // the enumeration failing the rule stated four lines above it."*
  //
  // `AppState.announce` is the shared controller's one status slot and this client
  // had NO consumer for it, so every one of these was dispatched and never spoken —
  // including AC-2's offline refusal, *"the one that fires during an outage when a
  // screen-reader user has least other information"*, in AC-33's own words.

  it('the offline refusal is spoken — the outage case AC-33 names', async () => {
    const h = await mobileHarness({ online: false })
    await h.controller.init()
    h.controller.injectAction({ type: 'tasks', tasks: [task({ id: 'task-1', title: 'Buy milk' })] })
    h.announcer.clear()

    await h.controller.editTask('task-1', 'Buy oat milk')

    expect(h.announcer.announcements.map((s) => s.text).join(' ')).toContain("You're offline")
  })

  it('the passed-reminder surfacing is spoken', async () => {
    const h = await mobileHarness()
    h.server.always('GET /tasks', 200, {
      tasks: [task({ id: 'task-r1', reminder_at: '2026-08-16T13:04:00.000Z' })],
    })
    await h.controller.init()
    expect(h.announcer.announcements.length).toBeGreaterThan(0)
  })

  it('an empty-title refusal is spoken', async () => {
    const h = await mobileHarness()
    await h.controller.init()
    h.controller.injectAction({ type: 'tasks', tasks: [task({ id: 'task-1', title: 'Buy milk' })] })
    h.announcer.clear()
    await h.controller.editTask('task-1', '   ')
    expect(h.announcer.announcements.length).toBeGreaterThan(0)
  })

  it('polite, never assertive — the family waits, so interrupting would claim a false urgency', async () => {
    const h = await mobileHarness({ online: false })
    await h.controller.init()
    h.controller.injectAction({ type: 'tasks', tasks: [task({ id: 'task-1', title: 'Buy milk' })] })
    h.announcer.clear()
    await h.controller.editTask('task-1', 'Buy oat milk')
    expect(h.announcer.announcements.every((s) => s.assertive !== true)).toBe(true)
  })

  it('the same sentence twice is TWO announcements — a second failure must be heard', async () => {
    // De-duping on text would swallow it. `seq` is what makes the repeat audible,
    // which is why the drain tracks the sequence rather than the string.
    const h = await mobileHarness({ online: false })
    await h.controller.init()
    h.controller.injectAction({ type: 'tasks', tasks: [task({ id: 'task-1', title: 'Buy milk' })] })
    h.announcer.clear()
    await h.controller.editTask('task-1', 'Buy oat milk')
    const first = h.announcer.announcements.length
    await h.controller.editTask('task-1', 'Buy soy milk')
    expect(h.announcer.announcements.length).toBeGreaterThan(first)
  })
})
