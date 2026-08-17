// View-model tests — node env, no React (platform web.md: all conversation
// logic lives in plain TS and is tested there).
//
// These cover the four-state machine (AC-29), the undo window (AC-8), the
// outcome→message mapping (AC-4, AC-6, AC-7, AC-11, AC-14, AC-15, AC-28) and
// the client stores (AC-16, AC-25, AC-26, AC-27).

import { describe, expect, it } from 'vitest'
import {
  appliedTurn,
  askedTurn,
  boundary,
  session,
  T0,
  task,
  turn,
  undoOutcome,
} from './_helpers.ts'
import { appliedHead, formatDue, formatValue } from '../../_shared/model/format.ts'
import {
  boundaryMessage,
  permissionDeniedMessage,
  revertedMessage,
  sessionMessages,
  transientFailureMessage,
  turnOutcomeMessages,
  undoRefusedMessage,
} from '../../_shared/model/messages.ts'
import type { MessageContext, NewMsg } from '../../_shared/model/messages.ts'
import { initialState, micMode, reducer, undoableTurnId } from '../../_shared/model/reducer.ts'
import type { Action, AppState } from '../../_shared/model/reducer.ts'
import { ClientStores } from '../../_shared/model/client-stores.ts'
import { MemoryDurableStore } from '../../_shared/ports/durable-store.ts'

const ctx: MessageContext = {
  titleFor: (id) => (id === 'task-1' ? 'Review Q3 budget draft' : null),
  questionInfo: () => ({ qkind: 'bulk_delete', titles: ['a', 'b', 'c'] }),
  now: new Date(T0),
}

function fold(state: AppState, ...actions: Action[]): AppState {
  return actions.reduce(reducer, state)
}

function start(): AppState {
  return { ...initialState('available'), sessionId: 'sess-1' }
}

// ---------------------------------------------------------------------------
// AC-29 — exactly four states; only the flowchart's edges
// ---------------------------------------------------------------------------

