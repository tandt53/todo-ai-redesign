// What the AI actually cost, recorded per call (F-007).
//
// Every estimate in this project's cost discussions was arithmetic over guessed
// token counts. This records what the provider itself reported, per user, per
// call, so the guesses can be replaced by measurements.
//
// **Prices are configuration, exactly like the model is.** A price compiled in
// would be wrong within weeks and would quietly misreport every historical row.
// A call whose model has no configured price records its TOKENS and leaves cost
// `null` - a missing number, which is honest, rather than an invented one.
//
// Cost is computed and stored AT THE TIME OF THE CALL, not at query time: what
// a call cost is a fact about the day it ran, and a later price change must not
// rewrite it.

/** What a provider reports about one exchange. */
export interface ModelUsage {
  input_tokens: number
  /** the subset of input billed at the cache-read rate (0 when not cached) */
  cached_input_tokens: number
  output_tokens: number
}

export const emptyUsage = (): ModelUsage => ({
  input_tokens: 0,
  cached_input_tokens: 0,
  output_tokens: 0,
})

export function addUsage(a: ModelUsage, b: ModelUsage): ModelUsage {
  return {
    input_tokens: a.input_tokens + b.input_tokens,
    cached_input_tokens: a.cached_input_tokens + b.cached_input_tokens,
    output_tokens: a.output_tokens + b.output_tokens,
  }
}

/**
 * Which of the three AI roles a row is about. They are billed by three different
 * units, so one ledger with a `role` column beats three ledgers that have to be
 * joined to answer "what did this user cost me".
 */
export type AiRole = 'reasoning' | 'stt' | 'tts'

/** One recorded call's worth of AI use. */
export interface AiUsageRow {
  id: string
  user_id: string
  /** ISO instant the call finished */
  at: string
  /** defaults to `reasoning` on rows written before the other two roles existed */
  role: AiRole
  provider: string
  model: string
  input_tokens: number
  cached_input_tokens: number
  output_tokens: number
  /** hearing: billable audio length. 0 for the other roles. */
  audio_seconds: number
  /** speaking: billable characters. 0 for the other roles. */
  characters: number
  /** how many exchanges with the model this turn took (reasoning only) */
  rounds: number
  tool_calls: number
  /**
   * Wall clock for the whole call, including retries and any fallback.
   *
   * Recorded because naturalness is mostly LATENCY, and nothing else here
   * measures it: a turn that costs a tenth of a cent and takes nine seconds is
   * a bad turn, and every other column on this row calls it a good one.
   */
  latency_ms: number
  /** attempts beyond the first. 0 on a call that worked the first time. */
  retries: number
  /** true when the configured model would not answer and the fallback did */
  fell_back: boolean
  /**
   * Which tools the model called, in order, with repeats.
   * `tool_calls: 2` says it used two; this says which two — the difference
   * between "it looked the date up" and "it guessed".
   */
  tools_used: string[]
  /**
   * Why the turn was refused, verbatim from the interpreter. Null on a turn
   * that went through.
   *
   * `outcome` says a turn was refused; this says HOW the model was wrong, which
   * is the only one of the two that tells you what to change in the prompt.
   */
  refusal_reason: string | null
  /** length of what the user said. Not the text — see the note below. */
  transcript_chars: number
  /** `final`, or `exhausted:max_rounds` / `exhausted:wall_clock` */
  outcome: string
  /** null when no price is configured for this provider+model - never guessed */
  cost_usd: number | null
}

/**
 * What a provider charges, in whichever unit it publishes.
 *
 * Three units because there are three roles and no vendor converts between
 * them: tokens for reasoning (USD per MILLION), minutes for hearing, characters
 * for speaking (USD per MILLION). Putting them in one shape means an entry can
 * only ever be read in the unit it was written in.
 */
export interface ModelPrice {
  /** USD per million input tokens (reasoning) */
  input?: number
  /** USD per million output tokens (reasoning) */
  output?: number
  /** the cache-read rate; when absent, cached tokens are billed as ordinary input */
  cached_input?: number
  /** USD per minute of audio (hearing) */
  per_minute?: number
  /** USD per million characters (speaking) */
  per_million_chars?: number
}

/** Keyed `provider/model`, both lower-cased. */
export type PriceTable = Record<string, ModelPrice>

const priceKey = (provider: string, model: string): string =>
  `${provider.trim().toLowerCase()}/${model.trim().toLowerCase()}`

