// F-007 - the AI usage ledger: what was spent, by whom, on which model, when.
//
// The arithmetic is the part that would be quietly wrong for months, so it is
// tested on its own before anything stores a row.

import { describe, expect, it } from 'vitest'
import {
  addUsage,
  aggregate,
  bucketOf,
  buildUsageRow,
  costOf,
  emptyUsage,
  outcomeLabel,
  priceTableFromEnv,
  type AiUsageRow,
  type PriceTable,
} from '../ai/usage.ts'
import { buildHarness } from './helpers.ts'

const PRICES: PriceTable = {
  'anthropic/claude-opus-5': { input: 5, output: 25, cached_input: 0.5 },
  'openai-compatible/qwen2.5:14b': { input: 0, output: 0 },
}

describe('F-007 what one call cost', () => {
  it('prices fresh input, cached input and output separately', () => {
    // 10k input of which 8k cached, 1k output:
    //   fresh 2000 x $5/M  = $0.010
    //   cached 8000 x $0.5/M = $0.004
    //   output 1000 x $25/M = $0.025
    const cost = costOf(
      { input_tokens: 10_000, cached_input_tokens: 8_000, output_tokens: 1_000 },
      'anthropic', 'claude-opus-5', PRICES,
    )
    expect(cost).toBeCloseTo(0.039, 6)
  })

  it('treats the cached count as a SUBSET of input, never an extra charge', () => {
    const allCached = costOf(
      { input_tokens: 1_000, cached_input_tokens: 1_000, output_tokens: 0 },
      'anthropic', 'claude-opus-5', PRICES,
    )
    // 1000 x $0.5/M, not 1000 x $5/M + 1000 x $0.5/M
    expect(allCached).toBeCloseTo(0.0005, 8)
  })

  it('bills cached tokens at the ordinary rate when no cache rate is configured', () => {
    const prices: PriceTable = { 'x/y': { input: 10, output: 10 } }
    const cost = costOf({ input_tokens: 1_000, cached_input_tokens: 1_000, output_tokens: 0 }, 'x', 'y', prices)
    expect(cost).toBeCloseTo(0.01, 8)
  })

  it('returns null for a model nobody priced, rather than guessing', () => {
    const cost = costOf(
      { input_tokens: 1_000, cached_input_tokens: 0, output_tokens: 100 },
      'some-gateway', 'a-model-we-never-priced', PRICES,
    )
    expect(cost).toBeNull()
  })

  it('costs a free local model at zero, which is not the same as unknown', () => {
    const cost = costOf(
      { input_tokens: 50_000, cached_input_tokens: 0, output_tokens: 5_000 },
      'openai-compatible', 'qwen2.5:14b', PRICES,
    )
    expect(cost).toBe(0)
  })

  it('matches the price key case-insensitively', () => {
    const cost = costOf(
      { input_tokens: 1_000, cached_input_tokens: 0, output_tokens: 0 },
      'Anthropic', 'Claude-Opus-5', PRICES,
    )
    expect(cost).toBeCloseTo(0.005, 8)
  })
})

describe('F-007 the price table is configuration', () => {
  it('is empty when nothing is configured', () => {
    expect(priceTableFromEnv({})).toEqual({})
  })

  it('reads a table and lower-cases its keys', () => {
    const t = priceTableFromEnv({
      AI_PRICES: '{"Anthropic/Claude-Opus-5": {"input": 5, "output": 25, "cached_input": 0.5}}',
    })
    expect(t['anthropic/claude-opus-5']).toEqual({ input: 5, output: 25, cached_input: 0.5 })
  })

  it('refuses malformed configuration rather than reading as free', () => {
    expect(() => priceTableFromEnv({ AI_PRICES: 'not json' })).toThrow(/valid JSON/)
    expect(() => priceTableFromEnv({ AI_PRICES: '[]' })).toThrow(/JSON object/)
    expect(() => priceTableFromEnv({ AI_PRICES: '{"a/b": {"output": 1}}' })).toThrow(/missing input/)
    expect(() => priceTableFromEnv({ AI_PRICES: '{"a/b": {"input": -1, "output": 1}}' })).toThrow(/non-negative/)
  })
})

