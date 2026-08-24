// The agentic loop (F-007), and the bound that keeps it from spinning.
//
// Owner decision 2026-08-21 § 3: the AI calls tools to search and read, the
// backend answers, and the AI decides what it needs next. **How many rounds
// that takes depends on the question, and on how well the model does — it is
// not a fixed count.** What an agentic loop needs that a pipeline does not is
// therefore a bound: not to predict the round count, but so a bad question
// cannot spin. Both limits are adjustable, and the decision is explicit that
// **silence at the ceiling is the failure mode** — so hitting either produces a
// stated outcome the user can read, never a hang and never nothing.

import { runTool, type ToolCall, type ToolContext } from './tools.ts'
import type { ReplyText } from './reply.ts'
import { addUsage, emptyUsage, type ModelUsage } from './usage.ts'

/** Default bound: six rounds, twenty seconds. Both overridable per call. */
export const DEFAULT_MAX_ROUNDS = 6
export const DEFAULT_WALL_CLOCK_MS = 20_000

/**
 * One exchange with the model. Either it wants tools run, or it is finished.
 * The port is this small on purpose: a transport that speaks the Anthropic
 * Messages API and a fake that returns scripted turns satisfy the same shape,
 * so every rule below is testable without a network.
 */
export type ModelStep =
  | { kind: 'tool_use'; calls: ToolCall[]; usage?: ModelUsage }
  | { kind: 'final'; payload: unknown; reply: ReplyText; usage?: ModelUsage }

export interface ModelClient {
  /**
   * `results` is empty on the first call and carries the previous round's tool
   * output afterwards. The client keeps its own conversation state — the loop
   * does not reassemble a message list, because two places building the same
   * history is how they drift.
   */
  next(results: { call: ToolCall; result: unknown; is_error: boolean }[]): Promise<ModelStep>
}

export type LoopOutcome =
  | { kind: 'final'; payload: unknown; reply: ReplyText; rounds: number; toolCalls: number; usage: ModelUsage }
  /** The bound was hit. `reason` names which one, so the client can say which. */
  | { kind: 'exhausted'; reason: 'max_rounds' | 'wall_clock'; rounds: number; toolCalls: number; usage: ModelUsage }

export interface LoopOptions {
  maxRounds?: number
  wallClockMs?: number
  /** injected so the bound is testable without waiting twenty real seconds */
  nowMs?: () => number
  /** every tool call and its result, in order — the audit trail for one turn */
  trace?: { call: ToolCall; result: unknown; is_error: boolean }[]
}

export async function runLoop(
  model: ModelClient,
  toolCtx: ToolContext,
  opts: LoopOptions = {},
): Promise<LoopOutcome> {
  const maxRounds = opts.maxRounds ?? DEFAULT_MAX_ROUNDS
  const wallClockMs = opts.wallClockMs ?? DEFAULT_WALL_CLOCK_MS
  const now = opts.nowMs ?? (() => Date.now())
  const startedAt = now()

  let results: { call: ToolCall; result: unknown; is_error: boolean }[] = []
  let toolCalls = 0
  // Accumulated across every round, because that is what the turn cost. A per-
  // round figure would under-report by however many rounds the question needed.
  let usage = emptyUsage()

  for (let round = 1; round <= maxRounds; round++) {
    const step = await model.next(results)
    if (step.usage !== undefined) usage = addUsage(usage, step.usage)

    if (step.kind === 'final') {
      return { kind: 'final', payload: step.payload, reply: step.reply, rounds: round, toolCalls, usage }
    }

    // A model that asks for no tools and is not finished would loop forever
    // against a client that keeps saying the same thing. Treat it as the model
    // having nothing more to ask, which the bound then ends on the next round.
    results = step.calls.map((call) => {
      const out = runTool(toolCtx, call)
      toolCalls++
      const entry = { call, result: out.content, is_error: out.is_error }
      opts.trace?.push(entry)
      return entry
    })

    // Checked AFTER the round's work so a slow round is not billed to the next
    // one, and so a loop that finishes exactly at the limit still returns its
    // answer rather than throwing it away.
    if (now() - startedAt >= wallClockMs) {
      return { kind: 'exhausted', reason: 'wall_clock', rounds: round, toolCalls, usage }
    }
  }

  return { kind: 'exhausted', reason: 'max_rounds', rounds: maxRounds, toolCalls, usage }
}
