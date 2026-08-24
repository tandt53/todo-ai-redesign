// F-007 - a whole turn, end to end, with a scripted model.
//
// The bridge and the interpreter are where a wrong answer becomes a wrong WRITE,
// so most of these cases are about refusing rather than succeeding. Every one of
// them drives the real loop, the real tools and the real store; only the model
// is scripted, because a real provider would be testing the provider.

import { describe, expect, it } from 'vitest'
import '../ai/providers/index.ts'
import { FakeClock } from '../ports/clock.ts'
import { MemoryStore } from '../store/memory-store.ts'
import type { InterpreterContext } from '../ports/interpreter.ts'
import { toInterpretation } from '../ai/bridge.ts'
import { createModelInterpreter, systemPrompt, type TurnTelemetry } from '../ai/interpreter.ts'
import { registerProvider } from '../ai/provider.ts'
import { RESPOND_TOOL } from '../ai/reply.ts'
import { TOOL_NAMES } from '../ai/tools.ts'
import { buildSystemPrompt, buildUserMessage } from '../ai/prompt.ts'
import { TOOL_SCHEMAS } from '../ai/tools.ts'

const USER = 'me@x.com'
const HANDLES = { t1: 'id-1', t2: 'id-2' }

// ---- the bridge ------------------------------------------------------------

describe('F-007 the bridge refuses rather than approximates', () => {
  it('accepts every action kind the engine implements', () => {
    const good: unknown[] = [
      { kind: 'create', tasks: [{ title: 'Buy milk' }] },
      { kind: 'edit', edits: [{ handle: 't1', changes: { title: 'Rename me' } }] },
      { kind: 'delete', handles: ['t1'] },
      { kind: 'clarify', handles: ['t1', 't2'], pending_op: { op: 'delete' } },
      { kind: 'clarify', handles: ['t1'], pending_op: { op: 'edit', changes: { priority: 'high' } } },
      { kind: 'answer', answer: { type: 'affirmative' } },
      { kind: 'answer', answer: { type: 'selection', handle: 't2' } },
      { kind: 'query' },
      { kind: 'no_match' },
      { kind: 'list_create', name: 'Home' },
      { kind: 'list_move', handle: 't1', list_name: null },
      { kind: 'list_refuse' },
      { kind: 'trash_read', query: 'trash_contents' },
    ]
    for (const action of good) {
      const r = toInterpretation(action, HANDLES)
      expect(r.ok, JSON.stringify(action)).toBe(true)
    }
  })

  it('refuses a kind nobody implemented', () => {
    const r = toInterpretation({ kind: 'archive_everything', handles: ['t1'] }, HANDLES)
    expect(r).toEqual({ ok: false, reason: 'no such action kind: "archive_everything"' })
  })

  it('refuses a handle that resolves to nothing', () => {
    // Silently targeting an empty set is how "done" gets said over no change.
    for (const action of [
      { kind: 'delete', handles: ['t9'] },
      { kind: 'edit', edits: [{ handle: 't9', changes: { title: 'x' } }] },
      { kind: 'list_move', handle: 't9', list_name: null },
      { kind: 'answer', answer: { type: 'selection', handle: 't9' } },
    ]) {
      const r = toInterpretation(action, HANDLES)
      expect(r.ok, JSON.stringify(action)).toBe(false)
      if (!r.ok) expect(r.reason).toContain('unknown handle')
    }
  })

  it('refuses a field a turn is not allowed to write, by name', () => {
    // parent_id, list_id, sort_order and the repeat members have exactly one
    // writer each, and a turn is not it (F-005 AC-36).
    for (const field of ['parent_id', 'list_id', 'sort_order', 'repeat_frequency', 'deleted_at']) {
      const r = toInterpretation(
        { kind: 'edit', edits: [{ handle: 't1', changes: { [field]: 'x' } }] }, HANDLES)
      expect(r.ok, field).toBe(false)
      if (!r.ok) expect(r.reason).toBe(`a turn may not set "${field}"`)
    }
  })

  it('refuses a date that is not a date', () => {
    const r = toInterpretation(
      { kind: 'edit', edits: [{ handle: 't1', changes: { due_at: 'tomorrow' } }] }, HANDLES)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toContain('ISO 8601')
  })

  it('refuses an empty edit, which would report a change that never happened', () => {
    const r = toInterpretation({ kind: 'edit', edits: [{ handle: 't1', changes: {} }] }, HANDLES)
    expect(r.ok).toBe(false)
  })

  it('refuses an edit clarify with nothing to apply on a yes', () => {
    const r = toInterpretation({ kind: 'clarify', handles: ['t1'], pending_op: { op: 'edit' } }, HANDLES)
    expect(r.ok).toBe(false)
  })

  it('refuses junk without throwing', () => {
    for (const junk of [null, 'delete', 42, [], {}, { kind: '' }]) {
      expect(() => toInterpretation(junk, HANDLES)).not.toThrow()
      expect(toInterpretation(junk, HANDLES).ok).toBe(false)
    }
  })
})

