// What happens when the model is down, slow, or costing too much (F-007).
//
// Three separate concerns that get conflated, and are kept apart here because
// they fail differently:
//
//   retry     the same model, again, because the failure was transient
//   fallback  a DIFFERENT model, because the first one is not coming back
//   cap       stop, because we have spent enough today
//
// A retry that keeps hitting a 401 is a slow way to fail; a fallback that fires
// on a 429 wastes the cheaper model's quota; and neither notices that the bill
// has quietly tripled. So each has its own trigger.

import type { PriceTable } from './usage.ts'

/** Which failures are worth trying again, and which are answers. */
export function isRetryable(err: unknown): boolean {
  const message = String((err as Error)?.message ?? err)
  // Providers report status in the message our adapters build ("anthropic 529: …").
  const status = /\b(\d{3})\b/.exec(message)?.[1]
  if (status !== undefined) {
    const code = Number(status)
    // 408 timeout, 409 conflict, 429 rate limit, 5xx server. A 4xx that is not
    // one of those is a statement about the request - retrying sends the same
    // wrong request again.
    if (code === 408 || code === 409 || code === 429) return true
    return code >= 500
  }
  // No status at all is usually the socket: DNS, reset, timeout.
  return /econn|etimedout|enotfound|network|socket|fetch failed|aborted/i.test(message)
}

export interface RetryOptions {
  /** total attempts, including the first. 1 disables retrying. */
  attempts?: number
  /** first backoff in ms; each attempt doubles it */
  baseDelayMs?: number
  /** cap on any single backoff */
  maxDelayMs?: number
  /** injected so tests do not actually wait */
  sleep?: (ms: number) => Promise<void>
  /** injected so a test can assert the jitter band without flaking */
  random?: () => number
}

const DEFAULT_ATTEMPTS = 3
const DEFAULT_BASE_MS = 400
const DEFAULT_MAX_MS = 8_000

/**
 * Run `fn`, retrying only what is worth retrying.
 *
 * Backoff is exponential with jitter. The jitter is not decoration: without it,
 * every client that failed at the same instant retries at the same instant, and
 * a provider recovering from an outage is knocked over by its own clients.
 */
export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const attempts = Math.max(1, opts.attempts ?? DEFAULT_ATTEMPTS)
  const base = opts.baseDelayMs ?? DEFAULT_BASE_MS
  const max = opts.maxDelayMs ?? DEFAULT_MAX_MS
  const sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)))
  const random = opts.random ?? Math.random

  let last: unknown
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn()
    } catch (e) {
      last = e
      if (attempt === attempts || !isRetryable(e)) break
      const backoff = Math.min(base * 2 ** (attempt - 1), max)
      // Full jitter: anywhere in [0, backoff], not backoff ± a little.
      await sleep(Math.round(backoff * random()))
    }
  }
  throw last
}

// ---- spending cap ----------------------------------------------------------

export interface CapOptions {
  /** USD per account per day. Absent means no cap. */
  perUserDailyUsd?: number
}

/**
 * Read the cap from configuration. No default: a cap nobody chose would either
 * be so high it does nothing or so low it stops a real user, and both are worse
 * than none.
 */
export function capFromEnv(env: Record<string, string | undefined> = process.env): CapOptions {
  const raw = env.AI_DAILY_USD_PER_USER?.trim()
  if (raw === undefined || raw === '') return {}
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`AI_DAILY_USD_PER_USER must be a positive number, got '${raw}'`)
  }
  return { perUserDailyUsd: n }
}

export interface CapVerdict {
  allowed: boolean
  /** what this account has already spent in the window */
  spentUsd: number
  limitUsd: number | null
  /** how many of the window's calls had no price - the cap cannot see them */
  unpricedCalls: number
}

/**
 * Would one more call be allowed?
 *
 * **Unpriced calls are counted and reported, not silently ignored.** A cap that
 * cannot see half the spend is a cap that does not hold, and the honest thing is
 * to say how blind it is rather than to pretend or to block.
 */
export function checkCap(
  rows: readonly { at: string; cost_usd: number | null }[],
  nowIso: string,
  opts: CapOptions,
): CapVerdict {
  const limit = opts.perUserDailyUsd
  const day = nowIso.slice(0, 10)
  let spent = 0
  let unpriced = 0
  for (const r of rows) {
    if (r.at.slice(0, 10) !== day) continue
    if (r.cost_usd === null) unpriced += 1
    else spent += r.cost_usd
  }
  return {
    allowed: limit === undefined || spent < limit,
    spentUsd: spent,
    limitUsd: limit ?? null,
    unpricedCalls: unpriced,
  }
}

// ---- fallback --------------------------------------------------------------

export interface FallbackConfig {
  provider: string
  model: string
  apiKey: string
  baseUrl?: string
}

/**
 * A second model to try when the first will not answer.
 *
 * Configured, never inferred: picking a fallback automatically would mean
 * choosing a vendor and a price on the user's behalf at the worst possible
 * moment. `AI_FALLBACK_PROVIDER` and `AI_FALLBACK_MODEL`, or nothing.
 */
export function fallbackFromEnv(
  env: Record<string, string | undefined> = process.env,
): FallbackConfig | null {
  const provider = env.AI_FALLBACK_PROVIDER?.trim()
  const model = env.AI_FALLBACK_MODEL?.trim()
  if ((provider ?? '') === '' && (model ?? '') === '') return null
  if ((provider ?? '') === '' || (model ?? '') === '') {
    throw new Error(
      'AI fallback is half-configured: set both AI_FALLBACK_PROVIDER and AI_FALLBACK_MODEL, or neither',
    )
  }
  const vendorKey = `${provider!.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_API_KEY`
  const baseUrl = env.AI_FALLBACK_BASE_URL?.trim()
  return {
    provider: provider!,
    model: model!,
    apiKey: env.AI_FALLBACK_API_KEY?.trim() ?? env[vendorKey]?.trim() ?? '',
    ...(baseUrl === undefined || baseUrl === '' ? {} : { baseUrl }),
  }
}

/** Prices are per provider+model, so a fallback needs its own entry or it records null. */
export function pricedFor(prices: PriceTable, provider: string, model: string): boolean {
  return prices[`${provider.toLowerCase()}/${model.toLowerCase()}`] !== undefined
}
