// F-007 - what happens when the model is down, slow, or costing too much.
//
// Three separate mechanisms, tested apart and then together, because the ways
// they go wrong are different: a retry that keeps hitting a 401 is a slow way to
// fail, a fallback that fires on a 429 spends the cheaper model's quota on a
// problem that would have cleared, and a cap that cannot see unpriced calls does
// not hold.

import { describe, expect, it } from 'vitest'
import '../ai/providers/index.ts'
import { FakeClock } from '../ports/clock.ts'
import { MemoryStore } from '../store/memory-store.ts'
import type { InterpreterContext } from '../ports/interpreter.ts'
import { createModelInterpreter, type TurnTelemetry } from '../ai/interpreter.ts'
import { assertUsable, registerProvider } from '../ai/provider.ts'
import {
  capFromEnv,
  checkCap,
  fallbackFromEnv,
  isRetryable,
  withRetry,
} from '../ai/resilience.ts'
import { buildUsageRow, type PriceTable } from '../ai/usage.ts'

const USER = 'me@x.com'
const HANDLES = { t1: 'id-1' }
const PRICES: PriceTable = { 'a/b': { input: 5, output: 25 } }

// ---- retry -----------------------------------------------------------------

describe('F-007 what is worth retrying', () => {
  it('retries a rate limit, a timeout and a server error', () => {
    for (const m of ['anthropic 429: slow down', 'openai 500: oops', 'x 503: busy', 'y 408: timeout']) {
      expect(isRetryable(new Error(m)), m).toBe(true)
    }
  })

  it('does not retry an answer', () => {
    // A 401, 403 or 400 is a statement about the request. Sending the same wrong
    // request again is a slow way to get the same answer.
    for (const m of ['anthropic 401: bad key', 'openai 400: invalid tool', 'z 404: no such model']) {
      expect(isRetryable(new Error(m)), m).toBe(false)
    }
  })

  it('retries a socket that never got a status at all', () => {
    for (const m of ['fetch failed', 'ECONNRESET', 'ETIMEDOUT', 'getaddrinfo ENOTFOUND api.x']) {
      expect(isRetryable(new Error(m)), m).toBe(true)
    }
  })

  it('gives up after the configured number of attempts', async () => {
    let calls = 0
    const slept: number[] = []
    await expect(withRetry(async () => { calls++; throw new Error('529 overloaded') }, {
      attempts: 3, baseDelayMs: 100, sleep: async (ms) => { slept.push(ms) }, random: () => 1,
    })).rejects.toThrow(/529/)
    expect(calls).toBe(3)
    // Exponential: 100 then 200. No sleep after the last attempt.
    expect(slept).toEqual([100, 200])
  })

  it('stops immediately on something that will not get better', async () => {
    let calls = 0
    await expect(withRetry(async () => { calls++; throw new Error('401 bad key') }, { attempts: 5 }))
      .rejects.toThrow(/401/)
    expect(calls).toBe(1)
  })

  it('returns the first success without sleeping again', async () => {
    let calls = 0
    const slept: number[] = []
    const out = await withRetry(async () => {
      calls++
      if (calls < 3) throw new Error('500 x')
      return 'ok'
    }, { attempts: 5, baseDelayMs: 10, sleep: async (ms) => { slept.push(ms) }, random: () => 1 })
    expect(out).toBe('ok')
    expect(calls).toBe(3)
    expect(slept).toHaveLength(2)
  })

  it('jitters, so clients that failed together do not retry together', async () => {
    const slept: number[] = []
    await expect(withRetry(async () => { throw new Error('500') }, {
      attempts: 4, baseDelayMs: 1000, sleep: async (ms) => { slept.push(ms) }, random: () => 0.25,
    })).rejects.toThrow()
    // Full jitter: a quarter of 1000, 2000, 4000.
    expect(slept).toEqual([250, 500, 1000])
  })

  it('respects the ceiling on a long backoff', async () => {
    const slept: number[] = []
    await expect(withRetry(async () => { throw new Error('500') }, {
      attempts: 6, baseDelayMs: 1000, maxDelayMs: 2000,
      sleep: async (ms) => { slept.push(ms) }, random: () => 1,
    })).rejects.toThrow()
    expect(Math.max(...slept)).toBe(2000)
  })
})

// ---- cap --------------------------------------------------------------------

/** A ledger row that cost exactly `cost`, or whose cost is unknown. `checkCap`
 *  reads only `at` and `cost_usd`, so nothing else needs to be real here. */