// ---- the prompt -------------------------------------------------------------

describe('F-007 the system prompt', () => {
  it('names every tool the model is actually offered', () => {
    const p = systemPrompt()
    for (const name of TOOL_NAMES) expect(p, name).toContain(name)
    expect(p).toContain(RESPOND_TOOL.name)
  })

  it('describes the two channels as different things', () => {
    const p = systemPrompt()
    expect(p).toContain('message')
    expect(p).toContain('speech')
    expect(p).toMatch(/ONE plain\s+sentence/)
  })

  it('is byte-identical every time, or the cache prefix does not hold', () => {
    expect(buildSystemPrompt(TOOL_SCHEMAS)).toBe(buildSystemPrompt(TOOL_SCHEMAS))
    expect(systemPrompt()).toBe(buildSystemPrompt(TOOL_SCHEMAS))
  })

  it('carries nothing per-turn — that all goes after the cache breakpoint', () => {
    const p = systemPrompt()
    expect(p).not.toMatch(/20\d\d-\d\d-\d\d/)
    expect(p).not.toContain(USER)
  })

  it('puts the turn\'s own facts in the user message instead', () => {
    const msg = buildUserMessage({
      transcript: 'delete the buy milk task',
      source: 'voice',
      timezone: 'Asia/Ho_Chi_Minh',
      tasks: [{ handle: 't1', title: 'Buy milk', status: 'inbox', due_at: null, priority: 'high', note: 'the low-sugar kind', list_id: null }],
      lists: [{ name: 'Home' }],
      recentTurns: [{ transcript: 'add a task to buy milk', outcome_kind: 'applied' }],
      question: null,
    })
    expect(msg).toContain('t1 "Buy milk"')
    expect(msg).toContain('high')
    expect(msg).toContain('the low-sugar kind')
    expect(msg).toContain('Home')
    expect(msg).toContain('Asia/Ho_Chi_Minh')
    expect(msg).toContain('They said: "delete the buy milk task"')
  })

  it('says plainly when there is no timezone, rather than implying UTC', () => {
    const msg = buildUserMessage({
      transcript: 'x', source: 'typed', timezone: null,
      tasks: [], lists: [], recentTurns: [], question: null,
    })
    expect(msg).toContain('do not resolve relative dates')
  })
})

// ---- a whole turn -----------------------------------------------------------

function fixture() {
  const store = new MemoryStore()
  const clock = new FakeClock()
  store.transact((s) => {
    for (const [id, title] of [['id-1', 'Buy milk'], ['id-2', 'Call mom']] as const) {
      s.tasks[id] = {
        id, user_id: USER, title, note: null, due_at: null, due_all_day: null,
        reminder_at: null, reminder_shown_at: null, priority: null, status: 'inbox',
        parent_id: null, step_order: null, completed_by_parent: false, ever_completed: false,
        repeat_frequency: null, repeat_interval: null, repeat_weekdays: null,
        repeat_month_days: null, repeat_until: null, repeat_count: null,
        series_id: null, series_ended_at: null, delete_gesture_id: null,
        list_id: null, sort_order: null,
        created_at: '2026-08-01T00:00:00.000Z', updated_at: '2026-08-01T00:00:00.000Z',
        deleted_at: null,
      }
    }
  })
  return { store, clock }
}

