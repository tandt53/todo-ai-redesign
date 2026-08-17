// @vitest-environment jsdom
//
// The app shell — AC-31, AC-32, and the two-peer frame they live in.
//
// WHAT THIS TIER CAN AND CANNOT FALSIFY. jsdom applies no CSS and performs no
// layout, and the ONE layout branch in this app is a container query. So no
// assertion here can show that Tasks holds the centre at 1280 or that
// `shell-tasks-button` is really absent there — that is the Playwright tier's
// job, and it is named in the returns. What this tier CAN hold is everything
// that must be true at every width, which is deliberately most of it: both
// surfaces mounted, one scroll-and-flash routine, the inert case rendered as
// text rather than as a dead control, and the list not being stale after a
// turn. Where a claim is only checkable as CSS TEXT, it is checked as CSS text
// and says so, rather than being asserted through a proxy that would pass
// whatever the stylesheet said (L-002).

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../App.tsx'
import { FLASH_MS } from '../shell.ts'
import { APP_VERSION } from '../version.ts'
import { initialState, reducer } from '../../_shared/model/reducer.ts'
import type { Action, AppState } from '../../_shared/model/reducer.ts'
import type { NewMsg } from '../../_shared/model/messages.ts'
import { collectionCount, inCollection } from '../../_shared/model/tasks.ts'
import { appliedTurn, harness, session, T0, task, turnResponse } from './_helpers.ts'
import type { TestController } from './_helpers.ts'

const ROOT = process.cwd()

afterEach(cleanup)

// jsdom has no `scrollIntoView`; without a stand-in the reveal routine's own
// guard returns early and every AC-31 assertion below would pass while nothing
// scrolled — the shape L-006 describes.
const scrolled: HTMLElement[] = []
beforeEach(() => {
  scrolled.length = 0
  Element.prototype.scrollIntoView = function scrollIntoViewStub(this: HTMLElement) {
    scrolled.push(this)
  }
})

function seed(base: Partial<AppState>, messages: NewMsg[] = []): AppState {
  const actions: Action[] = messages.length > 0 ? [{ type: 'append', messages }] : []
  return actions.reduce(reducer, { ...initialState('available'), sessionId: 'sess-1', ...base })
}

function mount(state: AppState): { container: HTMLElement; controller: TestController } {
  const h = harness()
  h.controller.state = state
  const { container } = render(<App controller={h.controller} />)
  return { container, controller: h.controller }
}

// `status: 'inbox'` deliberately: that is what `controller.addTask` really
// creates, so these are the rows a user actually accumulates. Leaving the
// fixture's `today` default would put every task in the Today collection and
// make the badge assertions below vacuous.
const TASKS = [
  task({ id: 'task-1', title: 'Review the Q3 budget draft', status: 'inbox' }),
  task({ id: 'task-2', title: 'Pay the electricity bill', status: 'inbox' }),
]

/** An applied message naming two tasks — one the list holds, one it does not. */
const appliedNaming = (taskIds: [string, string]): NewMsg => ({
  kind: 'applied',
  turnId: 'turn-1',
  head: 'Edited 1 task · added 1',
  lines: [
    {
      taskId: taskIds[0],
      title: 'Review the Q3 budget draft',
      label: 'edit',
      chips: [{ field: 'due_at', old: '2:00 PM', new: '4:00 PM' }],
    },
    { taskId: taskIds[1], title: 'Pay the electricity bill', label: 'new', chips: [] },
  ],
  deletedTitles: [],
  mutated: true,
  undone: false,
  at: T0,
})

function surfaceOf(container: HTMLElement): string | null {
  return container.querySelector('.app')?.getAttribute('data-surface') ?? null
}

function rowFor(container: HTMLElement, taskId: string): HTMLElement | null {
  return container.querySelector(`.task-row[data-task-id="${taskId}"]`)
}

// ---------------------------------------------------------------------------
// AC-31 — a task named in a message is a door to that task
// ---------------------------------------------------------------------------