describe('F-007 usage adds up across rounds', () => {
  it('sums every round, because that is what the turn cost', () => {
    let u = emptyUsage()
    u = addUsage(u, { input_tokens: 1_000, cached_input_tokens: 0, output_tokens: 50 })
    u = addUsage(u, { input_tokens: 1_400, cached_input_tokens: 1_100, output_tokens: 60 })
    expect(u).toEqual({ input_tokens: 2_400, cached_input_tokens: 1_100, output_tokens: 110 })
  })

  it('labels an exhausted loop by which bound it hit', () => {
    expect(outcomeLabel({ kind: 'final' })).toBe('final')
    expect(outcomeLabel({ kind: 'exhausted', reason: 'max_rounds' })).toBe('exhausted:max_rounds')
    expect(outcomeLabel({ kind: 'exhausted', reason: 'wall_clock' })).toBe('exhausted:wall_clock')
  })
})

describe('F-007 time buckets', () => {
  it('names a day, a month and a total', () => {
    expect(bucketOf('2026-08-24T13:05:00.000Z', 'day')).toBe('2026-08-24')
    expect(bucketOf('2026-08-24T13:05:00.000Z', 'month')).toBe('2026-08')
    expect(bucketOf('2026-08-24T13:05:00.000Z', 'total')).toBe('total')
  })

  it('starts a week on Monday and names it by that Monday', () => {
    // 2026-08-24 is a Monday; the 23rd is the Sunday that ENDS the prior week.
    expect(bucketOf('2026-08-24T00:00:00.000Z', 'week')).toBe('2026-08-24')
    expect(bucketOf('2026-08-30T23:59:59.000Z', 'week')).toBe('2026-08-24')
    expect(bucketOf('2026-08-23T12:00:00.000Z', 'week')).toBe('2026-08-17')
  })
})

// ---- aggregation ----------------------------------------------------------

const row = (over: Partial<AiUsageRow>): AiUsageRow =>
  buildUsageRow({
    id: over.id ?? 'r1',
    at: over.at ?? '2026-08-24T10:00:00.000Z',
    userId: over.user_id ?? 'a@x.com',
    provider: over.provider ?? 'anthropic',
    model: over.model ?? 'claude-opus-5',
    usage: {
      input_tokens: over.input_tokens ?? 1_000,
      cached_input_tokens: over.cached_input_tokens ?? 0,
      output_tokens: over.output_tokens ?? 100,
    },
    rounds: over.rounds ?? 1,
    toolCalls: over.tool_calls ?? 0,
    outcome: over.outcome ?? 'final',
    prices: PRICES,
  })

describe('F-007 aggregation by day, week, month and model', () => {
  const rows = [
    row({ id: '1', at: '2026-08-24T09:00:00.000Z', rounds: 1, tool_calls: 0 }),
    row({ id: '2', at: '2026-08-24T20:00:00.000Z', rounds: 3, tool_calls: 2 }),
    row({ id: '3', at: '2026-08-25T09:00:00.000Z', rounds: 1, tool_calls: 0 }),
    row({ id: '4', at: '2026-09-01T09:00:00.000Z', model: 'claude-haiku-4-5', rounds: 1 }),
  ]

  it('groups by day', () => {
    const g = aggregate(rows, { bucket: 'day' })
    expect(g.map((x) => x.bucket)).toEqual(['2026-08-24', '2026-08-25', '2026-09-01'])
    expect(g[0]!.calls).toBe(2)
    expect(g[0]!.rounds).toBe(4)
    expect(g[0]!.tool_calls).toBe(2)
  })

  it('groups by month', () => {
    const g = aggregate(rows, { bucket: 'month' })
    expect(g.map((x) => [x.bucket, x.calls])).toEqual([['2026-08', 3], ['2026-09', 1]])
  })

  it('groups by week, Monday to Sunday', () => {
    const g = aggregate(rows, { bucket: 'week' })
    expect(g.map((x) => x.bucket)).toEqual(['2026-08-24', '2026-08-31'])
    expect(g[0]!.calls).toBe(3)
  })

  it('splits a bucket by model', () => {
    const g = aggregate(rows, { bucket: 'total', by: 'model' })
    expect(g.map((x) => x.key)).toEqual(['anthropic/claude-haiku-4-5', 'anthropic/claude-opus-5'])
    expect(g.find((x) => x.key === 'anthropic/claude-opus-5')!.calls).toBe(3)
  })

  it('splits by user, so one account\'s spend is separable from another\'s', () => {
    const mixed = [row({ id: 'a', user_id: 'a@x.com' }), row({ id: 'b', user_id: 'b@x.com' })]
    const g = aggregate(mixed, { bucket: 'total', by: 'user' })
    expect(g.map((x) => x.key)).toEqual(['a@x.com', 'b@x.com'])
  })

  it('honours a from/to window, inclusive of from and exclusive of to', () => {
    const g = aggregate(rows, {
      bucket: 'total',
      from: '2026-08-24T00:00:00.000Z',
      to: '2026-08-25T00:00:00.000Z',
    })
    expect(g[0]!.calls).toBe(2)
  })

  it('counts unpriced calls separately instead of folding them in as zero', () => {
    const mixed = [
      row({ id: 'a' }),
      row({ id: 'b', provider: 'mystery-gateway', model: 'unknown' }),
    ]
    const g = aggregate(mixed, { bucket: 'total' })
    expect(g[0]!.calls).toBe(2)
    expect(g[0]!.unpriced_calls).toBe(1)
    // The cost total is the priced half only - a total that silently absorbed
    // an unknown as $0 would read as "we know, and it was free".
    expect(g[0]!.cost_usd).toBeCloseTo(row({ id: 'a' }).cost_usd!, 8)
  })

  it('returns nothing at all rather than an empty bucket', () => {
    expect(aggregate([], { bucket: 'day' })).toEqual([])
  })
})