const CTX: InterpreterContext = {
  user_id: USER,
  handles: HANDLES,
  transcript: 'delete the buy milk task',
  source: 'voice',
  timezone: 'Asia/Ho_Chi_Minh',
  tasks: [
    { handle: 't1', title: 'Buy milk', status: 'inbox', note: null, due_at: null, reminder_at: null, priority: null, list_id: null },
    { handle: 't2', title: 'Call mom', status: 'inbox', note: null, due_at: null, reminder_at: null, priority: null, list_id: null },
  ],
  deleted_tasks: [],
  lists: [],
  recent_turns: [],
  question: null,
}

/** Register a one-off provider that plays a script, and return the telemetry sink. */
let scriptSeq = 0
function withModel(steps: unknown[]) {
  const name = `scripted-${scriptSeq++}`
  let i = 0
  registerProvider(name, () => ({ next: async () => steps[Math.min(i++, steps.length - 1)] as never }),
    { cache: 'none', toolCalling: true })
  const seen: TurnTelemetry[] = []
  const { store, clock } = fixture()
  const interp = createModelInterpreter({
    config: { provider: name, model: 'scripted-v1', apiKey: '' },
    store, clock,
    onTurn: (_user, t) => seen.push(t),
  })
  return { interp, seen }
}

const REPLY = { message: 'Deleted "Buy milk".', speech: 'Deleted Buy milk.' }

