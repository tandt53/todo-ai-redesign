// F-003 AC-12 — accessibility identity and screen-reader announcements.
//
// Two halves, both node-testable:
//   the CATALOGUE — the 23 ids are parsed out of both mobile mockups and
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
import {
  A11Y_IDS,
  ALL_A11Y_IDS,
  ALL_SHELL_A11Y_IDS,
  RETIRED_A11Y_IDS,
  SHELL_A11Y_IDS,
  SHELL_IDS_BLOCKED,
  SHELL_IDS_AWAITING_MOCKUP,
  SHELL_IDS_AHEAD_OF_DESIGN,
  SHELL_IDS_RETIRED_FROM_CLIENT,
  a11yProps,
  expectedIds,
  expectedShellIds,
  identityAttribute,
} from '../model/a11y.ts'
import type { A11yId, ShellA11yId, SurfaceContext } from '../model/a11y.ts'
import { initialShellState } from '../model/shell.ts'
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
    'docs/design/assistant/screens/voice-assistant-view-ios.html',
    'accessibilityIdentifier',
  )
  // The Android mockup carries identity on `resource-id`, NOT on
  // contentDescription — its header states why: contentDescription is what
  // TalkBack speaks, so an id parked there would be read aloud instead of the
  // message (F-003 AC-12 vs F-001 AC-19). React Native's `testID` surfaces as
  // accessibilityIdentifier on iOS and resource-id on Android, which is how one
  // catalogue reaches both platforms.
  const android = catalogueOf(
    'docs/design/assistant/screens/voice-assistant-view-android.html',
    'resource-id',
  )
  const web = catalogueOf('docs/design/assistant/screens/voice-assistant-view.html', 'data-testid')

  // 23 since F-001 AC-30 / BUG-004 published `assistant-new-message-affordance`
  // (docs/design/_shared/components.md § NewMessageAffordance, "one id on the control
  // in all three mockups"). The literal is here on purpose: it is the tripwire
  // that makes a catalogue change arrive as a decision rather than as a silent
  // widening of every set comparison below.
  it('the mockups declare 23 ids and both mobile platforms carry the same values', () => {
    expect(sorted(ios)).toHaveLength(23)
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

    const props = a11yProps(A11Y_IDS.micButton, { label: 'Tap to speak', role: 'button' })
    expect(props.testID).toBe('assistant-mic-button')
    // WCAG 2.5.3 label-in-name (F-001 AC-19, held in force by the parity
    // table): the *human* label is what a screen reader announces.
    expect(props.accessibilityLabel).toBe('Tap to speak')
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

const STATES: { name: string; state: AppState; ctx: SurfaceContext }[] =
  [
    {
      name: 'idle-empty',
      state: stateWith([]),
      ctx: { tasksVisible: true, hasTasks: false, unseenBelowFold: 0 },
    },
    {
      name: 'idle-with-tasks',
      state: stateWith([], { tasks: [task()] }),
      ctx: { tasksVisible: true, hasTasks: true, unseenBelowFold: 0 },
    },
    {
      name: 'listening',
      state: stateWith([], { surface: 'listening' }),
      ctx: { tasksVisible: true, hasTasks: false, unseenBelowFold: 0 },
    },
    {
      name: 'thinking',
      state: stateWith([], { surface: 'thinking' }),
      ctx: { tasksVisible: true, hasTasks: false, unseenBelowFold: 0 },
    },
    {
      name: 'applied-with-diff-and-undo',
      state: stateWith(
        [
          msg<Extract<Message, { kind: 'applied' }>>({
            kind: 'applied',
            turnId: 'turn-1',
            head: 'Edited 1 task',
            lines: [
              {
                taskId: 'task-1',
                title: 'Budget review Q3',
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
                title: 'Budget review Q3',
                label: 'edit',
                chips: [{ field: 'due_at', old: '14:00', new: '16:00' }],
              },
            },
          },
        },
      ),
      ctx: { tasksVisible: true, hasTasks: true, unseenBelowFold: 0 },
    },
    {
      name: 'question-confirm',
      state: stateWith([
        msg<Extract<Message, { kind: 'question' }>>({
          kind: 'question',
          turnId: 'turn-2',
          qkind: 'bulk_delete',
          head: 'Delete 3 tasks?',
          body: 'Will delete: Groceries, Order the cake, Pick up parcel.',
          options: ['Delete 3 tasks', 'Keep them'],
          taskTitles: ['Groceries', 'Order the cake', 'Pick up parcel'],
          resolved: false,
          at: AT,
        }),
      ]),
      ctx: { tasksVisible: true, hasTasks: false, unseenBelowFold: 0 },
    },
    {
      name: 'question-clarify',
      state: stateWith([
        msg<Extract<Message, { kind: 'question' }>>({
          kind: 'question',
          turnId: 'turn-3',
          qkind: 'clarify',
          head: '“Standup” matches two tasks — which one?',
          body: null,
          options: ['Morning standup — 9:30', '1:1 with Ha — 16:30'],
          taskTitles: ['Morning standup', '1:1 with Ha'],
          resolved: false,
          at: AT,
        }),
      ]),
      ctx: { tasksVisible: true, hasTasks: false, unseenBelowFold: 0 },
    },
    {
      name: 'error-with-retry',
      state: stateWith(
        [
          msg<Extract<Message, { kind: 'error' }>>({
            kind: 'error',
            head: 'Not sent yet',
            body: ['The assistant could not handle what you just sent.'],
            retryTurnId: 'cid-1',
            at: AT,
          }),
        ],
        { surface: 'error' },
      ),
      ctx: { tasksVisible: true, hasTasks: false, unseenBelowFold: 0 },
    },
    {
      name: 'offline-queued',
      state: stateWith(
        [
          msg<Extract<Message, { kind: 'user' }>>({
            kind: 'user',
            text: 'mark the electricity bill done',
            via: 'voice',
            at: AT,
            queued: true,
            clientTurnId: 'cid-9',
          }),
        ],
        { offline: true, queuedTurnId: 'cid-9' },
      ),
      ctx: { tasksVisible: true, hasTasks: false, unseenBelowFold: 0 },
    },
    {
      name: 'boundary',
      state: stateWith(
        [
          msg<Extract<Message, { kind: 'boundary' }>>({
            kind: 'boundary',
            head: 'Session ended — idle too long',
            lines: ['Closing skipped: “Delete 3 tasks?”'],
            at: AT,
          }),
        ],
        { sessionId: null },
      ),
      ctx: { tasksVisible: true, hasTasks: false, unseenBelowFold: 0 },
    },
    {
      name: 'mic-permission',
      state: stateWith(
        [
          msg<Extract<Message, { kind: 'info' }>>({
            kind: 'info',
            head: 'Microphone needs permission',
            body: ['Microphone permission is off.'],
            cta: 'permission',
            at: AT,
          }),
        ],
        { capability: 'permission-denied' },
      ),
      ctx: { tasksVisible: true, hasTasks: false, unseenBelowFold: 0 },
    },
    {
      name: 'mic-hidden',
      state: stateWith([], { capability: 'none' }),
      ctx: { tasksVisible: true, hasTasks: false, unseenBelowFold: 0 },
    },
    // The two F-001 AC-30 states, named after the mockup states that depict
    // them (`nma-new` / `nma-waiting` — the state names ARE the row IDs). Both
    // are the same conversation seen from a viewport that is not at the bottom:
    // the difference is what arrived below the fold, which is the whole of
    // clause (e).
    {
      name: 'nma-new',
      state: stateWith([
        msg<Extract<Message, { kind: 'outcome' }>>({
          kind: 'outcome',
          head: null,
          body: ['Deleted 1 task: Order the cake.'],
          at: AT,
        }),
        msg<Extract<Message, { kind: 'no-match' }>>({
          kind: 'no-match',
          heard: 'call the dentist',
          at: AT,
        }),
      ]),
      ctx: { tasksVisible: true, hasTasks: false, unseenBelowFold: 2 },
    },
    {
      name: 'nma-waiting',
      state: stateWith([
        msg<Extract<Message, { kind: 'question' }>>({
          kind: 'question',
          turnId: 'turn-30',
          qkind: 'bulk_delete',
          head: 'Delete 3 tasks?',
          body: 'Will delete: Buy milk, Order the cake, Collect the parcel.',
          options: ['Delete 3 tasks', 'Keep them'],
          taskTitles: ['Buy milk', 'Order the cake', 'Collect the parcel'],
          resolved: false,
          at: AT,
        }),
      ]),
      ctx: { tasksVisible: true, hasTasks: false, unseenBelowFold: 1 },
    },
  ]

// The two AC-30 counts must match the fixtures they describe — the below-fold
// set is the TAIL of the message list, so an off-by-one would silently read as
// NMA-NEW when a question was pending. Derived rather than typed twice.
for (const name of ['nma-new', 'nma-waiting']) {
  const s = STATES.find((x) => x.name === name)!
  s.ctx = { ...s.ctx, unseenBelowFold: s.state.messages.length }
}

describe('the APP SHELL catalogue — one source, three attribute spellings', () => {
  // Parsed at run time from all three shell mockups, in both directions, for
  // L-008's reason: a hand-copied list turns a contract check into a
  // self-agreement check, and it fails in the direction drift does not travel.
  const ios = catalogueOf('docs/design/assistant/screens/app-shell-ios.html', 'accessibilityIdentifier')
  const android = catalogueOf('docs/design/assistant/screens/app-shell-android.html', 'resource-id')
  const web = catalogueOf('docs/design/assistant/screens/app-shell.html', 'data-testid')

  it('all three shell mockups declare the same ids modulo documented platform asymmetries', () => {
    // The COUNT is deliberately gone; what matters is cross-platform agreement.
    // Two documented asymmetries exist (components.md § Testid catalogue):
    //   - `tasks-drag-handle`: iOS uses accessibilityIdentifier, Android uses
    //     contentDescription instead of resource-id for the drag affordance.
    //   - `menu-list-row`: web-only — personal lists are not on mobile, so the
    //     mobile mockups carry it as data-testid but not in the platform attribute.
    expect(sorted(ios).length).toBeGreaterThanOrEqual(31)
    const IOS_ONLY = new Set(['tasks-drag-handle'])
    const WEB_ONLY = new Set(['menu-list-row'])
    // iOS is the mobile baseline
    expect(sorted([...ios].filter((id) => !android.has(id) && !IOS_ONLY.has(id)))).toEqual([])
    expect(sorted([...android].filter((id) => !ios.has(id)))).toEqual([])
    // Web is iOS + web-only ids
    expect(sorted([...web].filter((id) => !ios.has(id) && !WEB_ONLY.has(id)))).toEqual([])
    expect(sorted([...ios].filter((id) => !web.has(id)))).toEqual([])
  })

  it('the shell mockups name nothing the client does not declare somewhere', () => {
    const known = new Set<string>([...ALL_A11Y_IDS, ...ALL_SHELL_A11Y_IDS, ...SHELL_IDS_RETIRED_FROM_CLIENT])
    expect(sorted([...ios].filter((id) => !known.has(id)))).toEqual([])
  })

  it('the shell catalogue invents nothing — every id is drawn, published, or ahead of design', () => {
    // The anti-invention rule. An id must be in one of three sets: drawn in the
    // mockups, published in components.md and awaiting its drawing, or introduced
    // by implementation ahead of the design pass (with a task reference).
    const undrawn = sorted([...ALL_SHELL_A11Y_IDS].filter((id) => !ios.has(id)))
    const awaiting = new Set([
      ...Object.keys(SHELL_IDS_AWAITING_MOCKUP),
      ...Object.keys(SHELL_IDS_AHEAD_OF_DESIGN),
    ])
    expect(undrawn.filter((id) => !awaiting.has(id)), 'neither drawn nor published nor ahead of design').toEqual([])
  })

  it('every id awaiting a drawing is genuinely published in design sources, with a reason', () => {
    // Otherwise the map above is a place to hide an invented id. Each entry has to
    // be traceable to a design source — components.md or the mockup's own comment —
    // and carry a reason someone can act on.
    const md = readFileSync(resolve(ROOT, 'docs/design/_shared/components.md'), 'utf8')
    const iosHtml = readFileSync(resolve(ROOT, 'docs/design/assistant/screens/app-shell-ios.html'), 'utf8')
    for (const [id, reason] of Object.entries(SHELL_IDS_AWAITING_MOCKUP)) {
      const published = md.includes('`' + id + '`') || iosHtml.includes('`' + id + '`')
      expect(published, `${id} is not published in components.md or the mockup`).toBe(true)
      expect((reason as string).length, `${id}'s reason is not a reason`).toBeGreaterThan(20)
    }
  })

  it('nothing sits in the awaiting-a-drawing map once the mockups have caught up', () => {
    // The entry's own expiry. Once `phase: screens` draws these ids, the mockup
    // comparison covers them and a leftover entry here would keep a satisfied debt
    // on the books forever, which is how a scope boundary decays into folklore.
    const stale = Object.keys(SHELL_IDS_AWAITING_MOCKUP).filter((id) => ios.has(id))
    expect(stale, 'drawn in the mockups but still recorded as awaiting a drawing').toEqual([])
  })

  it('the six carried-over controls keep their existing ids rather than gaining new ones', () => {
    // components.md § Testid catalogue — app shell: "Controls that already
    // exist keep their ids and simply render on a different surface. They are
    // not renamed" — § Touch publishes width floors against those names.
    // T-227 retired `assistant-add-task-button` from the shell header.
    // T-363 retired `tasks-inline-add` — the TaskBottomBar is the sole add.
    const carried = sorted([...ios].filter((id) => (ALL_A11Y_IDS as readonly string[]).includes(id)))
    expect(carried).toEqual([
      'assistant-composer-input',
      'assistant-mic-button',
      'assistant-offline-banner',
      'assistant-task-checkbox',
      'assistant-task-row',
      'assistant-undo-button',
    ])
    expect(sorted([...ALL_SHELL_A11Y_IDS]).filter((id) => carried.includes(id))).toEqual([])
  })
})

describe('AC-12 — every catalogue id is reachable, and the surface invents none', () => {
  it('the enumerated surface states between them show every catalogue id', () => {
    const seen = new Set<A11yId>()
    for (const { state, ctx } of STATES) {
      for (const id of expectedIds(state, ctx)) seen.add(id)
    }
    // RETIRED ids are excluded on purpose and only ever by name. The
    // conversation catalogue still declares `assistant-drawer-button` because
    // the three `voice-assistant-view*` mockups do and design owns those files;
    // what retired it is the app shell, where the list is a peer surface and the
    // hamburger is navigation (`components.md § Testid catalogue — app shell`).
    const retired = new Set<A11yId>(RETIRED_A11Y_IDS)
    const declared = new Set<A11yId>([...ALL_A11Y_IDS].filter((id) => !retired.has(id)))
    expect(sorted([...declared].filter((id) => !seen.has(id)))).toEqual([])
    expect(sorted([...seen].filter((id) => !declared.has(id)))).toEqual([])
  })

  it('the retired drawer button is shown by NO surface state — asserted, not merely absent', () => {
    // Positive form on purpose: "we stopped listing it" and "it cannot come
    // back without a decision" are different claims, and only the second is
    // worth a test. Re-adding the control fails here.
    for (const { name, state, ctx } of STATES) {
      for (const id of RETIRED_A11Y_IDS) {
        expect(expectedIds(state, ctx).has(id), `${name} still shows ${id}`).toBe(false)
      }
    }
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
          head: 'Added 1 task',
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

  // APPLIED, not merely MEASURED — and the distinction is not pedantry. The
  // first version of this check asked only whether the id appeared anywhere in
  // `components/`, and a mutation that swapped a row's delete id for another
  // catalogue id sailed through it, because `touchProps(SHELL_A11Y_IDS.
  // tasksDeleteButton, …)` one line above kept the NAME in the file while
  // nothing rendered it. So the measurement helpers are stripped before the
  // scan: an id mentioned only by `touchProps` / `paintedBox` has a hit area
  // and no element.
  //
  // The narrower rule that suggests itself — require the id inside an
  // `a11yProps(` call — is L-002's mistake in the other direction: some ids
  // are chosen by a ternary and passed as a variable (`chipRole`), so that
  // scan reports correct controls missing. This one reads what it can see.
  const rendered = sources.replace(/(touchProps|paintedBox)\([^)]*\)/g, '')
  const applied = (map: 'A11Y_IDS' | 'SHELL_A11Y_IDS', key: string) =>
    rendered.includes(`${map}.${key}`)

  it('each catalogue id is APPLIED to an element by a component', () => {
    const retired = new Set<string>(RETIRED_A11Y_IDS)
    const unwired = Object.entries(A11Y_IDS)
      .filter(([key]) => !applied('A11Y_IDS', key))
      .map(([, id]) => id)
      .filter((id) => !retired.has(id))
    expect(unwired).toEqual([])
  })

  it('every RETIRED id is referenced by no component at all', () => {
    for (const [key, id] of Object.entries(A11Y_IDS)) {
      if (!RETIRED_A11Y_IDS.includes(id)) continue
      expect(applied('A11Y_IDS', key), `${id} is still rendered`).toBe(false)
    }
  })

  it('every shell id is either wired into a component or recorded as blocked, never neither', () => {
    // The two halves of one claim. A drawn control that is neither built nor
    // recorded is the failure `information-architecture.md § 7` warns about —
    // "six of the drawn surfaces cannot be built from today's data model, and
    // the platform variants make that easier to forget by making it look
    // finished on three platforms".
    const orphans: string[] = []
    const builtButStillListedAsBlocked: string[] = []
    for (const [key, id] of Object.entries(SHELL_A11Y_IDS)) {
      const wired = applied('SHELL_A11Y_IDS', key)
      const blocked = Object.hasOwn(SHELL_IDS_BLOCKED, id)
      if (!wired && !blocked) orphans.push(id)
      if (wired && blocked) builtButStillListedAsBlocked.push(id)
    }
    expect(orphans, 'drawn, unbuilt and unrecorded').toEqual([])
    expect(builtButStillListedAsBlocked, 'built but still recorded as blocked').toEqual([])
  })

  it('every blocked shell id states what blocks it', () => {
    for (const [id, reason] of Object.entries(SHELL_IDS_BLOCKED)) {
      expect(reason, `${id} has no reason`).toBeTruthy()
      expect((reason as string).length, `${id}'s reason is not a reason`).toBeGreaterThan(20)
    }
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
    expect(a?.text).toContain('Edited 1 task')
    expect(a?.text).toContain('Budget review Q3')
    expect(a?.text).toContain('14:00')
    expect(a?.text).toContain('16:00')
    expect(a?.text).toContain('Undo')
    expect(a?.assertive).toBe(false)
  })

  it('says so honestly when the undo window has already passed', () => {
    const applied = STATES.find((s) => s.name === 'applied-with-diff-and-undo')!.state
      .messages[0] as Message
    const a = announcementFor(applied, { undoAvailable: false })
    expect(a?.text).toContain('The undo window for this change has passed.')
  })

  it('a question announces its count, its titles and its options', () => {
    const q = STATES.find((s) => s.name === 'question-confirm')!.state.messages[0] as Message
    const a = announcementFor(q, { undoAvailable: false })
    expect(a?.text).toContain('Delete 3 tasks?')
    expect(a?.text).toContain('Groceries')
    expect(a?.text).toContain('Keep them')
  })

  it('errors are assertive and are announced ahead of politely-queued output', () => {
    const err = STATES.find((s) => s.name === 'error-with-retry')!.state.messages[0] as Message
    const info = STATES.find((s) => s.name === 'mic-permission')!.state.messages[0] as Message
    const out = announcementsFor([info, err], null)
    expect(out[0]?.assertive).toBe(true)
    expect(out[0]?.text).toContain('Not sent yet')
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
    expect(a?.text).toContain('Waiting for the network')
  })
})

describe('AC-12 — the controller announces as messages arrive', () => {
  it('announces a new outcome, and does not re-read restored history on every foreground', async () => {
    const h = await mobileHarness({ platform: 'ios' })
    h.server.always('POST /assistant/turn', 200, turnResponse({ turn: appliedTurn() }))
    await h.controller.init()
    h.announcer.clear()

    h.controller.composerChange('move the meeting to 4')
    await h.controller.send('typed')
    await settle()

    expect(h.announcer.texts().join(' ')).toContain('Edited 1 task')
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

    h.controller.composerChange('move the gym session')
    await h.controller.send('typed')
    await settle()

    const assertive = h.announcer.announcements.filter((a) => a.assertive)
    expect(assertive).toHaveLength(1)
    expect(assertive[0]?.text).toContain("Couldn't send")
  })
})