const spend = (at: string, cost: number | null): { at: string; cost_usd: number | null } =>
  ({ at, cost_usd: cost })

describe('F-007 the daily cap', () => {
  const NOW = '2026-08-24T15:00:00.000Z'

  it('allows everything when no cap is configured', () => {
    const v = checkCap([spend(NOW, 100)], NOW, {})
    expect(v.allowed).toBe(true)
    expect(v.limitUsd).toBeNull()
  })

  it('counts only today', () => {
    const rows = [spend('2026-08-23T23:00:00.000Z', 5), spend(NOW, 0.5)]
    const v = checkCap(rows, NOW, { perUserDailyUsd: 1 })
    expect(v.spentUsd).toBeCloseTo(0.5, 6)
    expect(v.allowed).toBe(true)
  })

  it('stops once the limit is reached', () => {
    const v = checkCap([spend(NOW, 0.6), spend(NOW, 0.5)], NOW, { perUserDailyUsd: 1 })
    expect(v.spentUsd).toBeCloseTo(1.1, 6)
    expect(v.allowed).toBe(false)
  })

  it('says how blind it is rather than pretending', () => {
    // A cap that cannot see half the spend is a cap that does not hold. It
    // neither blocks on the unknown nor hides it.
    const v = checkCap([spend(NOW, 0.2), spend(NOW, null), spend(NOW, null)], NOW, { perUserDailyUsd: 1 })
    expect(v.allowed).toBe(true)
    expect(v.unpricedCalls).toBe(2)
  })

  it('is configured, with no default', () => {
    expect(capFromEnv({})).toEqual({})
    expect(capFromEnv({ AI_DAILY_USD_PER_USER: '2.50' })).toEqual({ perUserDailyUsd: 2.5 })
    expect(() => capFromEnv({ AI_DAILY_USD_PER_USER: '0' })).toThrow(/positive/)
    expect(() => capFromEnv({ AI_DAILY_USD_PER_USER: 'lots' })).toThrow(/positive/)
  })
})

// ---- fallback configuration -------------------------------------------------

describe('F-007 the fallback model is configured, never inferred', () => {
  it('is absent unless asked for', () => {
    expect(fallbackFromEnv({})).toBeNull()
  })

  it('reads a whole second configuration', () => {
    expect(fallbackFromEnv({
      AI_FALLBACK_PROVIDER: 'anthropic', AI_FALLBACK_MODEL: 'claude-haiku-4-5',
      ANTHROPIC_API_KEY: 'k',
    })).toEqual({ provider: 'anthropic', model: 'claude-haiku-4-5', apiKey: 'k' })
  })

  it('refuses half of one', () => {
    expect(() => fallbackFromEnv({ AI_FALLBACK_PROVIDER: 'anthropic' })).toThrow(/half-configured/)
  })
})

describe('F-007 a misconfiguration fails at startup, not on a user\'s turn', () => {
  it('rejects a provider nobody registered', () => {
    // Without this the server starts, logs `hal9000/x`, and answers every
    // request with "I did not understand". Observed before this check existed.
    expect(() => assertUsable({ provider: 'hal9000', model: 'x', apiKey: 'k' }))
      .toThrow(/unknown AI provider 'hal9000'.*anthropic/)
  })

  it('accepts one that is registered', () => {
    expect(() => assertUsable({ provider: 'anthropic', model: 'claude-haiku-4-5', apiKey: 'k' }))
      .not.toThrow()
  })

  it('rejects an empty model', () => {
    expect(() => assertUsable({ provider: 'anthropic', model: '  ', apiKey: 'k' })).toThrow(/AI_MODEL/)
  })

  it('rejects a provider that cannot call tools, which this design requires', () => {
    registerProvider('no-tools', () => ({ next: async () => ({ kind: 'final', payload: {}, reply: REPLY }) }),
      { cache: 'none', toolCalling: false })
    expect(() => assertUsable({ provider: 'no-tools', model: 'm', apiKey: '' }))
      .toThrow(/does not support tool calling/)
  })
})

// ---- all three, on a real turn ----------------------------------------------

const CTX: InterpreterContext = {
  user_id: USER, handles: HANDLES,
  transcript: 'add a task to buy milk', source: 'voice', timezone: 'UTC',
  tasks: [{ handle: 't1', title: 'Buy milk', status: 'inbox', note: null, due_at: null, reminder_at: null, priority: null, list_id: null }],
  deleted_tasks: [], lists: [], recent_turns: [], question: null,
}

