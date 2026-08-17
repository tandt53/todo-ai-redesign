// @vitest-environment jsdom
//
// Component tests — the rendered surface.
//
// The headline assertion is the testid contract: the design mockup carries a
// 22-id catalogue, the QA page object binds to those ids and nothing else, and
// a dropped or renamed id is a `layer: web` bug. So the catalogue is READ FROM
// THE MOCKUP at test time and compared against what the app actually renders
// across all 17 mockup states — no hand-copied list to drift.

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
import type { SpeechCapability } from '../../_shared/ports/transcript-source.ts'
import { appliedTurn, askedTurn, harness, session, T0, task, turnResponse } from './_helpers.ts'

afterEach(cleanup)

// jsdom rewrites import.meta.url to an http URL, so resolve from the vitest
// root instead — the mockup is the contract and must really be read.
const MOCKUP = resolve(process.cwd(), 'design/assistant/screens/voice-assistant-view.html')

/** The contract, straight from the design mockup — never hand-copied. */
function catalogue(): Set<string> {
  const html = readFileSync(MOCKUP, 'utf8')
  return new Set([...html.matchAll(/data-testid="([^"]+)"/g)].map((m) => m[1] as string))
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

function mount(state: AppState): { controller: AssistantController; container: HTMLElement } {
  const h = harness({ capability: state.capability })
  h.controller.state = state
  const { container } = render(<App controller={h.controller} />)
  return { controller: h.controller, container }
}

const TASKS = [
  task({ id: 'task-1', title: 'Review Q3 budget draft', due_at: '2026-08-16T09:00:00.000Z' }),
  task({ id: 'task-2', title: 'Pay electricity bill' }),
  task({ id: 'task-3', title: 'Team standup', status: 'done' }),
]

const appliedMsg: NewMsg = {
  kind: 'applied',
  turnId: 'turn-1',
  head: 'Đã sửa 1 việc · thêm 1',
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

/** The mockup's 17 states, rebuilt as real app state. */
const STATES: { name: string; state: AppState }[] = [
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
        head: 'Xóa 3 việc?',
        body: 'Sẽ xóa: Buy groceries for the week, Order birthday cake, Pick up dry cleaning.',
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
        head: 'Có 2 việc khớp — bạn muốn việc nào?',
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
        head: 'Xóa 3 việc?',
        body: 'Sẽ xóa: Buy groceries for the week, Order birthday cake, Pick up dry cleaning.',
        options: ['Yes', 'No'],
        taskTitles: ['Buy groceries for the week', 'Order birthday cake', 'Pick up dry cleaning'],
        resolved: true,
        at: T0,
      },
      userMsg('add call the bank tomorrow at 9'),
      {
        kind: 'outcome',
        head: 'Đã giữ nguyên 3 việc',
        body: ['Việc xóa được bỏ qua vì bạn đã chuyển sang chuyện khác. Không có gì bị xóa.'],
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
        head: 'Đã hoàn tác — trừ 1 việc',
        body: [
          'Đã bỏ: Pick up birthday cake.',
          'Bỏ qua: Review Q3 budget draft — việc này đã thay đổi sau đó nên tôi giữ nguyên.',
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
        head: 'Không hoàn tác được gì',
        body: ['Mọi việc của lần đó đều đã thay đổi sau đấy: Review Q3 budget draft. Chúng được giữ nguyên.'],
        at: T0,
      },
      userMsg('undo'),
      {
        kind: 'outcome',
        head: null,
        body: ['Không có gì để hoàn tác — phiên này chưa có thay đổi nào được áp dụng.'],
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
        head: 'Chưa gửi được',
        body: [
          'Trợ lý chưa xử lý được lời bạn vừa gửi. Chưa có gì thay đổi — lời của bạn vẫn được giữ bên dưới.',
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
    name: 'boundary',
    state: seed({ sessionId: null, tasks: TASKS }, [
      {
        kind: 'boundary',
        head: 'Phiên đã kết thúc — để lâu không dùng · Fri 11:42 PM',
        lines: [
          'Đóng phiên nên bỏ qua: “Xóa 3 việc?” — vẫn giữ Buy groceries for the week.',
          'Trong lúc bạn vắng mặt: đã thêm “Call the bank”.',
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
          head: 'Micro cần quyền truy cập',
          body: ['Trình duyệt đang chặn micro cho trang này.', 'Gõ chữ vẫn dùng được như thường.'],
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
          head: 'Nhận dạng giọng nói đang bận',
          body: ['Dịch vụ nhận dạng chưa phản hồi lúc này.', 'Gõ chữ vẫn dùng được như thường.'],
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
  it('renders all 17 mockup states', () => {
    expect(STATES).toHaveLength(17)
    for (const { name, state } of STATES) {
      const { container } = mount(state)
      expect(container.querySelector('.app'), name).not.toBeNull()
      cleanup()
    }
  })

  it('applies every one of the mockup’s testids across the states, and invents none', () => {
    const expected = catalogue()
    expect(expected.size).toBe(22)

    const seen = new Set<string>()
    for (const { state } of STATES) {
      const { container } = mount(state)
      for (const id of renderedTestids(container)) seen.add(id)
      cleanup()
    }

    const missing = [...expected].filter((id) => !seen.has(id)).sort()
    const invented = [...seen].filter((id) => !expected.has(id)).sort()
    expect(missing).toEqual([])
    expect(invented).toEqual([])
  })

  it('exposes the state indicator only while listening or thinking (AC-29)', () => {
    for (const { name, state } of STATES) {
      const { container } = mount(state)
      const indicator = container.querySelector('[data-testid="assistant-state-indicator"]')
      const shouldShow = state.surface === 'listening' || state.surface === 'thinking'
      expect(indicator !== null, `${name} indicator`).toBe(shouldShow)
      if (state.surface === 'listening') expect(indicator?.textContent).toContain('Đang nghe')
      if (state.surface === 'thinking') expect(indicator?.textContent).toContain('Đang xử lý')
      // the thinking-state Cancel pill exists exactly when thinking does (AC-3)
      const cancel = container.querySelector('[data-testid="assistant-cancel-button"]')
      expect(cancel !== null, `${name} cancel`).toBe(state.surface === 'thinking')
      cleanup()
    }
  })

  it('never renders a raw uuid or a draft-ref token (AC-4)', () => {
    for (const { name, state } of STATES) {
      const { container } = mount(state)
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
    for (const { name, state } of STATES) {
      const { container } = mount(state)
      const text = container.textContent ?? ''
      expect(text, `${name}: leaked "turn"`).not.toMatch(/\bturns?\b/i)
      cleanup()
    }
  })

  it('keeps the composer usable in every state — it is never disabled (AC-11, AC-24, AC-25)', () => {
    for (const { name, state } of STATES) {
      mount(state)
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
    expect(screen.getByTestId('assistant-row-badge').textContent).toBe('Đã sửa')
  })

  it('undone: the bubble is marked and the Undo affordance is gone (AC-6)', () => {
    mount(byName('reverted'))
    expect(screen.queryByTestId('assistant-undo-button')).toBeNull()
    expect(screen.getByText('Đã hoàn tác')).toBeTruthy()
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
    expect(screen.getByText('Đã giữ nguyên 3 việc')).toBeTruthy()
  })

  it('no-match quotes the heard transcript verbatim (AC-14)', () => {
    mount(byName('no-match'))
    expect(screen.getByText('“cross off the badminton game”')).toBeTruthy()
  })

  it('nothing-reverted never reads as a success (AC-7)', () => {
    mount(byName('nothing-reverted'))
    expect(screen.getByText('Không hoàn tác được gì')).toBeTruthy()
    expect(screen.queryByText(/^Đã hoàn tác/)).toBeNull()
  })

  it('offline hands over to the list and shows the queued turn (AC-25)', () => {
    mount(byName('offline'))
    const banner = screen.getByTestId('assistant-offline-banner')
    expect(banner.textContent).toMatch(/danh sách vẫn dùng được/i)
    expect(banner.textContent).toMatch(/1 câu đang chờ gửi/)
    expect(screen.getByTestId('assistant-queued-notice').textContent).toMatch(/sẽ gửi lại/i)
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
    expect(screen.queryByText(/lỗi|error/i)).toBeNull()
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
    for (const { name, state } of STATES) {
      const { container } = mount(state)
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
    for (const { name, state } of STATES) {
      const { container } = mount(state)
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

  it('2.5.3 — the accessible name contains the visible label', () => {
    for (const { name, state } of STATES) {
      const { container } = mount(state)
      for (const el of interactive(container)) {
        const visible = (el.textContent ?? '').trim().toLowerCase()
        if (visible === '') continue
        const accName = (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().toLowerCase()
        expect(accName, `${name}: “${visible}”`).toContain(visible)
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
      ['applied-diff', 'Đã sửa 1 việc · thêm 1'],
      ['declined-superseded', 'Đã giữ nguyên 3 việc'],
      ['nothing-reverted', 'Không hoàn tác được gì'],
      ['no-match', 'cross off the badminton game'],
      ['error', 'Chưa gửi được'],
      ['boundary', 'Phiên đã kết thúc'],
      ['question-confirm', 'Xóa 3 việc?'],
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
    expect(within(bubble).getByText('Đã sửa')).toBeTruthy()
    expect(within(bubble).getByText('Mới')).toBeTruthy()
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
    expect(screen.getByTestId('assistant-state-indicator').textContent).toContain('Đang nghe')

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
    expect(screen.getByTestId('assistant-state-indicator').textContent).toContain('Đang xử lý')
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
    expect(within(bubbles[0] as HTMLElement).getByText('Đã hoàn tác')).toBeTruthy()
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

    await act(async () => {
      fireEvent.click(screen.getByTestId('assistant-add-task-button'))
    })
    const field = screen.getByLabelText('Tên việc mới')
    await act(async () => {
      fireEvent.change(field, { target: { value: 'Buy milk' } })
    })
    await act(async () => {
      fireEvent.keyDown(field, { key: 'Enter' })
    })

    expect(h.server.calls.some((c) => c.method === 'POST' && c.path === '/tasks')).toBe(true)
    expect(h.server.assistantCalls()).toHaveLength(assistantBefore)
  })

  it('the drawer stays reachable and switches the list filter (OQ-1)', async () => {
    const h = harness()
    h.server
      .always('GET /assistant/session', 200, { session: session(), boundary: null })
      .always('GET /tasks', 200, { tasks: TASKS })
    await act(async () => {
      await h.controller.init()
    })
    render(<App controller={h.controller} />)

    expect(screen.getAllByTestId('assistant-task-row').length).toBe(3)
    await act(async () => {
      fireEvent.click(screen.getByTestId('assistant-drawer-button'))
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Đã xong' }))
    })
    expect(screen.getAllByTestId('assistant-task-row').length).toBe(1)
  })
})
