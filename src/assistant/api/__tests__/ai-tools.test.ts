// F-007 — the tool surface, the reply schema, and the loop's bound.
//
// Every case runs against a real store through the real executor. The model is
// a scripted fake: the rules being checked are the backend's, and a real
// provider call would test the provider.

import { describe, expect, it } from 'vitest'
import { MemoryStore } from '../store/memory-store.ts'
import { FakeClock } from '../ports/clock.ts'
import { TOOL_NAMES, TOOL_SCHEMAS, runTool, type ToolContext } from '../ai/tools.ts'
import { checkReplyFacts, checkReplyShape, type ReplyText } from '../ai/reply.ts'
import { DEFAULT_MAX_ROUNDS, runLoop, type ModelClient, type ModelStep } from '../ai/loop.ts'

const USER = 'someone@example.com'

function fixture() {
  const store = new MemoryStore()
  const clock = new FakeClock()
  const handleMap: Record<string, string> = {}
  store.transact((s) => {
    const rows = [
      { id: 'a', title: 'Mua sữa cho bé', note: null, status: 'inbox' },
      { id: 'b', title: 'Nộp báo cáo quý', note: 'gửi cho chị Lan', status: 'inbox' },
      { id: 'c', title: 'Đã xong từ lâu', note: null, status: 'done' },
    ]
    for (const r of rows) {
      s.tasks[r.id] = {
        id: r.id, user_id: USER, title: r.title, note: r.note,
        due_at: null, due_all_day: null, reminder_at: null, reminder_shown_at: null,
        priority: null, status: r.status as 'inbox', parent_id: null, step_order: null,
        completed_by_parent: false, ever_completed: false,
        repeat_frequency: null, repeat_interval: null, repeat_weekdays: null,
        repeat_month_days: null, repeat_until: null, repeat_count: null,
        series_id: null, series_ended_at: null, delete_gesture_id: null,
        list_id: null, sort_order: null,
        created_at: '2026-08-01T00:00:00.000Z', updated_at: '2026-08-01T00:00:00.000Z',
        deleted_at: null,
      }
    }
    s.tasks['b1'] = {
      ...s.tasks['a']!, id: 'b1', title: 'In hai bản', parent_id: 'b', step_order: 0,
    }
    s.tasks['gone'] = {
      ...s.tasks['a']!, id: 'gone', title: 'Việc đã xoá', deleted_at: '2026-08-10T00:00:00.000Z',
    }
  })
  handleMap['t1'] = 'a'; handleMap['t2'] = 'b'; handleMap['t3'] = 'c'
  const ctx: ToolContext = {
    read: (fn) => store.read(fn), userId: USER, handleMap, clock, zone: 'Asia/Ho_Chi_Minh',
  }
  return { store, clock, ctx }
}

describe('F-007 the tool catalogue', () => {
  it('is the same list the executor answers to', () => {
    for (const name of TOOL_NAMES) {
      const out = runTool(fixture().ctx, { name, input: name === 'search_tasks' ? { query: 'x' } : name === 'get_task' ? { handle: 't1' } : {} })
      expect(out.is_error, name).toBe(false)
    }
  })

  it('refuses a tool it does not have, rather than throwing', () => {
    const out = runTool(fixture().ctx, { name: 'delete_everything', input: {} })
    expect(out.is_error).toBe(true)
    expect(JSON.stringify(out.content)).toContain('no such tool')
  })

  it('every schema declares its required fields', () => {
    for (const t of TOOL_SCHEMAS) {
      expect(t.input_schema.type, t.name).toBe('object')
      expect(Array.isArray(t.input_schema.required), t.name).toBe(true)
    }
  })
})

describe('F-007 search_tasks', () => {
  it('matches the title and the note, and hides done tasks by default', () => {
    const { ctx } = fixture()
    const byTitle = runTool(ctx, { name: 'search_tasks', input: { query: 'sữa' } }).content as { matches: unknown[] }
    expect(byTitle.matches).toHaveLength(1)

    const byNote = runTool(ctx, { name: 'search_tasks', input: { query: 'chị Lan' } }).content as { matches: { title: string }[] }
    expect(byNote.matches[0]!.title).toBe('Nộp báo cáo quý')

    const done = runTool(ctx, { name: 'search_tasks', input: { query: 'xong' } }).content as { count: number }
    expect(done.count).toBe(0)
    const withDone = runTool(ctx, { name: 'search_tasks', input: { query: 'xong', include_done: true } }).content as { count: number }
    expect(withDone.count).toBe(1)
  })

  it('never returns a uuid, only a handle', () => {
    const { ctx } = fixture()
    const out = runTool(ctx, { name: 'search_tasks', input: { query: 'a' } })
    expect(JSON.stringify(out.content)).not.toContain('"id"')
  })

  it('excludes steps — a task with a step contributes one row, not two', () => {
    const { ctx } = fixture()
    const out = runTool(ctx, { name: 'search_tasks', input: { query: 'bản' } }).content as { count: number }
    expect(out.count).toBe(0)
  })
})