describe('F-007 one turn, end to end', () => {
  it('reads the account and the handle table from the TURN, not from itself', async () => {
    // One interpreter, two accounts: each turn must act on its own rows.
    const { interp, seen } = withModel([
      { kind: 'final', payload: { kind: 'delete', handles: ['t1'] }, reply: REPLY },
    ])
    await interp.interpret(CTX)
    await interp.interpret({ ...CTX, user_id: 'other@x.com' })
    expect(seen).toHaveLength(2)
  })

  it('carries a valid action through, with its two sentences', async () => {
    const { interp, seen } = withModel([
      { kind: 'final', payload: { kind: 'delete', handles: ['t1'] }, reply: REPLY,
        usage: { input_tokens: 1200, cached_input_tokens: 900, output_tokens: 80 } },
    ])
    const out = await interp.interpret(CTX)
    expect(out).toEqual({ kind: 'delete', handles: ['t1'] })
    expect(seen[0]).toMatchObject({
      model: 'scripted-v1', rounds: 1, outcome: 'final', refusal: null,
      usage: { input_tokens: 1200, cached_input_tokens: 900, output_tokens: 80 },
    })
    expect(seen[0]!.reply).toEqual(REPLY)
  })

  it('lets the model use tools first, and counts what it used', async () => {
    const { interp, seen } = withModel([
      { kind: 'tool_use', calls: [{ name: 'search_tasks', input: { query: 'milk' } }] },
      { kind: 'tool_use', calls: [{ name: 'now', input: {} }] },
      { kind: 'final', payload: { kind: 'delete', handles: ['t1'] }, reply: REPLY },
    ])
    await interp.interpret(CTX)
    expect(seen[0]).toMatchObject({ rounds: 3, toolCalls: 2, outcome: 'final' })
  })

  it('falls back to no_match when the action is not one the engine knows', async () => {
    const { interp, seen } = withModel([
      { kind: 'final', payload: { kind: 'nuke_everything' }, reply: REPLY },
    ])
    expect(await interp.interpret(CTX)).toEqual({ kind: 'no_match' })
    expect(seen[0]!.outcome).toBe('invalid_action')
    expect(seen[0]!.refusal).toContain('no such action kind')
  })

  it('falls back when the sentence names a task that is not being touched', async () => {
    // The action deletes "Buy milk"; the sentence says it deleted the other one.
    // Consent runs on the sentence, so neither survives.
    const { interp, seen } = withModel([
      { kind: 'final', payload: { kind: 'delete', handles: ['t1'] },
        reply: { message: 'Deleted "Call mom".', speech: 'Deleted.' } },
    ])
    expect(await interp.interpret(CTX)).toEqual({ kind: 'no_match' })
    expect(seen[0]!.outcome).toBe('bad_reply')
    expect(seen[0]!.refusal).toContain('not being acted on')
  })

  it('falls back when the spoken half carries markup', async () => {
    const { interp, seen } = withModel([
      { kind: 'final', payload: { kind: 'delete', handles: ['t1'] },
        reply: { message: 'ok', speech: '- Deleted\n- done' } },
    ])
    expect(await interp.interpret(CTX)).toEqual({ kind: 'no_match' })
    expect(seen[0]!.outcome).toBe('bad_reply')
  })

  it('accepts a rename that names its own new title', async () => {
    const { interp, seen } = withModel([
      { kind: 'final', payload: { kind: 'edit', edits: [{ handle: 't1', changes: { title: 'Buy fresh milk' } }] },
        reply: { message: 'Renamed "Buy milk" to "Buy fresh milk".', speech: 'Renamed it.' } },
    ])
    const out = await interp.interpret(CTX)
    expect(out.kind).toBe('edit')
    expect(seen[0]!.refusal).toBeNull()
  })

  it('does not check titles on a turn that touches nothing', async () => {
    // A query answers in words and may quote anything; there is no target set to
    // disagree with, and flagging it would refuse correct answers.
    const { interp, seen } = withModel([
      { kind: 'final', payload: { kind: 'query' },
        reply: { message: 'Today you have "Buy milk" and "Call mom".', speech: 'You have two tasks today.' } },
    ])
    expect(await interp.interpret(CTX)).toEqual({ kind: 'query' })
    expect(seen[0]!.refusal).toBeNull()
  })

  it('says which bound it hit when the loop runs out', async () => {
    const { interp, seen } = withModel([
      { kind: 'tool_use', calls: [{ name: 'now', input: {} }] },
    ])
    expect(await interp.interpret(CTX)).toEqual({ kind: 'no_match' })
    expect(seen[0]!.outcome).toBe('exhausted:max_rounds')
    expect(seen[0]!.refusal).toContain('ran out of steps')
  })

  it('survives a provider that is simply down', async () => {
    const name = `broken-${scriptSeq++}`
    registerProvider(name, () => ({ next: async () => { throw new Error('529 overloaded') } }),
      { cache: 'none', toolCalling: true })
    const seen: TurnTelemetry[] = []
    const { store, clock } = fixture()
    const interp = createModelInterpreter({
      config: { provider: name, model: 'm', apiKey: '' },
      store, clock,
      onTurn: (_user, t) => seen.push(t),
    })
    expect(await interp.interpret(CTX)).toEqual({ kind: 'no_match' })
    expect(seen[0]!.outcome).toBe('error')
    expect(seen[0]!.refusal).toContain('529')
    // Nothing is billed for a call that never happened.
    expect(seen[0]!.usage).toEqual({ input_tokens: 0, cached_input_tokens: 0, output_tokens: 0 })
  })

  it('reports usage even on a refused turn — it was still paid for', async () => {
    const { interp, seen } = withModel([
      { kind: 'final', payload: { kind: 'nope' }, reply: REPLY,
        usage: { input_tokens: 900, cached_input_tokens: 0, output_tokens: 40 } },
    ])
    await interp.interpret(CTX)
    expect(seen[0]!.usage.input_tokens).toBe(900)
  })
})
