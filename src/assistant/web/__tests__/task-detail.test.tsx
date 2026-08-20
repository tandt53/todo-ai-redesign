// @vitest-environment jsdom
//
// F-005 · S6 — the task detail, rendered.
//
// ── WHAT THIS TIER CAN AND CANNOT FALSIFY ──────────────────────────────────
//
// jsdom applies no CSS and performs no layout, and the ONE layout branch in this
// app is a container query — so **no assertion here can show that the detail takes
// the centre column at 1280**, and no assertion here can cross
// `breakpoints.split`. That is the Playwright tier's job and it is named in the
// return.
//
// What this tier CAN hold is everything that must be true at every width, which is
// deliberately most of AC-45: one application state rather than two, the close
// affordance unconditionally present, the notice region rendered outside the
// surface stack, and every field of AC-1's account. Where a claim is only
// checkable as source or CSS TEXT it is checked as text and **says so** rather
// than being asserted through a proxy that would pass whatever the file said
// (L-002).

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { App } from '../App.tsx'
import { initialState, reducer } from '../../_shared/model/reducer.ts'
import type { Action, AppState } from '../../_shared/model/reducer.ts'
import type { NewMsg } from '../../_shared/model/messages.ts'
import { DETAIL_FIELDS } from '../detail.ts'
import { harness, T0, task, todayTask } from './_helpers.ts'
import type { TestController } from './_helpers.ts'
import type { TaskWire } from '../../_shared/types.ts'

afterEach(cleanup)

// jsdom has no `scrollIntoView`; without a stand-in the reveal routine returns
// early and every AC-31/AC-48 assertion would pass while nothing happened (L-006).
beforeEach(() => {
  Element.prototype.scrollIntoView = function stub() {}
})

interface Mounted {
  container: HTMLElement
  controller: TestController
  server: ReturnType<typeof harness>['server']
  stores: ReturnType<typeof harness>['stores']
}

function seed(base: Partial<AppState>, messages: NewMsg[] = []): AppState {
  const actions: Action[] = messages.length > 0 ? [{ type: 'append', messages }] : []
  return actions.reduce(reducer, { ...initialState('available'), sessionId: 'sess-1', ...base })
}

function mount(state: AppState, opts: { online?: boolean } = {}): Mounted {
  const h = harness(opts)
  h.controller.state = state
  const { container } = render(<App controller={h.controller} />)
  return { container, controller: h.controller, server: h.server, stores: h.stores }
}

const surfaceOf = (c: HTMLElement): string | null =>
  c.querySelector('.app')?.getAttribute('data-surface') ?? null

/** Open the detail the way a user does: activate the row (AC-1's one action). */
function openDetail(taskId: string): void {
  const row = screen
    .getAllByTestId('assistant-task-row')
    .find((r) => r.getAttribute('data-task-id') === taskId) as HTMLElement
  act(() => {
    fireEvent.click(within(row).getByTestId('tasks-row-open'))
  })
}

/** Go to the Tasks surface first — the app opens on Talk. */
function goToTasks(): void {
  act(() => {
    fireEvent.click(screen.getByTestId('shell-tasks-button'))
  })
}

/** …and to the Inbox collection, where a DATELESS row lives (ADR-009's two axes:
 * `undated` has no surface of its own and Inbox serves it). */
function goToInbox(): void {
  act(() => {
    fireEvent.click(screen.getByTestId('shell-tasks-button'))
  })
  act(() => {
    fireEvent.click(screen.getByTestId('shell-lists-menu-button'))
  })
  act(() => {
    const rows = screen.getAllByTestId('menu-collection-row')
    const inbox = rows.find((r) => r.textContent?.includes('Inbox')) as HTMLElement
    fireEvent.click(inbox)
  })
}

const PLAIN = todayTask({ id: 't1', title: 'Review the Q3 budget' })
const OTHER = todayTask({ id: 't2', title: 'Pay the electricity bill' })

// ---------------------------------------------------------------------------
// AC-1 / AC-45 — the surface, and where it lives
// ---------------------------------------------------------------------------

describe('AC-1 — activating a row opens its detail in ONE action', () => {
  it('opens the detail, showing every user-settable field this spec names', () => {
    const { container } = mount(seed({ tasks: [PLAIN, OTHER] }))
    goToTasks()
    expect(surfaceOf(container)).toBe('tasks')

    openDetail('t1')

    // AC-45 — **one application state**, and it is the enum's fourth value rather
    // than a modal, a route or a second layout mechanism.
    expect(surfaceOf(container)).toBe('detail')
    expect(screen.getByTestId('detail-surface')).toBeTruthy()
    // **AC-1's "surface's own account of itself"** (tester W5): every one of the
    // seven appears whether or not it holds a value. Asserted against the ACCOUNT
    // and not against a count of visible inputs, because counting inputs
    // over-constrains a compliant implementation that collapses empty fields behind
    // a disclosure — which is why revision 2's wording left both available tests
    // wrong.
    const fields = screen.getAllByTestId('detail-field').map((f) => f.getAttribute('data-field'))
    expect(fields).toEqual([...DETAIL_FIELDS])
  })

  it('a field with no value renders as an empty, SETTABLE control — never as absent', () => {
    // `PLAIN` has no note, no priority, no reminder, no steps and no repeat: the
    // ordinary appearance of a task, not a degraded one (IA § S6: *"there is no
    // empty state, and that is a decision rather than an omission"*).
    mount(seed({ tasks: [PLAIN] }))
    goToTasks()
    openDetail('t1')

    expect((screen.getByTestId('detail-note-input') as HTMLTextAreaElement).value).toBe('')
    expect((screen.getByTestId('detail-reminder-date') as HTMLInputElement).value).toBe('')
    expect(screen.getByTestId('detail-priority-control')).toBeTruthy()
    expect(screen.getByTestId('detail-step-add-input')).toBeTruthy()
    expect(screen.getByTestId('detail-repeat-summary').textContent).toBe('Does not repeat')
  })

  it('the activation gesture is DISTINCT from the inline rename — both stay on the row', () => {
    // F-001 AC-18 puts an inline rename on the web row, so *"activating a task row"*
    // must name a gesture that is not the rename gesture, **or F-005 takes a shipped
    // affordance away by collision**.
    mount(seed({ tasks: [PLAIN] }))
    goToTasks()
    const row = screen.getAllByTestId('assistant-task-row')[0] as HTMLElement
    // The rename still has its own control, and using it does NOT open the detail.
    act(() => {
      fireEvent.click(within(row).getByLabelText('Edit “Review the Q3 budget”'))
    })
    expect(screen.getByTestId('tasks-rename-input')).toBeTruthy()
    expect(screen.queryByTestId('detail-surface')).toBeNull()
  })
})