describe('AC-31 — a message is a door to the row', () => {
  it('activating a named task brings its row into view and flashes it once', () => {
    const { container } = mount(seed({ tasks: TASKS }, [appliedNaming(['task-1', 'task-2'])]))
    expect(surfaceOf(container)).toBe('talk')

    const links = screen.getAllByTestId('talk-task-link')
    act(() => {
      fireEvent.click(links[0] as HTMLElement)
    })

    // the postcondition, in one sentence: that task's row is on screen…
    expect(surfaceOf(container)).toBe('tasks')
    const row = rowFor(container, 'task-1')
    expect(row).not.toBeNull()
    expect(scrolled).toContain(row)
    // …and has flashed.
    expect(row?.className).toContain('on-arrival')
    // exactly one row flashes — the cue names ONE task, not the turn's set
    expect(container.querySelectorAll('.task-row.on-arrival')).toHaveLength(1)
  })

  it('the flash ENDS — "flashed once" is not "tinted from now on"', () => {
    vi.useFakeTimers()
    try {
      const { container } = mount(seed({ tasks: TASKS }, [appliedNaming(['task-1', 'task-2'])]))
      act(() => {
        fireEvent.click(screen.getAllByTestId('talk-task-link')[0] as HTMLElement)
      })
      expect(container.querySelectorAll('.task-row.on-arrival')).toHaveLength(1)
      act(() => {
        vi.advanceTimersByTime(FLASH_MS + 1)
      })
      // A permanent tint would read as a selection and spend the one signal
      // add-green carries (app-shell.html, the note beside `.on-arrival`).
      expect(container.querySelectorAll('.task-row.on-arrival')).toHaveLength(0)
    } finally {
      vi.useRealTimers()
    }
  })

  it('a task the list does not hold is not activatable AT ALL — text, not a disabled control', () => {
    // `task-9` was deleted by this or a later turn: no row remains anywhere to
    // open. The message still NAMES it (AC-4 is undamaged); it is simply not a
    // door. The two assertions are different claims and both matter: no link,
    // and no disabled button either — a disabled control still announces itself
    // as a control that is temporarily off, which is a promise the list cannot
    // keep.
    const { container } = mount(seed({ tasks: TASKS }, [appliedNaming(['task-9', 'task-2'])]))
    const links = screen.getAllByTestId('talk-task-link')
    expect(links).toHaveLength(1)
    expect(links[0]?.textContent).toBe('Pay the electricity bill')
    const bubble = screen.getAllByTestId('assistant-message-bubble').at(-1) as HTMLElement
    expect(within(bubble).getByText('Review the Q3 budget draft').tagName).toBe('SPAN')
    expect(container.querySelectorAll('.conv button[disabled]')).toHaveLength(0)
  })

  it('a task filtered out of the collection on screen is not activatable either', () => {
    // Same rule, the other cause AC-31 names. `task-3` is done, so the Inbox
    // collection does not hold it — and a link that navigates to a list which
    // will not show the row is the affordance that does nothing.
    const done = task({ id: 'task-3', title: 'Morning stand-up', status: 'done' })
    const now = new Date()
    expect(inCollection(done, 'inbox', now)).toBe(false)
    const msg: NewMsg = {
      kind: 'applied',
      turnId: 'turn-1',
      head: 'Edited 1 task · added 1',
      lines: [
        { taskId: 'task-3', title: 'Morning stand-up', label: 'edit', chips: [] },
        { taskId: 'task-2', title: 'Pay the electricity bill', label: 'new', chips: [] },
      ],
      deletedTitles: [],
      mutated: true,
      undone: false,
      at: T0,
    }
    mount(seed({ tasks: [...TASKS, done] }, [msg]))
    const links = screen.getAllByTestId('talk-task-link')
    expect(links.map((l) => l.textContent)).toEqual(['Pay the electricity bill'])
  })

  it('deleted tasks named in an outcome are never links (the delete case)', () => {
    const msg: NewMsg = {
      kind: 'applied',
      turnId: 'turn-2',
      head: 'Deleted 1 task',
      lines: [],
      deletedTitles: ['Order the birthday cake'],
      mutated: true,
      undone: false,
      at: T0,
    }
    mount(seed({ tasks: TASKS }, [msg]))
    expect(screen.queryByTestId('talk-task-link')).toBeNull()
    expect(screen.getByText('Order the birthday cake')).toBeTruthy()
  })

  it('ONE routine, two entry points — the postcondition is identical from either', () => {
    // Entry 1: the Tasks surface is NOT showing (below the split, the click
    // that reveals is also the click that navigates).
    const { container } = mount(seed({ tasks: TASKS }, [appliedNaming(['task-1', 'task-2'])]))
    act(() => {
      fireEvent.click(screen.getAllByTestId('talk-task-link')[0] as HTMLElement)
    })
    const first = {
      surface: surfaceOf(container),
      flashed: rowFor(container, 'task-1')?.className.includes('on-arrival'),
      scrolls: scrolled.length,
    }
    cleanup()

    // Entry 2: the Tasks surface is ALREADY showing (which is what the wide
    // frame is, permanently). The Talk panel is mounted either way, so the same
    // link is there to click.
    scrolled.length = 0
    const { container: c2 } = mount(seed({ tasks: TASKS }, [appliedNaming(['task-1', 'task-2'])]))
    act(() => {
      fireEvent.click(screen.getByTestId('shell-tasks-button'))
    })
    expect(surfaceOf(c2)).toBe('tasks')
    act(() => {
      fireEvent.click(screen.getAllByTestId('talk-task-link')[0] as HTMLElement)
    })
    const second = {
      surface: surfaceOf(c2),
      flashed: rowFor(c2, 'task-1')?.className.includes('on-arrival'),
      scrolls: scrolled.length,
    }

    expect(second).toEqual(first)
    expect(first.flashed).toBe(true)
    expect(first.scrolls).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// AC-32 — the task list tells the truth after a turn
//
// Deliberately separate from AC-1, and weaker: AC-1's guarantee is discharged
// by the MESSAGE and verified against the message alone. These tests read the
// LIST and never the message, so neither can be mistaken for coverage of the
// other — which is the specific substitution the spec's split exists to prevent.
// ---------------------------------------------------------------------------

describe('AC-32 — the rendered list is not stale after a turn', () => {
  it('a list already on screen updates within the turn, with no refresh and no re-navigation', async () => {
    const h = harness()
    const before = [task({ id: 'task-1', title: 'Review the Q3 budget draft' })]
    const after = [...before, task({ id: 'task-2', title: 'Pay the electricity bill' })]
    h.server
      .always('GET /assistant/session', 200, { session: session(), boundary: null })
      .once('GET /tasks', 200, { tasks: before })
      .always('GET /tasks', 200, { tasks: after })
      .always(
        'POST /assistant/turn',
        200,
        turnResponse({
          turn: appliedTurn({ id: 'turn-1' }, { changed_task_ids: ['task-2'], diff: [], created_titles: ['Pay the electricity bill'] }),
        }),
      )
    await act(async () => {
      await h.controller.init()
    })
    const { container } = render(<App controller={h.controller} />)

    // Put the list on screen first — this is the "already rendered" half.
    act(() => {
      fireEvent.click(screen.getByTestId('shell-tasks-button'))
    })
    expect(container.querySelectorAll('.task-row')).toHaveLength(1)

    await act(async () => {
      await h.controller.send('typed', 'add pay the electricity bill')
    })

    // Nothing was navigated and nothing was refreshed by hand.
    expect(surfaceOf(container)).toBe('tasks')
    // Read off the LIST, never off the message — the two are never substitutes.
    const list = container.querySelector('.s-tasks') as HTMLElement
    expect(list.querySelectorAll('.task-row')).toHaveLength(2)
    expect(within(list).getByText('Pay the electricity bill')).toBeTruthy()
  })

  it('a list opened AFTER the turn opens showing the applied state', async () => {
    const h = harness()
    const before = [task({ id: 'task-1', title: 'Review the Q3 budget draft' })]
    const after = [...before, task({ id: 'task-2', title: 'Pay the electricity bill' })]
    h.server
      .always('GET /assistant/session', 200, { session: session(), boundary: null })
      .once('GET /tasks', 200, { tasks: before })
      .always('GET /tasks', 200, { tasks: after })
      .always(
        'POST /assistant/turn',
        200,
        turnResponse({
          turn: appliedTurn({ id: 'turn-1' }, { changed_task_ids: ['task-2'], diff: [], created_titles: ['Pay the electricity bill'] }),
        }),
      )
    await act(async () => {
      await h.controller.init()
    })
    const { container } = render(<App controller={h.controller} />)

    // The turn happens while the user is on Talk…
    await act(async () => {
      await h.controller.send('typed', 'add pay the electricity bill')
    })
    // …and the list they then open is current.
    act(() => {
      fireEvent.click(screen.getByTestId('shell-tasks-button'))
    })
    expect(container.querySelectorAll('.task-row')).toHaveLength(2)
  })

  it('AC-1 is read off the MESSAGE alone — the full diff survives a row the list does not hold', () => {
    // The guard that keeps the two apart from the other side. If AC-1 had
    // quietly acquired the list as its mechanism, this message would be
    // incomplete whenever the row was absent — and a wide-screen-only branch is
    // exactly the mechanism nobody runs.
    mount(seed({ tasks: [] }, [appliedNaming(['task-1', 'task-2'])]))
    const bubble = screen.getAllByTestId('assistant-message-bubble').at(-1) as HTMLElement
    expect(bubble.textContent).toContain('Edited 1 task · added 1')
    expect(bubble.textContent).toContain('Review the Q3 budget draft')
    expect(screen.getByTestId('assistant-diff-old').textContent).toBe('2:00 PM')
    expect(screen.getByTestId('assistant-diff-new').textContent).toBe('4:00 PM')
    // and there is no list rendering to have read it from
    expect(document.querySelectorAll('.task-row')).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// The frame: two peers, one branch, and a Settings surface that never
// dismisses the assistant
// ---------------------------------------------------------------------------

describe('the shell', () => {
  it('mounts every surface at every width — the branch is CSS, not behaviour', () => {
    const { container } = mount(seed({ tasks: TASKS }))
    expect(container.querySelector('.s-talk')).not.toBeNull()
    expect(container.querySelector('.s-tasks')).not.toBeNull()
    expect(container.querySelector('.s-settings')).not.toBeNull()
    // Nothing in the tree asks how wide it is. A width read in JS is how AC-1
    // would grow a second, viewport-selected mechanism.
    const src = [
      readFileSync(resolve(ROOT, 'src/assistant/web/shell.ts'), 'utf8'),
      readFileSync(resolve(ROOT, 'src/assistant/web/App.tsx'), 'utf8'),
      readFileSync(resolve(ROOT, 'src/assistant/web/components/TalkSurface.tsx'), 'utf8'),
      readFileSync(resolve(ROOT, 'src/assistant/web/components/TasksSurface.tsx'), 'utf8'),
    ]
      .join('\n')
      .split('\n')
      .filter((l) => !l.trimStart().startsWith('//') && !l.trimStart().startsWith('*'))
      .join('\n')
    expect(src).not.toMatch(/innerWidth|clientWidth|matchMedia\(\s*['"`]\(min-width/)
  })

  it('the PathSwitch moves between the two peers', () => {
    const { container } = mount(seed({ tasks: TASKS }))
    expect(surfaceOf(container)).toBe('talk')
    act(() => {
      fireEvent.click(screen.getByTestId('shell-tasks-button'))
    })
    expect(surfaceOf(container)).toBe('tasks')
    act(() => {
      fireEvent.click(screen.getByTestId('shell-talk-button'))
    })
    expect(surfaceOf(container)).toBe('talk')
  })

  it('the badge counts open tasks due today, names what it counts, and vanishes at zero', () => {
    const now = new Date()
    const dueToday = task({ id: 'task-4', title: 'Call Mum', status: 'today' })
    mount(seed({ tasks: [...TASKS, dueToday] }))
    const sw = screen.getByTestId('shell-tasks-button')
    expect(collectionCount([...TASKS, dueToday], 'today', now)).toBe(1)
    expect(sw.querySelector('.path-badge')?.textContent).toBe('1')
    // the badge is never the whole accessible name
    expect(sw.getAttribute('aria-label')).toBe('Tasks, 1 left today')
    cleanup()

    // Zero renders NO badge — "a number pretending to be news".
    mount(seed({ tasks: TASKS }))
    const zero = screen.getByTestId('shell-tasks-button')
    expect(zero.querySelector('.path-badge')).toBeNull()
    expect(zero.getAttribute('aria-label')).toBe('Tasks')
  })

  it('AC-24 — the by-hand list is one action away from EVERY conversation failure state', () => {
    // Written as the AC writes it: a bound, not a named control. The three
    // failure states the AC enumerates are checked as three structurally
    // different cases, because an AC whose subject is "every X" is exactly the
    // shape where one door goes unguarded (L-005).
    const failures: [string, AppState][] = [
      [
        'a failed turn',
        seed({ surface: 'error', tasks: TASKS }, [
          { kind: 'error', head: "Couldn't send", body: ['Try again.'], retryTurnId: 'cid-1', at: T0 },
        ]),
      ],
      ['offline', seed({ offline: true, queuedTurnId: 'cid-1', tasks: TASKS })],
      ['the session read itself', seed({ sessionLoad: 'failed', tasks: TASKS })],
    ]
    for (const [name, state] of failures) {
      const { container } = mount(state)
      const sw = screen.getByTestId('shell-tasks-button')
      expect(sw.hasAttribute('disabled'), name).toBe(false)
      expect(sw.getAttribute('aria-disabled'), name).toBeNull()
      // one action, and it really lands on the list
      act(() => {
        fireEvent.click(sw)
      })
      expect(surfaceOf(container), name).toBe('tasks')
      expect(container.querySelectorAll('.task-row').length, name).toBeGreaterThan(0)
      cleanup()
    }
  })

  it('the session-read failure takes the surface, keeps Retry, and is not an error bubble', () => {
    const { container } = mount(seed({ sessionLoad: 'failed', tasks: TASKS }))
    expect(screen.getByText("Couldn't load your conversation")).toBeTruthy()
    expect(screen.getByText('Your tasks are unaffected. Try again, or carry on by hand.')).toBeTruthy()
    expect(screen.getByTestId('talk-session-retry-button')).toBeTruthy()
    // there is no thread, so there is nowhere to put a bubble
    expect(container.querySelectorAll('.s-talk [data-testid="assistant-message-bubble"]')).toHaveLength(0)
  })

  it('a loading conversation never renders its empty state', () => {
    // A returning user who reads "Say it. I'll write it down." while their
    // history loads reads it as history lost.
    const { container } = mount(seed({ sessionLoad: 'loading' }))
    expect(container.querySelector('.sk-thread')).not.toBeNull()
    expect(container.querySelector('.s-talk .invite')).toBeNull()
    expect(screen.queryByText(/I'll write it down/)).toBeNull()
  })

  it('the Tasks surface is never replaced by an error while anything is known', () => {
    // InlineRetryBanner, not SE-TASKS: every locally-known task still rendered
    // and still editable. A fallback that blanks itself on a network error has
    // failed at the one job it has.
    const { container } = mount(seed({ tasks: TASKS, tasksLoad: 'failed' }))
    expect(screen.getByText(/Couldn't refresh your tasks/)).toBeTruthy()
    expect(container.querySelectorAll('.task-row')).toHaveLength(2)
    expect(screen.queryByText("Couldn't load your tasks")).toBeNull()
    cleanup()

    // …and only when there is genuinely nothing to show does it take the
    // surface — with `Add task` still live, because the local no-AI path works.
    mount(seed({ tasks: [], tasksLoad: 'failed' }))
    expect(screen.getByText("Couldn't load your tasks")).toBeTruthy()
    const add = screen.getByRole('button', { name: /Add task/ })
    expect(add.hasAttribute('disabled')).toBe(false)
  })

  it('Settings never dismisses the assistant, and Back means up one level', () => {
    const { container } = mount(seed({ tasks: TASKS }))
    act(() => {
      fireEvent.click(screen.getByTestId('shell-lists-menu-button'))
    })
    act(() => {
      fireEvent.click(screen.getByTestId('menu-settings-row'))
    })
    expect(surfaceOf(container)).toBe('settings')
    // The panel is still mounted; at or above the split it is still on screen,
    // which is the difference between a panel and a screen. The hiding is CSS —
    // asserted as CSS below, because jsdom applies none.
    expect(container.querySelector('.s-talk')).not.toBeNull()

    act(() => {
      fireEvent.click(screen.getByTestId('settings-back-button'))
    })
    // up one level: S4 is stacked on S3, so back returns to the menu
    expect(surfaceOf(container)).toBe('tasks')
    expect(screen.getByTestId('menu-close-button')).toBeTruthy()
  })

  it('the Lists menu closes on Escape and on its close control', () => {
    mount(seed({ tasks: TASKS }))
    act(() => {
      fireEvent.click(screen.getByTestId('shell-lists-menu-button'))
    })
    act(() => {
      fireEvent.click(screen.getByTestId('menu-close-button'))
    })
    expect(screen.queryByTestId('menu-close-button')).toBeNull()

    act(() => {
      fireEvent.click(screen.getByTestId('shell-lists-menu-button'))
    })
    act(() => {
      fireEvent.keyDown(globalThis.document, { key: 'Escape' })
    })
    expect(screen.queryByTestId('menu-close-button')).toBeNull()
  })

  it('the menu holds only rows this data model can fill', () => {
    // Six drawn surfaces depend on `lists` + `tasks.list_id` and neither
    // exists (IA §7). The rows below Done, `New list`, and the whole
    // ListEditorSheet are therefore absent rather than inert.
    mount(seed({ tasks: TASKS }))
    act(() => {
      fireEvent.click(screen.getByTestId('shell-lists-menu-button'))
    })
    expect(screen.getAllByTestId('menu-collection-row').map((r) => r.textContent?.trim())).toEqual([
      'Today',
      'Inbox 2',
      'Done',
    ])
    expect(screen.queryByTestId('menu-list-row')).toBeNull()
    expect(screen.queryByTestId('menu-new-list-button')).toBeNull()
    expect(screen.queryByTestId('list-editor-name-input')).toBeNull()
    // navigation must never be the thing that breaks
    expect(screen.getByTestId('menu-settings-row')).toBeTruthy()
  })

  it('Settings carries only rows whose dependencies exist', () => {
    mount(seed({ tasks: TASKS }))
    expect(screen.getByTestId('settings-theme-control')).toBeTruthy()
    expect(screen.getByText(`todo-ai · ${APP_VERSION}`)).toBeTruthy()
    // Talk back ships with F-002, not before: a switch that toggles nothing is
    // worse than an absent one. No language picker either — IA §8.2 makes that
    // a separate owner decision, and drawing one is the silent ride the
    // settings-and-lists decision refused.
    expect(screen.queryByTestId('settings-talkback-switch')).toBeNull()
    expect(screen.queryByText(/language/i)).toBeNull()
  })

  it('the theme control switches the document theme and remembers the choice', () => {
    const { container } = mount(seed({ tasks: TASKS }))
    const seg = screen.getByTestId('settings-theme-control')
    const light = [...seg.querySelectorAll('button')].find((b) => b.textContent === 'Light')
    act(() => {
      fireEvent.click(light as HTMLElement)
    })
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    expect(light?.getAttribute('aria-pressed')).toBe('true')
    cleanup()

    // a fresh mount reads the stored choice back
    mount(seed({ tasks: TASKS }))
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    const again = screen.getByTestId('settings-theme-control')
    const dark = [...again.querySelectorAll('button')].find((b) => b.textContent === 'Dark')
    act(() => {
      fireEvent.click(dark as HTMLElement)
    })
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(container).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// Agreement with the artifacts that own these numbers.
//
// Each one PARSES its upstream artifact rather than retyping it, so the
// assertion fails when the artifact moves — the direction drift travels, and
// the direction a hand-copied expectation is blind to (L-008).
// ---------------------------------------------------------------------------

describe('numbers this code does not own', () => {
  it('the arrival flash lasts exactly diffFlashHold + diffFlashFade', () => {
    const tokens = JSON.parse(
      readFileSync(resolve(ROOT, 'design/_shared/tokens.json'), 'utf8'),
    ) as { motion: { duration_ms: Record<string, number> } }
    const hold = tokens.motion.duration_ms['diffFlashHold']
    const fade = tokens.motion.duration_ms['diffFlashFade']
    expect(hold, 'tokens.json declares no diffFlashHold').toBeTypeOf('number')
    expect(fade, 'tokens.json declares no diffFlashFade').toBeTypeOf('number')
    expect(FLASH_MS).toBe((hold as number) + (fade as number))
  })

  it('the one layout branch is at tokens.json breakpoints.split', () => {
    const tokens = JSON.parse(
      readFileSync(resolve(ROOT, 'design/_shared/tokens.json'), 'utf8'),
    ) as { breakpoints: Record<string, unknown> }
    const split = tokens.breakpoints['split']
    expect(split, 'tokens.json declares no breakpoints.split').toBeTypeOf('number')
    const css = readFileSync(resolve(ROOT, 'src/assistant/web/styles.css'), 'utf8')
    // The container query really exists, at that width, on that container…
    expect(css).toContain('container-type: inline-size')
    expect(css).toContain('container-name: app')
    expect(css).toMatch(new RegExp(`@container app \\(min-width:\\s*${String(split)}px\\)`))
    // …and there is exactly ONE of it. A second branch is the thing
    // components.md § AppFrame says does not exist.
    expect(css.match(/@container/g) ?? []).toHaveLength(1)
    // The two rules jsdom cannot exercise, asserted as the text they are.
    expect(css).toMatch(/\.app\[data-surface="settings"\]\s*\.s-tasks\s*\{\s*display:\s*none/)
    expect(css).toMatch(/\.path\s*\{\s*display:\s*none/)
  })

  it('the About row publishes the version package.json declares', () => {
    const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8')) as {
      version?: string
    }
    expect(pkg.version, 'package.json declares no version').toBeTypeOf('string')
    expect(APP_VERSION).toBe(pkg.version)
  })
})