describe('F-007 get_task', () => {
  it('reads one task in full, with its steps addressed under the parent', () => {
    const { ctx } = fixture()
    const out = runTool(ctx, { name: 'get_task', input: { handle: 't2' } }).content as {
      title: string; steps: { handle: string; title: string }[]
    }
    expect(out.title).toBe('Nộp báo cáo quý')
    expect(out.steps).toHaveLength(1)
    expect(out.steps[0]!.handle).toBe('t2.s1')
  })

  it('tells the model a handle is unknown instead of failing the turn', () => {
    const { ctx } = fixture()
    const out = runTool(ctx, { name: 'get_task', input: { handle: 't99' } })
    expect(out.is_error).toBe(true)
    expect(JSON.stringify(out.content)).toContain('no such handle')
  })
})

describe('F-007 list_trash is readable and carries no handle', () => {
  it('lists deleted tasks without giving the model a way to target them', () => {
    const { ctx } = fixture()
    const out = runTool(ctx, { name: 'list_trash', input: {} }).content as {
      deleted: Record<string, unknown>[]; count: number
    }
    expect(out.count).toBe(1)
    expect(out.deleted[0]!.title).toBe('Việc đã xoá')
    expect(Object.keys(out.deleted[0]!)).not.toContain('handle')
  })
})

describe('F-007 now', () => {
  it('answers in the account timezone', () => {
    const { ctx } = fixture()
    const out = runTool(ctx, { name: 'now', input: {} }).content as { timezone: string; local: string }
    expect(out.timezone).toBe('Asia/Ho_Chi_Minh')
    expect(out.local).toBeTypeOf('string')
  })

  it('refuses to imply a zone it does not have', () => {
    const { ctx } = fixture()
    const out = runTool({ ...ctx, zone: null }, { name: 'now', input: {} }).content as {
      timezone: null; note: string
    }
    expect(out.timezone).toBeNull()
    expect(out.note).toContain('do not resolve')
  })
})

describe('F-007 the reply carries two channels', () => {
  const good: ReplyText = { message: 'Đã thêm "Mua sữa cho bé" vào Inbox.', speech: 'Đã thêm Mua sữa cho bé.' }

  it('accepts a well-formed pair', () => {
    expect(checkReplyShape(good)).toEqual([])
  })

  it('refuses markup in the spoken half — it is read aloud', () => {
    const problems = checkReplyShape({ ...good, speech: 'Đã thêm **Mua sữa**.' })
    expect(problems.map((p) => p.kind)).toContain('markup_in_speech')
  })

  it('refuses a list in the spoken half', () => {
    const problems = checkReplyShape({ ...good, speech: 'Ba việc:\n- một\n- hai' })
    expect(problems.map((p) => p.kind)).toContain('markup_in_speech')
  })

  it('refuses either half empty', () => {
    expect(checkReplyShape({ message: '', speech: 'x' }).map((p) => p.kind)).toContain('empty')
    expect(checkReplyShape({ message: 'x', speech: '  ' }).map((p) => p.kind)).toContain('empty')
  })
})

