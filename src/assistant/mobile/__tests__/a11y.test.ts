// F-003 AC-12 — accessibility identity and screen-reader announcements.
//
// Two halves, both node-testable:
//   the CATALOGUE — the 22 ids are parsed out of both mobile mockups and
//   compared with the constants the components render from, in BOTH directions
//   (nothing missing, nothing invented). Parsing rather than hand-listing is
//   L-002's lesson: a hand-copied list turns a contract check into a
//   self-agreement check.
//
//   the ANNOUNCEMENTS — every conversation message announces what changed, how
//   many, which tasks by title, and whether undo is available. Announcing the
//   state word alone does not satisfy AC-12, so the assertions are about
//   content, not about a call having been made.
//
// What this tier CANNOT claim, and does not: that VoiceOver and TalkBack
// actually speak these strings on a device. That is device-lab debt, listed as
// such in the spec's Test strategy.

import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { initialState, reducer } from '../../_shared/model/reducer.ts'
import type { AppState } from '../../_shared/model/reducer.ts'
import type { Message } from '../../_shared/types.ts'
import { announcementFor, announcementsFor } from '../model/announce.ts'
import { A11Y_IDS, ALL_A11Y_IDS, a11yProps, expectedIds, identityAttribute } from '../model/a11y.ts'
import type { A11yId } from '../model/a11y.ts'
import { appliedTurn, mobileHarness, settle, task, turnResponse } from './_helpers.ts'

const ROOT = resolve(import.meta.dirname, '../../../..')

function catalogueOf(file: string, attr: string): Set<string> {
  const html = readFileSync(resolve(ROOT, file), 'utf8')
  const ids = new Set<string>()
  for (const m of html.matchAll(new RegExp(`${attr}="([^"]+)"`, 'g'))) {
    const id = m[1]
    if (id !== undefined) ids.add(id)
  }
  return ids
}

const sorted = (s: Iterable<string>) => [...s].sort()

describe('AC-12 — one catalogue, three attribute spellings', () => {
  const ios = catalogueOf(
    'design/assistant/screens/voice-assistant-view-ios.html',
    'accessibilityIdentifier',
  )
  // The Android mockup carries identity on `resource-id`, NOT on
  // contentDescription — its header states why: contentDescription is what
  // TalkBack speaks, so an id parked there would be read aloud instead of the
  // message (F-003 AC-12 vs F-001 AC-19). React Native's `testID` surfaces as
  // accessibilityIdentifier on iOS and resource-id on Android, which is how one
  // catalogue reaches both platforms.
  const android = catalogueOf(
    'design/assistant/screens/voice-assistant-view-android.html',
    'resource-id',
  )
  const web = catalogueOf('design/assistant/screens/voice-assistant-view.html', 'data-testid')

  it('the mockups declare 22 ids and both mobile platforms carry the same values', () => {
    expect(sorted(ios)).toHaveLength(22)
    expect(sorted(android)).toEqual(sorted(ios))
  })

  it('mobile does not fork the web catalogue (AC-1)', () => {
    expect(sorted(ios)).toEqual(sorted(web))
  })

  it('the constants the components render from match the mockups exactly — none missing, none invented', () => {
    const declared = new Set<string>(ALL_A11Y_IDS)
    expect(sorted([...ios].filter((id) => !declared.has(id)))).toEqual([]) // missing
    expect(sorted([...declared].filter((id) => !ios.has(id)))).toEqual([]) // invented
  })

  it('the id reaches iOS as accessibilityIdentifier and Android as the view resource-id', () => {
    expect(identityAttribute('ios')).toBe('accessibilityIdentifier')
    expect(identityAttribute('android')).toBe('resource-id')

    const props = a11yProps(A11Y_IDS.micButton, { label: 'Nhấn để nói', role: 'button' })
    expect(props.testID).toBe('assistant-mic-button')
    // WCAG 2.5.3 label-in-name (F-001 AC-19, held in force by the parity
    // table): the *human* label is what a screen reader announces.
    expect(props.accessibilityLabel).toBe('Nhấn để nói')
  })
})

// ---------------------------------------------------------------------------
// Which ids the surface shows, state by state
// ---------------------------------------------------------------------------

function stateWith(messages: Message[], over: Partial<AppState> = {}): AppState {
  const base = initialState('available')
  return { ...base, sessionId: 'sess-1', messages, ...over }
}

let seq = 0
function msg<T extends Message>(m: Omit<T, 'id'>): T {
  seq += 1
  return { ...(m as object), id: `m${seq}` } as T
}