describe('surface states (AC-29)', () => {
  it('starts idle and reaches listening only from idle or error', () => {
    expect(start().surface).toBe('idle')

    const listening = fold(start(), { type: 'listen-start' })
    expect(listening.surface).toBe('listening')

    // thinking → listening is not an edge on the flowchart
    const thinking = fold(start(), {
      type: 'send',
      clientTurnId: 'cid-1',
      message: { kind: 'user', text: 'hi', via: 'typed', at: T0, queued: false, clientTurnId: 'cid-1' },
    })
    expect(thinking.surface).toBe('thinking')
    expect(fold(thinking, { type: 'listen-start' }).surface).toBe('thinking')

    // error → idle → listening IS an edge (flowchart E → A)
    const errored = fold(thinking, {
      type: 'turn-failed',
      clientTurnId: 'cid-1',
      appendMessages: [],
      restoreComposer: 'hi',
    })
    expect(errored.surface).toBe('error')
    expect(fold(errored, { type: 'listen-start' }).surface).toBe('listening')
  })

  it('listening with nothing recognized returns to idle and sends no turn (AC-2)', () => {
    const s = fold(start(), { type: 'listen-start' }, { type: 'transcript', text: '' })
    const ended = fold(s, { type: 'listen-end', mode: 'speech-end-empty', text: '' })
    expect(ended.surface).toBe('idle')
    expect(ended.messages).toHaveLength(0)
  })

  it('cancel while listening keeps the recognized words in the composer (AC-3)', () => {
    const s = fold(
      start(),
      { type: 'listen-start' },
      { type: 'transcript', text: 'push the budget review to fou' },
      { type: 'listen-end', mode: 'cancelled', text: 'push the budget review to fou' },
    )
    expect(s.surface).toBe('idle')
    expect(s.composer).toBe('push the budget review to fou')
  })

  it('a late outcome after a client-local cancel never re-enters thinking (AC-3)', () => {
    const sent = fold(start(), {
      type: 'send',
      clientTurnId: 'cid-1',
      message: { kind: 'user', text: 'x', via: 'typed', at: T0, queued: false, clientTurnId: 'cid-1' },
    })
    const cancelled = fold(sent, { type: 'cancel-thinking', restoreComposer: 'x' })
    expect(cancelled.surface).toBe('idle')
    expect(cancelled.composer).toBe('x')

    const late = fold(cancelled, {
      type: 'turn-ok',
      clientTurnId: 'cid-1',
      sessionId: 'sess-1',
      appendMessages: [{ kind: 'outcome', head: 'Applied', body: [], at: T0 }],
      resolvedQuestionIds: [],
      marks: null,
      undoneTurnId: null,
    })
    expect(late.surface).toBe('idle')
    // the outcome still renders — cancel never pretends it won
    expect(late.messages.at(-1)?.kind).toBe('outcome')
  })

  it('only the newest error keeps a Retry affordance', () => {
    const err = (cid: string): Action => ({
      type: 'turn-failed',
      clientTurnId: cid,
      appendMessages: [{ kind: 'error', head: 'x', body: [], retryTurnId: cid, at: T0 }],
      restoreComposer: null,
    })
    const s = fold(start(), err('cid-1'), err('cid-2'))
    const retries = s.messages.filter((m) => m.kind === 'error' && m.retryTurnId !== null)
    expect(retries).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// AC-20..22 — mic modes are orthogonal to the four states
// ---------------------------------------------------------------------------

describe('mic modes (AC-20, AC-21, AC-22)', () => {
  it('maps capability to mode without touching the surface state', () => {
    expect(micMode(initialState('available'))).toBe('available')
    expect(micMode(initialState('none'))).toBe('hidden')
    expect(micMode(initialState('permission-denied'))).toBe('dimmed-permission')
    expect(micMode(initialState('transient-failure'))).toBe('dimmed-transient')
  })

  it('losing capability mid-capture behaves as an interruption, not a fifth state', () => {
    const listening = fold(start(), { type: 'listen-start' })
    const lost = fold(listening, {
      type: 'capability',
      capability: 'transient-failure',
      message: transientFailureMessage(T0),
    })
    expect(lost.surface).toBe('idle')
    expect(micMode(lost)).toBe('dimmed-transient')
  })

  it('states a distinguishable cause for permission vs transient', () => {
    const p = permissionDeniedMessage(T0)
    const t = transientFailureMessage(T0)
    expect(p.kind).toBe('info')
    expect(t.kind).toBe('info')
    if (p.kind !== 'info' || t.kind !== 'info') throw new Error('unreachable')
    expect(p.head).not.toBe(t.head)
    expect(p.cta).toBe('permission')
    expect(t.cta).toBeNull()
    // typing is never blocked by either
    expect(p.body.join(' ')).toMatch(/gõ chữ vẫn dùng được/i)
    expect(t.body.join(' ')).toMatch(/gõ chữ vẫn dùng được/i)
  })
})

// ---------------------------------------------------------------------------
// AC-8 — the undo window
// ---------------------------------------------------------------------------

describe('undo window (AC-5, AC-8)', () => {
  const appliedMsg = (turnId: string, mutated: boolean): NewMsg => ({
    kind: 'applied',
    turnId,
    head: 'Changed 1 task',
    lines: [],
    deletedTitles: [],
    mutated,
    undone: false,
    at: T0,
  })

  it('offers undo on the newest mutating applied turn', () => {
    const s = fold(start(), { type: 'append', messages: [appliedMsg('turn-1', true)] })
    expect(undoableTurnId(s)).toBe('turn-1')
    const s2 = fold(s, { type: 'append', messages: [appliedMsg('turn-2', true)] })
    expect(undoableTurnId(s2)).toBe('turn-2')
  })

  it('a turn that mutated nothing neither holds nor ends the window (AC-8)', () => {
    const s = fold(
      start(),
      { type: 'append', messages: [appliedMsg('turn-1', true)] },
      { type: 'append', messages: [{ kind: 'no-match', heard: 'cross off the badminton game', at: T0 }] },
      { type: 'append', messages: [appliedMsg('turn-2', false)] },
    )
    expect(undoableTurnId(s)).toBe('turn-1')
  })

  it('an undo makes the previous mutating turn undoable again', () => {
    const s = fold(
      start(),
      { type: 'append', messages: [appliedMsg('turn-1', true)] },
      { type: 'append', messages: [appliedMsg('turn-2', true)] },
      { type: 'undo-done', turnId: 'turn-2', appendMessages: [] },
    )
    expect(undoableTurnId(s)).toBe('turn-1')
  })

  it('session close ends the window — a clean start offers no undo (AC-28)', () => {
    const s = fold(start(), { type: 'append', messages: [appliedMsg('turn-1', true)] })
    const clean = fold(s, {
      type: 'session-synced',
      sessionId: null,
      messages: [boundaryMessage(boundary(), ctx)],
      marks: null,
    })
    expect(undoableTurnId(clean)).toBeNull()
  })

  it('undo is guarded against double activation', () => {
    const first = fold(start(), { type: 'undo-start', turnId: 'turn-1' })
    expect(first.undoInFlight).toBe('turn-1')
    const second = fold(first, { type: 'undo-start', turnId: 'turn-1' })
    expect(second).toBe(first)
  })
})

// ---------------------------------------------------------------------------
// AC-4 — attribution: marks, diff anatomy, no internal refs
// ---------------------------------------------------------------------------

describe('applied anatomy (AC-1, AC-4)', () => {
  it('renders per-field old → new and marks only the turn’s own rows', () => {
    const t = appliedTurn({ id: 'turn-9' })
    const { messages, marks } = turnOutcomeMessages(t, ctx, true)
    const m = messages[0]
    expect(m?.kind).toBe('applied')
    if (m?.kind !== 'applied') throw new Error('unreachable')
    expect(m.mutated).toBe(true)
    expect(m.lines[0]?.title).toBe('Review Q3 budget draft')
    expect(m.lines[0]?.chips[0]).toEqual({ field: 'due_at', old: '2:00 PM', new: '4:00 PM' })
    expect(marks?.turnId).toBe('turn-9')
    expect(Object.keys(marks?.byTask ?? {})).toEqual(['task-1'])
  })

  it('a create is labelled new with no fabricated old value', () => {
    const t = appliedTurn(
      {},
      {
        changed_task_ids: ['task-2'],
        diff: [{ task_id: 'task-2', field: 'title', old: null, new: 'Pay electricity bill' }],
        created_titles: ['Pay electricity bill'],
      },
    )
    const m = turnOutcomeMessages(t, ctx, true).messages[0]
    if (m?.kind !== 'applied') throw new Error('unreachable')
    expect(m.lines[0]?.label).toBe('new')
    expect(m.lines[0]?.chips.every((c) => c.old === null)).toBe(true)
  })

  it('a delete is named by title, since no row remains', () => {
    const t = appliedTurn(
      {},
      {
        changed_task_ids: ['task-3'],
        diff: [{ task_id: 'task-3', field: 'deleted_at', old: null, new: null }],
        deleted_titles: ['Call the bank'],
      },
    )
    const m = turnOutcomeMessages(t, ctx, true).messages[0]
    if (m?.kind !== 'applied') throw new Error('unreachable')
    expect(m.deletedTitles).toEqual(['Call the bank'])
  })

  it('a hand edit drops the row’s attribution (AC-4: only the turn’s own changes)', () => {
    const t = appliedTurn({ id: 'turn-9' })
    const { marks } = turnOutcomeMessages(t, ctx, true)
    const s = fold(
      { ...start(), marks },
      { type: 'unmark-task', taskId: 'task-1' },
    )
    expect(s.marks).toBeNull()
  })

  it('an asking turn applies nothing — the question IS the result (AC-1 carve-out)', () => {
    const t = askedTurn('bulk_delete', ['a', 'b', 'c'], ['Yes', 'No'])
    const { messages, marks } = turnOutcomeMessages(t, ctx, true)
    expect(messages[0]?.kind).toBe('question')
    expect(marks).toBeNull()
    expect(t.changed_task_ids).toEqual([])
  })

  it('the applied head states the real counts', () => {
    expect(appliedHead({ edited: 1, created: 1, deleted: 0 })).toBe('Đã sửa 1 việc · thêm 1')
    expect(appliedHead({ edited: 0, created: 1, deleted: 0 })).toBe('Đã thêm 1 việc')
    expect(appliedHead({ edited: 0, created: 0, deleted: 3 })).toBe('Đã xóa 3 việc')
  })
})

// ---------------------------------------------------------------------------
// AC-6, AC-7 — revert shapes and refusals
// ---------------------------------------------------------------------------

describe('undo outcomes (AC-6, AC-7)', () => {
  it('names every skipped task', () => {
    const m = revertedMessage(
      undoOutcome({
        reverted: [{ task_id: 'task-2', title: 'Pick up birthday cake' }],
        skipped: [
          { task_id: 'task-1', title: 'Review Q3 budget draft', reason: 'modified_since_apply' },
        ],
      }),
      (id) => (id === 'task-2' ? { taskId: id, title: 'Pick up birthday cake', label: 'new', chips: [] } : null),
      T0,
    )
    if (m.kind !== 'reverted') throw new Error('unreachable')
    expect(m.head).toMatch(/trừ 1 việc/)
    expect(m.body.join(' ')).toContain('Review Q3 budget draft')
    expect(m.body.join(' ')).toContain('Pick up birthday cake')
  })

  it('all-skipped never renders as a successful revert', () => {
    const m = revertedMessage(
      undoOutcome({
        reverted: [],
        skipped: [
          { task_id: 'task-1', title: 'Review Q3 budget draft', reason: 'modified_since_apply' },
          { task_id: 'task-2', title: 'Pick up birthday cake', reason: 'modified_since_apply' },
        ],
        nothing_reverted: true,
      }),
      () => null,
      T0,
    )
    if (m.kind !== 'reverted') throw new Error('unreachable')
    expect(m.head).toBe('Không hoàn tác được gì')
    expect(m.head).not.toMatch(/^Đã hoàn tác/)
    expect(m.body.join(' ')).toContain('Review Q3 budget draft')
  })

  it('every refusal reason renders a distinct visible message, never silence', () => {
    const reasons = ['not_undoable', 'not_newest', 'session_closed']
    const bodies = reasons.map((r) => {
      const m = undoRefusedMessage(r, T0)
      if (m.kind !== 'outcome') throw new Error('unreachable')
      return m.body.join(' ')
    })
    expect(new Set(bodies).size).toBe(3)
    for (const b of bodies) expect(b.length).toBeGreaterThan(0)
    const unknown = undoRefusedMessage('something-new', T0)
    if (unknown.kind !== 'outcome') throw new Error('unreachable')
    expect(unknown.body.join(' ')).toMatch(/chưa hoàn tác được/)
  })
})

// ---------------------------------------------------------------------------
// AC-11, AC-14, AC-15 — every resolution path is visible
// ---------------------------------------------------------------------------

describe('resolution + honesty messages (AC-11, AC-14, AC-15)', () => {
  it('declined, superseded and already-resolved each produce a message', () => {
    const kinds = (['declined', 'declined_superseded', 'already_resolved'] as const).map((result) => {
      const t = turn({
        status: 'applied',
        outcome: { kind: 'resolution', result, question_turn_id: 'turn-0' },
      })
      return turnOutcomeMessages(t, ctx, true).messages
    })
    for (const msgs of kinds) {
      expect(msgs).toHaveLength(1)
      expect(msgs[0]?.kind).toBe('outcome')
    }
  })

  it('an executed resolution carries the full applied anatomy incl. undo (AC-11)', () => {
    const t = turn({
      status: 'applied',
      outcome: {
        kind: 'resolution',
        result: 'executed',
        question_turn_id: 'turn-0',
        executed: {
          changed_task_ids: ['task-1', 'task-2', 'task-3'],
          diff: [],
          created_titles: [],
          deleted_titles: ['Buy groceries for the week', 'Order birthday cake', 'Pick up dry cleaning'],
        },
      },
    })
    const m = turnOutcomeMessages(t, ctx, true).messages[0]
    expect(m?.kind).toBe('applied')
    if (m?.kind !== 'applied') throw new Error('unreachable')
    expect(m.mutated).toBe(true)
    expect(m.head).toBe('Đã xóa 3 việc')
    expect(m.deletedTitles).toHaveLength(3)
  })

  it('an unclassifiable answer executes nothing and leaves the question open (AC-10)', () => {
    const t = turn({
      status: 'applied',
      outcome: { kind: 'unclassifiable', question_turn_id: 'turn-0' },
    })
    const { messages, marks } = turnOutcomeMessages(t, ctx, true)
    expect(marks).toBeNull()
    const m = messages[0]
    if (m?.kind !== 'outcome') throw new Error('unreachable')
    expect(m.body.join(' ')).toMatch(/vẫn đang chờ/i)
  })

  it('no-match quotes the heard transcript verbatim (AC-14)', () => {
    const t = turn({
      status: 'applied',
      outcome: { kind: 'no_match', heard_transcript: 'cross off the badminton game' },
    })
    const m = turnOutcomeMessages(t, ctx, true).messages[0]
    if (m?.kind !== 'no-match') throw new Error('unreachable')
    expect(m.heard).toBe('cross off the badminton game')
  })

  it('an unsupported list question names the working alternative (AC-15)', () => {
    const t = turn({
      status: 'applied',
      outcome: { kind: 'unsupported_query', alternative: 'the on-screen list and its filters' },
    })
    const m = turnOutcomeMessages(t, ctx, true).messages[0]
    if (m?.kind !== 'unsupported') throw new Error('unreachable')
    expect(m.alternative).toBe('the on-screen list and its filters')
  })
})

// ---------------------------------------------------------------------------
// AC-28 — session lifecycle
// ---------------------------------------------------------------------------

describe('session lifecycle (AC-28)', () => {
  it('resume replays the session’s turns as messages, in order', () => {
    const s = session({
      messages: [
        appliedTurn({ id: 'turn-1', seq: 1 }),
        turn({
          id: 'turn-2',
          seq: 2,
          status: 'applied',
          outcome: { kind: 'no_match', heard_transcript: 'badminton' },
        }),
      ],
    })
    const { messages, marks } = sessionMessages(s, ctx)
    expect(messages.map((m) => m.kind)).toEqual(['user', 'applied', 'user', 'no-match'])
    expect(marks?.turnId).toBe('turn-1')
  })

  it('a clean start renders exactly one boundary message carrying the terminal outcomes', () => {
    const m = boundaryMessage(
      boundary({
        declined_questions: [
          { turn_id: 'turn-0', kind: 'bulk_delete', task_titles: ['Buy groceries for the week'] },
        ],
        late_outcomes: [
          {
            turn_id: 'turn-9',
            status: 'applied',
            outcome: {
              kind: 'applied',
              changed_task_ids: ['task-4'],
              diff: [],
              created_titles: ['Call the bank'],
              deleted_titles: [],
            },
          },
        ],
      }),
      ctx,
    )
    if (m.kind !== 'boundary') throw new Error('unreachable')
    expect(m.head).toMatch(/Phiên đã kết thúc — để lâu không dùng/)
    expect(m.lines).toHaveLength(2)
    expect(m.lines[0]).toContain('Buy groceries for the week')
    expect(m.lines[1]).toContain('Call the bank')
  })

  it('an undone turn replays as undone with its revert message', () => {
    const s = session({
      messages: [
        appliedTurn({
          id: 'turn-1',
          status: 'undone',
          undo_result: {
            reverted: [{ task_id: 'task-1', title: 'Review Q3 budget draft' }],
            skipped: [],
            nothing_reverted: false,
            via: 'voice',
            undone_at: T0,
          },
        }),
      ],
    })
    const { messages } = sessionMessages(s, ctx)
    expect(messages.map((m) => m.kind)).toEqual(['user', 'applied', 'reverted'])
    const appliedMsg = messages[1]
    if (appliedMsg?.kind !== 'applied') throw new Error('unreachable')
    expect(appliedMsg.undone).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Client stores (AC-16, AC-25, AC-26, AC-27 web floor)
// ---------------------------------------------------------------------------

describe('client stores', () => {
  it('namespaces keys per user so two accounts never share state', () => {
    const store = new MemoryDurableStore()
    new ClientStores(store, 'user-a').savePendingInput('a-words', () => T0)
    new ClientStores(store, 'user-b').savePendingInput('b-words', () => T0)
    expect(new ClientStores(store, 'user-a').pendingInput()).toBe('a-words')
    expect(new ClientStores(store, 'user-b').pendingInput()).toBe('b-words')
  })

  it('round-trips the outgoing turn and clears it on ack', () => {
    const stores = new ClientStores(new MemoryDurableStore(), 'user-1')
    const body = {
      session_id: 'sess-1',
      client_turn_id: 'cid-1',
      transcript: 'hello',
      source: 'typed' as const,
      answer_to_turn_id: null,
      timezone: null,
    }
    stores.saveOutgoingTurn({ body, sent_at: T0, attempts: 1 })
    expect(stores.outgoingTurn()?.body.client_turn_id).toBe('cid-1')
    stores.clearOutgoingTurn()
    expect(stores.outgoingTurn()).toBeNull()
  })

  it('survives corrupted storage rather than throwing', () => {
    const store = new MemoryDurableStore()
    store.set('assistant.user-1.pending_input', '{not json')
    expect(new ClientStores(store, 'user-1').pendingInput()).toBe('')
  })

  it('empties the pending input instead of storing an empty record', () => {
    const store = new MemoryDurableStore()
    const stores = new ClientStores(store, 'user-1')
    stores.savePendingInput('words', () => T0)
    stores.savePendingInput('', () => T0)
    expect(store.get('assistant.user-1.pending_input')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Formatting — no raw internals ever reach the screen (AC-4)
// ---------------------------------------------------------------------------

describe('formatting (AC-4)', () => {
  it('reformats ISO timestamps and passes display strings through verbatim', () => {
    expect(formatValue('2:00 PM', new Date(T0))).toBe('2:00 PM')
    expect(formatValue(null)).toBeNull()
    expect(formatValue(undefined)).toBeNull()
    expect(formatDue('2026-08-16T09:30:00.000Z', new Date('2026-08-16T00:00:00.000Z'))).toMatch(/[AP]M/)
  })

  it('never renders a raw uuid — a title is always resolved', () => {
    const t = appliedTurn(
      {},
      {
        changed_task_ids: ['9f1c0f4e-4b5e-4d2a-9f61-0f1c2e3d4a5b'],
        diff: [
          { task_id: '9f1c0f4e-4b5e-4d2a-9f61-0f1c2e3d4a5b', field: 'due_at', old: '2:00 PM', new: '4:00 PM' },
        ],
      },
    )
    const m = turnOutcomeMessages(t, { ...ctx, titleFor: () => 'Review Q3 budget draft' }, true).messages[0]
    if (m?.kind !== 'applied') throw new Error('unreachable')
    expect(JSON.stringify(m.lines.map((l) => l.title))).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}/)
  })

  it('tasks keep their identity fields off the rendered surface', () => {
    // the wire task carries an id; nothing in the view model turns it into copy
    const t = task({ id: '9f1c0f4e-4b5e-4d2a-9f61-0f1c2e3d4a5b' })
    expect(t.title).not.toContain(t.id)
  })
})
