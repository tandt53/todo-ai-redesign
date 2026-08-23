// The app shell — two peer surfaces on a phone, the landing question, back,
// PathSwitch, and the reachability bound F-001 AC-24 / AC-25 state.
//
// Node tier: every assertion below is over `model/shell.ts` and
// `model/tasks-view.ts`, which is where the decisions live precisely so a
// simulator is not what stands between this build and a red test
// (platform mobile.md ## Test Harness).

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { readdirSync } from 'node:fs'
import { initialState } from '../../_shared/model/reducer.ts'
import type { AppState } from '../../_shared/model/reducer.ts'
import type { Message } from '../../_shared/types.ts'
import {
  LANDING_SURFACE,
  SURFACE_ERROR,
  SURFACE_ERRORS_NOT_ON_PHONE,
  actionsToList,
  initialShellState,
  listAffordanceEnabled,
  pathSwitch,
  reachesListAffordance,
  shellBack,
  shellReducer,
  talkView,
} from '../model/shell.ts'
import type { PeerSurface, ShellState } from '../model/shell.ts'
import {
  EMPTY_TASKS,
  INLINE_RETRY_BANNER,
  DEFAULT_COLLECTION,
  groupTasks,
  groupsByDay,
  openTodayCount,
  tasksHeadline,
  tasksSurfaceView,
} from '../model/tasks-view.ts'
import type { LoadState } from '../../_shared/model/reducer.ts'
import { task, todayTask, upcomingTask } from './_helpers.ts'

const ROOT = resolve(import.meta.dirname, '../../../..')
const MOBILE_SRC = resolve(ROOT, 'src/assistant/mobile')

function stateWith(over: Partial<AppState> = {}): AppState {
  // `ok` by default: most cases below are about what renders once a read has
  // landed, and the reads themselves get their own cases.
  return {
    ...initialState('available'),
    sessionId: 'sess-1',
    sessionLoad: 'ok',
    tasksLoad: 'ok',
    ...over,
  }
}

const AT = '2026-08-17T09:00:00.000Z'
function message(over: Partial<Message> = {}): Message {
  return { id: 'm1', kind: 'no-match', heard: 'plan the week', at: AT, ...over } as Message
}

// ---------------------------------------------------------------------------
// OQ9 — the landing surface
// ---------------------------------------------------------------------------