/**
 * Read the table from configuration. `AI_PRICES` is JSON, keyed `provider/model`,
 * in USD per million tokens:
 *
 *     {"anthropic/claude-opus-5": {"input": 5, "output": 25, "cached_input": 0.5}}
 *
 * A malformed table is an error at startup rather than a silently empty one -
 * an empty table looks identical to "everything is free".
 */
export function priceTableFromEnv(
  env: Record<string, string | undefined> = process.env,
): PriceTable {
  const raw = env.AI_PRICES?.trim()
  if (raw === undefined || raw === '') return {}
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('AI_PRICES is not valid JSON')
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('AI_PRICES must be a JSON object keyed "provider/model"')
  }
  const table: PriceTable = {}
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof value !== 'object' || value === null) {
      throw new Error(`AI_PRICES["${key}"] must be an object`)
    }
    const v = value as Record<string, unknown>
    const num = (name: string, required: boolean): number | undefined => {
      const n = v[name]
      if (n === undefined) {
        if (required) throw new Error(`AI_PRICES["${key}"] is missing ${name}`)
        return undefined
      }
      if (typeof n !== 'number' || !Number.isFinite(n) || n < 0) {
        throw new Error(`AI_PRICES["${key}"].${name} must be a non-negative number`)
      }
      return n
    }
    const entry: ModelPrice = {}
    for (const field of ['input', 'output', 'cached_input', 'per_minute', 'per_million_chars'] as const) {
      const n = num(field, false)
      if (n !== undefined) entry[field] = n
    }
    if (Object.keys(entry).length === 0) {
      throw new Error(
        `AI_PRICES["${key}"] prices nothing - give it input/output, per_minute, or per_million_chars`,
      )
    }
    // Token pricing is a PAIR. One half alone would silently price the other
    // half at zero, which reads as a real number and is not one. (Widening this
    // shape for audio and characters opened exactly that hole; the test that
    // caught it was already there.)
    if ((entry.input === undefined) !== (entry.output === undefined)) {
      throw new Error(`AI_PRICES["${key}"] needs both input and output, or neither`)
    }
    table[key.trim().toLowerCase()] = entry
  }
  return table
}

/**
 * What one call cost, or `null` when the price is unknown.
 *
 * `cached_input_tokens` is treated as a SUBSET of `input_tokens`, which is how
 * every provider reports it - billing them separately as well would double-count
 * the cached half.
 */
export function costOf(
  usage: ModelUsage,
  provider: string,
  model: string,
  prices: PriceTable,
): number | null {
  const price = prices[priceKey(provider, model)]
  if (price === undefined) return null
  if (price.input === undefined && price.output === undefined) return null
  const inRate = price.input ?? 0
  const outRate = price.output ?? 0
  const cached = Math.min(usage.cached_input_tokens, usage.input_tokens)
  const fresh = usage.input_tokens - cached
  const cachedRate = price.cached_input ?? inRate
  return (fresh * inRate + cached * cachedRate + usage.output_tokens * outRate) / 1e6
}

/** Hearing: billed by the minute, and the row records seconds. */
export function costOfAudio(
  seconds: number,
  provider: string,
  model: string,
  prices: PriceTable,
): number | null {
  const rate = prices[priceKey(provider, model)]?.per_minute
  return rate === undefined ? null : (seconds / 60) * rate
}

/** Speaking: billed per million characters. */
export function costOfCharacters(
  characters: number,
  provider: string,
  model: string,
  prices: PriceTable,
): number | null {
  const rate = prices[priceKey(provider, model)]?.per_million_chars
  return rate === undefined ? null : (characters / 1e6) * rate
}

/**
 * Build the ledger row for one finished turn.
 *
 * Pure, and separate from storing it, so the arithmetic that decides what a
 * turn cost is testable on its own - it is the part that would be wrong for
 * months without anybody noticing.
 */
export function buildUsageRow(input: {
  id: string
  at: string
  userId: string
  provider: string
  model: string
  usage: ModelUsage
  rounds: number
  toolCalls: number
  outcome: string
  prices: PriceTable
  latencyMs?: number
  retries?: number
  fellBack?: boolean
  toolsUsed?: readonly string[]
  refusalReason?: string | null
  transcriptChars?: number
}): AiUsageRow {
  return {
    id: input.id,
    user_id: input.userId,
    at: input.at,
    role: 'reasoning',
    provider: input.provider,
    model: input.model,
    input_tokens: input.usage.input_tokens,
    cached_input_tokens: input.usage.cached_input_tokens,
    output_tokens: input.usage.output_tokens,
    audio_seconds: 0,
    characters: 0,
    rounds: input.rounds,
    tool_calls: input.toolCalls,
    latency_ms: input.latencyMs ?? 0,
    retries: input.retries ?? 0,
    fell_back: input.fellBack ?? false,
    tools_used: [...(input.toolsUsed ?? [])],
    refusal_reason: input.refusalReason ?? null,
    transcript_chars: input.transcriptChars ?? 0,
    outcome: input.outcome,
    cost_usd: costOf(input.usage, input.provider, input.model, input.prices),
  }
}