const REPLY = { message: 'Added "Buy milk".', speech: 'Added Buy milk.' }
let seq = 0

/** A provider that fails `failures` times, then answers. */
function flaky(failures: number, error: string) {
  const name = `flaky-${seq++}`
  let seen = 0
  registerProvider(name, () => ({
    next: async () => {
      if (seen++ < failures) throw new Error(error)
      return { kind: 'final', payload: { kind: 'delete', handles: ['t1'] }, reply: REPLY,
        usage: { input_tokens: 100, cached_input_tokens: 0, output_tokens: 10 } } as never
    },
  }), { cache: 'none', toolCalling: true })
  return name
}

function interp(overrides: Record<string, unknown>, provider: string) {
  const seen: TurnTelemetry[] = []
  const store = new MemoryStore()
  const clock = new FakeClock()
  const it = createModelInterpreter({
    config: { provider, model: 'm1', apiKey: '' },
    store, clock,
    onTurn: (_u, t) => seen.push(t),
    retry: { baseDelayMs: 1, sleep: async () => {}, random: () => 0 },
    ...overrides,
  })
  return { it, seen, store, clock }
}

describe('F-007 resilience on a real turn', () => {
  it('rides out a transient failure and still answers', async () => {
    const { it: i, seen } = interp({}, flaky(2, '529 overloaded'))
    expect(await i.interpret(CTX)).toEqual({ kind: 'delete', handles: ['t1'] })
    expect(seen[0]!.outcome).toBe('final')
  })

  it('does not retry a bad key — it fails once, quickly', async () => {
    const { it: i, seen } = interp({}, flaky(99, '401 bad key'))
    expect(await i.interpret(CTX)).toEqual({ kind: 'no_match' })
    expect(seen[0]!.refusal).toContain('401')
  })

  it('falls back to the second model, and bills the model that answered', async () => {
    const good = flaky(0, '')
    const { it: i, seen } = interp(
      { fallback: { provider: good, model: 'cheap-v1', apiKey: '' } },
      flaky(99, '503 down'),
    )
    expect(await i.interpret(CTX)).toEqual({ kind: 'delete', handles: ['t1'] })
    // The bill belongs to the model that ran, not the one that was configured.
    expect(seen[0]!.model).toBe('cheap-v1')
    expect(seen[0]!.provider).toBe(good)
  })

  it('reports the original failure when the fallback fails too', async () => {
    const { it: i, seen } = interp(
      { fallback: { provider: flaky(99, '500 also down'), model: 'cheap-v1', apiKey: '' } },
      flaky(99, '503 down'),
    )
    expect(await i.interpret(CTX)).toEqual({ kind: 'no_match' })
    expect(seen[0]!.outcome).toBe('error')
  })

  it('stops spending once the day\'s cap is reached, without calling the model', async () => {
    const provider = flaky(0, '')
    const { it: i, seen, store, clock } = interp({ cap: { perUserDailyUsd: 0.01 } }, provider)
    // Yesterday's spend does not count; today's does.
    store.transact((st) => {
      st.ai_usage ??= {}
      for (const [id, at, cost] of [
        ['old', '2026-08-18T10:00:00.000Z', 5],
        ['today', new Date(clock.now()).toISOString(), 0.02],
      ] as const) {
        st.ai_usage[id] = buildUsageRow({
          id, at, userId: USER, provider: 'a', model: 'b',
          usage: { input_tokens: cost * 1e6 / 5, cached_input_tokens: 0, output_tokens: 0 },
          rounds: 1, toolCalls: 0, outcome: 'final', prices: PRICES,
        })
      }
    })
    expect(await i.interpret(CTX)).toEqual({ kind: 'no_match' })
    expect(seen[0]!.outcome).toBe('capped')
    expect(seen[0]!.refusal).toContain('daily cap reached')
    // Nothing was spent finding out.
    expect(seen[0]!.usage).toEqual({ input_tokens: 0, cached_input_tokens: 0, output_tokens: 0 })
  })

  it('lets the turn through while the account is under its cap', async () => {
    const { it: i, seen } = interp({ cap: { perUserDailyUsd: 10 } }, flaky(0, ''))
    expect(await i.interpret(CTX)).toEqual({ kind: 'delete', handles: ['t1'] })
    expect(seen[0]!.outcome).toBe('final')
  })
})
