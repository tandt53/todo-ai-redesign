// @vitest-environment jsdom
//
// Component tests — the rendered surface.
//
// The headline assertion is the testid contract: the design mockup carries a
// 23-id catalogue, the QA page object binds to those ids and nothing else, and
// a dropped or renamed id is a `layer: web` bug. So the catalogue is READ FROM
// THE MOCKUP at test time and compared against what the app actually renders
// across all 19 mockup states — no hand-copied list to drift.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { App } from '../App.tsx'
import { AssistantApi } from '../../_shared/api/client.ts'
import { AssistantController } from '../../_shared/controller.ts'
import { initialState, reducer } from '../../_shared/model/reducer.ts'
import type { Action, AppState } from '../../_shared/model/reducer.ts'
import type { NewMsg } from '../../_shared/model/messages.ts'
import { isToday } from '../../_shared/model/tasks.ts'
import type { SpeechCapability } from '../../_shared/ports/transcript-source.ts'
import {
  animateScrollTo,
  appliedTurn,
  askedTurn,
  fakeLayout,
  harness,
  recordScrollTo,
  scrollToBottom,
  session,
  setReducedMotion,
  T0,
  task,
  todayTask,
  upcomingTask,
  turnResponse,
} from './_helpers.ts'
import type { TestController } from './_helpers.ts'
import { distanceFromBottom } from '../../_shared/model/follow.ts'

afterEach(cleanup)

// jsdom rewrites import.meta.url to an http URL, so resolve from the vitest
// root instead — the mockups are the contract and must really be read.
//
// TWO mockups now, because the app has two halves. `voice-assistant-view.html`
// draws the conversation's own states; `app-shell.html` draws the surfaces
// outside it (Tasks as a surface, the Lists menu, Settings, the New-list
// sheet). The catalogue is their union.
const MOCKUPS = [
  'design/assistant/screens/voice-assistant-view.html',
  'design/assistant/screens/app-shell.html',
].map((p) => resolve(process.cwd(), p))

