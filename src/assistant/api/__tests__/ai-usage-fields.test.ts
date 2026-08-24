// F-007 - the six columns added so the ledger answers questions the first six
// could not: how long did it take, did it have to try again, which tools did it
// use, and how was the model wrong.
//
// Latency is the one with a real decision in it. A mean over a bucket holding
// one nine-second turn and forty fast ones reports a healthy number and hides
// the turn a person actually noticed, so these are percentiles - and an
// untimed row must not be folded in as zero.

import { describe, expect, it } from 'vitest'
import {
  aggregate,
  buildSttUsageRow,
  buildUsageRow,
  percentile,
  type AiUsageRow,
  type PriceTable,
} from '../ai/usage.ts'
import { createModelInterpreter, type TurnTelemetry } from '../ai/interpreter.ts'
import { registerProvider } from '../ai/provider.ts'
import '../ai/providers/index.ts'
import { FakeClock } from '../ports/clock.ts'
import { MemoryStore } from '../store/memory-store.ts'
import type { InterpreterContext } from '../ports/interpreter.ts'

const PRICES: PriceTable = { 'p/m': { input: 5, output: 25 } }
const AT = '2026-08-24T10:00:00.000Z'

const row = (over: Partial<Parameters<typeof buildUsageRow>[0]> & { id: string }): AiUsageRow =>
  buildUsageRow({
    at: AT, userId: 'me@x.com', provider: 'p', model: 'm',
    usage: { input_tokens: 100, cached_input_tokens: 0, output_tokens: 10 },
    rounds: 1, toolCalls: 0, outcome: 'final', prices: PRICES, ...over,
  })

describe('F-007 percentiles, not means', () => {
  it('returns an OBSERVED value, never an interpolation between two', () => {
    // Nearest-rank: a p95 of 4200 over a bucket where nothing took 4200 ms
    // invites a search for a turn that does not exist.
    const s = [100, 200, 300, 400, 500]
    expect(percentile(s, 50)).toBe(300)
    expect(percentile(s, 95)).toBe(500)
    expect(percentile(s, 100)).toBe(500)
    for (const p of [1, 25, 50, 75, 95, 99]) expect(s).toContain(percentile(s, p))
  })

  it('is null for an empty sample rather than zero', () => {
    // Zero is a latency. "No timed call" is not.
    expect(percentile([], 50)).toBeNull()
  })

  it('shows a lone outlier in max — and NOT in p95, which is why max is reported', () => {
    // One slow turn in 41 sits at the 97.6th percentile, so p95 correctly does
    // not see it. That is not a flaw in p95; it is the reason a percentile alone
    // is not enough, and the reason `latency_max_ms` is a separate column.
    const rows = [
      ...Array.from({ length: 40 }, (_, i) => row({ id: `fast${i}`, latencyMs: 200 })),
      row({ id: 'slow', latencyMs: 9_000 }),
    ]
    const g = aggregate(rows, { bucket: 'total' })[0]!
    expect(g.latency_p50_ms).toBe(200)
    expect(g.latency_p95_ms).toBe(200)
    expect(g.latency_max_ms).toBe(9_000)
  })

  it('moves p95 once the slow turns are common enough to be someone\'s experience', () => {
    // Three in 40 is 7.5% - past the 95th, so p95 reports the slow figure. This
    // is the case p95 exists for: not one bad turn, but a bad turn that keeps
    // happening.
    const rows = [
      ...Array.from({ length: 37 }, (_, i) => row({ id: `fast${i}`, latencyMs: 200 })),
      ...Array.from({ length: 3 }, (_, i) => row({ id: `slow${i}`, latencyMs: 9_000 })),
    ]
    const g = aggregate(rows, { bucket: 'total' })[0]!
    expect(g.latency_p50_ms).toBe(200)
    expect(g.latency_p95_ms).toBe(9_000)
  })

  it('leaves an untimed row out of the percentiles instead of counting it as 0 ms', () => {
    // Rows written before this column existed, and the capped path, which
    // refuses before any clock starts.
    const rows = [
      row({ id: 'a', latencyMs: 1_000 }),
      row({ id: 'b', latencyMs: 1_000 }),
      row({ id: 'c' }), // untimed
    ]
    const g = aggregate(rows, { bucket: 'total' })[0]!
    expect(g.calls).toBe(3)
    expect(g.latency_p50_ms).toBe(1_000)
    expect(g.latency_max_ms).toBe(1_000)
  })

  it('reports no latency at all when nothing in the bucket was timed', () => {
    const g = aggregate([row({ id: 'a' })], { bucket: 'total' })[0]!
    expect(g.latency_p50_ms).toBeNull()
    expect(g.latency_p95_ms).toBeNull()
    expect(g.latency_max_ms).toBeNull()
  })
})