/** Hearing. `seconds` is what the provider reported, or the caller's own measure. */
export function buildSttUsageRow(input: {
  id: string
  at: string
  userId: string
  provider: string
  model: string
  seconds: number
  outcome: string
  prices: PriceTable
  latencyMs?: number
}): AiUsageRow {
  return {
    id: input.id,
    user_id: input.userId,
    at: input.at,
    role: 'stt',
    provider: input.provider,
    model: input.model,
    input_tokens: 0,
    cached_input_tokens: 0,
    output_tokens: 0,
    audio_seconds: input.seconds,
    characters: 0,
    rounds: 0,
    tool_calls: 0,
    latency_ms: input.latencyMs ?? 0,
    retries: 0,
    fell_back: false,
    tools_used: [],
    refusal_reason: null,
    transcript_chars: 0,
    outcome: input.outcome,
    cost_usd: costOfAudio(input.seconds, input.provider, input.model, input.prices),
  }
}

/** Speaking. */
export function buildTtsUsageRow(input: {
  id: string
  at: string
  userId: string
  provider: string
  model: string
  characters: number
  outcome: string
  prices: PriceTable
  latencyMs?: number
}): AiUsageRow {
  return {
    id: input.id,
    user_id: input.userId,
    at: input.at,
    role: 'tts',
    provider: input.provider,
    model: input.model,
    input_tokens: 0,
    cached_input_tokens: 0,
    output_tokens: 0,
    audio_seconds: 0,
    characters: input.characters,
    rounds: 0,
    tool_calls: 0,
    latency_ms: input.latencyMs ?? 0,
    retries: 0,
    fell_back: false,
    tools_used: [],
    refusal_reason: null,
    transcript_chars: 0,
    outcome: input.outcome,
    cost_usd: costOfCharacters(input.characters, input.provider, input.model, input.prices),
  }
}

/** The outcome string a loop result records, so the two never drift apart. */
export function outcomeLabel(
  out: { kind: 'final' } | { kind: 'exhausted'; reason: string },
): string {
  return out.kind === 'final' ? 'final' : `exhausted:${out.reason}`
}

// ---- aggregation -----------------------------------------------------------

export type Bucket = 'day' | 'week' | 'month' | 'total'

/**
 * The bucket an instant falls in. Weeks start Monday and are named by that
 * Monday's date - an ISO week number would be shorter and is unreadable in a
 * report ("2026-W34" answers nothing about which days it covers).
 */
export function bucketOf(iso: string, bucket: Bucket): string {
  if (bucket === 'total') return 'total'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'invalid'
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  if (bucket === 'month') return `${y}-${m}`
  if (bucket === 'day') return `${y}-${m}-${String(d.getUTCDate()).padStart(2, '0')}`
  const monday = new Date(d)
  // getUTCDay(): 0 = Sunday. Shifting by 6 puts Sunday at the END of its week.
  monday.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7))
  return monday.toISOString().slice(0, 10)
}

export interface UsageTotals {
  calls: number
  rounds: number
  tool_calls: number
  input_tokens: number
  cached_input_tokens: number
  output_tokens: number
  audio_seconds: number
  characters: number
  cost_usd: number
  /** calls whose model had no configured price - cost_usd excludes them */
  unpriced_calls: number
  /**
   * Latency as PERCENTILES, never a mean.
   *
   * A mean over a bucket that holds one nine-second turn and forty fast ones
   * reports a healthy number and hides the turn a person actually noticed. p95
   * is the one that describes the experience; p50 says whether the typical case
   * is fine. Both are null when the bucket holds no timed call.
   */
  latency_p50_ms: number | null
  latency_p95_ms: number | null
  latency_max_ms: number | null
  /** attempts beyond the first, summed */
  retries: number
  /** calls the configured model would not answer and the fallback did */
  fell_back_calls: number
  /** how often each tool was called in this bucket, most-used first */
  tools_used: Record<string, number>
  /** how often each refusal reason occurred - what to fix, in frequency order */
  refusal_reasons: Record<string, number>
  /** total length of what users said, so an average is derivable per call */
  transcript_chars: number
}

export interface UsageGroup extends UsageTotals {
  bucket: string
  /** present when grouped by something other than time alone */
  key?: string
}