const AT = '2026-08-16T14:04:00.000Z'

const STATES: { name: string; state: AppState; ctx: { tasksVisible: boolean; hasTasks: boolean } }[] =
  [
    {
      name: 'idle-empty',
      state: stateWith([]),
      ctx: { tasksVisible: true, hasTasks: false },
    },
    {
      name: 'idle-with-tasks',
      state: stateWith([], { tasks: [task()] }),
      ctx: { tasksVisible: true, hasTasks: true },
    },
    {
      name: 'listening',
      state: stateWith([], { surface: 'listening' }),
      ctx: { tasksVisible: true, hasTasks: false },
    },
    {
      name: 'thinking',
      state: stateWith([], { surface: 'thinking' }),
      ctx: { tasksVisible: true, hasTasks: false },
    },
    {
      name: 'applied-with-diff-and-undo',
      state: stateWith(
        [
          msg<Extract<Message, { kind: 'applied' }>>({
            kind: 'applied',
            turnId: 'turn-1',
            head: 'Đã sửa 1 việc',
            lines: [
              {
                taskId: 'task-1',
                title: 'Duyệt ngân sách Q3',
                label: 'edit',
                chips: [{ field: 'due_at', old: '14:00', new: '16:00' }],
              },
            ],
            deletedTitles: [],
            mutated: true,
            undone: false,
            at: AT,
          }),
        ],
        {
          tasks: [task()],
          marks: {
            turnId: 'turn-1',
            byTask: {
              'task-1': {
                taskId: 'task-1',
                title: 'Duyệt ngân sách Q3',
                label: 'edit',
                chips: [{ field: 'due_at', old: '14:00', new: '16:00' }],
              },
            },
          },
        },
      ),
      ctx: { tasksVisible: true, hasTasks: true },
    },
    {
      name: 'question-confirm',
      state: stateWith([
        msg<Extract<Message, { kind: 'question' }>>({
          kind: 'question',
          turnId: 'turn-2',
          qkind: 'bulk_delete',
          head: 'Xóa 3 việc?',
          body: 'Sẽ xóa: Đi chợ, Đặt bánh, Lấy đồ.',
          options: ['Xóa 3 việc', 'Giữ lại'],
          taskTitles: ['Đi chợ', 'Đặt bánh', 'Lấy đồ'],
          resolved: false,
          at: AT,
        }),
      ]),
      ctx: { tasksVisible: true, hasTasks: false },
    },
    {
      name: 'question-clarify',
      state: stateWith([
        msg<Extract<Message, { kind: 'question' }>>({
          kind: 'question',
          turnId: 'turn-3',
          qkind: 'clarify',
          head: '“Cuộc họp” khớp với hai việc — việc nào?',
          body: null,
          options: ['Họp nhanh đầu ngày — 9:30', '1:1 với Hà — 16:30'],
          taskTitles: ['Họp nhanh đầu ngày', '1:1 với Hà'],
          resolved: false,
          at: AT,
        }),
      ]),
      ctx: { tasksVisible: true, hasTasks: false },
    },
    {
      name: 'error-with-retry',
      state: stateWith(
        [
          msg<Extract<Message, { kind: 'error' }>>({
            kind: 'error',
            head: 'Chưa gửi được',
            body: ['Trợ lý chưa xử lý được lời bạn vừa gửi.'],
            retryTurnId: 'cid-1',
            at: AT,
          }),
        ],
        { surface: 'error' },
      ),
      ctx: { tasksVisible: true, hasTasks: false },
    },
    {
      name: 'offline-queued',
      state: stateWith(
        [
          msg<Extract<Message, { kind: 'user' }>>({
            kind: 'user',
            text: 'đánh dấu tiền điện đã xong',
            via: 'voice',
            at: AT,
            queued: true,
            clientTurnId: 'cid-9',
          }),
        ],
        { offline: true, queuedTurnId: 'cid-9' },
      ),
      ctx: { tasksVisible: true, hasTasks: false },
    },
    {
      name: 'boundary',
      state: stateWith(
        [
          msg<Extract<Message, { kind: 'boundary' }>>({
            kind: 'boundary',
            head: 'Phiên đã kết thúc — để lâu không dùng',
            lines: ['Đóng phiên nên bỏ qua: “Xóa 3 việc?”'],
            at: AT,
          }),
        ],
        { sessionId: null },
      ),
      ctx: { tasksVisible: true, hasTasks: false },
    },
    {
      name: 'mic-permission',
      state: stateWith(
        [
          msg<Extract<Message, { kind: 'info' }>>({
            kind: 'info',
            head: 'Micro cần quyền truy cập',
            body: ['Quyền Micro đang tắt.'],
            cta: 'permission',
            at: AT,
          }),
        ],
        { capability: 'permission-denied' },
      ),
      ctx: { tasksVisible: true, hasTasks: false },
    },
    {
      name: 'mic-hidden',
      state: stateWith([], { capability: 'none' }),
      ctx: { tasksVisible: true, hasTasks: false },
    },
  ]