describe('OQ9 — what a phone lands on is ONE declared value', () => {
  it('the shell opens on the shared default collection, not a second answer', () => {
    expect(initialShellState().collection).toBe(DEFAULT_COLLECTION)
  })

  it('the mount reads the constant rather than restating its value', () => {
    // Both possible answers, driven through the same function. If the mount
    // path ever hardcodes one of them this goes red for the other.
    for (const landing of ['talk', 'tasks'] as PeerSurface[]) {
      expect(initialShellState(landing).surface).toBe(landing)
    }
    expect(initialShellState().surface).toBe(LANDING_SURFACE)
  })

  it('nothing else in src/assistant/mobile decides a landing surface', () => {
    // A SOURCE SCAN, and labelled as one — but the claim it checks is exactly
    // what a source scan can see: that the constant has one declaration and
    // that no other module initialises a shell state of its own. "One line to
    // change" is worthless if it is one line plus a mount path nobody
    // remembered, and the owner answers this question in the morning.
    const files: string[] = []
    const walk = (dir: string) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const full = resolve(dir, e.name)
        if (e.isDirectory()) walk(full)
        else if (/\.tsx?$/.test(e.name) && !full.includes('__tests__')) files.push(full)
      }
    }
    walk(MOBILE_SRC)

    const declarations = files.filter((f) =>
      readFileSync(f, 'utf8').includes('export const LANDING_SURFACE'),
    )
    expect(declarations.map((f) => f.replace(`${MOBILE_SRC}/`, ''))).toEqual(['model/shell.ts'])

    // `initialShellState` is the only constructor of a ShellState, and only the
    // controller calls it. Anything else building one would be a second answer.
    // A CALL, not a mention: the comment blocks that explain the design name
    // the function too, and a scan that counted those would report a second
    // decision where there is only a second sentence.
    const callers = files.filter(
      (f) =>
        /^(?!\s*(\*|\/\/)).*initialShellState\(/m.test(readFileSync(f, 'utf8')) &&
        !f.endsWith('model/shell.ts'),
    )
    expect(callers.map((f) => f.replace(`${MOBILE_SRC}/`, ''))).toEqual(['controller.ts'])
  })

  it('no caller passes an override, so the constant is the live answer', () => {
    const ctrl = readFileSync(resolve(MOBILE_SRC, 'controller.ts'), 'utf8')
    expect(ctrl).toContain('initialShellState()')
    expect(/initialShellState\((?!\))/.test(ctrl)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Two peers, one at a time
// ---------------------------------------------------------------------------

describe('two peer surfaces, one at a time', () => {
  it('the switch is reciprocal and costs one action each way', () => {
    let s = initialShellState('talk')
    s = shellReducer(s, { type: 'go', surface: 'tasks' })
    expect(s.surface).toBe('tasks')
    s = shellReducer(s, { type: 'go', surface: 'talk' })
    expect(s.surface).toBe('talk')
  })

  it('leaving Tasks closes what was stacked over it', () => {
    let s = shellReducer(initialShellState('tasks'), { type: 'open-menu' })
    s = shellReducer(s, { type: 'open-settings' })
    s = shellReducer(s, { type: 'go', surface: 'talk' })
    expect(s.overlay).toBe('none')
  })

  it('picking a collection closes the menu — "tap the row; the menu closes"', () => {
    let s = shellReducer(initialShellState('tasks'), { type: 'open-menu' })
    s = shellReducer(s, { type: 'select-collection', collection: 'inbox' })
    expect(s).toMatchObject({ collection: 'inbox', overlay: 'none' })
  })
})

describe('back means UP ONE LEVEL, never "the previous surface"', () => {
  // Four cases, one per level, written separately rather than parameterised:
  // the interesting one is the LAST, and a shared setup is what would hide it
  // (L-005).
  it('Settings goes back to the Lists menu, not to the surface underneath', () => {
    const s: ShellState = { ...initialShellState('tasks'), overlay: 'settings' }
    expect(shellBack(s)).toEqual({ state: { ...s, overlay: 'menu' }, consumed: true })
  })

  it('the Lists menu closes onto its peer', () => {
    const s: ShellState = { ...initialShellState('tasks'), overlay: 'menu' }
    expect(shellBack(s)).toEqual({ state: { ...s, overlay: 'none' }, consumed: true })
  })

  it('back on Tasks is NOT a switch to Talk — the peers are not stacked', () => {
    const s = initialShellState('tasks')
    const out = shellBack(s)
    expect(out.state.surface).toBe('tasks')
    expect(out.consumed).toBe(false)
  })

  it('back on Talk leaves the app rather than becoming a fourth navigation edge', () => {
    const s = initialShellState('talk')
    expect(shellBack(s)).toEqual({ state: s, consumed: false })
  })
})

// ---------------------------------------------------------------------------
// PathSwitch
// ---------------------------------------------------------------------------

describe('PathSwitch carries the open count, and the count is not the guarantee', () => {
  it('PS-TASKS names the count as a sentence, never as a bare number', () => {
    // All three are dated TODAY (ADR-009: that is the only thing that puts a
    // row in Today). `c` is dated today AND done, so the badge excluding it is
    // the done rule doing work — a dateless `done` row would have been excluded
    // twice over and proved neither.
    const tasks = [todayTask({ id: 'a' }), todayTask({ id: 'b' }), todayTask({ id: 'c', status: 'done' })]
    const v = pathSwitch('talk', tasks)
    expect(v).toMatchObject({ row: 'PS-TASKS', label: 'Tasks', badge: 2 })
    expect(v.accessibleName).toBe('Tasks, 2 left today')
  })

  it('zero renders NO badge — a badge reading 0 is a number pretending to be news', () => {
    const v = pathSwitch('talk', [todayTask({ status: 'done' })])
    expect(v.badge).toBe(null)
    expect(v.accessibleName).toBe('Tasks')
  })

  it('PS-TALK carries no count at all', () => {
    expect(pathSwitch('tasks', [task()])).toMatchObject({
      row: 'PS-TALK',
      label: 'Talk',
      badge: null,
      accessibleName: 'Talk',
    })
  })

  it('the badge and the Tasks header publish ONE number, not two definitions', () => {
    // two in Today (dated), one only in Inbox (dateless) — so the number is 2
    // and not 3, and the two publishers still agree on it
    const tasks = [todayTask({ id: 'a' }), task({ id: 'b', status: 'inbox' }), todayTask({ id: 'c' })]
    expect(pathSwitch('talk', tasks).badge).toBe(openTodayCount(tasks))
    expect(tasksHeadline(openTodayCount(tasks))).toBe('2 tasks left today')
  })
})

// ---------------------------------------------------------------------------
// AC-24 / AC-25 — the reachability bound
// ---------------------------------------------------------------------------

describe('AC-24 / AC-25 — the by-hand list is at most ONE action from every conversation failure', () => {
  // The AC names three failure states explicitly, and its own wording is a
  // quantifier over all of them ("from EVERY conversation failure state").
  // These are the three, each reached its own way rather than through a shared
  // setup — the shape L-005 warns about is exactly one door left unguarded.
  const failures: { name: string; state: AppState; isFailing: (s: AppState) => boolean }[] = [
    {
      name: 'a failed turn (AC-24)',
      isFailing: (s) => s.surface === 'error',
      state: stateWith({
        surface: 'error',
        messages: [message({ kind: 'error', head: "Couldn't send", body: [], retryTurnId: 'cid-1' })],
      }),
    },
    {
      name: 'offline (AC-25)',
      isFailing: (s) => s.offline && s.queuedTurnId !== null,
      state: stateWith({ offline: true, queuedTurnId: 'cid-9' }),
    },
    {
      name: 'the session read failing, with no thread to render at all (IA §6)',
      isFailing: (s) => talkView(s) === 'failed',
      state: stateWith({ messages: [], sessionLoad: 'failed' }),
    },
  ]

  for (const f of failures) {
    it(`${f.name}: one action, and the affordance is neither hidden nor disabled`, () => {
      const shell = initialShellState('talk')
      expect(actionsToList(shell)).toBeLessThanOrEqual(1)
      expect(reachesListAffordance(shell)).toBe(true)
      expect(listAffordanceEnabled(f.state)).toBe(true)
      // …and the fixture really is the failure it claims to be. Each case says
      // so in its own terms rather than through one shared predicate: the three
      // failures have three different observables, and a shared one would pass
      // for a fixture that had drifted into being none of them.
      expect(f.isFailing(f.state), 'the fixture is not actually failing').toBe(true)
    })
  }

  it('on Tasks the list is already there — zero actions, and the bound still holds', () => {
    expect(actionsToList(initialShellState('tasks'))).toBe(0)
  })

  it('nothing in the shell model can disable the affordance', () => {
    // Stated as a property over every state the conversation can be in rather
    // than over a list of failures, because the AC is stated that way and a
    // list is what leaves the next failure state outside the guarantee.
    for (const surface of ['idle', 'listening', 'thinking', 'error'] as const) {
      for (const offline of [false, true]) {
        expect(listAffordanceEnabled(stateWith({ surface, offline }))).toBe(true)
      }
    }
    // The control has no disabling path at all: not a `disabled` prop, not an
    // `accessibilityState.disabled`. Asserted against the rendered props rather
    // than against the prose that explains them.
    const src = readFileSync(resolve(MOBILE_SRC, 'components/PathSwitch.tsx'), 'utf8')
    expect(/disabled\s*[:=]/.test(src)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Which view each surface renders
// ---------------------------------------------------------------------------

describe('S1 Talk — a loading surface never renders its empty state', () => {
  it('loading shows skeletons, not the invitation', () => {
    expect(talkView(stateWith({ sessionLoad: 'loading' }))).toBe('loading')
  })

  it('a read never attempted is loading too — the invitation must not beat the answer', () => {
    expect(talkView(stateWith({ sessionLoad: 'idle' }))).toBe('loading')
  })

  it('a failed session read is its own surface, not an empty conversation', () => {
    expect(talkView(stateWith({ sessionLoad: 'failed' }))).toBe('failed')
  })

  it('the invitation needs a read that actually completed', () => {
    expect(talkView(stateWith({ sessionLoad: 'ok' }))).toBe('empty')
  })

  it('with a thread on screen there is somewhere to put an error bubble, so SE-SESSION does not take the surface', () => {
    for (const load of ['failed', 'loading'] as LoadState[]) {
      expect(talkView(stateWith({ messages: [message()], sessionLoad: load }))).toBe('idle')
    }
  })
})

describe('S2 Tasks — the list is never replaced by an error', () => {
  it('a failed refresh with tasks on device keeps every row and adds a retry banner', () => {
    const v = tasksSurfaceView(stateWith({ tasks: [todayTask()], tasksLoad: 'failed' }), 'today')
    expect(v.view).toBe('default')
    expect(v.banner).toBe('retry')
    expect(v.tasks).toHaveLength(1)
  })

  it('a failed refresh with nothing anywhere IS the error surface', () => {
    const v = tasksSurfaceView(stateWith({ tasksLoad: 'failed' }), 'today')
    expect(v.view).toBe('error')
  })

  it('offline is not a failure: the list works and the banner carries the news', () => {
    const v = tasksSurfaceView(stateWith({ tasks: [todayTask()], offline: true }), 'today')
    expect(v.view).toBe('default')
    expect(v.banner).toBe('offline')
  })

  it('loading shows skeletons rather than "No tasks yet"', () => {
    expect(tasksSurfaceView(stateWith({ tasksLoad: 'loading' }), 'today').view).toBe('loading')
  })

  it('three empty states, because they are three different facts', () => {
    // ET-FIRST — nothing anywhere
    expect(tasksSurfaceView(stateWith(), 'today').empty).toBe('ET-FIRST')
    // ET-COLLECTION — this collection only. Telling a user with tasks that
    // they have none is the lie the generic empty state tells.
    // a task that is `done` is in no open collection, so Inbox is empty while
    // the list as a whole is not
    expect(tasksSurfaceView(stateWith({ tasks: [task({ status: 'done' })] }), 'inbox').empty).toBe(
      'ET-COLLECTION',
    )
    // ET-DONE — and it offers no action, because none fills this list
    expect(tasksSurfaceView(stateWith({ tasks: [task()] }), 'done').empty).toBe('ET-DONE')
    expect(EMPTY_TASKS['ET-DONE'].action).toBe(null)
  })
})

describe('day headers stack above their rows — and only on the collections that group', () => {
  // `TaskList.tsx` is the consumer, so the per-collection rule is asserted at
  // this tier too rather than trusted from the web one: the two clients render
  // the same groups from the same function (F-003 § Parity), and a mobile-only
  // regression would otherwise have no observable here.
  const now = new Date('2026-08-16T09:00:00.000Z')

  it('today and tomorrow are named; a task with no date gets its own group', () => {
    const groups = groupTasks(
      [
        task({ id: 'a', status: 'inbox', due_at: '2026-08-16T16:00:00.000Z' }),
        task({ id: 'b', status: 'inbox', due_at: '2026-08-17T10:00:00.000Z' }),
        task({ id: 'c', status: 'inbox', due_at: null }),
      ],
      'today',
      now,
    )
    expect(groups).toHaveLength(3)
    expect(groups[0]?.label?.startsWith('Today · ')).toBe(true)
    expect(groups[1]?.label?.startsWith('Tomorrow · ')).toBe(true)
    expect(groups[2]?.label).toBe('Anytime')
  })

  it('tasks due the same day share one group', () => {
    const groups = groupTasks(
      [
        task({ id: 'a', status: 'inbox', due_at: '2026-08-16T10:00:00.000Z' }),
        task({ id: 'b', status: 'inbox', due_at: '2026-08-16T12:00:00.000Z' }),
      ],
      'today',
      now,
    )
    expect(groups).toHaveLength(1)
    expect(groups[0]?.tasks).toHaveLength(2)
  })

  it('overdue rows head the Today collection under `Overdue`, not under `Later`', () => {
    // The heading `Later` reads *after tomorrow*. Once Today widened to
    // `<= today` (ADR-009 § Amendment) every overdue row in it rendered under
    // that word — false, on the collection every account opens, about the seven
    // rows that are the entire observable effect of the amendment.
    const groups = groupTasks(
      [
        task({ id: 'today', status: 'inbox', due_at: '2026-08-16T16:00:00.000Z' }),
        task({ id: 'late', status: 'inbox', due_at: '2026-08-14T10:00:00.000Z' }),
      ],
      'today',
      now,
    )
    expect(groups.map((g) => g.label)).toEqual(['Overdue', 'Today · Sun, Aug 16'])
    expect(groups.map((g) => g.label)).not.toContain('Later')
  })

  it('DONE renders FLAT — `label: null`, and no heading is drawn for it', () => {
    // CHANGED at T-139: Inbox was in this loop and now groups. It read flat on
    // the premise that Inbox *is* "no date", so `Anytime` was true of every row
    // it could hold; Inbox is a container now and holds rows from every cell of
    // the date axis. Done stays flat for the reason that did not move — group
    // it by `due_at` and a task finished this morning appears under `Overdue`
    // because it was due last week.
    const groups = groupTasks([task({ id: 'a' }), task({ id: 'b' })], 'done', now)
    expect(groups.map((g) => g.label)).toEqual([null])
    expect(groups[0]?.tasks).toHaveLength(2)
    expect(groupsByDay('done')).toBe(false)

    // and the three that DO group say so, which is what the skeleton reads to
    // decide whether to draw its heading-shaped bar
    expect(groupsByDay('today')).toBe(true)
    expect(groupsByDay('upcoming')).toBe(true)
    expect(groupsByDay('inbox')).toBe(true)
  })

  it('the mobile Lists menu draws the group break — a SOURCE SCAN, and it says so', () => {
    // What this tier can and cannot see (L-002). The web client's break is
    // asserted on the RENDER, in `web/__tests__/shell.test.tsx`: two
    // `.menu-group` blocks, three rows then one. Mobile's components are React
    // Native and nothing here renders them — there is no react-native-web alias
    // in the vitest config, and the hook tier drives doubles rather than the
    // real views. So the strongest available check on this half is a scan, and
    // the claim it makes is exactly what a scan can support: the menu maps the
    // GROUPS and never the flattened order.
    //
    // It can fail, which is the only reason to write it: flatten the render
    // back to `COLLECTIONS.map(` — the shape that shipped until T-139 and the
    // one a tidy-up would reach for — and both assertions go red.
    const src = readFileSync(resolve(MOBILE_SRC, 'components/ListsMenu.tsx'), 'utf8')
    expect(src, 'renders the two groups').toMatch(/COLLECTION_GROUPS\.map\(/)
    expect(src, 'and does not flatten them back into one column').not.toMatch(
      /COLLECTIONS\.map\(|COLLECTION_GROUPS\.flat\(\)/,
    )
    // the break is space, not a rule or a header: no divider view, no border,
    // and no label over the filing group (components.md § ListsMenu)
    expect(src, 'the break is a margin, not a divider').toMatch(/styles\.menuFilingGroup/)
    const styles = readFileSync(resolve(MOBILE_SRC, 'components/styles.ts'), 'utf8')
    const rule = /menuFilingGroup: \{([^}]*)\}/.exec(styles)?.[1] ?? ''
    expect(rule, 'the filing group carries margin only').toMatch(/marginTop/)
    expect(rule, 'no rule, no border').not.toMatch(/border|Width|backgroundColor/)
  })

  it('INBOX groups — the lateness signal reaches the surface every account opens', () => {
    // components.md § TaskList (rewritten T-139). Mobile draws the same
    // headings from the same shared classification, and this is the collection
    // where flat rendering was costing a FACT rather than a heading: *one
    // signal, not two* puts lateness in the group heading and nowhere else, so
    // a flat Inbox showed the live store's 7 overdue rows with no lateness
    // signal anywhere.
    const groups = groupTasks(
      [
        task({ id: 'undated', due_at: null }),
        task({ id: 'late', status: 'inbox', due_at: '2026-08-14T10:00:00.000Z' }),
        task({ id: 'today', status: 'inbox', due_at: '2026-08-16T16:00:00.000Z' }),
      ],
      'inbox',
      now,
    )
    expect(groups.map((g) => g.label)).toEqual(['Overdue', 'Today · Sun, Aug 16', 'Anytime'])
    expect(groups[0]?.tasks.map((t) => t.id)).toEqual(['late'])
    expect(groups[2]?.tasks.map((t) => t.id)).toEqual(['undated'])
  })

  it('Upcoming holds a seeded future row — the live store has none to read', () => {
    // ADR-009 § Amendment §2: no account has a future-dated task, so a suite
    // that replays the store reports this collection green having never held a
    // member. `upcomingTask` is the seed, and it is a week out so `Later` is
    // exercised rather than `Tomorrow`.
    const view = tasksSurfaceView(stateWith({ tasks: [upcomingTask({ id: 'ahead' })] }), 'upcoming', now)
    expect(view.tasks.map((t) => t.id)).toEqual(['ahead'])
    expect(view.empty).toBeNull()
    expect(groupTasks(view.tasks, 'upcoming', now).map((g) => g.label)).toEqual(['Later'])
  })
})

// ---------------------------------------------------------------------------
// Copy — parsed from the owning artifact, never retyped (L-008)
// ---------------------------------------------------------------------------

describe('published copy is transcribed from components.md, not composed', () => {
  const md = readFileSync(resolve(ROOT, 'docs/design/_shared/components.md'), 'utf8')

  function tableRows(heading: string): Map<string, string[]> {
    const section = md.split(`## ${heading}`)[1]
    expect(section, `${heading} is missing from components.md`).toBeDefined()
    const rows = new Map<string, string[]>()
    for (const line of (section as string).split('\n## ')[0]!.split('\n')) {
      const m = /^\|\s*\*\*([A-Z-]+)\*\*\s*\|(.*)\|\s*$/.exec(line)
      if (m === null) continue
      rows.set(
        m[1] as string,
        (m[2] as string).split('|').map((c) => c.trim()),
      )
    }
    return rows
  }

  it('every SurfaceError row design publishes is either carried verbatim or recorded as not-on-phone', () => {
    // Parsing the OWNING artifact rather than a retyped copy is the direction
    // drift actually travels: this goes red when components.md moves, which a
    // check comparing two things the implementation controls never would.
    //
    // **It used to assert `rows.size === 2`, and that was the wrong shape of
    // upstream check.** Design added SE-DETAIL for the web-only task detail and
    // the suite went red with nothing wrong on either side — the count was
    // standing in for "and no others", which is a claim about THIS client's
    // surfaces rather than about design's table. So the count is gone and the
    // partition is asserted instead: every published row is carried or excluded
    // with a reason, and nothing is both or neither. A new row design adds still
    // fails here (it is in neither set) — which is the property the count was
    // there for — but it now fails saying which row and that it needs a decision.
    const rows = tableRows('SurfaceError')
    expect(rows.size).toBeGreaterThanOrEqual(2)
    for (const [id, cells] of rows) {
      const copy = SURFACE_ERROR[id as keyof typeof SURFACE_ERROR]
      const excluded = SURFACE_ERRORS_NOT_ON_PHONE[id]
      expect(
        (copy === undefined) !== (excluded === undefined),
        `${id} must be either carried in SURFACE_ERROR or recorded in SURFACE_ERRORS_NOT_ON_PHONE — not both, not neither`,
      ).toBe(true)
      if (copy === undefined) continue
      expect(copy.line1).toBe(cells[1])
      expect(copy.line2).toBe(cells[2])
    }
    // The exclusions are for rows that EXIST upstream. A stale entry for a row
    // design has removed would otherwise sit here forever looking deliberate.
    for (const id of Object.keys(SURFACE_ERRORS_NOT_ON_PHONE)) {
      expect(rows.has(id), `${id} is recorded as not-on-phone but design no longer publishes it`).toBe(
        true,
      )
    }
  })

  it('the three Tasks empty states carry design’s exact heads', () => {
    const rows = tableRows('Empty states — Tasks')
    expect(rows.size).toBe(3)
    for (const [id, cells] of rows) {
      const copy = EMPTY_TASKS[id as keyof typeof EMPTY_TASKS]
      expect(copy, `${id} has no literal in the model`).toBeDefined()
      expect(copy.head).toBe(cells[1])
    }
  })

  it('the inline retry banner is design’s sentence, em dash and all', () => {
    // The sentence wraps across two source lines in the markdown, so the
    // comparison is on collapsed whitespace — never on a re-typed copy.
    const section = (md.split('## InlineRetryBanner')[1] as string).replace(/\s+/g, ' ')
    expect(section).toContain(INLINE_RETRY_BANNER)
  })

  it('no published body is derived — every literal appears verbatim in the model source', () => {
    // The assertion that makes "literals, never templates" enforceable rather
    // than a convention (L-008 rule 3). A template that interpolated the
    // varying part would serve plausible text for combinations nobody
    // enumerated, and `{list}` is design's own verbatim slot, not an
    // interpolation of ours.
    const src = readFileSync(resolve(MOBILE_SRC, 'model/tasks-view.ts'), 'utf8')
    for (const row of Object.values(EMPTY_TASKS)) {
      expect(src).toContain(row.head)
      if (row.body !== null) expect(src).toContain(row.body)
    }
    const shellSrc = readFileSync(resolve(MOBILE_SRC, 'model/shell.ts'), 'utf8')
    for (const row of Object.values(SURFACE_ERROR)) {
      expect(shellSrc).toContain(row.line2)
    }
  })
})