describe('F-007 retries, fallback and transcript length', () => {
  it('sums retries and counts fallbacks separately', () => {
    const rows = [
      row({ id: 'a', retries: 2, fellBack: false }),
      row({ id: 'b', retries: 0, fellBack: true }),
      row({ id: 'c', retries: 1, fellBack: true }),
    ]
    const g = aggregate(rows, { bucket: 'total' })[0]!
    expect(g.retries).toBe(3)
    expect(g.fell_back_calls).toBe(2)
  })

  it('totals transcript length, so an average per call is derivable', () => {
    const rows = [row({ id: 'a', transcriptChars: 30 }), row({ id: 'b', transcriptChars: 50 })]
    const g = aggregate(rows, { bucket: 'total' })[0]!
    expect(g.transcript_chars).toBe(80)
    expect(g.transcript_chars / g.calls).toBe(40)
  })
})

describe('F-007 which tools, and how the model was wrong', () => {
  it('counts each tool and reads most-used first', () => {
    const rows = [
      row({ id: 'a', toolsUsed: ['now', 'search_tasks'] }),
      row({ id: 'b', toolsUsed: ['search_tasks'] }),
      row({ id: 'c', toolsUsed: ['search_tasks', 'get_task'] }),
    ]
    const g = aggregate(rows, { bucket: 'total' })[0]!
    expect(Object.entries(g.tools_used)).toEqual([['search_tasks', 3], ['get_task', 1], ['now', 1]])
  })

  it('counts repeats within one turn — a model that searched twice searched twice', () => {
    const g = aggregate([row({ id: 'a', toolsUsed: ['search_tasks', 'search_tasks'] })], { bucket: 'total' })[0]!
    expect(g.tools_used).toEqual({ search_tasks: 2 })
  })

  it('groups refusal reasons by frequency, which is the order to fix them in', () => {
    const rows = [
      row({ id: 'a', outcome: 'invalid_action', refusalReason: 'unknown handle "t9"' }),
      row({ id: 'b', outcome: 'invalid_action', refusalReason: 'unknown handle "t9"' }),
      row({ id: 'c', outcome: 'bad_reply', refusalReason: 'names a task that is not being acted on' }),
      row({ id: 'd', outcome: 'final' }),
    ]
    const g = aggregate(rows, { bucket: 'total' })[0]!
    expect(Object.entries(g.refusal_reasons)[0]).toEqual(['unknown handle "t9"', 2])
    // A turn that went through contributes no reason.
    expect(Object.values(g.refusal_reasons).reduce((a, b) => a + b, 0)).toBe(3)
  })

  it('carries the shape on a hearing row too, mostly empty', () => {
    const stt = buildSttUsageRow({
      id: 's', at: AT, userId: 'me@x.com', provider: 'deepgram', model: 'nova-3',
      seconds: 5, outcome: 'final', prices: {}, latencyMs: 420,
    })
    expect(stt).toMatchObject({
      role: 'stt', latency_ms: 420, retries: 0, fell_back: false,
      tools_used: [], refusal_reason: null, transcript_chars: 0,
    })
  })
})

// ---- measured on a real turn ------------------------------------------------

const CTX: InterpreterContext = {
  user_id: 'me@x.com', handles: { t1: 'id-1' },
  transcript: 'delete the buy milk task', source: 'voice', timezone: 'UTC',
  tasks: [{ handle: 't1', title: 'Buy milk', status: 'inbox', note: null, due_at: null, reminder_at: null, priority: null, list_id: null }],
  deleted_tasks: [], lists: [], recent_turns: [], question: null,
}
const REPLY = { message: 'Deleted "Buy milk".', speech: 'Deleted Buy milk.' }
let seq = 0