const zero = (): UsageTotals => ({
  calls: 0, rounds: 0, tool_calls: 0,
  input_tokens: 0, cached_input_tokens: 0, output_tokens: 0,
  audio_seconds: 0, characters: 0,
  cost_usd: 0, unpriced_calls: 0,
  latency_p50_ms: null, latency_p95_ms: null, latency_max_ms: null,
  retries: 0, fell_back_calls: 0,
  tools_used: {}, refusal_reasons: {}, transcript_chars: 0,
})

/**
 * Nearest-rank percentile on a sorted array — the definition that always returns
 * an OBSERVED value rather than an interpolation between two.
 *
 * That matters for a latency figure a person will act on: an interpolated p95 of
 * 4.2s over a bucket where nothing took 4.2s invites a search for a turn that
 * does not exist.
 */
export function percentile(sorted: readonly number[], p: number): number | null {
  if (sorted.length === 0) return null
  const rank = Math.ceil((p / 100) * sorted.length)
  return sorted[Math.min(Math.max(rank, 1), sorted.length) - 1]!
}

const bump = (map: Record<string, number>, key: string): void => {
  map[key] = (map[key] ?? 0) + 1
}

/** Frequency maps read most-used first; insertion order is what JSON preserves. */
const sortByCount = (map: Record<string, number>): Record<string, number> =>
  Object.fromEntries(Object.entries(map).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])))

function fold(t: UsageTotals, r: AiUsageRow, latencies: number[]): void {
  t.calls += 1
  t.rounds += r.rounds
  t.tool_calls += r.tool_calls
  t.input_tokens += r.input_tokens
  t.cached_input_tokens += r.cached_input_tokens
  t.output_tokens += r.output_tokens
  t.audio_seconds += r.audio_seconds ?? 0
  t.characters += r.characters ?? 0
  t.retries += r.retries ?? 0
  if (r.fell_back === true) t.fell_back_calls += 1
  t.transcript_chars += r.transcript_chars ?? 0
  for (const tool of r.tools_used ?? []) bump(t.tools_used, tool)
  if (r.refusal_reason !== null && r.refusal_reason !== undefined) {
    bump(t.refusal_reasons, r.refusal_reason)
  }
  // A zero here means "not timed" - rows written before this column existed, and
  // the cap path, which refuses before any clock starts. Counting those as 0 ms
  // would drag every percentile toward a latency nothing achieved.
  const ms = r.latency_ms ?? 0
  if (ms > 0) latencies.push(ms)
  if (r.cost_usd === null) t.unpriced_calls += 1
  else t.cost_usd += r.cost_usd
}

export interface AggregateOptions {
  bucket?: Bucket
  /** a second dimension: per model, per provider, or per user */
  by?: 'model' | 'provider' | 'user' | 'role' | 'none'
  /** ISO instants, inclusive `from`, exclusive `to` */
  from?: string
  to?: string
}

export function aggregate(rows: readonly AiUsageRow[], opts: AggregateOptions = {}): UsageGroup[] {
  const bucket = opts.bucket ?? 'day'
  const by = opts.by ?? 'none'
  const groups = new Map<string, UsageGroup>()
  const samples = new Map<string, number[]>()

  for (const r of rows) {
    if (opts.from !== undefined && r.at < opts.from) continue
    if (opts.to !== undefined && r.at >= opts.to) continue
    const b = bucketOf(r.at, bucket)
    const key =
      by === 'model' ? `${r.provider}/${r.model}`
      : by === 'provider' ? r.provider
      : by === 'user' ? r.user_id
      : by === 'role' ? (r.role ?? 'reasoning')
      : undefined
    const id = key === undefined ? b : `${b} ${key}`
    let g = groups.get(id)
    if (g === undefined) {
      g = { bucket: b, ...(key === undefined ? {} : { key }), ...zero() }
      groups.set(id, g)
      samples.set(id, [])
    }
    fold(g, r, samples.get(id)!)
  }

  for (const [id, g] of groups) {
    const sorted = samples.get(id)!.sort((a, b) => a - b)
    g.latency_p50_ms = percentile(sorted, 50)
    g.latency_p95_ms = percentile(sorted, 95)
    g.latency_max_ms = sorted.length === 0 ? null : sorted[sorted.length - 1]!
    g.tools_used = sortByCount(g.tools_used)
    g.refusal_reasons = sortByCount(g.refusal_reasons)
  }

  return [...groups.values()].sort(
    (a, b) => a.bucket.localeCompare(b.bucket) || (a.key ?? '').localeCompare(b.key ?? ''),
  )
}