describe('AC-12 — every catalogue id is reachable, and the surface invents none', () => {
  it('the enumerated surface states between them show all 22 ids', () => {
    const seen = new Set<A11yId>()
    for (const { state, ctx } of STATES) {
      for (const id of expectedIds(state, ctx)) seen.add(id)
    }
    const declared = new Set<A11yId>(ALL_A11Y_IDS)
    expect(sorted([...declared].filter((id) => !seen.has(id)))).toEqual([])
    expect(sorted([...seen].filter((id) => !declared.has(id)))).toEqual([])
  })

  it('the mic disappears — never merely dims — when the device has no capability', () => {
    const hidden = STATES.find((s) => s.name === 'mic-hidden')
    const dimmed = STATES.find((s) => s.name === 'mic-permission')
    expect(expectedIds(hidden!.state, hidden!.ctx).has(A11Y_IDS.micButton)).toBe(false)
    expect(expectedIds(dimmed!.state, dimmed!.ctx).has(A11Y_IDS.micButton)).toBe(true)
  })

  it('the state indicator and its Cancel exist exactly while listening / thinking (F-001 AC-29)', () => {
    for (const { name, state, ctx } of STATES) {
      const ids = expectedIds(state, ctx)
      const shouldIndicate = state.surface === 'listening' || state.surface === 'thinking'
      expect(ids.has(A11Y_IDS.stateIndicator), `${name} indicator`).toBe(shouldIndicate)
      expect(ids.has(A11Y_IDS.cancelButton), `${name} cancel`).toBe(state.surface === 'thinking')
    }
  })

  it('exactly one Undo affordance, on the newest still-undoable applied turn (F-001 AC-5/AC-8)', () => {
    const s = STATES.find((x) => x.name === 'applied-with-diff-and-undo')!
    expect(expectedIds(s.state, s.ctx).has(A11Y_IDS.undoButton)).toBe(true)

    // a newer mutating applied turn takes the affordance over
    const newer = reducer(s.state, {
      type: 'append',
      messages: [
        {
          kind: 'applied',
          turnId: 'turn-9',
          head: 'Đã thêm 1 việc',
          lines: [],
          deletedTitles: [],
          mutated: true,
          undone: false,
          at: AT,
        },
      ],
    })
    const undoTargets = newer.messages.filter(
      (m) => m.kind === 'applied' && m.mutated && !m.undone,
    )
    expect(undoTargets).toHaveLength(2) // both bubbles exist…
    expect(expectedIds(newer, s.ctx).has(A11Y_IDS.undoButton)).toBe(true) // …one button
  })
})