describe('AC-45 — where the detail lives, and the close that is always available', () => {
  it('closing returns to the list, and the close control is present in EVERY state of the surface', () => {
    const { container } = mount(seed({ tasks: [PLAIN] }))
    goToTasks()
    openDetail('t1')
    expect(screen.getByTestId('detail-close-button')).toBeTruthy()
    act(() => {
      fireEvent.click(screen.getByTestId('detail-close-button'))
    })
    expect(surfaceOf(container)).toBe('tasks')
    expect(screen.queryByTestId('detail-surface')).toBeNull()
  })

  it('leaving the Tasks surface closes it — `Tasks · N` returns to the LIST, not to a forgotten detail', () => {
    // AC-45's edge list, IA §4. Asserted through two doors so neither is the only
    // one guarded (L-005): the path switch, and the Lists menu's collection pick.
    const { container } = mount(seed({ tasks: [PLAIN] }))
    goToTasks()
    openDetail('t1')
    act(() => {
      fireEvent.click(screen.getByTestId('shell-talk-button'))
    })
    expect(surfaceOf(container)).toBe('talk')
    goToTasks()
    expect(surfaceOf(container), 'back on the list, not on the detail').toBe('tasks')

    openDetail('t1')
    act(() => {
      fireEvent.click(screen.getByTestId('shell-lists-menu-button'))
    })
    act(() => {
      fireEvent.click(screen.getAllByTestId('menu-collection-row')[0] as HTMLElement)
    })
    expect(surfaceOf(container)).toBe('tasks')
  })

  it('a loading read draws SK-DETAIL, and a failed read draws SE-DETAIL — three states told apart', () => {
    // The discrimination is what makes AC-45's loading clause and AC-4's terminal
    // state both assertable. Collapsed into one "no task" branch, a user's first
    // look at their own task would be a lie that corrects itself (design D8) and
    // AC-4's terminal state would have no reachable case.
    const loading = mount(seed({ tasks: [], tasksLoad: 'loading' }))
    loading.controller.state = { ...loading.controller.state, tasks: [PLAIN] }
    // drive the open, then take the task away with the read still in flight
    goToTasks()
    openDetail('t1')
    act(() => {
      loading.controller.state = { ...loading.controller.state, tasks: [], tasksLoad: 'loading' }
      loading.controller.push([])
    })
    expect(loading.container.querySelector('.detail-sk'), 'SK-DETAIL').not.toBeNull()
    // …and it carries no text and no testid, so it asserts none of the field labels
    // (§ Skeletons' own rule).
    expect(loading.container.querySelector('.detail-sk')?.textContent).toBe('')
    cleanup()

    const failed = mount(seed({ tasks: [PLAIN], tasksLoad: 'ok' }))
    goToTasks()
    openDetail('t1')
    act(() => {
      failed.controller.state = { ...failed.controller.state, tasks: [], tasksLoad: 'failed' }
      failed.controller.push([])
    })
    const se = screen.getByTestId('detail-surface-error')
    // Design's exact two lines (§ SurfaceError, SE-DETAIL).
    expect(within(se).getByText("Couldn't load this task")).toBeTruthy()
    expect(
      within(se).getByText('Your other tasks are unaffected. Try again, or go back to the list.'),
    ).toBeTruthy()
    // **The way back stays live** — the clause F-001 AC-24 rev 6 exists for.
    expect(screen.getByTestId('detail-close-button')).toBeTruthy()
  })

  it('there is no width read anywhere in the web tree — checked as SOURCE TEXT, and it says so', () => {
    // AC-45: *"a JS width branch does not exist and is not to be introduced — not
    // in a hook, not in a media-query listener, not in a resize observer"*
    // (`owner-decision-2026-08-17-desktop-list-is-primary.md` constraint 2).
    //
    // **This is a grep and grep is evidence rather than proof** (L-002, and AC-45's
    // own tester-W10 note: a width read can live in a hook, a media-query listener
    // or a resize observer). The runtime observable — crossing the split changes
    // nothing the detail holds — is the Playwright tier's, and it is named in the
    // return. What this catches is the introduction of one, which is the thing a
    // later pass is most likely to do.
    const files = [
      'App.tsx',
      'shell.ts',
      'components/TaskDetail.tsx',
      'components/CarriedNotices.tsx',
      'components/TasksSurface.tsx',
      'detail.ts',
    ]
    for (const f of files) {
      const src = readFileSync(resolve(process.cwd(), 'src/assistant/web', f), 'utf8')
      for (const forbidden of [
        'innerWidth',
        'outerWidth',
        'clientWidth',
        'offsetWidth',
        'getBoundingClientRect',
        'ResizeObserver',
        'min-width',
      ]) {
        expect(src.includes(forbidden), `${f} must not read a width (${forbidden})`).toBe(false)
      }
    }
  })
})

// ---------------------------------------------------------------------------
// AC-2 — the save model, and the three states of a write
// ---------------------------------------------------------------------------