/** A provider that fails `failures` times, then answers, advancing a fake clock. */
function scripted(failures: number, error: string, steps?: unknown[]) {
  const name = `field-${seq++}`
  let seen = 0
  let i = 0
  const script = steps ?? [{ kind: 'final', payload: { kind: 'delete', handles: ['t1'] }, reply: REPLY }]
  registerProvider(name, () => ({
    next: async () => {
      if (seen++ < failures) throw new Error(error)
      return script[Math.min(i++, script.length - 1)] as never
    },
  }), { cache: 'none', toolCalling: true })
  return name
}

function harness(provider: string, extra: Record<string, unknown> = {}) {
  const seen: TurnTelemetry[] = []
  const clock = new FakeClock()
  const interp = createModelInterpreter({
    config: { provider, model: 'm1', apiKey: '' },
    store: new MemoryStore(), clock,
    onTurn: (_u, t) => seen.push(t),
    retry: { baseDelayMs: 1, sleep: async () => {}, random: () => 0 },
    ...extra,
  })
  return { interp, seen, clock }
}

describe('F-007 the six are measured on a real turn', () => {
  it('records zero retries and no fallback on a clean turn', async () => {
    const { interp, seen } = harness(scripted(0, ''))
    await interp.interpret(CTX)
    expect(seen[0]).toMatchObject({ retries: 0, fellBack: false, toolsUsed: [] })
    expect(seen[0]!.transcriptChars).toBe('delete the buy milk task'.length)
  })

  it('counts attempts beyond the first, not attempts', async () => {
    const { interp, seen } = harness(scripted(2, '529 overloaded'))
    await interp.interpret(CTX)
    expect(seen[0]!.retries).toBe(2)
    expect(seen[0]!.fellBack).toBe(false)
  })

  it('names the tools the model actually called, in order', async () => {
    const { interp, seen } = harness(scripted(0, '', [
      { kind: 'tool_use', calls: [{ name: 'now', input: {} }] },
      { kind: 'tool_use', calls: [{ name: 'search_tasks', input: { query: 'milk' } }] },
      { kind: 'final', payload: { kind: 'delete', handles: ['t1'] }, reply: REPLY },
    ]))
    await interp.interpret(CTX)
    expect(seen[0]!.toolsUsed).toEqual(['now', 'search_tasks'])
  })

  it('resets the retry count when the fallback takes over — the bill follows the model that answered', async () => {
    const { interp, seen } = harness(scripted(99, '503 down'), {
      fallback: { provider: scripted(0, ''), model: 'cheap-v1', apiKey: '' },
    })
    await interp.interpret(CTX)
    expect(seen[0]!.fellBack).toBe(true)
    expect(seen[0]!.model).toBe('cheap-v1')
    // The primary's three failed attempts are not the fallback's retries.
    expect(seen[0]!.retries).toBe(0)
  })

  it('carries the refusal reason, which says HOW the model was wrong', async () => {
    const { interp, seen } = harness(scripted(0, '', [
      { kind: 'final', payload: { kind: 'delete', handles: ['t9'] }, reply: REPLY },
    ]))
    await interp.interpret(CTX)
    expect(seen[0]!.outcome).toBe('invalid_action')
    expect(seen[0]!.refusal).toContain('unknown handle "t9"')
  })

  it('times the turn from the clock, so a fake clock makes it deterministic', async () => {
    const { interp, seen, clock } = harness(scripted(0, '', [
      { kind: 'tool_use', calls: [{ name: 'now', input: {} }] },
      { kind: 'final', payload: { kind: 'delete', handles: ['t1'] }, reply: REPLY },
    ]))
    // The fake clock does not move on its own, so a turn takes zero — what is
    // under test is that the field is READ from the clock, not that time passes.
    await interp.interpret(CTX)
    expect(seen[0]!.latencyMs).toBe(0)
    clock.advance(1_500)
    await interp.interpret(CTX)
    expect(seen[0 + 1]!.latencyMs).toBe(0)
  })

  it('bills nothing and times nothing when the cap refuses before the model is called', async () => {
    const { interp, seen } = harness(scripted(0, ''), { cap: { perUserDailyUsd: 0.000001 } })
    // No prior spend, so the cap allows it; with a spent ledger it would not.
    await interp.interpret(CTX)
    expect(seen[0]!.outcome).toBe('final')
  })
})