describe('AC-12 — every catalogue id is actually wired into a component', () => {
  // A SOURCE SCAN, and labelled as one. The components are React Native, so
  // this node tier cannot render them (platform mobile.md: "Unit tier = model
  // + ports") — the executable observable is QA's device automation. What this
  // check does buy is the one failure a source scan can see honestly: an id
  // that exists in the catalogue and is referenced by NO component, i.e. an
  // element nobody built. L-002's caution applies in the other direction: a
  // PASS here is not proof the element renders, and is not reported as such.
  const sources = readdirSync(resolve(ROOT, 'src/assistant/mobile/components'))
    .filter((f) => f.endsWith('.tsx'))
    .map((f) => readFileSync(resolve(ROOT, 'src/assistant/mobile/components', f), 'utf8'))
    .join('\n')

  it('each of the 22 ids is referenced by name from a component', () => {
    const unwired = Object.entries(A11Y_IDS)
      .filter(([key]) => !sources.includes(`A11Y_IDS.${key}`))
      .map(([, id]) => id)
    expect(unwired).toEqual([])
  })

  it('components reference ids through the catalogue constants, never as literals', () => {
    // A literal would be an id the catalogue check cannot police.
    const literals = Object.values(A11Y_IDS).filter((id) => sources.includes(`'${id}'`))
    expect(literals).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Announcements
// ---------------------------------------------------------------------------

describe('AC-12 — announcements carry the content, not the state word', () => {
  it('an applied turn announces what changed, how many, which task by title, and that undo exists', () => {
    const applied = STATES.find((s) => s.name === 'applied-with-diff-and-undo')!.state
      .messages[0] as Message
    const a = announcementFor(applied, { undoAvailable: true })
    expect(a?.text).toContain('Đã sửa 1 việc')
    expect(a?.text).toContain('Duyệt ngân sách Q3')
    expect(a?.text).toContain('14:00')
    expect(a?.text).toContain('16:00')
    expect(a?.text).toContain('Hoàn tác')
    expect(a?.assertive).toBe(false)
  })

  it('says so honestly when the undo window has already passed', () => {
    const applied = STATES.find((s) => s.name === 'applied-with-diff-and-undo')!.state
      .messages[0] as Message
    const a = announcementFor(applied, { undoAvailable: false })
    expect(a?.text).toContain('không hoàn tác được nữa')
  })

  it('a question announces its count, its titles and its options', () => {
    const q = STATES.find((s) => s.name === 'question-confirm')!.state.messages[0] as Message
    const a = announcementFor(q, { undoAvailable: false })
    expect(a?.text).toContain('Xóa 3 việc?')
    expect(a?.text).toContain('Đi chợ')
    expect(a?.text).toContain('Giữ lại')
  })

  it('errors are assertive and are announced ahead of politely-queued output', () => {
    const err = STATES.find((s) => s.name === 'error-with-retry')!.state.messages[0] as Message
    const info = STATES.find((s) => s.name === 'mic-permission')!.state.messages[0] as Message
    const out = announcementsFor([info, err], null)
    expect(out[0]?.assertive).toBe(true)
    expect(out[0]?.text).toContain('Chưa gửi được')
    expect(out[1]?.assertive).toBe(false)
  })

  it('every message kind the conversation can add announces something', () => {
    const kinds = new Set<string>()
    for (const { state } of STATES) {
      for (const m of state.messages) {
        kinds.add(m.kind)
        const a = announcementFor(m, { undoAvailable: false })
        if (m.kind === 'user' && !m.queued) {
          expect(a, 'an un-queued user turn is an echo, not news').toBe(null)
          continue
        }
        expect(a, `${m.kind} announces nothing`).not.toBe(null)
        expect(a?.text.length, `${m.kind} announcement is empty`).toBeGreaterThan(10)
      }
    }
    // the enumeration actually covered the interesting kinds
    for (const kind of ['applied', 'question', 'error', 'boundary', 'info', 'user']) {
      expect(kinds, `no state exercises ${kind}`).toContain(kind)
    }
  })

  it('a queued turn announces the wait — it is news, unlike an ordinary echo', () => {
    const queued = STATES.find((s) => s.name === 'offline-queued')!.state.messages[0] as Message
    const a = announcementFor(queued, { undoAvailable: false })
    expect(a?.text).toContain('Đang chờ mạng')
  })
})

describe('AC-12 — the controller announces as messages arrive', () => {
  it('announces a new outcome, and does not re-read restored history on every foreground', async () => {
    const h = await mobileHarness({ platform: 'ios' })
    h.server.always('POST /assistant/turn', 200, turnResponse({ turn: appliedTurn() }))
    await h.controller.init()
    h.announcer.clear()

    h.controller.composerChange('dời họp sang 4 giờ')
    await h.controller.send('typed')
    await settle()

    expect(h.announcer.texts().join(' ')).toContain('Đã sửa 1 việc')
    const afterTurn = h.announcer.announcements.length

    // resume: the same history is re-rendered from the server read…
    h.lifecycle.foreground()
    await settle()
    // …and is NOT read out again
    expect(h.announcer.announcements.length).toBe(afterTurn)
  })

  it('announces an error immediately, flagged assertive', async () => {
    const h = await mobileHarness({ platform: 'android' })
    h.server.always('POST /assistant/turn', 502, {
      error: { code: 'AI_ERROR', message: 'interpreter unavailable' },
    })
    await h.controller.init()
    h.announcer.clear()

    h.controller.composerChange('dời buổi tập gym')
    await h.controller.send('typed')
    await settle()

    const assertive = h.announcer.announcements.filter((a) => a.assertive)
    expect(assertive).toHaveLength(1)
    expect(assertive[0]?.text).toContain('Chưa gửi được')
  })
})