function idsIn(file: string): Set<string> {
  const html = readFileSync(file, 'utf8')
  return new Set([...html.matchAll(/data-testid="([^"]+)"/g)].map((m) => m[1] as string))
}

/**
 * Drawn, and deliberately NOT built — each with the artifact that says so.
 *
 * This list is the honest half of the contract. Without it the suite has two
 * dishonest options: drop the second mockup (and stop checking the shell at
 * all), or quietly widen `missing` to a warning (and stop checking anything).
 * Naming them here keeps `missing` empty-or-fail for everything else, and makes
 * the gap a thing a reader can audit rather than a silence.
 */
const NOT_BUILT: Record<string, string> = {
  // Retired, not missing: "the hamburger stops toggling a pane and becomes
  // navigation to a different surface, which is a different control wearing the
  // same glyph … Its retirement lands with the spec pass" (components.md
  // § Testid catalogue — app shell). The spec pass is F-001 revision 4, which
  // has landed; `shell-lists-menu-button` is the replacement.
  'assistant-drawer-button': 'retired by F-001 rev 4 / components.md § Testid catalogue',
  // Personal lists: `lists` and `tasks.list_id` do not exist in
  // src/assistant/api/types.ts. IA §7 draws the line explicitly, and six drawn
  // surfaces sit the wrong side of it.
  'menu-list-row': 'needs `lists` + `tasks.list_id` (IA §7)',
  'menu-new-list-button': 'needs `lists` + `tasks.list_id` (IA §7)',
  'menu-retry-button': 'reports a personal-lists read that cannot happen (IA §7)',
  'list-editor-name-input': 'ListEditorSheet needs `lists` (IA §7, components.md § ListEditorSheet)',
  'list-editor-create-button': 'ListEditorSheet needs `lists` (IA §7)',
  'list-editor-cancel-button': 'ListEditorSheet needs `lists` (IA §7)',
  // "Talk back ships with F-002, not before … a switch that toggles nothing is
  // worse than an absent one" (components.md § SettingsRow). F-002 is specced
  // to rev 3 and unbuilt.
  'settings-talkback-switch': 'needs F-002 (components.md § SettingsRow)',
  'settings-row-retry': 'the failed state of a row that does not exist yet',
  // SaveNotice is drawn in app-shell.html by T-135 and deliberately not built:
  // "designed, not built" (components.md § SaveNotice). Both ids land here
  // together — a notice with no dismiss control, or a dismiss control with no
  // notice, would each be half a component.
  'tasks-save-notice': 'SaveNotice is drawn and unbuilt (components.md § SaveNotice, T-135)',
  'tasks-save-notice-dismiss': 'dismisses a notice that does not render yet (components.md § SaveNotice)',
}

/** The contract, straight from the design mockups — never hand-copied. */
function catalogue(): Set<string> {
  const union = new Set<string>()
  for (const file of MOCKUPS) {
    const ids = idsIn(file)
    // L-007: a parser that silently matched nothing yields the same green as
    // one that worked. Fail loudly instead.
    if (ids.size === 0) throw new Error(`read no testids from ${file}`)
    for (const id of ids) union.add(id)
  }
  return union
}

/** The half of the catalogue this build is expected to render. */
function builtCatalogue(): Set<string> {
  const all = catalogue()
  for (const id of Object.keys(NOT_BUILT)) {
    // Every excuse must name an id the mockups really declare, or the exclusion
    // list is quietly excusing nothing while looking like it excuses something.
    if (!all.has(id)) throw new Error(`NOT_BUILT names ${id}, which no mockup declares`)
    all.delete(id)
  }
  return all
}

function renderedTestids(root: HTMLElement): Set<string> {
  return new Set(
    [...root.querySelectorAll('[data-testid]')].map((el) => el.getAttribute('data-testid') as string),
  )
}

// ---------------------------------------------------------------------------
// State seeding
// ---------------------------------------------------------------------------

function seed(
  base: Partial<AppState>,
  messages: NewMsg[] = [],
  capability: SpeechCapability = 'available',
): AppState {
  const actions: Action[] = messages.length > 0 ? [{ type: 'append', messages }] : []
  return actions.reduce(reducer, {
    ...initialState(capability),
    sessionId: 'sess-1',
    ...base,
  })
}

interface Mounted {
  controller: TestController
  container: HTMLElement
}

/** A `drive` step runs against the mounted app. Two of the mockup's states —
 * the new-message affordance's — are not snapshots of a model but of a
 * SITUATION (the user is scrolled up and something arrived), so they are seeded
 * by putting the app in that situation rather than by a state literal. */
function mount(state: AppState, drive?: (m: Mounted) => void): Mounted {
  const h = harness({ capability: state.capability })
  h.controller.state = state
  const { container } = render(<App controller={h.controller} />)
  const mounted: Mounted = { controller: h.controller, container }
  if (drive !== undefined) drive(mounted)
  return mounted
}

// Two open rows and one ticked one. The two open rows are dated TODAY, because
// the app now opens on the Today collection (DEFAULT_COLLECTION, ADR-009) and
// membership there is the date — dateless rows would render an empty list and
// every `assistant-task-row` / `assistant-row-badge` assertion below would be
// asserting about a surface with nothing on it.
const TASKS = [
  todayTask({ id: 'task-1', title: 'Review Q3 budget draft' }),
  todayTask({ id: 'task-2', title: 'Pay electricity bill' }),
  task({ id: 'task-3', title: 'Team standup', status: 'done' }),
]

const appliedMsg: NewMsg = {
  kind: 'applied',
  turnId: 'turn-1',
  head: 'Edited 1 task · added 1',
  lines: [
    {
      taskId: 'task-1',
      title: 'Review Q3 budget draft',
      label: 'edit',
      chips: [{ field: 'due_at', old: '2:00 PM', new: '4:00 PM' }],
    },
    { taskId: 'task-2', title: 'Pick up birthday cake', label: 'new', chips: [] },
  ],
  deletedTitles: [],
  mutated: true,
  undone: false,
  at: T0,
}

const userMsg = (text: string, queued = false): NewMsg => ({
  kind: 'user',
  text,
  via: 'typed',
  at: T0,
  queued,
  clientTurnId: 'cid-1',
})

const MARKS = {
  turnId: 'turn-1',
  byTask: {
    'task-1': {
      taskId: 'task-1',
      title: 'Review Q3 budget draft',
      label: 'edit' as const,
      chips: [{ field: 'due_at', old: '2:00 PM', new: '4:00 PM' }],
    },
  },
}

const confirmQuestion: NewMsg = {
  kind: 'question',
  turnId: 'turn-2',
  qkind: 'bulk_delete',
  head: 'Delete 3 tasks?',
  body: 'Will delete: Buy groceries for the week, Order birthday cake, Pick up dry cleaning.',
  options: ['Yes', 'No'],
  taskTitles: ['Buy groceries for the week', 'Order birthday cake', 'Pick up dry cleaning'],
  resolved: false,
  at: T0,
}

/** The history the two new-message states sit on: a conversation a few turns
 * long, which is when BUG-004 becomes visible at all. */
const NMA_HISTORY: NewMsg[] = [
  userMsg('add pay the electricity bill'),
  appliedMsg,
  userMsg('move the budget review to 4pm'),
  { kind: 'outcome', head: 'Edited 1 task', body: ['Review Q3 budget draft — 4:00 PM.'], at: T0 },
]

/** The situation both new-message states depict: the user has scrolled up to
 * read history, and messages land below the fold (BUG-004 / AC-30). */
function scrolledUpThen(arriving: NewMsg[]): (m: Mounted) => void {
  return ({ controller, container }) => {
    const scroller = container.querySelector('.conv-scroll') as HTMLElement
    fakeLayout(scroller, { viewportHeight: 400, rowHeight: 200 })
    scroller.scrollTop = 0
    // Guard the setup, not just the assertion: a fake layout that leaves the
    // user AT the bottom would make every check below vacuously green, which
    // reads exactly like a check that works (L-007).
    const away = distanceFromBottom({
      contentHeight: scroller.scrollHeight,
      scrollOffset: scroller.scrollTop,
      viewportHeight: scroller.clientHeight,
    })
    if (away <= 48) throw new Error(`nma setup is not scrolled up: distance_from_bottom = ${away}`)
    act(() => {
      controller.push(arriving)
    })
  }
}

/** The mockup's 19 states, rebuilt as real app state. */
const STATES: { name: string; state: AppState; drive?: (m: Mounted) => void }[] = [
  { name: 'idle-empty', state: seed({}) },
  { name: 'idle-tasks', state: seed({ tasks: TASKS }, [userMsg('add pay the electricity bill'), appliedMsg]) },
  {
    name: 'listening',
    state: seed({ surface: 'listening', tasks: TASKS, composer: 'push the budget review to fou' }),
  },
  { name: 'thinking', state: seed({ surface: 'thinking', tasks: TASKS }, [userMsg('push the budget review')]) },
  {
    name: 'applied-diff',
    state: seed({ tasks: TASKS, marks: MARKS }, [userMsg('push the budget review to 4pm'), appliedMsg]),
  },
  {
    name: 'question-confirm',
    state: seed({ tasks: TASKS }, [
      userMsg('delete the shopping tasks'),
      {
        kind: 'question',
        turnId: 'turn-2',
        qkind: 'bulk_delete',
        head: 'Delete 3 tasks?',
        body: 'Will delete: Buy groceries for the week, Order birthday cake, Pick up dry cleaning.',
        options: ['Yes', 'No'],
        taskTitles: ['Buy groceries for the week', 'Order birthday cake', 'Pick up dry cleaning'],
        resolved: false,
        at: T0,
      },
    ]),
  },
  {
    name: 'question-clarify',
    state: seed({ tasks: TASKS }, [
      userMsg('cancel the meeting'),
      {
        kind: 'question',
        turnId: 'turn-3',
        qkind: 'clarify',
        head: '2 tasks match — which one?',
        body: null,
        options: ['Team standup — 9:30 AM', '1:1 with Ha — 4:30 PM'],
        taskTitles: ['Team standup', '1:1 with Ha'],
        resolved: false,
        at: T0,
      },
    ]),
  },
  {
    name: 'declined-superseded',
    state: seed({ tasks: TASKS }, [
      {
        kind: 'question',
        turnId: 'turn-2',
        qkind: 'bulk_delete',
        head: 'Delete 3 tasks?',
        body: 'Will delete: Buy groceries for the week, Order birthday cake, Pick up dry cleaning.',
        options: ['Yes', 'No'],
        taskTitles: ['Buy groceries for the week', 'Order birthday cake', 'Pick up dry cleaning'],
        resolved: true,
        at: T0,
      },
      userMsg('add call the bank tomorrow at 9'),
      {
        kind: 'outcome',
        head: 'Kept all 3 tasks',
        body: ['The delete was set aside because you moved on to something else. Nothing was deleted.'],
        at: T0,
      },
      appliedMsg,
    ]),
  },
  {
    name: 'reverted',
    state: seed({ tasks: TASKS }, [
      { ...appliedMsg, undone: true },
      userMsg('undo'),
      {
        kind: 'reverted',
        head: 'Undone — except one task',
        body: [
          'Undone: Pick up birthday cake.',
          'Skipped: Review Q3 budget draft — it changed after my edit, so I left it alone.',
        ],
        at: T0,
      },
    ]),
  },
  {
    name: 'nothing-reverted',
    state: seed({ tasks: TASKS }, [
      userMsg('undo'),
      {
        kind: 'reverted',
        head: 'Nothing was undone',
        body: ['They all changed after my edit: Review Q3 budget draft. I left them as they are.'],
        at: T0,
      },
      userMsg('undo'),
      {
        kind: 'outcome',
        head: null,
        body: ['There is nothing to undo — nothing has been applied in this session.'],
        at: T0,
      },
    ]),
  },
  {
    name: 'no-match',
    state: seed({ tasks: TASKS }, [
      userMsg('cross off the badminton game'),
      { kind: 'no-match', heard: 'cross off the badminton game', at: T0 },
    ]),
  },
  {
    name: 'error',
    state: seed({ surface: 'error', tasks: TASKS, composer: 'Move my gym session to Monday at 7' }, [
      userMsg('Move my gym session to Monday at 7'),
      {
        kind: 'error',
        head: "Couldn't send",
        body: [
          "The assistant couldn't handle that one. Nothing changed — your words are still in the box below.",
        ],
        retryTurnId: 'cid-1',
        at: T0,
      },
    ]),
  },
  {
    name: 'offline',
    state: seed({ tasks: TASKS, offline: true, queuedTurnId: 'cid-1' }, [
      userMsg('mark the electricity bill as done', true),
    ]),
  },
  {
    // The view did NOT move; three replies landed below the fold and nothing is
    // pending, so the one pill reports a count (NMA-NEW).
    name: 'nma-new',
    state: seed({ tasks: TASKS }, NMA_HISTORY),
    drive: scrolledUpThen([
      { kind: 'outcome', head: 'Added 1 task', body: ['Call the bank — tomorrow, 9:00 AM.'], at: T0 },
      { kind: 'outcome', head: 'Added 1 task', body: ['Order the birthday cake.'], at: T0 },
      { kind: 'outcome', head: 'Edited 1 task', body: ['Review Q3 budget draft — 4:00 PM.'], at: T0 },
    ]),
  },
  {
    // Same situation, but a bulk-delete confirmation is pending off screen and
    // the app is waiting on an answer (owner decision rule 5 — no scroll
    // carve-out): the pill stops reporting and asks (NMA-WAITING).
    name: 'nma-waiting',
    state: seed({ tasks: TASKS }, NMA_HISTORY),
    drive: scrolledUpThen([
      { kind: 'outcome', head: 'Added 1 task', body: ['Call the bank — tomorrow, 9:00 AM.'], at: T0 },
      confirmQuestion,
    ]),
  },
  {
    name: 'boundary',
    state: seed({ sessionId: null, tasks: TASKS }, [
      {
        kind: 'boundary',
        head: 'Session closed — no activity · Fri 11:42 PM',
        lines: [
          'Closing the session declined “Delete 3 tasks?” — Buy groceries for the week were all kept.',
          'While you were away: added “Call the bank”.',
        ],
        at: T0,
      },
    ]),
  },
  {
    name: 'mic-permission',
    state: seed(
      { tasks: TASKS, capability: 'permission-denied' },
      [
        {
          kind: 'info',
          head: 'Microphone needs permission',
          body: ['Your browser is blocking the microphone for this page.', 'Typing still works as usual.'],
          cta: 'permission',
          at: T0,
        },
      ],
      'permission-denied',
    ),
  },
  {
    name: 'mic-transient',
    state: seed(
      { tasks: TASKS, capability: 'transient-failure' },
      [
        {
          kind: 'info',
          head: 'Speech recognition is busy',
          body: ["The recognition service isn't answering.", 'Typing still works as usual.'],
          cta: null,
          at: T0,
        },
      ],
      'transient-failure',
    ),
  },
  {
    name: 'mic-hidden',
    state: seed({ tasks: TASKS, capability: 'none' }, [userMsg('add pay the electricity bill'), appliedMsg], 'none'),
  },
  // --- app-shell.html's states (design/assistant/screens/app-shell.html) ------
  // Three of the shell's states are SITUATIONS rather than model snapshots — a
  // menu that was opened, a row being renamed — so they are driven, exactly as
  // the two new-message states are.
  {
    name: 'shell-menu',
    state: seed({ tasks: TASKS }),
    drive: ({ container }) => {
      act(() => {
        fireEvent.click(
          container.querySelector('[data-testid="shell-lists-menu-button"]') as HTMLElement,
        )
      })
    },
  },
  {
    name: 'shell-rename',
    state: seed({ tasks: TASKS }),
    drive: ({ container }) => {
      act(() => {
        fireEvent.click(container.querySelector('.row-action') as HTMLElement)
      })
    },
  },
  {
    // SE-TASKS: the read failed with nothing on device. `Add task` stays live.
    name: 'tasks-load-failed',
    state: seed({ tasks: [], tasksLoad: 'failed' }),
  },
  {
    // SE-SESSION: the thread cannot render at all — the failure AC-24's
    // reachability bound names by hand.
    name: 'talk-session-failed',
    state: seed({ tasks: TASKS, sessionLoad: 'failed' }),
  },
]

function byName(n: string): AppState {
  const found = STATES.find((s) => s.name === n)
  if (found === undefined) throw new Error(`no such state: ${n}`)
  return found.state
}

// ---------------------------------------------------------------------------
// The testid contract
// ---------------------------------------------------------------------------

describe('testid contract (design mockup catalogue)', () => {
  it('renders all 23 mockup states', () => {
    expect(STATES).toHaveLength(23)
    for (const { name, state, drive } of STATES) {
      const { container } = mount(state, drive)
      expect(container.querySelector('.app'), name).not.toBeNull()
      cleanup()
    }
  })

  it('applies every one of the mockups’ testids across the states, and invents none', () => {
    // Both size guards are here for L-007's reason: a catalogue that silently
    // came back empty, or an exclusion list that silently excused everything,
    // both yield the same green as a working check.
    expect(catalogue().size).toBe(47)
    const expected = builtCatalogue()
    expect(expected.size).toBe(36)

    const seen = new Set<string>()
    for (const { state, drive } of STATES) {
      const { container } = mount(state, drive)
      for (const id of renderedTestids(container)) seen.add(id)
      cleanup()
    }

    const missing = [...expected].filter((id) => !seen.has(id)).sort()
    const invented = [...seen].filter((id) => !expected.has(id)).sort()
    expect(missing).toEqual([])
    expect(invented).toEqual([])
  })

  it('renders no id it declared not-built — the exclusions are real, not aspirational', () => {
    // The other direction of the same contract. Without this, `NOT_BUILT` would
    // be a list of ids the suite stopped checking in EITHER direction, and a
    // half-built personal-lists row could ship behind it unnoticed.
    const seen = new Set<string>()
    for (const { state, drive } of STATES) {
      const { container } = mount(state, drive)
      for (const id of renderedTestids(container)) seen.add(id)
      cleanup()
    }
    const shipped = Object.keys(NOT_BUILT).filter((id) => seen.has(id))
    expect(shipped).toEqual([])
  })

  it('exposes the state indicator only while listening or thinking (AC-29)', () => {
    for (const { name, state, drive } of STATES) {
      const { container } = mount(state, drive)
      const indicator = container.querySelector('[data-testid="assistant-state-indicator"]')
      const shouldShow = state.surface === 'listening' || state.surface === 'thinking'
      expect(indicator !== null, `${name} indicator`).toBe(shouldShow)
      if (state.surface === 'listening') expect(indicator?.textContent).toContain('Listening')
      if (state.surface === 'thinking') expect(indicator?.textContent).toContain('Thinking')
      // the thinking-state Cancel pill exists exactly when thinking does (AC-3)
      const cancel = container.querySelector('[data-testid="assistant-cancel-button"]')
      expect(cancel !== null, `${name} cancel`).toBe(state.surface === 'thinking')
      cleanup()
    }
  })

  it('never renders a raw uuid or a draft-ref token (AC-4)', () => {
    for (const { name, state, drive } of STATES) {
      const { container } = mount(state, drive)
      const text = container.textContent ?? ''
      expect(text, name).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)
      expect(text, name).not.toMatch(/#d\d+/)
      cleanup()
    }
  })

  it('never leaks implementation vocabulary into visible copy', () => {
    // "turn" is this system's domain word (turn.status, client_turn_id); a user
    // has no such concept. Fixture task titles are the user's own words, so the
    // check runs over the app's copy only — everything outside a task title.
    for (const { name, state, drive } of STATES) {
      const { container } = mount(state, drive)
      const text = container.textContent ?? ''
      expect(text, `${name}: leaked "turn"`).not.toMatch(/\bturns?\b/i)
      cleanup()
    }
  })

  it('keeps the composer usable in every state — it is never disabled (AC-11, AC-24, AC-25)', () => {
    for (const { name, state, drive } of STATES) {
      mount(state, drive)
      const input = screen.getByTestId('assistant-composer-input')
      expect((input as HTMLInputElement).disabled, name).toBe(false)
      cleanup()
    }
  })
})

// ---------------------------------------------------------------------------
// Per-state anatomy
// ---------------------------------------------------------------------------

describe('message anatomy', () => {
  it('applied: per-field old → new, marked rows, and one Undo (AC-4, AC-5)', () => {
    mount(byName('applied-diff'))
    const bubble = screen.getAllByTestId('assistant-message-bubble').at(-1) as HTMLElement
    expect(within(bubble).getByTestId('assistant-diff-old').textContent).toBe('2:00 PM')
    expect(within(bubble).getByTestId('assistant-diff-new').textContent).toBe('4:00 PM')
    expect(within(bubble).getByText('Review Q3 budget draft')).toBeTruthy()
    expect(screen.getAllByTestId('assistant-undo-button')).toHaveLength(1)
    // and the row carries the attribution badge
    expect(screen.getByTestId('assistant-row-badge').textContent).toBe('EDITED')
  })

  it('undone: the bubble is marked and the Undo affordance is gone (AC-6)', () => {
    mount(byName('reverted'))
    expect(screen.queryByTestId('assistant-undo-button')).toBeNull()
    expect(screen.getByText('Undone')).toBeTruthy()
  })

  it('confirm question: the affirmative chip is the only red action (AC-9)', () => {
    mount(byName('question-confirm'))
    const affirm = screen.getByTestId('assistant-chip-affirm')
    const negative = screen.getByTestId('assistant-chip-negative')
    expect(affirm.className).toContain('chip-danger')
    expect(negative.className).not.toContain('chip-danger')
    // chip text IS the literal answer text the tap will send (AC-10)
    expect(affirm.textContent).toBe('Yes')
    expect(negative.textContent).toBe('No')
  })

  it('clarify question: every real candidate is a chip (AC-13)', () => {
    mount(byName('question-clarify'))
    const chips = screen.getAllByTestId('assistant-option-chip')
    expect(chips.map((c) => c.textContent)).toEqual(['Team standup — 9:30 AM', '1:1 with Ha — 4:30 PM'])
    expect(chips.every((c) => !(c as HTMLButtonElement).disabled)).toBe(true)
  })

  it('a resolved question stays visible with its chips disabled (AC-11)', () => {
    mount(byName('declined-superseded'))
    const chips = screen.getAllByRole('button', { name: /^(Yes|No)$/ })
    expect(chips).toHaveLength(2)
    expect(chips.every((c) => (c as HTMLButtonElement).disabled)).toBe(true)
    expect(screen.getByText('Kept all 3 tasks')).toBeTruthy()
  })

  it('no-match quotes the heard transcript verbatim (AC-14)', () => {
    mount(byName('no-match'))
    expect(screen.getByText('“cross off the badminton game”')).toBeTruthy()
  })

  it('nothing-reverted never reads as a success (AC-7)', () => {
    mount(byName('nothing-reverted'))
    expect(screen.getByText('Nothing was undone')).toBeTruthy()
    expect(screen.queryByText(/^Undone$/)).toBeNull()
  })

  it('offline hands over to the list and shows the queued turn (AC-25)', () => {
    mount(byName('offline'))
    const banner = screen.getByTestId('assistant-offline-banner')
    expect(banner.textContent).toMatch(/the list still works/i)
    expect(banner.textContent).toMatch(/1 waiting to send/)
    expect(screen.getByTestId('assistant-queued-notice').textContent).toMatch(/will send again/i)
    // the list is still there, by hand
    expect(screen.getAllByTestId('assistant-task-row').length).toBeGreaterThan(0)
  })

  it('a clean start renders exactly one boundary marker (AC-28)', () => {
    mount(byName('boundary'))
    expect(screen.getAllByTestId('assistant-boundary-marker')).toHaveLength(1)
    expect(screen.queryByTestId('assistant-undo-button')).toBeNull()
  })

  it('mic modes: hidden renders no orb; permission dims and offers re-grant (AC-20, AC-21)', () => {
    mount(byName('mic-hidden'))
    expect(screen.queryByTestId('assistant-mic-button')).toBeNull()
    expect(screen.queryByText(/error|permission/i)).toBeNull()
    cleanup()

    mount(byName('mic-permission'))
    expect(screen.getByTestId('assistant-mic-button')).toBeTruthy()
    expect(screen.getByTestId('assistant-permission-cta')).toBeTruthy()
    expect(document.querySelector('.app')?.className).toContain('mic-dimmed-permission')
    cleanup()

    mount(byName('mic-transient'))
    expect(screen.queryByTestId('assistant-permission-cta')).toBeNull()
    expect(document.querySelector('.app')?.className).toContain('mic-dimmed-transient')
  })

  it('the error state offers retry and keeps the words in the composer (AC-24)', () => {
    mount(byName('error'))
    expect(screen.getByTestId('assistant-retry-button')).toBeTruthy()
    expect((screen.getByTestId('assistant-composer-input') as HTMLInputElement).value).toBe(
      'Move my gym session to Monday at 7',
    )
  })
})

// ---------------------------------------------------------------------------
// AC-19 — the four named WCAG criteria
// ---------------------------------------------------------------------------

describe('accessibility (AC-19)', () => {
  const interactive = (root: HTMLElement): HTMLElement[] =>
    [...root.querySelectorAll('button, input')] as HTMLElement[]

  it('2.1.1 — every control is a natively keyboard-operable element', () => {
    for (const { name, state, drive } of STATES) {
      const { container } = mount(state, drive)
      for (const el of interactive(container)) {
        const tag = el.tagName.toLowerCase()
        expect(['button', 'input'], `${name}: ${tag}`).toContain(tag)
        // nothing is taken out of the tab order
        expect(el.getAttribute('tabindex'), `${name}: ${tag}`).not.toBe('-1')
      }
      cleanup()
    }
  })

  it('4.1.2 — every control exposes a name, and the mic exposes its value', () => {
    for (const { name, state, drive } of STATES) {
      const { container } = mount(state, drive)
      for (const el of interactive(container)) {
        const accName = el.getAttribute('aria-label') ?? el.textContent ?? ''
        expect(accName.trim().length, `${name}: ${el.outerHTML.slice(0, 80)}`).toBeGreaterThan(0)
      }
      const mic = container.querySelector('[data-testid="assistant-mic-button"]')
      if (mic !== null) {
        expect(mic.getAttribute('aria-pressed'), name).toBe(
          state.surface === 'listening' ? 'true' : 'false',
        )
      }
      cleanup()
    }
  })

  it('2.5.3 — the accessible name contains the visible label, in order', () => {
    // SC 2.5.3 is about the visible WORDS appearing in the accessible name in
    // the same order — not about the name containing a raw concatenation of the
    // label's text nodes. The distinction became load-bearing with PathSwitch:
    // its visible label is "Tasks" beside a "3" badge, and design fixes the
    // accessible name as "Tasks, 3 left today" precisely so the badge is never
    // the whole name ("a screen reader user must not have to guess what 3
    // counts", components.md § PathSwitch). Concatenation reads that as
    // "tasks3" and rejects a control that satisfies the criterion.
    const words = (s: string): string[] => s.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []
    for (const { name, state, drive } of STATES) {
      const { container } = mount(state, drive)
      for (const el of interactive(container)) {
        const visible = words(el.textContent ?? '')
        if (visible.length === 0) continue
        const accName = words(el.getAttribute('aria-label') ?? el.textContent ?? '')
        let at = 0
        for (const w of visible) {
          const found = accName.indexOf(w, at)
          expect(
            found,
            `${name}: “${visible.join(' ')}” not in accessible name “${accName.join(' ')}”`,
          ).toBeGreaterThanOrEqual(0)
          at = found + 1
        }
      }
      cleanup()
    }
  })

  it('4.1.3 — the message list is a live region, mounted before the first message', () => {
    // A live region only announces what changes AFTER it exists, so an empty
    // conversation must already carry it — otherwise the very first outcome
    // (the one a screen-reader user most needs) is silent.
    const { container } = mount(byName('idle-empty'))
    const log = container.querySelector('[role="log"]')
    expect(log).not.toBeNull()
    expect(log?.getAttribute('aria-live')).toBe('polite')
    cleanup()

    // and it is the element the messages actually render into
    const { container: c2 } = mount(byName('applied-diff'))
    const log2 = c2.querySelector('[role="log"]') as HTMLElement
    expect(within(log2).getAllByTestId('assistant-message-bubble').length).toBeGreaterThan(0)
  })

  it('4.1.3 — every outcome message announces the text a sighted user reads', () => {
    // The outcomes the product review named as silent: applied, declined,
    // reverted, no-match, error, boundary. Each must sit inside a live region,
    // and the announced text is the visible text — no parallel copy to drift.
    const outcomeStates = [
      ['applied-diff', 'Edited 1 task · added 1'],
      ['declined-superseded', 'Kept all 3 tasks'],
      ['nothing-reverted', 'Nothing was undone'],
      ['no-match', 'cross off the badminton game'],
      ['error', "Couldn't send"],
      ['boundary', 'Session closed'],
      ['question-confirm', 'Delete 3 tasks?'],
    ] as const
    for (const [name, text] of outcomeStates) {
      const { container } = mount(byName(name))
      const live = container.querySelector('[role="log"], [role="alert"]') as HTMLElement | null
      expect(live, name).not.toBeNull()
      // the announced subtree really carries the words on screen
      const announced = [...container.querySelectorAll('[role="log"], [role="alert"]')]
        .map((el) => el.textContent ?? '')
        .join(' ')
      expect(announced, name).toContain(text)
      cleanup()
    }
  })

  it('4.1.3 — an error interrupts as an alert, and announces exactly once', () => {
    const { container } = mount(byName('error'))
    const alerts = container.querySelectorAll('[role="alert"]')
    expect(alerts).toHaveLength(1)
    expect(alerts[0]?.getAttribute('data-testid')).toBe('assistant-message-bubble')
    // the alert is nested inside the log, so the innermost live region wins and
    // the error is announced once (assertively), never twice
    expect(container.querySelector('[role="log"]')?.contains(alerts[0] as Node)).toBe(true)
    // no other state fabricates an alert
    cleanup()
    const { container: calm } = mount(byName('applied-diff'))
    expect(calm.querySelectorAll('[role="alert"]')).toHaveLength(0)
  })

  it('1.4.3 — colour is never the only carrier: diff and state carry text labels', () => {
    mount(STATES.find((s) => s.name === 'applied-diff')!.state)
    const bubble = screen.getAllByTestId('assistant-message-bubble').at(-1) as HTMLElement
    expect(within(bubble).getByText('EDITED')).toBeTruthy()
    expect(within(bubble).getByText('NEW')).toBeTruthy()
    expect(screen.getByTestId('assistant-row-badge').textContent?.trim()).not.toBe('')
  })
})

// ---------------------------------------------------------------------------
// Interactions — driven through the real controller
// ---------------------------------------------------------------------------

describe('interactions', () => {
  it('typing and pressing send goes through the assistant (AC-17)', async () => {
    const h = harness()
    h.server
      .always('GET /assistant/session', 200, { session: session(), boundary: null })
      .always('GET /tasks', 200, { tasks: [] })
      .always('POST /assistant/turn', 200, turnResponse({ turn: appliedTurn() }))
    await act(async () => {
      await h.controller.init()
    })
    render(<App controller={h.controller} />)

    const input = screen.getByTestId('assistant-composer-input')
    await act(async () => {
      fireEvent.change(input, { target: { value: 'add pay the electricity bill today' } })
    })
    await act(async () => {
      fireEvent.click(screen.getByTestId('assistant-composer-send'))
    })

    expect(h.server.turnBodies()[0]?.['transcript']).toBe('add pay the electricity bill today')
    expect(screen.getAllByTestId('assistant-message-bubble').length).toBeGreaterThan(0)
  })

  it('tapping the mic enters listening and streams the transcript (AC-2)', async () => {
    const h = harness()
    h.server
      .always('GET /assistant/session', 200, { session: session(), boundary: null })
      .always('GET /tasks', 200, { tasks: [] })
    await act(async () => {
      await h.controller.init()
    })
    render(<App controller={h.controller} />)

    await act(async () => {
      fireEvent.click(screen.getByTestId('assistant-mic-button'))
    })
    expect(screen.getByTestId('assistant-mic-button').getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByTestId('assistant-state-indicator').textContent).toContain('Listening')

    await act(async () => {
      h.speech.feed(['push the budget review'])
    })
    expect((screen.getByTestId('assistant-composer-input') as HTMLInputElement).value).toBe(
      'push the budget review',
    )
  })

  it('the thinking Cancel pill returns to idle with the words kept, no cancel call (AC-3)', async () => {
    const h = harness()
    h.server
      .always('GET /assistant/session', 200, { session: session(), boundary: null })
      .always('GET /tasks', 200, { tasks: [] })
      .always('POST /assistant/turn', 200, turnResponse({ turn: appliedTurn() }))
    await act(async () => {
      await h.controller.init()
    })

    // Hold the POST open so the thinking state — and its Cancel pill — are
    // really on screen when the click lands.
    let release: () => void = () => {}
    const gate = new Promise<void>((r) => {
      release = r
    })
    const base = h.server.fetchFn
    const controller = new AssistantController({
      api: new AssistantApi({
        userId: 'user-1',
        fetchFn: async (url, init) => {
          if (String(url) === '/assistant/turn') await gate
          return base(url, init)
        },
      }),
      speech: h.speech,
      stores: h.stores,
      uuid: () => 'cid-cancel',
      now: () => T0,
      timezone: null,
      onlineNow: () => true,
    })
    render(<App controller={controller} />)

    await act(async () => {
      fireEvent.change(screen.getByTestId('assistant-composer-input'), {
        target: { value: 'move my gym session to Monday at 7' },
      })
    })
    let inflight: Promise<void> = Promise.resolve()
    await act(async () => {
      inflight = controller.send('typed')
    })

    // thinking: the pill is present, the composer is empty (the words are sent)
    expect(screen.getByTestId('assistant-state-indicator').textContent).toContain('Thinking')
    await act(async () => {
      fireEvent.click(screen.getByTestId('assistant-cancel-button'))
    })

    // client-local: back to idle immediately, words restored, nothing cancelled
    expect(screen.queryByTestId('assistant-state-indicator')).toBeNull()
    expect((screen.getByTestId('assistant-composer-input') as HTMLInputElement).value).toBe(
      'move my gym session to Monday at 7',
    )

    release()
    await act(async () => {
      await inflight
    })
    // the sent turn still completed, and its outcome renders honestly
    expect(screen.queryByTestId('assistant-state-indicator')).toBeNull()
    expect(screen.getAllByTestId('assistant-message-bubble').length).toBeGreaterThan(0)
    expect(h.server.calls.some((c) => /cancel/i.test(c.path))).toBe(false)
  })

  it('a chip tap sends the option’s literal text (AC-10, AC-13)', async () => {
    const asked = askedTurn('clarify', ['Team standup', '1:1 with Ha'], [
      'Team standup — 9:30 AM',
      '1:1 with Ha — 4:30 PM',
    ])
    const h = harness()
    h.server
      .always('GET /assistant/session', 200, { session: session({ messages: [asked] }), boundary: null })
      .always('GET /tasks', 200, { tasks: [] })
      .always('POST /assistant/turn', 200, turnResponse({ turn: appliedTurn({ id: 'turn-9' }) }))
    await act(async () => {
      await h.controller.init()
    })
    render(<App controller={h.controller} />)

    await act(async () => {
      fireEvent.click(screen.getAllByTestId('assistant-option-chip')[0] as HTMLElement)
    })
    const body = h.server.turnBodies()[0]
    expect(body?.['transcript']).toBe('Team standup — 9:30 AM')
    expect(body?.['answer_to_turn_id']).toBe('turn-1')
  })

  it('the Undo button reverts the turn and then disappears (AC-5, AC-8)', async () => {
    const h = harness()
    h.server
      .always('GET /assistant/session', 200, {
        session: session({ messages: [appliedTurn()] }),
        boundary: null,
      })
      .always('GET /tasks', 200, { tasks: [task()] })
      .always('POST /assistant/turn/:id/undo', 200, {
        turn_id: 'turn-1',
        undone: true,
        already_undone: false,
        reverted: [{ task_id: 'task-1', title: 'Review Q3 budget draft' }],
        skipped: [],
        nothing_reverted: false,
        via: 'tap',
      })
    await act(async () => {
      await h.controller.init()
    })
    render(<App controller={h.controller} />)

    expect(screen.getAllByTestId('assistant-undo-button')).toHaveLength(1)
    await act(async () => {
      fireEvent.click(screen.getByTestId('assistant-undo-button'))
    })
    expect(screen.queryByTestId('assistant-undo-button')).toBeNull()
    const bubbles = screen.getAllByTestId('assistant-message-bubble')
    // the applied bubble stays visible, marked undone (AC-6)
    expect(bubbles[0]?.className).toContain('undone')
    expect(within(bubbles[0] as HTMLElement).getByText('Undone')).toBeTruthy()
    // and the revert itself rendered as its own outcome message
    expect(bubbles.at(-1)?.textContent).toContain('Review Q3 budget draft')
  })

  it('the manual add path creates a task without touching the assistant (AC-18)', async () => {
    const h = harness()
    h.server
      .always('GET /assistant/session', 200, { session: session(), boundary: null })
      .always('GET /tasks', 200, { tasks: [] })
      .always('POST /tasks', 201, { task: task({ id: 'task-9', title: 'Buy milk' }) })
    await act(async () => {
      await h.controller.init()
    })
    render(<App controller={h.controller} />)
    const assistantBefore = h.server.assistantCalls().length

    // With nothing on the list the header is not drawn at all — the invitation
    // is (ET-FIRST), and its CTA is the add path from an empty surface.
    await act(async () => {
      fireEvent.click(screen.getByTestId('tasks-empty-add-button'))
    })
    const field = screen.getByLabelText('New task name')
    await act(async () => {
      fireEvent.change(field, { target: { value: 'Buy milk' } })
    })
    await act(async () => {
      fireEvent.keyDown(field, { key: 'Enter' })
    })

    const post = h.server.calls.find((c) => c.method === 'POST' && c.path === '/tasks')
    expect(post).toBeDefined()
    // Add-in-context (ADR-009 §4), end to end through the UI: the surface is on
    // Today, so the create carries TODAY'S DATE and no `status: 'today'`. This
    // is what stops the default landing collection showing an empty list to a
    // user who has just added something to it.
    const body = post?.body as { due_at: string | null; status?: string }
    expect(body.status).toBeUndefined()
    // `T0`, not `new Date()`: the create path dates the row from the
    // controller's injected clock (`ControllerDeps.now`), which the harness
    // pins. In production that seam IS the device clock the view buckets by, so
    // the two agree; here the pin is what makes the assertion deterministic.
    expect(isToday(body.due_at, new Date(T0))).toBe(true)
    // and it is midnight-local, not the moment of creation (ADR-009 §4)
    const created = new Date(body.due_at as string)
    expect([created.getHours(), created.getMinutes()]).toEqual([0, 0])
    expect(h.server.assistantCalls()).toHaveLength(assistantBefore)
  })

  it('the Lists menu switches the collection the surface renders (OQ-1, answered)', async () => {
    // OQ-1's answer is that the two are PEERS, so the hamburger no longer
    // toggles a pane beside the conversation — it opens navigation to the other
    // surface's collections. Same data, now addressable (IA §3).
    const h = harness()
    // Two open rows are added to TASKS on purpose, one per collection that TASKS
    // cannot fill. After ADR-009 § Amendment the four buckets are DISJOINT, so
    // each step of this walk has to render a different set for the walk to prove
    // anything — under the old superset Inbox it would have shown Today's rows
    // again and passed whatever the menu did.
    //
    // `ahead` is the seed ADR-009 § Amendment §2 says QA owes: the live store
    // has no future-dated task in any account, so an Upcoming assertion that
    // replays real data is vacuous — green having never rendered a row.
    const dateless = task({ id: 'task-4', title: 'Someday', status: 'inbox', due_at: null })
    const ahead = upcomingTask({ id: 'task-5', title: 'Renew the passport' })
    h.server
      .always('GET /assistant/session', 200, { session: session(), boundary: null })
      .always('GET /tasks', 200, { tasks: [...TASKS, dateless, ahead] })
    await act(async () => {
      await h.controller.init()
    })
    render(<App controller={h.controller} />)

    const openMenu = async (name: string): Promise<void> => {
      await act(async () => {
        fireEvent.click(screen.getByTestId('shell-lists-menu-button'))
      })
      const row = screen
        .getAllByTestId('menu-collection-row')
        .find((r) => (r.textContent ?? '').includes(name)) as HTMLElement
      await act(async () => {
        fireEvent.click(row)
      })
    }

    // Today (DEFAULT_COLLECTION) — the two open rows that carry today's date.
    expect(screen.getAllByTestId('assistant-task-row').length).toBe(2)
    // Upcoming — the future-dated row, and only it. This row is the reason the
    // collection has to be reachable at all: under four buckets it is in no
    // other list, so a missing menu row would make it invisible with nothing
    // erroring (ADR-009 § Nothing is stranded).
    await openMenu('Upcoming')
    expect(screen.getAllByTestId('assistant-task-row').length).toBe(1)
    expect(screen.getByText('Renew the passport')).toBeTruthy()
    // Inbox — the UNDATED open rows, and nothing else. CHANGED at T-128: this
    // expected 3 and read "EVERY open task, dated or not: the superset, one row
    // larger". Inbox is a date predicate now — its absence — so the two dated
    // rows are not here.
    await openMenu('Inbox')
    expect(screen.getAllByTestId('assistant-task-row').length).toBe(1)
    expect(screen.getByText('Someday')).toBeTruthy()
    // Done — the ticked one.
    await openMenu('Done')
    expect(screen.getAllByTestId('assistant-task-row').length).toBe(1)
    // …and the four steps above between them showed every open row exactly
    // once, which is the totality F-001 AC-24's reachability bound now rests on
    // — walked through the UI rather than asserted on the predicate.
    // …and picking a collection closes the menu (IA §4: "tap the row; the menu
    // closes" — one tap, not two).
    expect(screen.queryByTestId('menu-close-button')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// AC-30 — following new messages (BUG-004, owner decision 2026-08-17)
//
// WHAT THIS TIER CAN AND CANNOT FALSIFY. jsdom performs no layout, so
// `scrollHeight` / `clientHeight` are 0 and every element reads as "at the
// bottom" — that is precisely why BUG-004 survived the unit tier ("a message
// that exists but is scrolled out of view is indistinguishable from one in
// view"). `fakeLayout` replaces the missing layout with one that GROWS as
// messages are appended, which is the single property AC-30(a) turns on: a
// post-append sample then reads the taller content and the (b) tests below go
// red. What no tier here can check is the real browser's layout — that a
// message is *visually* on screen, that the pill does not reflow the pane, and
// that the smooth scroll actually lands. Those belong to the Playwright tier.
// ---------------------------------------------------------------------------

describe('following new messages (AC-30)', () => {
  const LAYOUT = { viewportHeight: 400, rowHeight: 200 }

  const arrival = (head: string): NewMsg => ({ kind: 'outcome', head, body: [], at: T0 })

  const metrics = (el: HTMLElement) => ({
    contentHeight: el.scrollHeight,
    scrollOffset: el.scrollTop,
    viewportHeight: el.clientHeight,
  })

  async function open() {
    const h = harness()
    h.server
      .always('GET /assistant/session', 200, {
        session: session({ messages: [appliedTurn()] }),
        boundary: null,
      })
      .always('GET /tasks', 200, { tasks: TASKS })
      .always('POST /assistant/turn', 200, turnResponse({ turn: appliedTurn({ id: 'turn-9' }) }))
    await act(async () => {
      await h.controller.init()
    })
    render(<App controller={h.controller} />)
    const scroller = document.querySelector('.conv-scroll') as HTMLElement
    fakeLayout(scroller, LAYOUT)
    // Enough history that the surface can actually be scrolled up, which is when
    // BUG-004 becomes visible at all. Pushed while at the bottom, so it follows
    // and leaves no affordance behind.
    scrollToBottom(scroller)
    act(() => {
      h.controller.push([arrival('Added 1 task'), arrival('Added 1 task'), arrival('Edited 1 task')])
    })
    scrollToBottom(scroller)
    return { h, scroller }
  }

  const pill = () => screen.queryByTestId('assistant-new-message-affordance')

  it('(b) at the bottom: the newest message arrives in view, and no affordance appears', async () => {
    const { h, scroller } = await open()
    const contentBefore = scroller.scrollHeight

    act(() => {
      h.controller.push([arrival('Added 1 task')])
    })

    // The append really grew the content — without this the rest is vacuous.
    expect(scroller.scrollHeight).toBeGreaterThan(contentBefore)
    // …and the surface followed it. This is the assertion that kills a
    // post-append sample (AC-30(a)): measured AFTER the append, this user is a
    // whole row from the bottom, so a mis-ordered implementation holds still
    // and raises the pill instead.
    expect(scroller.scrollTop).toBe(scroller.scrollHeight)
    expect(distanceFromBottom(metrics(scroller))).toBeLessThanOrEqual(48)
    expect(pill()).toBeNull()
  })

  it('(b) a session load starts at the bottom, with no affordance', async () => {
    const { h, scroller } = await open()
    scroller.scrollTop = 0

    await act(async () => {
      await h.controller.syncSession()
    })

    expect(scroller.scrollTop).toBe(scroller.scrollHeight)
    expect(pill()).toBeNull()
  })

  it('(c) not at the bottom: the view does not move and no scroll is started', async () => {
    const { h, scroller } = await open()
    const animated = recordScrollTo(scroller)
    scroller.scrollTop = 0

    act(() => {
      h.controller.push([arrival('Added 1 task')])
    })

    // AC-30(c) names this form for web: on a non-inverted list, "the message at
    // the top edge is still there at the same offset" IS "scroll_offset is
    // unchanged".
    expect(scroller.scrollTop).toBe(0)
    // "No scroll animation is started at all; a shorter or gentler scroll does
    // not satisfy this."
    expect(animated).toEqual([])
    expect(pill()).not.toBeNull()
  })

  it('(d) N arrivals produce exactly ONE affordance — asserted as a count', async () => {
    const { h, scroller } = await open()
    scroller.scrollTop = 0

    act(() => {
      h.controller.push([arrival('Added 1 task')])
    })
    const first = screen.getByTestId('assistant-new-message-affordance')

    act(() => {
      h.controller.push([arrival('Added 1 task')])
    })
    act(() => {
      h.controller.push([arrival('Edited 1 task'), arrival('Added 1 task'), arrival('Added 1 task')])
    })

    expect(screen.getAllByTestId('assistant-new-message-affordance')).toHaveLength(1)
    // it persists — it does not stack, duplicate, or re-mount
    expect(screen.getByTestId('assistant-new-message-affordance')).toBe(first)
    expect(first.textContent).toContain('5 new messages')
  })

  it('(e) an unresolved question below the fold says an answer is WAITING, in words and accent', async () => {
    const { h, scroller } = await open()
    scroller.scrollTop = 0

    act(() => {
      h.controller.push([arrival('Added 1 task')])
    })
    const counting = (pill() as HTMLElement).textContent ?? ''
    expect(counting).toContain('1 new message')

    act(() => {
      h.controller.push([confirmQuestion])
    })
    const waiting = pill() as HTMLElement

    // The words change — colour is never the sole carrier (WCAG 1.4.3)…
    expect(waiting.textContent).not.toBe(counting)
    expect(waiting.textContent).toContain('Waiting for your answer')
    // …and it quotes the question's own head verbatim, so the user learns WHAT
    // is pending, not merely that something is.
    expect(waiting.textContent).toContain('Delete 3 tasks?')
    // …and the accent changes too (the `question` amber, per the catalogue).
    expect(waiting.closest('.nm-wrap')?.className).toContain('nm-waiting')
    // the accessible name carries the whole string, whatever the label clamps to
    expect(waiting.getAttribute('aria-label')).toContain('Delete 3 tasks?')
    // and it is still ONE control (AC-30(d)) — the question does not add a second
    expect(screen.getAllByTestId('assistant-new-message-affordance')).toHaveLength(1)
  })

  it('(e) tapping it only scrolls — it never answers the question', async () => {
    const { h, scroller } = await open()
    scroller.scrollTop = 0
    act(() => {
      h.controller.push([confirmQuestion])
    })
    const turnsBefore = h.server.turnBodies().length

    await act(async () => {
      fireEvent.click(pill() as HTMLElement)
    })

    // No turn was sent: the OptionChips stay the only way to answer (AC-10), so
    // the pill cannot become a second, quieter answer path.
    expect(h.server.turnBodies()).toHaveLength(turnsBefore)
    expect((screen.getByTestId('assistant-chip-affirm') as HTMLButtonElement).disabled).toBe(false)
    expect((screen.getByTestId('assistant-chip-negative') as HTMLButtonElement).disabled).toBe(false)
  })

  it('(f) activating it goes to the bottom and the affordance is gone', async () => {
    const { h, scroller } = await open()
    scroller.scrollTop = 0
    act(() => {
      h.controller.push([arrival('Added 1 task')])
    })

    await act(async () => {
      fireEvent.click(pill() as HTMLElement)
    })

    expect(distanceFromBottom(metrics(scroller))).toBeLessThanOrEqual(48)
    expect(pill()).toBeNull()
  })

  it('(f) reaching the bottom by hand dismisses it identically', async () => {
    const { h, scroller } = await open()
    scroller.scrollTop = 0
    act(() => {
      h.controller.push([arrival('Added 1 task')])
    })
    expect(pill()).not.toBeNull()

    // The dismissal condition is BEING at the bottom, not the gesture that got
    // there — so a plain scroll, with no click anywhere, has to clear it.
    await act(async () => {
      scrollToBottom(scroller)
      fireEvent.scroll(scroller)
    })

    expect(pill()).toBeNull()
  })

  it('(f) a scroll that stops short of the bottom does NOT dismiss it', async () => {
    const { h, scroller } = await open()
    scroller.scrollTop = 0
    act(() => {
      h.controller.push([arrival('Added 1 task')])
    })

    await act(async () => {
      scroller.scrollTop = scroller.scrollHeight - scroller.clientHeight - 49
      fireEvent.scroll(scroller)
    })

    expect(pill()).not.toBeNull()
  })

  it('(h) submitting a turn scrolls to the bottom, anchored to the append of the user’s message', async () => {
    const { h, scroller } = await open()
    scroller.scrollTop = 0
    act(() => {
      h.controller.push([arrival('Added 1 task')])
    })
    expect(pill()).not.toBeNull()
    const contentAtGesture = scroller.scrollHeight

    await act(async () => {
      fireEvent.change(screen.getByTestId('assistant-composer-input'), {
        target: { value: 'add call the bank tomorrow at 9' },
      })
    })
    await act(async () => {
      fireEvent.click(screen.getByTestId('assistant-composer-send'))
    })

    // The turn renders optimistically, so the user's own message is content the
    // gesture-time viewport did not have. A scroll fired at the gesture would
    // have landed on `contentAtGesture` — short by exactly that row.
    expect(scroller.scrollHeight).toBeGreaterThan(contentAtGesture)
    expect(scroller.scrollTop).toBeGreaterThan(contentAtGesture)
    expect(scroller.scrollTop).toBe(scroller.scrollHeight)
    expect(pill()).toBeNull()
  })

  it('(h) a submit that appends nothing scrolls nothing (AC-3 cancel-before-send)', async () => {
    const { h, scroller } = await open()
    scroller.scrollTop = 0
    act(() => {
      h.controller.push([arrival('Added 1 task')])
    })

    // Empty composer: the send is a no-op, so no message is appended.
    await act(async () => {
      fireEvent.click(screen.getByTestId('assistant-composer-send'))
    })

    expect(scroller.scrollTop).toBe(0)
    expect(pill()).not.toBeNull()
  })

  it('(g) reduced motion binds EVERY scroll this AC mandates — (b), (f) and (h)', async () => {
    const restore = setReducedMotion(true)
    try {
      const { h, scroller } = await open()
      const animated = recordScrollTo(scroller)

      // (b) the follow
      scrollToBottom(scroller)
      act(() => {
        h.controller.push([arrival('Added 1 task')])
      })
      expect(scroller.scrollTop, 'follow landed').toBe(scroller.scrollHeight)
      expect(animated, '(b) follow animated under reduce-motion').toEqual([])

      // (f) the activation
      scroller.scrollTop = 0
      act(() => {
        h.controller.push([arrival('Added 1 task')])
      })
      await act(async () => {
        fireEvent.click(pill() as HTMLElement)
      })
      expect(animated, '(f) activation animated under reduce-motion').toEqual([])

      // (h) the submit
      scroller.scrollTop = 0
      act(() => {
        h.controller.push([arrival('Added 1 task')])
      })
      await act(async () => {
        fireEvent.change(screen.getByTestId('assistant-composer-input'), {
          target: { value: 'add call the bank tomorrow at 9' },
        })
      })
      await act(async () => {
        fireEvent.click(screen.getByTestId('assistant-composer-send'))
      })
      expect(animated, '(h) submit animated under reduce-motion').toEqual([])
      expect(scroller.scrollTop).toBe(scroller.scrollHeight)
    } finally {
      restore()
    }
  })

  // -------------------------------------------------------------------------
  // BUG-006 — the clause-(h) scroll losing a race with the reply to that turn.
  //
  // Every other case in this block scrolls INSTANTLY: with no `scrollTo`
  // installed the routine assigns `scrollTop`, and `recordScrollTo` assigns it
  // too. So none of them has a window in which anything can arrive *during* a
  // scroll — which is precisely the window the defect lives in, and why the
  // unit tier reported AC-30 green while the browser tier found the reply to
  // your own turn sitting below the fold. `animateScrollTo` supplies the
  // window; that is the only reason these three are expressible here.
  //
  // The asymmetry worth keeping in view: reduced motion (TC-046) passes, and
  // always did, because an instant scroll has no window to be interrupted in.
  // The defect is reachable only on the animated path, so the reduce-motion
  // coverage above cannot catch a regression of it.
  // -------------------------------------------------------------------------

  const userSend = (text: string): NewMsg => ({
    kind: 'user',
    text,
    via: 'typed',
    at: T0,
    queued: false,
    clientTurnId: 'cid-tc047',
  })

  it('(h) a reply arriving MID-SCROLL is followed, not held below the fold (BUG-006)', async () => {
    const { h, scroller } = await open()
    const scroll = animateScrollTo(scroller)
    scrollToBottom(scroller)

    // (h): the user submits, their message is appended optimistically, and the
    // one scroll routine starts — animated, so it has not landed yet.
    act(() => {
      h.controller.push([userSend('plan the week')])
    })
    expect(scroll.calls, '(h) started no scroll').toHaveLength(1)
    const firstTarget = scroll.target() as number

    // Mid-flight. This is the sample clause (a) is about to be asked for, and
    // read literally it says the user is a long way from the bottom.
    scroll.advance(0.5)
    expect(
      distanceFromBottom(metrics(scroller)),
      'setup: the live offset must read NOT at the bottom, or nothing here is testable',
    ).toBeGreaterThan(48)

    // …and here is the reply to that same turn, landing in that window.
    act(() => {
      h.controller.push([arrival('Added 4 tasks')])
    })

    // Clause (a) asks whether the USER is at the bottom. They asked to be there
    // and the app is on its way; the passing offset is not their position.
    expect(pill(), 'the reply to your own turn raised a "1 new message" pill').toBeNull()
    // Clause (h)'s postcondition is an END STATE (`distance_from_bottom ≤ 48`),
    // not "a scroll was started": the append moved the bottom, so the scroll is
    // re-aimed at where the bottom is NOW rather than left carrying a target
    // computed from the content before the reply existed.
    expect(scroll.calls.length, 'the stale target was never re-aimed').toBeGreaterThan(1)
    expect(scroll.target() as number).toBeGreaterThan(firstTarget)

    scroll.settle()
    await act(async () => {
      fireEvent.scroll(scroller)
    })
    expect(distanceFromBottom(metrics(scroller))).toBeLessThanOrEqual(48)
    expect(pill()).toBeNull()
  })

  it('(c) the user taking hold mid-scroll ends the app’s claim on their intent', async () => {
    const { h, scroller } = await open()
    const scroll = animateScrollTo(scroller)
    scrollToBottom(scroller)

    act(() => {
      h.controller.push([userSend('plan the week')])
    })
    scroll.advance(0.5)

    // A flick of the wheel: Chromium cancels the smooth scroll, and the user is
    // now reading where they stopped. Everything arriving after this is (c)'s.
    await act(async () => {
      fireEvent.wheel(scroller)
    })
    const held = scroller.scrollTop
    const callsBefore = scroll.calls.length

    act(() => {
      h.controller.push([arrival('Added 4 tasks')])
    })

    expect(scroller.scrollTop, '(c) the view moved after the user took over').toBe(held)
    expect(scroll.calls.length, '(c) "no scroll animation is started at all"').toBe(callsBefore)
    expect(pill()).not.toBeNull()
  })

  it('(c) a surface moved AWAY mid-scroll keeps the position it was moved to', async () => {
    const { h, scroller } = await open()
    const scroll = animateScrollTo(scroller)
    scrollToBottom(scroller)

    act(() => {
      h.controller.push([userSend('plan the week')])
    })
    scroll.advance(0.5)

    // Something puts the reader back up the conversation while our scroll is
    // still running — here without any gesture at all, which is the case the
    // browser does NOT cancel for us. A scroll of ours only ever travels
    // toward the bottom, so an offset that moved the other way was moved by
    // someone else, and the remaining frames of our animation would drag a
    // view clause (c) says must hold still.
    scroller.scrollTop = 0
    await act(async () => {
      fireEvent.scroll(scroller)
    })

    scroll.settle()
    expect(scroller.scrollTop, 'the abandoned animation moved the view anyway').toBe(0)
  })

  // Abandoning a flight does two things — it stops the animation, and it ends
  // the in-flight allowance — and the case above only observes the first. Stop
  // the animation but leave the flag raised and everything it asserts is still
  // true, because the damage of a raised flag is not to THIS view, it is to the
  // NEXT arrival: (a) keeps answering "the user is at the bottom" for a user who
  // is demonstrably reading history. So the second half needs its own case.
  //
  // The flight here is abandoned MID-flight — the surface is nowhere near the
  // bottom at any point after it starts — so `sample`'s arrival branch can never
  // fire and the takeover is the only thing that can lower the flag.
  it('(c) a takeover ends the FLIGHT, not just the animation — the next arrival is held', async () => {
    const { h, scroller } = await open()
    const scroll = animateScrollTo(scroller)
    scrollToBottom(scroller)

    act(() => {
      h.controller.push([userSend('plan the week')])
    })
    scroll.advance(0.5)
    expect(
      distanceFromBottom(metrics(scroller)),
      'setup: the scroll has already arrived, so the arrival branch could lower the flag',
    ).toBeGreaterThan(48)

    scroller.scrollTop = 0
    await act(async () => {
      fireEvent.scroll(scroller)
    })
    // The cancel is the second call; the (h) scroll was the first.
    expect(scroll.calls, 'setup: the flight was not taken over').toHaveLength(2)

    // The user is reading history now. This arrival belongs to clause (c) —
    // and it is the first moment at which a flag left raised by the takeover
    // becomes visible, because that is what (a) reads.
    act(() => {
      h.controller.push([arrival('Added 4 tasks')])
    })

    expect(scroll.calls, 'a scroll was started for a user who is reading history').toHaveLength(2)
    expect(pill(), 'the arrival below the fold raised no affordance').not.toBeNull()
    scroll.settle()
    expect(scroller.scrollTop, '(c) the view was carried to the bottom anyway').toBe(0)
  })

  it('(c) still holds for an arrival long after the scroll has landed', async () => {
    const { h, scroller } = await open()
    const scroll = animateScrollTo(scroller)
    scrollToBottom(scroller)

    act(() => {
      h.controller.push([userSend('plan the week')])
    })
    scroll.settle()
    await act(async () => {
      fireEvent.scroll(scroller)
    })

    // The scroll is over. The in-flight allowance must be over with it — a flag
    // that is never lowered turns "follow while we are on our way" into "follow
    // always", which is (c) deleted rather than BUG-006 fixed.
    scroller.scrollTop = 0
    await act(async () => {
      fireEvent.scroll(scroller)
    })
    act(() => {
      h.controller.push([arrival('Added 1 task')])
    })

    expect(scroller.scrollTop).toBe(0)
    // One call is the (h) scroll above and nothing else: a follow started for
    // this arrival would be a second, and so would the CANCEL that the takeover
    // branch issues — which is the point. By this line the flight is already
    // over, so neither may happen. (The twin below covers the other half: that
    // it was the ARRIVAL, not this takeover, that ended it.)
    expect(scroll.calls, 'a scroll was started for an arrival the user is away from').toHaveLength(1)
    expect(pill()).not.toBeNull()
  })

  // The twin of the case above, and the reason there are two of them.
  //
  // Two branches can end a flight — the ARRIVAL in `sample`, and the TAKEOVER in
  // `onScroll` when the surface is moved backwards — and the case above reaches
  // the moment it tests by moving backwards, so the takeover is the branch that
  // actually runs there. Delete the arrival branch and everything it asserts
  // about the user's view still holds; only the raw call count moves, and it
  // moves because the cancel issues a `scrollTo` of its own, not because the
  // arrival was followed. That is a guard passing for a reason other than the
  // one it names — the same shape as the whole unit tier reporting AC-30 green
  // while BUG-006 was live.
  //
  // A branch reachable two ways needs a run that can only reach it one way. In
  // this one the surface never moves backwards while the flag is up and no
  // gesture is ever fired, so `sample`'s arrival is the ONLY thing that can
  // lower it.
  it('(c) the in-flight allowance ends when the scroll ARRIVES, with no takeover to end it', async () => {
    const { h, scroller } = await open()
    const scroll = animateScrollTo(scroller)
    scrollToBottom(scroller)

    act(() => {
      h.controller.push([userSend('plan the week')])
    })

    // Forward only: the animation carries the surface from where the user was
    // to the bottom, so the offset never falls below where it started and the
    // takeover comparison can never be true.
    const startedAt = scroller.scrollTop
    scroll.settle()
    expect(scroller.scrollTop, 'setup: the animation ran backwards').toBeGreaterThan(startedAt)
    await act(async () => {
      fireEvent.scroll(scroller)
    })
    expect(
      distanceFromBottom(metrics(scroller)),
      'setup: the scroll has not ARRIVED, so the branch under test cannot fire',
    ).toBeLessThanOrEqual(48)
    // …and the takeover demonstrably did not run: cancelling a flight issues a
    // `scrollTo` of its own, so a second call here would mean the flag had been
    // lowered by the other branch and this case would prove nothing.
    expect(scroll.calls, 'setup: something other than the arrival ended the flight').toHaveLength(1)

    // Now the user scrolls up, and the reply lands in the gap before the scroll
    // event is dispatched — a browser reports a scroll on the frame after the
    // offset changes, so this ordering is the ordinary one rather than a
    // contrived one. Nothing has had a chance to lower the flag since the
    // landing above, so if the landing did not lower it, it is still raised
    // here and this arrival is followed into the user's face.
    scroller.scrollTop = 0
    act(() => {
      h.controller.push([arrival('Added 4 tasks')])
    })

    expect(scroller.scrollTop, '(c) the view moved for an arrival the user is away from').toBe(0)
    expect(scroll.calls, 'a scroll was started while the user was reading history').toHaveLength(1)
    expect(pill(), 'the arrival below the fold raised no affordance').not.toBeNull()

    // and the scroll event catching up changes nothing
    await act(async () => {
      fireEvent.scroll(scroller)
    })
    expect(scroller.scrollTop).toBe(0)
    expect(pill()).not.toBeNull()
  })

  // The third door onto the same flag, and the last one. `scrollToNewest` reads
  // the OS setting per scroll — deliberately, so turning it on mid-session takes
  // effect on the next scroll — which means one session can start a scroll
  // ANIMATED and take the next one INSTANTLY. "An instant scroll is never in
  // flight" (`_shared/model/follow.ts`) then stops being a property of the
  // branch and becomes a handover: the instant path has to clear a flight it
  // inherited from the animated one. Nothing else in this block can catch that
  // — every other case keeps the setting fixed for its whole run.
  it('(g) an instant scroll ends the flight it inherits from an animated one', async () => {
    const { h, scroller } = await open()
    const scroll = animateScrollTo(scroller)
    scrollToBottom(scroller)

    // Animated, so this one IS in flight — and it is left in flight.
    act(() => {
      h.controller.push([userSend('plan the week')])
    })
    expect(scroll.calls, 'setup: the first scroll was not animated').toHaveLength(1)

    const restore = setReducedMotion(true)
    try {
      // The setting goes on mid-session. The reply to that turn arrives, is
      // followed because the flight above says the user asked to be at the
      // bottom, and THIS scroll is instant — it has already arrived when it
      // returns, so the flight is over.
      act(() => {
        h.controller.push([arrival('Added 4 tasks')])
      })
      expect(scroll.calls, 'setup: the second scroll animated, so nothing was inherited').toHaveLength(1)
      expect(
        distanceFromBottom(metrics(scroller)),
        'setup: the instant scroll did not arrive',
      ).toBeLessThanOrEqual(48)

      // The user reads back up, and the next arrival lands before the scroll
      // event is dispatched — so nothing but the instant scroll itself can have
      // ended the flight by now.
      scroller.scrollTop = 0
      act(() => {
        h.controller.push([arrival('Added 1 task')])
      })

      expect(scroller.scrollTop, '(c) the view moved for a user who is reading history').toBe(0)
      expect(pill(), 'the arrival below the fold raised no affordance').not.toBeNull()
    } finally {
      restore()
    }
  })

  it('(g) and it DOES animate when reduced motion is not set — the guard is a guard, not a constant', async () => {
    const restore = setReducedMotion(false)
    try {
      const { h, scroller } = await open()
      const animated = recordScrollTo(scroller)
      scrollToBottom(scroller)

      act(() => {
        h.controller.push([arrival('Added 1 task')])
      })

      expect(animated).toHaveLength(1)
      expect(animated[0]?.behavior).toBe('smooth')
    } finally {
      restore()
    }
  })
})