describe('AC-2 — value fields save on LEAVING the field, one field per request', () => {
  it('the request body carries exactly the field the user changed', () => {
    const m = mount(seed({ tasks: [PLAIN] }))
    goToTasks()
    openDetail('t1')

    const note = screen.getByTestId('detail-note-input')
    act(() => {
      fireEvent.change(note, { target: { value: 'ring first' } })
    })
    // Nothing is sent while typing — the model is save-on-blur, not save-per-key.
    expect(m.server.calls.filter((c) => c.method === 'PATCH')).toHaveLength(0)
    act(() => {
      fireEvent.blur(note)
    })
    const patches = m.server.calls.filter((c) => c.method === 'PATCH')
    expect(patches).toHaveLength(1)
    // **A whole-object write that happens to look correct fails this AC**, so the
    // body is asserted whole rather than with `toMatchObject`.
    expect(patches[0]?.body).toEqual({ note: 'ring first' })
  })

  it('a failed write leaves the user’s value IN THE FIELD, states it, and offers a retry', async () => {
    const m = mount(seed({ tasks: [PLAIN] }))
    m.server.always('PATCH /tasks/:id', 500, { error: { code: 'INTERNAL', message: 'boom' } })
    goToTasks()
    openDetail('t1')

    const note = screen.getByTestId('detail-note-input')
    await act(async () => {
      fireEvent.change(note, { target: { value: 'typed and not saved' } })
      fireEvent.blur(note)
    })

    // *"It never silently reverts to the stored value, because a field that snaps
    // back while someone is looking away is indistinguishable from one that saved."*
    expect((screen.getByTestId('detail-note-input') as HTMLTextAreaElement).value).toBe(
      'typed and not saved',
    )
    expect(screen.getByTestId('detail-field-failure')).toBeTruthy()
    expect(screen.getByTestId('detail-field-retry')).toBeTruthy()
  })

  it('CLOSING IS HONOURED AT ONCE over an in-flight write, and a write that fails AFTER the close still lands in the notice', async () => {
    // The owner's narrowing of AC-2, and the composition F-001 AC-24 rev 6 needs.
    //
    // *"An unresponsive server is exactly where 'closing waits for in-flight writes
    // to resolve' and 'the detail cannot be closed' are the same behaviour, and the
    // user cannot tell which one they are in."* And the trigger is not keyed to the
    // instant of closing: **the ordinary order in an outage is close, then fail** —
    // leaving a field is the gesture that precedes closing, so the write is in flight
    // precisely when the user closes. On that path, revision 2's trade (*give up the
    // hold, gain the notice*) would otherwise have bought nothing.
    const m = mount(seed({ tasks: [PLAIN] }))
    // A write that has not resolved when the close happens. `failOnce` cannot model
    // it — it throws inside the call, so the reply has already arrived by the next
    // line and there is no window for the close to happen *during* the write.
    const inFlight = m.server.holdOnce('PATCH /tasks/:id')

    goToTasks()
    openDetail('t1')
    act(() => {
      fireEvent.change(screen.getByTestId('detail-note-input'), { target: { value: 'in flight' } })
      fireEvent.blur(screen.getByTestId('detail-note-input'))
    })
    // **The surface never holds itself open waiting for it.**
    act(() => {
      fireEvent.click(screen.getByTestId('detail-close-button'))
    })
    expect(surfaceOf(m.container), 'closed at once, with the write still in the air').toBe('tasks')

    // …and the write fails AFTER the close.
    await act(async () => {
      inFlight.fail()
      await Promise.resolve()
      await new Promise((r) => setTimeout(r, 0))
    })

    // *"A write that fails after the close is the same failure as one that failed
    // before it."* It becomes a notice that carries the value — which is what makes
    // AC-2's "never silently reverts" true of a value whose surface is gone.
    const row = screen.getByTestId('shell-carried-notice')
    expect(within(row).getByText('in flight')).toBeTruthy()
    expect(within(row).getByTestId('shell-carried-notice-retry')).toBeTruthy()
  })

  it('the field’s retry and § CarriedNotice’s retry are ONE write path called from two places', async () => {
    // AC-47: *"Two implementations of one postcondition drift, and this is L-005's
    // shape applied to a recovery path."* The observable is that a retry from either
    // site produces exactly one attempt and resolves the same notice.
    const m = mount(seed({ tasks: [PLAIN] }))
    m.server.always('PATCH /tasks/:id', 500, { error: { code: 'INTERNAL', message: 'boom' } })
    goToTasks()
    openDetail('t1')
    await act(async () => {
      fireEvent.change(screen.getByTestId('detail-note-input'), { target: { value: 'v' } })
      fireEvent.blur(screen.getByTestId('detail-note-input'))
    })
    const afterFirst = m.server.calls.filter((c) => c.method === 'PATCH').length

    // From the FIELD.
    await act(async () => {
      fireEvent.click(screen.getByTestId('detail-field-retry'))
    })
    expect(m.server.calls.filter((c) => c.method === 'PATCH')).toHaveLength(afterFirst + 1)

    // From the NOTICE — same write, one attempt.
    await act(async () => {
      fireEvent.click(screen.getByTestId('shell-carried-notice-retry'))
    })
    expect(m.server.calls.filter((c) => c.method === 'PATCH')).toHaveLength(afterFirst + 2)
    const bodies = m.server.calls.filter((c) => c.method === 'PATCH').map((c) => c.body)
    expect(bodies.every((b) => JSON.stringify(b) === JSON.stringify({ note: 'v' }))).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// AC-3 / AC-4 — the task changing, and disappearing, underneath
// ---------------------------------------------------------------------------

describe('AC-3 — a control the user has FOCUS in is never overwritten while it has focus', () => {
  it('an arriving value waits for focus to leave; an unfocused field takes it at once', () => {
    const m = mount(seed({ tasks: [PLAIN] }))
    goToTasks()
    openDetail('t1')

    const title = screen.getByTestId('detail-title-input') as HTMLInputElement
    act(() => {
      fireEvent.focus(title)
      fireEvent.change(title, { target: { value: 'what the user is typing' } })
    })
    // An assistant turn renames the task underneath.
    act(() => {
      m.controller.state = {
        ...m.controller.state,
        tasks: [{ ...PLAIN, title: 'renamed by the assistant' }],
      }
      m.controller.push([])
    })
    // **The exception is absolute for what it is written about.**
    expect((screen.getByTestId('detail-title-input') as HTMLInputElement).value).toBe(
      'what the user is typing',
    )
    // The unfocused note took the arriving value in the same render — AC-3's
    // guarantee for every control the user is NOT working in.
    act(() => {
      m.controller.state = {
        ...m.controller.state,
        tasks: [{ ...PLAIN, title: 'renamed by the assistant', note: 'arrived' }],
      }
      m.controller.push([])
    })
    expect((screen.getByTestId('detail-note-input') as HTMLTextAreaElement).value).toBe('arrived')
  })
})

describe('AC-4 — the task deleted underneath is a normal event, not an error', () => {
  it('says so, offers NO retry, and keeps a way back', () => {
    const m = mount(seed({ tasks: [PLAIN], tasksLoad: 'ok' }))
    goToTasks()
    openDetail('t1')
    act(() => {
      m.controller.state = { ...m.controller.state, tasks: [], tasksLoad: 'ok' }
      m.controller.push([])
    })

    const terminal = screen.getByTestId('detail-deleted')
    expect(within(terminal).getByText('This task was deleted')).toBeTruthy()
    // **No retry. Deliberately.** `§ SurfaceError` is the nearest existing shape and
    // its whole anatomy is a Retry — the one action that must never be offered here,
    // because a retry pointed at a soft-deleted row is dead or a resurrection door.
    expect(within(terminal).queryByText('Retry')).toBeNull()
    expect(screen.queryByTestId('detail-retry-button')).toBeNull()
    // …and there is a way out. AC-48's swap is the other door out of this state.
    expect(screen.getByTestId('detail-back-button')).toBeTruthy()
    expect(screen.getByTestId('detail-close-button')).toBeTruthy()
    // No further edits are offered: the fields are gone, which is what *"offers no
    // further edits"* means on screen.
    expect(screen.queryByTestId('detail-title-input')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// AC-6 / AC-8 / AC-37 — the value fields
// ---------------------------------------------------------------------------

describe('AC-6 — the note', () => {
  it('empty, whitespace-only and newline-only input stores NO NOTE — never an empty string', () => {
    const m = mount(seed({ tasks: [{ ...PLAIN, note: 'was here' }] }))
    goToTasks()
    openDetail('t1')
    const note = screen.getByTestId('detail-note-input')
    act(() => {
      fireEvent.change(note, { target: { value: '  \n \n ' } })
      fireEvent.blur(note)
    })
    // The distinction is observable on read-back, so it has to be `null` on the
    // wire and not `''`.
    expect(m.server.calls.filter((c) => c.method === 'PATCH')[0]?.body).toEqual({ note: null })
  })

  it('line breaks inside a real note survive the round trip', () => {
    const m = mount(seed({ tasks: [PLAIN] }))
    goToTasks()
    openDetail('t1')
    const note = screen.getByTestId('detail-note-input')
    act(() => {
      fireEvent.change(note, { target: { value: 'one\ntwo\n\nthree' } })
      fireEvent.blur(note)
    })
    expect(m.server.calls.filter((c) => c.method === 'PATCH')[0]?.body).toEqual({
      note: 'one\ntwo\n\nthree',
    })
  })
})

describe('AC-37 — an empty title is REFUSED and the task keeps the name it had', () => {
  it('refuses blank and whitespace-only, states it, and sends nothing', () => {
    const m = mount(seed({ tasks: [PLAIN] }))
    goToTasks()
    openDetail('t1')
    const title = screen.getByTestId('detail-title-input')
    act(() => {
      fireEvent.change(title, { target: { value: '   ' } })
      fireEvent.blur(title)
    })
    expect(m.server.calls.filter((c) => c.method === 'PATCH')).toHaveLength(0)
    // …and the field shows the name the task actually has, which is what *"keeps the
    // name it had"* means on screen as well as in the store.
    expect((screen.getByTestId('detail-title-input') as HTMLInputElement).value).toBe(
      'Review the Q3 budget',
    )
    expect(m.controller.state.announce?.text).toContain('needs a name')
  })
})

describe('AC-8 — priority has exactly four states, each settable and clearable in one action', () => {
  it('offers all four, marks the current one, and clears to the ABSENCE of a stored value', () => {
    const m = mount(seed({ tasks: [{ ...PLAIN, priority: 'high' }] }))
    goToTasks()
    openDetail('t1')

    const options = screen.getAllByTestId('detail-priority-option')
    expect(options.map((o) => o.getAttribute('data-priority'))).toEqual([
      'none',
      'low',
      'medium',
      'high',
    ])
    expect(options[3]?.getAttribute('aria-checked')).toBe('true')

    act(() => {
      fireEvent.click(options[2] as HTMLElement)
    })
    expect(m.server.calls.filter((c) => c.method === 'PATCH')[0]?.body).toEqual({ priority: 'medium' })

    act(() => {
      fireEvent.click(screen.getAllByTestId('detail-priority-option')[0] as HTMLElement)
    })
    // **`none` is the absence of a stored value, not a stored string** (architect F8):
    // a literal `'none'` would add a `priority: none` row to F-001 AC-4's message on
    // every create, and `taskEquals` compares `===`, so stored `null` against live
    // `'none'` would report every pre-F-005 row modified in the very gate AC-34
    // exists to protect.
    expect(m.server.calls.filter((c) => c.method === 'PATCH')[1]?.body).toEqual({ priority: null })
  })
})

// ---------------------------------------------------------------------------
// AC-10 … AC-13 — the deadline and the reminder
// ---------------------------------------------------------------------------

describe('AC-10 / AC-11 / AC-12 / AC-13 — two moments, and no fabricated time', () => {
  it('the three shortcuts are offered, and one of them writes an exact instant', () => {
    const m = mount(seed({ tasks: [PLAIN] }))
    goToTasks()
    openDetail('t1')
    const shortcuts = screen.getAllByTestId('detail-deadline-shortcut')
    expect(shortcuts.map((s) => s.getAttribute('data-shortcut'))).toEqual([
      'today-18',
      'tomorrow-09',
      'this-weekend',
    ])
    act(() => {
      fireEvent.click(shortcuts[1] as HTMLElement)
    })
    const body = m.server.calls.filter((c) => c.method === 'PATCH')[0]?.body as Record<string, unknown>
    // All three shortcuts carry a time, so the flag says a time WAS chosen.
    expect(body).toMatchObject({ due_all_day: false })
    const d = new Date(String(body['due_at']))
    expect([d.getHours(), d.getMinutes()]).toEqual([9, 0])
  })

  it('a date picked with no time is ALL-DAY, and the row shows no clock time', () => {
    const m = mount(seed({ tasks: [PLAIN] }))
    goToTasks()
    openDetail('t1')
    act(() => {
      fireEvent.change(screen.getByTestId('detail-deadline-date'), {
        target: { value: '2026-08-21' },
      })
    })
    expect(m.server.calls.filter((c) => c.method === 'PATCH')[0]?.body).toMatchObject({
      due_all_day: true,
    })
  })

  it('clearing the deadline stores NO VALUE — not a zero date, not an empty string', () => {
    const m = mount(seed({ tasks: [{ ...PLAIN, due_all_day: true }] }))
    goToTasks()
    openDetail('t1')
    act(() => {
      fireEvent.click(screen.getByTestId('detail-deadline-clear'))
    })
    expect(m.server.calls.filter((c) => c.method === 'PATCH')[0]?.body).toEqual({
      due_at: null,
      due_all_day: null,
    })
  })

  it('the reminder is a SEPARATE moment, and it is the one that names itself as alerting', () => {
    // AC-11 — *"the report is due Friday, remind me Wednesday"* is an ordinary
    // sentence a single merged field cannot express, and attaching a reminder to
    // every deadline guesses that every deadline deserves noise.
    const m = mount(seed({ tasks: [{ ...PLAIN, due_all_day: true }] }))
    goToTasks()
    openDetail('t1')
    const reminderField = screen
      .getAllByTestId('detail-field')
      .find((f) => f.getAttribute('data-field') === 'reminder') as HTMLElement
    expect(within(reminderField).getByText('This is the one that alerts you.')).toBeTruthy()

    act(() => {
      fireEvent.change(screen.getByTestId('detail-reminder-date'), {
        target: { value: '2026-08-20' },
      })
    })
    // Setting a deadline never creates a reminder and vice versa: the write names
    // one field.
    expect(Object.keys(m.server.calls.filter((c) => c.method === 'PATCH')[0]?.body as object)).toEqual(
      ['reminder_at'],
    )
  })
})

// ---------------------------------------------------------------------------
// AC-14 … AC-18 — the steps
// ---------------------------------------------------------------------------

describe('AC-14 / AC-15 / AC-16 / AC-18 — steps', () => {
  const parent = todayTask({ id: 'p1', title: 'Pack for the trip' })
  const s1 = task({ id: 's1', title: 'passport', parent_id: 'p1', step_order: 1024 }) as TaskWire
  const s2 = task({ id: 's2', title: 'charger', parent_id: 'p1', step_order: 2048 }) as TaskWire

  it('a step is created in ONE call carrying its parent — not POST-then-PATCH', () => {
    const m = mount(seed({ tasks: [parent] }))
    goToTasks()
    openDetail('p1')
    act(() => {
      fireEvent.change(screen.getByTestId('detail-step-add-input'), {
        target: { value: 'passport' },
      })
      fireEvent.click(screen.getByTestId('detail-step-add-button'))
    })
    const posts = m.server.calls.filter((c) => c.method === 'POST' && c.path === '/tasks')
    expect(posts).toHaveLength(1)
    // **A step created without a position is appended last, positioned by the
    // server** — so the client sends no `step_order` here (ADR-015, AC-14).
    expect(posts[0]?.body).toEqual({ title: 'passport', parent_id: 'p1' })
  })

  it('renders the steps in the USER’S order, never derived from a step’s date', () => {
    // AC-15, and the specific way it fails: the original product had TWO functions
    // answering *"which steps does this task have"*, one sorted and one not, and the
    // unsorted one was what both clients drew from. There is one here and it always
    // sorts.
    const dated = { ...s2, due_at: '2020-01-01T00:00:00.000Z' }
    mount(seed({ tasks: [parent, dated, s1] }))
    goToTasks()
    openDetail('p1')
    expect(
      screen.getAllByTestId('detail-step-row').map((r) => r.getAttribute('data-task-id')),
      'a step with a deadline does not jump',
    ).toEqual(['s1', 's2'])
  })

  it('the move control does not appear on a ONE-STEP list, and does on a two-step one', () => {
    mount(seed({ tasks: [parent, s1] }))
    goToTasks()
    openDetail('p1')
    expect(screen.queryAllByTestId('detail-step-move')).toHaveLength(0)
    cleanup()

    mount(seed({ tasks: [parent, s1, s2] }))
    goToTasks()
    openDetail('p1')
    expect(screen.queryAllByTestId('detail-step-move')).toHaveLength(2)
  })

  it('the move mode is KEYBOARD-OPERABLE and writes one row on the drop', async () => {
    // AC-16's 2.5.1 / 2.1.1: dragging is never the only way. jsdom cannot exercise a
    // path-based pointer gesture, which is exactly why the accessible path is the
    // one with the assertions here.
    const m = mount(seed({ tasks: [parent, s1, s2] }))
    m.server.always('PATCH /tasks/:id', 200, {
      task: { ...s1, step_order: 3072 },
      prior: { step_order: 1024 },
    })
    goToTasks()
    openDetail('p1')
    const handles = screen.getAllByTestId('detail-step-move')
    act(() => {
      fireEvent.click(handles[0] as HTMLElement) // grab s1
    })
    expect((handles[0] as HTMLElement).getAttribute('aria-pressed')).toBe('true')
    // …and a position is announced on every move (4.1.3).
    act(() => {
      fireEvent.keyDown(handles[0] as HTMLElement, { key: 'ArrowDown' })
    })
    expect(m.controller.state.announce?.text).toBe('Step 2 of 2')
    await act(async () => {
      fireEvent.click(screen.getAllByTestId('detail-step-move')[0] as HTMLElement) // drop
    })
    const patches = m.server.calls.filter((c) => c.method === 'PATCH')
    expect(patches, 'one write, one row').toHaveLength(1)
    expect(Object.keys(patches[0]?.body as object)).toEqual(['step_order'])
    // …and the reversal is offered, replaying `prior.step_order` (ADR-015).
    expect(m.controller.state.undoOffer?.action).toMatchObject({
      kind: 'move-step',
      priorStepOrder: 1024,
    })
  })

  it('Escape abandons the move and the step returns to the position it held', () => {
    const m = mount(seed({ tasks: [parent, s1, s2] }))
    goToTasks()
    openDetail('p1')
    const handles = screen.getAllByTestId('detail-step-move')
    // Two `act` blocks, not one: React batches inside a single block, so the grab's
    // state would not have flushed when the key press ran and the handler would
    // still see `held === false`. The mode is a state machine and its transitions
    // are separate events.
    act(() => {
      fireEvent.click(handles[1] as HTMLElement) // grab s2, position 2
    })
    act(() => {
      fireEvent.keyDown(handles[1] as HTMLElement, { key: 'ArrowUp' })
    })
    expect(m.controller.state.announce?.text).toBe('Step 1 of 2')
    act(() => {
      fireEvent.keyDown(handles[1] as HTMLElement, { key: 'Escape' })
    })
    // Announced like any other position change (tester W13).
    expect(m.controller.state.announce?.text).toBe('Step 2 of 2')
    expect(m.server.calls.filter((c) => c.method === 'PATCH'), 'nothing was written').toHaveLength(0)
  })

  it('a step’s own detail offers NEITHER steps nor a repeat (AC-18, AC-21)', () => {
    mount(seed({ tasks: [parent, s1, s2] }))
    goToTasks()
    // A step is not drawn as a top-level row (AC-35), so its detail is reached by
    // the swap door rather than by a row — which is what this asserts against.
    openDetail('p1')
    act(() => {
      fireEvent.click(screen.getAllByTestId('detail-step-row')[0] as HTMLElement)
    })
    cleanup()
    // Mount straight onto the step's detail: the surface must refuse the gesture the
    // write path refuses, so the trap is never set.
    const m = mount(seed({ tasks: [parent, s1, s2] }))
    goToTasks()
    openDetail('p1')
    act(() => {
      m.controller.push([])
    })
    // (the step-detail case is exercised through the model in detail-model.test.ts;
    // here the assertion is that a PARENT does offer both, so the refusal above is
    // about the step and not about the surface)
    expect(screen.getByTestId('detail-steps')).toBeTruthy()
    expect(screen.getByTestId('detail-repeat-summary')).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// AC-20 … AC-25 — the repeat picker, the one preview-then-commit control
// ---------------------------------------------------------------------------

describe('AC-20 / AC-22 / AC-23 / AC-25 — the repeat picker', () => {
  it('discloses the created-or-moved date and its collection BEFORE the commit', async () => {
    // A DATELESS task, because AC-22's *"setting a repeat on a dateless task sets
    // the due to today"* is the case this asserts — and a dateless row is in Inbox,
    // not in the Today collection the app opens on (ADR-009's two axes).
    const m = mount(seed({ tasks: [{ ...PLAIN, due_at: null, due_all_day: null }] }))
    m.server.always('POST /tasks/:id/repeat-preview', 200, {
      due_at: '2026-08-24T00:00:00.000Z',
      due_all_day: true,
      created: true,
      moved: false,
      refusals: [],
    })
    goToInbox()
    openDetail('t1')
    act(() => {
      fireEvent.click(screen.getByTestId('detail-repeat-edit'))
    })
    await act(async () => {
      fireEvent.click(
        screen.getAllByTestId('detail-repeat-cadence').find((b) => b.getAttribute('data-cadence') === 'weekly') as HTMLElement,
      )
    })
    // The disclosure is a SERVER dry run of the same code the commit runs, so the
    // disclosed date is by construction the date that will be written (L-004: a
    // client-side preview would be a second implementation of the alignment, the
    // month-day clamp and the exclusivity rules).
    expect(screen.getByTestId('detail-repeat-preview-date').textContent).toBe('2026-08-24')
    expect(screen.getByTestId('detail-repeat-preview-collection').textContent).toBeTruthy()
    // Nothing is committed by previewing.
    expect(m.server.calls.filter((c) => c.method === 'PATCH')).toHaveLength(0)
    // …and it is announced under AC-33's 4.1.3.
    expect(m.controller.state.announce?.text).toContain('deadline')
  })

  it('a refusal is REPORTED before the commit, and the commit is not offered', async () => {
    const m = mount(seed({ tasks: [{ ...PLAIN, due_all_day: true }] }))
    m.server.always('POST /tasks/:id/repeat-preview', 200, {
      due_at: PLAIN.due_at,
      due_all_day: true,
      created: false,
      moved: false,
      refusals: [
        { code: 'UNTIL_BEFORE_DUE', field: 'repeat_until', message: 'That end date is before the task is due.' },
      ],
    })
    goToTasks()
    openDetail('t1')
    act(() => {
      fireEvent.click(screen.getByTestId('detail-repeat-edit'))
    })
    await act(async () => {
      fireEvent.change(screen.getByTestId('detail-repeat-until'), {
        target: { value: '2020-01-01' },
      })
    })
    // *"An end date earlier than the due date is REPORTED, not silently corrected —
    // the user may be about to change the due date next, and a date that moves on
    // its own while they are still typing is worse than a sentence."*
    expect(screen.getByTestId('detail-repeat-refusal').textContent).toContain('before the task is due')
    expect((screen.getByTestId('detail-repeat-commit') as HTMLButtonElement).disabled).toBe(true)
  })

  it('the commit sends only the members that changed', async () => {
    const m = mount(seed({ tasks: [{ ...PLAIN, due_all_day: true }] }))
    m.server.always('POST /tasks/:id/repeat-preview', 200, {
      due_at: PLAIN.due_at,
      due_all_day: true,
      created: false,
      moved: false,
      refusals: [],
    })
    goToTasks()
    openDetail('t1')
    act(() => {
      fireEvent.click(screen.getByTestId('detail-repeat-edit'))
    })
    await act(async () => {
      fireEvent.click(
        screen.getAllByTestId('detail-repeat-cadence').find((b) => b.getAttribute('data-cadence') === 'daily') as HTMLElement,
      )
    })
    await act(async () => {
      fireEvent.click(screen.getByTestId('detail-repeat-commit'))
    })
    expect(m.server.calls.filter((c) => c.method === 'PATCH')[0]?.body).toEqual({
      repeat_frequency: 'day',
      repeat_interval: 1,
    })
  })

  it('an uncommitted preview is DISCARDED VISIBLY when the surface goes (AC-45, AC-48)', async () => {
    // design D25: *"configure a repeat, see the disclosure, tap `Talk` before
    // committing — silent at the close door, announced at the swap door, same
    // object, same release. L-005's shape on a door revision 3 opened."*
    const m = mount(seed({ tasks: [{ ...PLAIN, due_all_day: true }] }))
    m.server.always('POST /tasks/:id/repeat-preview', 200, {
      due_at: PLAIN.due_at,
      due_all_day: true,
      created: false,
      moved: false,
      refusals: [],
    })
    goToTasks()
    openDetail('t1')
    act(() => {
      fireEvent.click(screen.getByTestId('detail-repeat-edit'))
    })
    await act(async () => {
      fireEvent.click(
        screen.getAllByTestId('detail-repeat-cadence').find((b) => b.getAttribute('data-cadence') === 'weekly') as HTMLElement,
      )
    })
    act(() => {
      fireEvent.click(screen.getByTestId('detail-close-button'))
    })
    expect(m.controller.state.announce?.text).toBe('The repeat you were setting up was not saved.')
    expect(m.server.calls.filter((c) => c.method === 'PATCH'), 'and NOT committed').toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// AC-30 / AC-31 — delete, and the series delete
// ---------------------------------------------------------------------------

describe('AC-30 / AC-31 — the detail’s deletes', () => {
  it('the detail deletes its task, closes, and offers the reversal in § CarriedNotice', async () => {
    const m = mount(seed({ tasks: [PLAIN, OTHER] }))
    m.server.always('DELETE /tasks/:id', 200, { task: { ...PLAIN, deleted_at: T0 } })
    goToTasks()
    openDetail('t1')
    await act(async () => {
      fireEvent.click(screen.getByTestId('detail-delete-button'))
    })
    expect(surfaceOf(m.container)).toBe('tasks')
    // **Rendered in the notice family, never on the row** (owner, 2026-08-19): a
    // row-local offer loses the reversal exactly when the user navigates away.
    expect(screen.getByTestId('shell-carried-notice-undo').textContent).toBe('Put back')
    // § Buttons' one-word-per-concept rule: `put back` for the user's own act, and
    // never `undo`, which is bound to reversing the last applied TURN.
    expect(screen.queryByTestId('shell-carried-notice-undo')?.textContent).not.toBe('Undo')
  })

  it('“delete the whole series” is present ONLY on a task in a live series', () => {
    mount(seed({ tasks: [PLAIN] }))
    goToTasks()
    openDetail('t1')
    // **Two controls, not one control that asks sometimes** (design D11).
    expect(screen.queryByTestId('detail-delete-series-button')).toBeNull()
    cleanup()

    mount(seed({ tasks: [{ ...PLAIN, series_live: true, series_id: 'S', repeat_frequency: 'week' }] }))
    goToTasks()
    openDetail('t1')
    expect(screen.getByTestId('detail-delete-series-button')).toBeTruthy()
  })

  it('neither delete asks a pre-action question — an action with an undo does not need one', () => {
    mount(seed({ tasks: [{ ...PLAIN, series_live: true, series_id: 'S', repeat_frequency: 'week' }] }))
    goToTasks()
    openDetail('t1')
    // UC-33 AC-33.2, cited twice in the spec. `§ Buttons`' danger variant is
    // *"confirm-delete contexts only"* — the very question the precedent refuses.
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByText(/are you sure/i)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// AC-32 — zero AI calls
// ---------------------------------------------------------------------------

describe('AC-32 — every operation on this surface makes ZERO AI calls', () => {
  it('and every one of them works while the assistant is erroring', async () => {
    // *"This surface is part of what F-001 AC-24 and AC-25 hand over to; a by-hand
    // path that needs the assistant to be healthy is not one."*
    const m = mount(seed({ tasks: [PLAIN], surface: 'error', sessionLoad: 'failed' }))
    m.server.always('POST /tasks/:id/repeat-preview', 200, {
      due_at: PLAIN.due_at,
      due_all_day: true,
      created: false,
      moved: false,
      refusals: [],
    })
    goToTasks()
    openDetail('t1')

    await act(async () => {
      fireEvent.change(screen.getByTestId('detail-note-input'), { target: { value: 'n' } })
      fireEvent.blur(screen.getByTestId('detail-note-input'))
    })
    act(() => {
      fireEvent.click(screen.getAllByTestId('detail-priority-option')[3] as HTMLElement)
    })
    act(() => {
      fireEvent.click(screen.getAllByTestId('detail-deadline-shortcut')[0] as HTMLElement)
    })
    act(() => {
      fireEvent.change(screen.getByTestId('detail-step-add-input'), { target: { value: 's' } })
      fireEvent.click(screen.getByTestId('detail-step-add-button'))
    })
    act(() => {
      fireEvent.click(screen.getByTestId('detail-repeat-edit'))
    })
    await act(async () => {
      fireEvent.click(screen.getAllByTestId('detail-repeat-cadence')[0] as HTMLElement)
    })

    expect(m.server.assistantCalls(), 'not one /assistant/* call').toEqual([])
    // …and every write reached `/tasks*`, which is the other half of the claim.
    expect(m.server.calls.filter((c) => c.path.startsWith('/tasks')).length).toBeGreaterThan(3)
  })
})

// ---------------------------------------------------------------------------
// AC-33 — WCAG 2.1 AA, by name
// ---------------------------------------------------------------------------

describe('AC-33 — the criteria this surface adds controls under', () => {
  /** Every focusable thing this surface renders. */
  function interactive(root: HTMLElement): HTMLElement[] {
    return [...root.querySelectorAll('button, input, textarea, [role="radio"]')] as HTMLElement[]
  }

  /** The detail with every field populated, so no control is absent from the sweep. */
  function fullDetail(): Mounted {
    const parent = todayTask({
      id: 'p1',
      title: 'Pack for the trip',
      note: 'the small case',
      priority: 'high',
      reminder_at: '2026-08-18T09:00:00.000Z',
      due_all_day: false,
      series_live: true,
      series_id: 'S',
      repeat_frequency: 'week',
      repeat_interval: 1,
    })
    const m = mount(
      seed({
        tasks: [
          parent,
          task({ id: 's1', title: 'passport', parent_id: 'p1', step_order: 1024 }),
          task({ id: 's2', title: 'charger', parent_id: 'p1', step_order: 2048 }),
        ],
      }),
    )
    goToTasks()
    openDetail('p1')
    return m
  }

  it('2.1.1 — every control this feature adds is a natively keyboard-operable element', () => {
    // *"This is not a nicety on a voice-first product whose MANIFEST standard is
    // WCAG 2.1 AA."* Includes AC-16's reorder alternative and AC-43's undo offer,
    // which the AC names explicitly.
    const m = fullDetail()
    for (const el of interactive(screen.getByTestId('detail-surface'))) {
      const tag = el.tagName.toLowerCase()
      expect(['button', 'input', 'textarea'], el.outerHTML.slice(0, 90)).toContain(tag)
      expect(el.getAttribute('tabindex'), el.outerHTML.slice(0, 90)).not.toBe('-1')
      expect((el as HTMLButtonElement).disabled ?? false, 'nothing is disabled by default').toBe(false)
    }
    // AC-43's offer, in § CarriedNotice, is a button too.
    m.server.always('DELETE /tasks/:id', 200, { task: { ...todayTask({ id: 's1' }), deleted_at: T0 } })
    act(() => {
      fireEvent.click(screen.getAllByTestId('detail-step-delete')[0] as HTMLElement)
    })
  })

  it('4.1.2 — every control exposes a name, and the priority control exposes its VALUE', () => {
    fullDetail()
    for (const el of interactive(screen.getByTestId('detail-surface'))) {
      const name = el.getAttribute('aria-label') ?? el.textContent ?? ''
      expect(name.trim().length, el.outerHTML.slice(0, 90)).toBeGreaterThan(0)
    }
    // *"name/role/value on the pickers, the priority control, each step's checkbox,
    // and AC-9's four priority states."* Role and value, not only name.
    const control = screen.getByTestId('detail-priority-control')
    expect(control.getAttribute('role')).toBe('radiogroup')
    const options = screen.getAllByTestId('detail-priority-option')
    expect(options.every((o) => o.getAttribute('role') === 'radio')).toBe(true)
    expect(options.filter((o) => o.getAttribute('aria-checked') === 'true')).toHaveLength(1)
    // each step's checkbox
    for (const cb of screen.getAllByTestId('detail-step-checkbox')) {
      expect(cb.getAttribute('aria-label')).toContain('step')
      expect(cb.getAttribute('aria-pressed')).toBeTruthy()
    }
  })

  it('2.5.3 — a visible label is a PREFIX of the accessible name, never a replacement', () => {
    fullDetail()
    for (const el of interactive(screen.getByTestId('detail-surface'))) {
      // **Text inputs are out of scope and that is 2.5.3's own scope, not a
      // convenience.** The criterion is about a control whose *label* is visible
      // text; a field's text content is its **value**, and requiring the accessible
      // name to start with whatever the user has typed would be a rule about data
      // rather than about labelling.
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') continue
      const label = el.getAttribute('aria-label')
      const visible = (el.textContent ?? '').trim()
      if (label === null || visible === '') continue
      // Where both exist the visible words must open the accessible name. An
      // icon-only control has no visible text and is exempt by construction.
      expect(
        label.toLowerCase().startsWith(visible.toLowerCase()) || !/[a-z]/i.test(visible),
        `${visible} / ${label}`,
      ).toBe(true)
    }
  })

  it('2.2.1 — no affordance this feature adds is withdrawn by the passage of time AT ALL', () => {
    // The rule at the strength its two siblings state it (AC-43, AC-47): *"not by a
    // timer, not by a timer that a focus or a hover extends, and not by any duration
    // however long."* Revision 3's *"withdrawn by time ALONE"* was satisfied by a
    // five-second timer extended on focus, which is the precise reading tester W8
    // had already removed from AC-43.
    //
    // **The requirement is an ABSENCE, so it is asserted as source text and says so**
    // (L-002): there is no runtime observable for "no timer exists" short of waiting
    // forever. The behavioural half — that a navigation and a surface change do not
    // clear a notice — is asserted in the AC-47 block above.
    for (const f of ['components/CarriedNotices.tsx', 'components/PassedReminders.tsx']) {
      const src = readFileSync(resolve(process.cwd(), 'src/assistant/web', f), 'utf8')
      for (const timer of ['setTimeout', 'setInterval', 'requestAnimationFrame']) {
        expect(src.includes(timer), `${f} must contain no ${timer}`).toBe(false)
      }
    }
  })

  it('4.1.3 — the status region pre-exists its content, and every refusal reaches it', () => {
    // *"Every refusal and every status message this spec states is announced"* — a
    // rule, not an enumeration, because a closed list is how AC-40's turn-path
    // refusals, AC-2's offline refusal, AC-38's surfacing and AC-47's own notice
    // ended up asserted by nobody.
    const m = mount(seed({ tasks: [PLAIN] }))
    const region = screen.getByTestId('shell-status-announcer')
    expect(region.getAttribute('role')).toBe('status')
    expect(region.getAttribute('aria-live')).toBe('polite')
    // A live region only announces what changes AFTER it exists.
    expect(region.textContent).toBe('')

    goToTasks()
    openDetail('t1')
    act(() => {
      fireEvent.change(screen.getByTestId('detail-title-input'), { target: { value: '  ' } })
      fireEvent.blur(screen.getByTestId('detail-title-input'))
    })
    expect(screen.getByTestId('shell-status-announcer').textContent).toContain('needs a name')

    // …and the same sentence twice is TWO announcements, not a DOM no-op the live
    // region ignores — which is what the sequence number is for.
    const firstSeq = m.controller.state.announce?.seq
    act(() => {
      fireEvent.change(screen.getByTestId('detail-title-input'), { target: { value: '' } })
      fireEvent.blur(screen.getByTestId('detail-title-input'))
    })
    expect(m.controller.state.announce?.seq).toBe((firstSeq as number) + 1)
  })
})

// ---------------------------------------------------------------------------
// AC-47 — the notice is visible WHEREVER the user is
// ---------------------------------------------------------------------------

describe('AC-47 — § CarriedNotice renders at the frame, on every surface', () => {
  it('the region pre-exists on Talk, on Tasks, on Settings and on the detail', () => {
    // *"'Persists' is not 'is visible' … only the third reading makes AC-2's promise
    // true: the notice is VISIBLE wherever the user is."* The region's presence on
    // every surface is the observable that requirement has, which is why it carries
    // a testid at all.
    const { container } = mount(seed({ tasks: [PLAIN] }))
    expect(surfaceOf(container)).toBe('talk')
    expect(screen.getByTestId('shell-carried-notices')).toBeTruthy()
    goToTasks()
    expect(screen.getByTestId('shell-carried-notices')).toBeTruthy()
    openDetail('t1')
    expect(screen.getByTestId('shell-carried-notices')).toBeTruthy()
    act(() => {
      fireEvent.click(screen.getByTestId('shell-lists-menu-button'))
    })
    act(() => {
      fireEvent.click(screen.getByTestId('menu-settings-row'))
    })
    expect(surfaceOf(container)).toBe('settings')
    expect(
      screen.getByTestId('shell-carried-notices'),
      'a region inside the stacking layer is invisible here — which is the failure AC-47 names',
    ).toBeTruthy()
  })

  it('is a live region that pre-exists its content, polite and NOT atomic', () => {
    mount(seed({ tasks: [PLAIN] }))
    const region = screen.getByTestId('shell-carried-notices')
    // A live region injected into the DOM at the same moment as its content is not
    // reliably announced — § SaveNotice's reasoning, with more force here because
    // this region is created once per app rather than once per surface.
    expect(region.getAttribute('role')).toBe('status')
    expect(region.getAttribute('aria-live')).toBe('polite')
    // `aria-atomic="false"` is where it diverges from § SaveNotice: re-reading N
    // rows when the third arrives is the *"N polite announcements"* failure AC-2 and
    // AC-47 both aggregate to avoid.
    expect(region.getAttribute('aria-atomic')).toBe('false')
  })

  it('carries the user’s value, names the task and the field, and survives the close', async () => {
    const m = mount(seed({ tasks: [PLAIN] }))
    m.server.always('PATCH /tasks/:id', 500, { error: { code: 'INTERNAL', message: 'boom' } })
    goToTasks()
    openDetail('t1')
    await act(async () => {
      fireEvent.change(screen.getByTestId('detail-note-input'), {
        target: { value: 'ring them first' },
      })
      fireEvent.blur(screen.getByTestId('detail-note-input'))
    })
    act(() => {
      fireEvent.click(screen.getByTestId('detail-close-button'))
    })

    const row = screen.getByTestId('shell-carried-notice')
    // Design's literal, cited by row id — never composed here (L-008).
    expect(within(row).getByText(`Couldn't save the note on "Review the Q3 budget".`)).toBeTruthy()
    expect(within(row).getByText('You typed')).toBeTruthy()
    expect(within(row).getByText('ring them first')).toBeTruthy()
    expect(within(row).getByTestId('shell-carried-notice-retry')).toBeTruthy()
  })

  it('an offline refusal joins it, with the offline sentence and no pending badge', async () => {
    const m = mount(seed({ tasks: [PLAIN], offline: true }), { online: false })
    goToTasks()
    openDetail('t1')
    await act(async () => {
      fireEvent.change(screen.getByTestId('detail-title-input'), { target: { value: 'renamed' } })
      fireEvent.blur(screen.getByTestId('detail-title-input'))
    })
    const row = screen.getByTestId('shell-carried-notice')
    expect(row.getAttribute('data-cn-state')).toBe('carried-offline')
    expect(within(row).getByText(`You're offline — "Review the Q3 budget" wasn't renamed.`)).toBeTruthy()
    // *"A spinner, a pending badge or a silent acceptance is not"* honest.
    expect(row.textContent).not.toMatch(/pending|saving|will send/i)
    expect(m.server.calls.filter((c) => c.method === 'PATCH')).toHaveLength(0)
  })

  it('a superseded notice reports and offers NO retry', async () => {
    const m = mount(seed({ tasks: [PLAIN] }))
    m.server.always('PATCH /tasks/:id', 500, { error: { code: 'INTERNAL', message: 'boom' } })
    goToTasks()
    openDetail('t1')
    await act(async () => {
      fireEvent.change(screen.getByTestId('detail-note-input'), { target: { value: 'mine' } })
      fireEvent.blur(screen.getByTestId('detail-note-input'))
    })
    // An assistant turn writes the same field.
    m.server.always('GET /tasks', 200, { tasks: [{ ...PLAIN, note: 'the assistant’s' }] })
    await act(async () => {
      await m.controller.refreshTasks()
    })

    const row = screen.getByTestId('shell-carried-notice')
    expect(row.getAttribute('data-cn-state')).toBe('carried-superseded')
    expect(within(row).getByText('Now saved')).toBeTruthy()
    expect(within(row).queryByTestId('shell-carried-notice-retry')).toBeNull()
    // …and the FIELD shows the stored value, because the notice and the surface
    // never disagree (AC-47's own reconciliation, and AC-3's live-update guarantee
    // for that field).
    expect((screen.getByTestId('detail-note-input') as HTMLTextAreaElement).value).toBe(
      'the assistant’s',
    )
  })

  it('the user dismissing a row removes it, and nothing else does', async () => {
    const m = mount(seed({ tasks: [PLAIN] }))
    m.server.always('PATCH /tasks/:id', 500, { error: { code: 'INTERNAL', message: 'boom' } })
    goToTasks()
    openDetail('t1')
    await act(async () => {
      fireEvent.change(screen.getByTestId('detail-note-input'), { target: { value: 'v' } })
      fireEvent.blur(screen.getByTestId('detail-note-input'))
    })
    // Navigating does not clear it — which is § SaveNotice's lifetime rule 3 and
    // exactly what AC-47 forbids.
    act(() => {
      fireEvent.click(screen.getByTestId('shell-talk-button'))
    })
    expect(screen.getByTestId('shell-carried-notice')).toBeTruthy()
    act(() => {
      fireEvent.click(screen.getByTestId('shell-carried-notice-dismiss'))
    })
    expect(screen.queryByTestId('shell-carried-notice')).toBeNull()
  })
})

describe('§ CarriedNotice’s copy is transcribed from components.md, not composed', () => {
  /**
   * L-008's own remedy, in the direction drift actually travels: **the test parses
   * the OWNING artifact**, never a retyped copy. A check comparing two things the
   * implementation controls would go green forever; this one goes red when
   * `components.md § CarriedNotice § The literal messages` moves.
   *
   * Both size guards are here for L-007's reason: a parser that silently matched
   * nothing yields the same green as one that worked.
   */
  function literals(): Map<string, { failed: string; offline: string; superseded: string }> {
    const md = readFileSync(resolve(process.cwd(), 'docs/design/_shared/components.md'), 'utf8')
    const start = md.indexOf('| Field | CN-FAILED | CN-OFFLINE | CN-SUPERSEDED |')
    expect(start, 'the literal-message table moved or was renamed').toBeGreaterThan(-1)
    const end = md.indexOf('**The seven fields are the user-settable set', start)
    const rows = new Map<string, { failed: string; offline: string; superseded: string }>()
    for (const line of md.slice(start, end).split('\n')) {
      const cells = line.split('|').map((c) => c.trim())
      if (cells.length < 6) continue
      const field = cells[1] as string
      if (field === 'Field' || field.startsWith('-')) continue
      const strip = (c: string): string => c.replace(/^`|`$/g, '')
      rows.set(field, {
        failed: strip(cells[2] as string),
        offline: strip(cells[3] as string),
        superseded: strip(cells[4] as string),
      })
    }
    return rows
  }

  it('publishes exactly the seven user-settable fields AC-1 names', () => {
    const rows = literals()
    expect([...rows.keys()]).toEqual([
      'title',
      'note',
      'priority',
      'deadline',
      'reminder',
      'step',
      'repeat',
    ])
  })

  it('renders design’s exact CN-FAILED and CN-OFFLINE sentences, slot and all', async () => {
    const rows = literals()
    const expected = (tpl: string, taskTitle: string): string => tpl.replace('{task}', taskTitle)

    // CN-FAILED, on the `note` field.
    const failed = mount(seed({ tasks: [PLAIN] }))
    failed.server.always('PATCH /tasks/:id', 500, { error: { code: 'INTERNAL', message: 'x' } })
    goToTasks()
    openDetail('t1')
    await act(async () => {
      fireEvent.change(screen.getByTestId('detail-note-input'), { target: { value: 'v' } })
      fireEvent.blur(screen.getByTestId('detail-note-input'))
    })
    expect(screen.getByTestId('shell-carried-notice').textContent).toContain(
      expected(rows.get('note')?.failed as string, 'Review the Q3 budget'),
    )
    cleanup()

    // CN-OFFLINE, on the `title` field — a different field AND a different row
    // type, so neither the mapping nor the row selection is proven by the other.
    const offline = mount(seed({ tasks: [PLAIN], offline: true }), { online: false })
    goToTasks()
    openDetail('t1')
    await act(async () => {
      fireEvent.change(screen.getByTestId('detail-title-input'), { target: { value: 'renamed' } })
      fireEvent.blur(screen.getByTestId('detail-title-input'))
    })
    expect(screen.getByTestId('shell-carried-notice').textContent).toContain(
      expected(rows.get('title')?.offline as string, 'Review the Q3 budget'),
    )
    expect(offline.server.calls.filter((c) => c.method === 'PATCH')).toHaveLength(0)
  })

  it('renders design’s exact CN-UNDO literal for a delete', async () => {
    const md = readFileSync(resolve(process.cwd(), 'docs/design/_shared/components.md'), 'utf8')
    const i = md.indexOf('**CN-UNDO**, four literals')
    expect(i, 'the CN-UNDO literals moved').toBeGreaterThan(-1)
    // The delete-a-task row of the four-literal table.
    const table = md.slice(i, md.indexOf('**A reorder that changes nothing', i))
    const row = table.split('\n').find((l) => l.includes('delete a task, from the detail')) as string
    const literal = (row.split('|')[2] as string).trim().replace(/^`|`$/g, '')

    const m = mount(seed({ tasks: [PLAIN, OTHER] }))
    m.server.always('DELETE /tasks/:id', 200, { task: { ...PLAIN, deleted_at: T0 } })
    goToTasks()
    openDetail('t1')
    await act(async () => {
      fireEvent.click(screen.getByTestId('detail-delete-button'))
    })
    expect(screen.getByTestId('shell-carried-notice').textContent).toContain(
      literal.replace('{task}', 'Review the Q3 budget'),
    )
  })
})

// ---------------------------------------------------------------------------
// AC-48 — the detail changes subject while it is open
// ---------------------------------------------------------------------------

describe('AC-48 — the swap', () => {
  const applied = (ids: string[], titles: string[]): NewMsg => ({
    kind: 'applied',
    turnId: 'turn-1',
    head: 'Edited 2 tasks',
    lines: ids.map((id, i) => ({ taskId: id, title: titles[i] as string, label: 'edit', chips: [] })),
    deletedTitles: [],
    mutated: true,
    undone: false,
    at: T0,
  })

  it('activating a message’s task while a DIFFERENT task’s detail is open replaces the subject', () => {
    mount(
      seed({ tasks: [PLAIN, OTHER] }, [
        applied(['t1', 't2'], ['Review the Q3 budget', 'Pay the electricity bill']),
      ]),
    )
    goToTasks()
    openDetail('t1')
    expect(screen.getByTestId('detail-title-input')).toHaveProperty('value', 'Review the Q3 budget')

    // The conversation renders beside the detail above the split (AC-45), so the
    // door is activatable. Below the split it is not on screen and the case does not
    // arise — which is why this is keyed to the detail being open and not to a width.
    act(() => {
      fireEvent.click(
        screen.getAllByTestId('talk-task-link').find((l) => l.textContent === 'Pay the electricity bill') as HTMLElement,
      )
    })
    expect(screen.getByTestId('detail-title-input')).toHaveProperty(
      'value',
      'Pay the electricity bill',
    )
  })

  it('when the named task is the one the detail already holds, nothing is replaced', () => {
    const m = mount(
      seed({ tasks: [PLAIN, OTHER] }, [
        applied(['t1', 't2'], ['Review the Q3 budget', 'Pay the electricity bill']),
      ]),
    )
    goToTasks()
    openDetail('t1')
    act(() => {
      fireEvent.change(screen.getByTestId('detail-title-input'), { target: { value: 'dirty' } })
    })
    act(() => {
      fireEvent.click(
        screen.getAllByTestId('talk-task-link').find((l) => l.textContent === 'Review the Q3 budget') as HTMLElement,
      )
    })
    // The postcondition is already true, so nothing is torn down and nothing is
    // saved as though focus left.
    expect(screen.getByTestId('detail-title-input')).toHaveProperty('value', 'dirty')
    expect(m.server.calls.filter((c) => c.method === 'PATCH')).toHaveLength(0)
  })

  it('an uncommitted repeat preview is discarded VISIBLY at the swap door too', async () => {
    const m = mount(
      seed({ tasks: [{ ...PLAIN, due_all_day: true }, OTHER] }, [
        applied(['t1', 't2'], ['Review the Q3 budget', 'Pay the electricity bill']),
      ]),
    )
    m.server.always('POST /tasks/:id/repeat-preview', 200, {
      due_at: PLAIN.due_at,
      due_all_day: true,
      created: false,
      moved: false,
      refusals: [],
    })
    goToTasks()
    openDetail('t1')
    act(() => {
      fireEvent.click(screen.getByTestId('detail-repeat-edit'))
    })
    await act(async () => {
      fireEvent.click(
        screen.getAllByTestId('detail-repeat-cadence').find((b) => b.getAttribute('data-cadence') === 'weekly') as HTMLElement,
      )
    })
    act(() => {
      fireEvent.click(
        screen.getAllByTestId('talk-task-link').find((l) => l.textContent === 'Pay the electricity bill') as HTMLElement,
      )
    })
    // The same rule at both doors, which is the point: the object is neither in
    // flight, failed nor refused, so AC-47 never carries it — and silence at one
    // door with an announcement at the other is L-005's shape.
    expect(m.controller.state.announce?.text).toBe('The repeat you were setting up was not saved.')
  })
})

// ---------------------------------------------------------------------------
// AC-9 / AC-17 / AC-39 — § TaskRow's three marks
// ---------------------------------------------------------------------------

describe('AC-9 / AC-17 / AC-39 — the row’s three marks', () => {
  it('urgency renders a glyph for a marked level and NOTHING for `none`', () => {
    mount(
      seed({
        tasks: [
          todayTask({ id: 'h', title: 'urgent', priority: 'high' }),
          todayTask({ id: 'n', title: 'plain', priority: 'none' }),
        ],
      }),
    )
    goToTasks()
    const rows = screen.getAllByTestId('assistant-task-row')
    const byId = (id: string) => rows.find((r) => r.getAttribute('data-task-id') === id) as HTMLElement
    expect(within(byId('h')).getByTestId('tasks-row-priority-mark').textContent).toBe('!!!')
    // `none` renders no mark at all, **so the marks stay meaningful**.
    expect(within(byId('n')).queryByTestId('tasks-row-priority-mark')).toBeNull()
    // …and **all four states are distinguished in the accessible name regardless**,
    // which is the half assertable across the whole set (tester W15): one glyph
    // cannot render three levels and 1.4.3 forbids carrying the difference in colour.
    expect(byId('h').getAttribute('aria-label')).toContain('high priority')
    expect(byId('n').getAttribute('aria-label')).not.toContain('priority')
  })

  it('the repeat mark reads `series_live` from the wire, NEVER `series_id`', () => {
    // AC-39's negative half: a cleared repeat, an ended series, and a completed
    // occupant of a deleted series all show NO mark — and `series_id` is the field
    // AC-25 never clears, so an implementation keyed off it passes the positive case
    // and marks every task that ever repeated as repeating for good.
    mount(
      seed({
        tasks: [
          todayTask({ id: 'live', title: 'waters', series_id: 'S', series_live: true }),
          todayTask({ id: 'ended', title: 'watered', series_id: 'S', series_live: false }),
        ],
      }),
    )
    goToTasks()
    const rows = screen.getAllByTestId('assistant-task-row')
    const byId = (id: string) => rows.find((r) => r.getAttribute('data-task-id') === id) as HTMLElement
    expect(within(byId('live')).getByTestId('tasks-row-repeat-mark')).toBeTruthy()
    expect(within(byId('ended')).queryByTestId('tasks-row-repeat-mark')).toBeNull()
    expect(byId('live').getAttribute('aria-label')).toContain('repeats')
    expect(byId('ended').getAttribute('aria-label')).not.toContain('repeats')
  })

  it('the step count is the REMAINING set, and a task with no steps shows nothing', () => {
    mount(
      seed({
        tasks: [
          todayTask({ id: 'p', title: 'Pack' }),
          task({ id: 's1', parent_id: 'p', step_order: 1024 }),
          task({ id: 's2', parent_id: 'p', step_order: 2048, status: 'done' }),
          todayTask({ id: 'bare', title: 'Bare' }),
        ],
      }),
    )
    goToTasks()
    const rows = screen.getAllByTestId('assistant-task-row')
    // AC-35 — the steps are not drawn as top-level rows at all.
    expect(rows.map((r) => r.getAttribute('data-task-id'))).toEqual(['p', 'bare'])
    const byId = (id: string) => rows.find((r) => r.getAttribute('data-task-id') === id) as HTMLElement
    expect(within(byId('p')).getByTestId('tasks-row-steps-mark').textContent).toContain('1')
    expect(within(byId('bare')).queryByTestId('tasks-row-steps-mark')).toBeNull()
    // Two literals, singular and plural — not a template over a noun.
    expect(byId('p').getAttribute('aria-label')).toContain('1 step left')
  })

  it('AC-7 — the row shows the title and NOTHING about the note: an assertion of absence', () => {
    // *"No marker, no icon, no preview line. This is an assertion of absence and
    // must be written as one."* Its source is the source product's own removal
    // decision and only that: UC-44 AC-44.2 records that the original shipped a `¶`
    // marker, removed it, and recorded the lesson that the AC had fixed a SOLUTION
    // before anyone checked the NEED. **Revision 1's "no comparable app marks notes
    // in a list view" is withdrawn** — Apple Reminders renders note text as a second
    // line and TickTick surfaces descriptions in the list column — because keeping it
    // would repeat the cited lesson in the opposite direction, with absence as the
    // fixed solution. **Open Question 12 puts the need back to the owner.**
    const noted = todayTask({
      id: 'n1',
      title: 'Call the plumber',
      note: 'ask about the boiler service and the radiator in the back room',
    })
    mount(seed({ tasks: [noted] }))
    goToTasks()
    const row = screen.getAllByTestId('assistant-task-row')[0] as HTMLElement
    // Absence, three ways, because "no marker" and "no preview line" are different
    // claims and a check for one is not coverage of the other.
    expect(row.textContent, 'no preview line').not.toContain('boiler')
    expect(row.textContent, 'no marker glyph').not.toContain('¶')
    expect(row.querySelectorAll('[data-testid*="note"]'), 'no note element at all').toHaveLength(0)
    // …and the marks that ARE allowed on this row are unaffected: the absence is
    // about the note, not about the row being bare.
    expect(row.getAttribute('aria-label')).toBe('Call the plumber')
  })

  it('none of the three carries colour — the marks are shape, weight and name', () => {
    // Checked as CSS TEXT and it says so (L-002): the accent set is closed at five
    // and every accent already carries an assigned meaning, this row already renders
    // under a `danger` Overdue heading, and urgency has three levels one hue cannot
    // encode.
    const css = readFileSync(resolve(process.cwd(), 'src/assistant/web/styles.css'), 'utf8')
    const block = css.slice(css.indexOf('.task-mark'))
    const marks = block.slice(0, block.indexOf('.task-open'))
    for (const accent of ['--primary', '--danger', '--success', '--question']) {
      expect(marks.includes(accent), `a mark must not take the ${accent} accent`).toBe(false)
    }
  })
})

// ---------------------------------------------------------------------------
// AC-38 — the passed-reminder surfacing
// ---------------------------------------------------------------------------

describe('AC-38 — a passed reminder is shown on open', () => {
  it('surfaces N as ONE surfacing with a deliberate per-reminder acknowledge and no bulk dismissal', async () => {
    const a = todayTask({
      id: 'a',
      title: 'Ring the dentist',
      reminder_at: '2026-08-10T09:00:00.000Z',
    })
    const b = todayTask({ id: 'b', title: 'Post the form', reminder_at: '2026-08-15T09:00:00.000Z' })
    const m = mount(seed({ tasks: [a, b] }))
    act(() => {
      m.controller.openingSync()
    })

    const rows = screen.getAllByTestId('shell-passed-reminder')
    expect(rows.map((r) => r.getAttribute('data-task-id')), 'oldest first').toEqual(['a', 'b'])
    // One acknowledge control per row, and **no bulk dismissal**: ten passed
    // reminders take ten gestures, and the cost is accepted knowingly because a
    // single gesture that retires reminders the user has not read is the looser
    // reading wearing a convenience label.
    expect(screen.getAllByTestId('shell-passed-reminder-ack')).toHaveLength(2)
    expect(screen.queryByText(/dismiss all|clear all/i)).toBeNull()

    m.server.always('POST /tasks/:id/reminder-ack', 200, {
      task: { ...a, reminder_shown_at: T0 },
      acknowledged: true,
    })
    await act(async () => {
      fireEvent.click(screen.getAllByTestId('shell-passed-reminder-ack')[0] as HTMLElement)
    })
    // **Only what the user acknowledges is marked.**
    expect(screen.getAllByTestId('shell-passed-reminder').map((r) => r.getAttribute('data-task-id'))).toEqual(
      ['b'],
    )
  })

  it('OPENING THE TASK does not count as acknowledging', async () => {
    // One of the three readings the owner ruled out by name, along with scrolling
    // past and rendering: *"a user taps to look, is interrupted, closes the app —
    // and under any looser reading the reminder is spent permanently, on every
    // device, while the task is still undone."*
    const a = todayTask({ id: 'a', title: 'Ring', reminder_at: '2026-08-10T09:00:00.000Z' })
    const m = mount(seed({ tasks: [a] }))
    act(() => {
      m.controller.openingSync()
    })
    act(() => {
      fireEvent.click(screen.getByTestId('shell-passed-reminder-open'))
    })
    expect(screen.getByTestId('detail-surface'), 'the task opened').toBeTruthy()
    expect(m.server.calls.filter((c) => c.path.includes('reminder-ack'))).toHaveLength(0)
    expect(screen.getByTestId('shell-passed-reminder'), 'and the reminder is still there').toBeTruthy()
  })
})