describe('F-007 the facts in the reply are checked, the wording is not', () => {
  it('passes a reply that names only the rows being acted on', () => {
    const reply: ReplyText = { message: 'Xoá "Mua sữa cho bé" nhé?', speech: 'Xoá Mua sữa cho bé nhé?' }
    expect(checkReplyFacts(reply, ['Mua sữa cho bé'])).toEqual([])
  })

  it('catches a named task that is not in the target set', () => {
    const reply: ReplyText = { message: 'Xoá "Nộp báo cáo quý" nhé?', speech: 'Xoá đi nhé?' }
    const problems = checkReplyFacts(reply, ['Mua sữa cho bé'])
    expect(problems.map((p) => p.kind)).toContain('unknown_task_named')
  })

  it('catches a count that disagrees with the batch', () => {
    const reply: ReplyText = { message: 'Xoá 3 tasks nhé?', speech: 'Xoá ba việc nhé?' }
    const problems = checkReplyFacts(reply, ['a', 'b', 'c', 'd', 'e'])
    expect(problems.map((p) => p.kind)).toContain('count_mismatch')
  })

  it('says nothing about wording — two very different sentences both pass', () => {
    const targets = ['Mua sữa cho bé']
    const terse: ReplyText = { message: 'Xong.', speech: 'Xong.' }
    const chatty: ReplyText = {
      message: 'Rồi nhé, mình đã ghi lại việc đó và để trong Inbox cho bạn.',
      speech: 'Rồi nhé, mình đã ghi lại việc đó.',
    }
    expect(checkReplyFacts(terse, targets)).toEqual([])
    expect(checkReplyFacts(chatty, targets)).toEqual([])
  })
})

// ---- the loop -------------------------------------------------------------

function scripted(steps: ModelStep[]): ModelClient {
  let i = 0
  return { next: async () => steps[Math.min(i++, steps.length - 1)]! }
}

const REPLY: ReplyText = { message: 'ok', speech: 'ok' }

describe('F-007 the loop runs as many rounds as the question needs', () => {
  it('finishes on the first round when the model asks for nothing', async () => {
    const { ctx } = fixture()
    const out = await runLoop(scripted([{ kind: 'final', payload: { kind: 'no_match' }, reply: REPLY }]), ctx)
    expect(out.kind).toBe('final')
    if (out.kind === 'final') { expect(out.rounds).toBe(1); expect(out.toolCalls).toBe(0) }
  })

  it('feeds each round\'s tool results back and finishes when the model is ready', async () => {
    const { ctx } = fixture()
    const trace: { call: { name: string }; result: unknown; is_error: boolean }[] = []
    const out = await runLoop(
      scripted([
        { kind: 'tool_use', calls: [{ name: 'search_tasks', input: { query: 'sữa' } }] },
        { kind: 'tool_use', calls: [{ name: 'get_task', input: { handle: 't1' } }] },
        { kind: 'final', payload: { kind: 'delete', handles: ['t1'] }, reply: REPLY },
      ]),
      ctx,
      { trace: trace as never },
    )
    expect(out.kind).toBe('final')
    if (out.kind === 'final') { expect(out.rounds).toBe(3); expect(out.toolCalls).toBe(2) }
    expect(trace.map((t) => t.call.name)).toEqual(['search_tasks', 'get_task'])
  })

  it('stops at the round ceiling rather than spinning', async () => {
    const { ctx } = fixture()
    const out = await runLoop(
      scripted([{ kind: 'tool_use', calls: [{ name: 'now', input: {} }] }]),
      ctx,
    )
    expect(out.kind).toBe('exhausted')
    if (out.kind === 'exhausted') {
      expect(out.reason).toBe('max_rounds')
      expect(out.rounds).toBe(DEFAULT_MAX_ROUNDS)
    }
  })

  it('stops at the wall clock, and says which bound it was', async () => {
    const { ctx } = fixture()
    let t = 0
    const out = await runLoop(
      scripted([{ kind: 'tool_use', calls: [{ name: 'now', input: {} }] }]),
      ctx,
      { wallClockMs: 100, nowMs: () => (t += 60) },
    )
    expect(out.kind).toBe('exhausted')
    if (out.kind === 'exhausted') expect(out.reason).toBe('wall_clock')
  })

  it('keeps an answer that arrives exactly at the ceiling', async () => {
    const { ctx } = fixture()
    const out = await runLoop(
      scripted([
        { kind: 'tool_use', calls: [{ name: 'now', input: {} }] },
        { kind: 'final', payload: { kind: 'query' }, reply: REPLY },
      ]),
      ctx,
      { maxRounds: 2 },
    )
    expect(out.kind).toBe('final')
  })

  it('records a tool error as a result the model can recover from', async () => {
    const { ctx } = fixture()
    const trace: { is_error: boolean }[] = []
    await runLoop(
      scripted([
        { kind: 'tool_use', calls: [{ name: 'get_task', input: { handle: 't99' } }] },
        { kind: 'final', payload: { kind: 'no_match' }, reply: REPLY },
      ]),
      ctx,
      { trace: trace as never },
    )
    expect(trace[0]!.is_error).toBe(true)
  })
})