// ---- the endpoint ---------------------------------------------------------

describe('F-007 GET /usage', () => {
  async function seedUsage(h: Awaited<ReturnType<typeof buildHarness>>, rows: AiUsageRow[]) {
    h.store.transact((s) => {
      s.ai_usage ??= {}
      for (const r of rows) s.ai_usage[r.id] = r
    })
  }

  it('reports this account\'s spend, bucketed', async () => {
    const h = await buildHarness()
    await seedUsage(h, [
      row({ id: '1', user_id: 'me@x.com', at: '2026-08-24T09:00:00.000Z' }),
      row({ id: '2', user_id: 'me@x.com', at: '2026-08-24T21:00:00.000Z', rounds: 3, tool_calls: 2 }),
    ])
    const res = await h.agent.get('/usage?bucket=day').set('X-User-Id', 'me@x.com')
    expect(res.status).toBe(200)
    expect(res.body.groups).toHaveLength(1)
    expect(res.body.groups[0]).toMatchObject({ bucket: '2026-08-24', calls: 2, rounds: 4, tool_calls: 2 })
  })

  it('never shows one account another account\'s spend', async () => {
    const h = await buildHarness()
    await seedUsage(h, [
      row({ id: '1', user_id: 'me@x.com' }),
      row({ id: '2', user_id: 'someone-else@x.com' }),
      row({ id: '3', user_id: 'someone-else@x.com' }),
    ])
    const res = await h.agent.get('/usage?bucket=total').set('X-User-Id', 'me@x.com')
    expect(res.body.groups[0].calls).toBe(1)
  })

  it('splits by model on request', async () => {
    const h = await buildHarness()
    await seedUsage(h, [
      row({ id: '1', user_id: 'me@x.com' }),
      row({ id: '2', user_id: 'me@x.com', model: 'claude-haiku-4-5' }),
    ])
    const res = await h.agent.get('/usage?bucket=total&by=model').set('X-User-Id', 'me@x.com')
    expect(res.body.groups.map((g: { key: string }) => g.key)).toEqual([
      'anthropic/claude-haiku-4-5',
      'anthropic/claude-opus-5',
    ])
  })

  it('answers an empty ledger with an empty list, not an error', async () => {
    const h = await buildHarness()
    const res = await h.agent.get('/usage').set('X-User-Id', 'nobody@x.com')
    expect(res.status).toBe(200)
    expect(res.body.groups).toEqual([])
  })

  it('refuses a bucket, a grouping or a date it does not understand', async () => {
    const h = await buildHarness()
    for (const q of ['bucket=fortnight', 'by=colour', 'from=yesterday']) {
      const res = await h.agent.get(`/usage?${q}`).set('X-User-Id', 'me@x.com')
      expect(res.status, q).toBe(400)
      expect(res.body.error.code, q).toBe('VALIDATION')
    }
  })

  it('needs an identity like every other endpoint', async () => {
    const h = await buildHarness()
    const res = await h.zonelessAgent.get('/usage')
    expect(res.status).toBe(401)
  })
})
