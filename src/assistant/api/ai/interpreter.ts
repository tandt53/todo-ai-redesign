// The real interpreter: everything in `ai/` behind the port the engine already
// calls (F-007).
//
// This is the piece that makes the rest reachable. `Interpreter` has one method
// and the engine has always called it; swapping the fixture stub for this one
// changes nothing else in the turn path, which is why the port was worth having.
//
// What happens on one turn:
//   build the prompt -> run the bounded loop, model driving, tools answering
//   -> validate the action against the engine's vocabulary
//   -> check the two sentences
//   -> record what it cost
//
// **Every failure lands on `no_match`, never on a guess.** A model that returns
// an action nobody implemented, a handle that resolves to nothing, a sentence
// naming a task that is not being touched, or a provider that is simply down -
// all of them end the turn saying so. The alternative is an assistant that acts
// on what it guessed the model meant, which is the failure mode the whole design
// is arranged against.

import type { Clock } from '../ports/clock.ts'
import type {
  Interpretation,
  Interpreter,
  InterpreterContext,
} from '../ports/interpreter.ts'
import type { Store } from '../store/store.ts'
import { toInterpretation } from './bridge.ts'
import { runLoop, type LoopOptions } from './loop.ts'
import { buildSystemPrompt, buildUserMessage } from './prompt.ts'
import { createModelClient, type ProviderConfig } from './provider.ts'
import {
  checkCap,
  withRetry,
  type CapOptions,
  type FallbackConfig,
  type RetryOptions,
} from './resilience.ts'
import { RESPOND_TOOL, checkReplyFacts, checkReplyShape, describeProblem, type ReplyText } from './reply.ts'
import { TOOL_SCHEMAS, type ToolContext } from './tools.ts'
import { outcomeLabel, type ModelUsage } from './usage.ts'

/** What the interpreter learned about one turn, beyond the interpretation. */
export interface TurnTelemetry {
  provider: string
  model: string
  usage: ModelUsage
  rounds: number
  toolCalls: number
  outcome: string
  /** the model's own two sentences, when it produced usable ones */
  reply: ReplyText | null
  /** why the turn fell back to no_match, when it did */
  refusal: string | null
  /** wall clock for the whole turn, retries and fallback included */
  latencyMs: number
  /** attempts beyond the first */
  retries: number
  /** the configured model would not answer and the fallback did */
  fellBack: boolean
  /** which tools were called, in order, with repeats */
  toolsUsed: string[]
  /** length of what the user said - the length, never the text */
  transcriptChars: number
}

export interface ModelInterpreterDeps {
  config: ProviderConfig
  store: Store
  clock: Clock
  /**
   * What a finished turn reports back, including the account it was for.
   * The caller records it and forwards the two sentences.
   */
  onTurn?: (userId: string, telemetry: TurnTelemetry) => void
  loop?: LoopOptions
  fetchImpl?: typeof fetch
  /** transient failures are retried; a 4xx that is an answer is not */
  retry?: RetryOptions
  /** a second model to try when the first will not answer at all */
  fallback?: FallbackConfig | null
  /** stop spending past this, per account per day */
  cap?: CapOptions
  /** what the cap reads. Defaults to the store's own ledger. */
  prices?: unknown
}

/**
 * The system prompt is built once per process, not per turn.
 *
 * Not a micro-optimisation: the provider caches a PREFIX, and a prompt rebuilt
 * per turn is byte-identical only by luck. Building it once makes that a fact
 * rather than a hope.
 */
const SYSTEM_PROMPT = buildSystemPrompt(TOOL_SCHEMAS)

export function systemPrompt(): string {
  return SYSTEM_PROMPT
}

/**
 * The titles a reply is allowed to name, for the consistency check.
 *
 * Only the rows this action actually touches. A create names titles that do not
 * exist yet, so its own new titles are what count.
 */
function targetsOf(interpretation: Interpretation, ctx: InterpreterContext): string[] {
  const byHandle = new Map(ctx.tasks.map((t) => [t.handle, t.title]))
  const titles = (handles: readonly string[]): string[] =>
    handles.map((h) => byHandle.get(h)).filter((t): t is string => t !== undefined)

  switch (interpretation.kind) {
    case 'create':
      return interpretation.tasks.map((t) => t.title)
    case 'edit': {
      const out = titles(interpretation.edits.map((e) => e.handle))
      // A rename names the NEW title as well - the sentence that reports it
      // would otherwise be flagged for saying the thing it just did.
      for (const e of interpretation.edits) {
        if (typeof e.changes.title === 'string') out.push(e.changes.title)
      }
      return out
    }
    case 'delete':
    case 'clarify':
      return titles(interpretation.handles)
    case 'list_move':
      return titles([interpretation.handle])
    case 'trash_read':
      // The trash is read-only and its titles are not in the handle map, so
      // there is nothing to check the sentence against. Allow every deleted
      // title rather than flagging a correct answer.
      return ctx.deleted_tasks.map((t) => t.title)
    default:
      // query, no_match, answer, list_create, list_refuse - nothing is being
      // acted on, so there is nothing for a title to disagree with. An empty
      // target list makes `checkReplyFacts` flag ANY quoted title, which would
      // be wrong here, so these skip the fact check entirely (see below).
      return []
  }
}

/** Kinds where a quoted title cannot be checked because nothing is being acted on. */
const NO_TARGET_KINDS = new Set(['query', 'no_match', 'answer', 'list_create', 'list_refuse'])

export function createModelInterpreter(deps: ModelInterpreterDeps): Interpreter {
  return {
    async interpret(ctx: InterpreterContext): Promise<Interpretation> {
      // Per turn, from the turn's own context - never held on this object. The
      // interpreter lives for the process; a handle table lives for one turn.
      const toolCtx: ToolContext = {
        read: (fn) => deps.store.read(fn),
        userId: ctx.user_id,
        handleMap: ctx.handles,
        clock: deps.clock,
        zone: ctx.timezone,
      }
      let used: { provider: string; model: string } = deps.config
      let attempts = 0
      let fellBack = false
      const trace: { call: { name: string } }[] = []
      const startedAt = deps.clock.now()
      const report = (
        interpretation: Interpretation,
        t: Omit<TurnTelemetry, 'provider' | 'model' | 'latencyMs' | 'retries' | 'fellBack' | 'toolsUsed' | 'transcriptChars'>,
      ): Interpretation => {
        // `used`, not `deps.config`: after a fallback the bill belongs to the
        // model that answered, and a ledger naming the wrong one is worse than
        // no ledger.
        deps.onTurn?.(ctx.user_id, {
          provider: used.provider,
          model: used.model,
          latencyMs: Math.max(0, deps.clock.now() - startedAt),
          // Attempts BEYOND the first. A call that worked first time made one
          // attempt and retried nothing.
          retries: Math.max(0, attempts - 1),
          fellBack,
          toolsUsed: trace.map((e) => e.call.name),
          transcriptChars: [...ctx.transcript].length,
          ...t,
        })
        return interpretation
      }

      const userMessage = buildUserMessage({
        transcript: ctx.transcript,
        source: ctx.source,
        timezone: ctx.timezone,
        tasks: ctx.tasks,
        lists: ctx.lists,
        recentTurns: ctx.recent_turns,
        question: ctx.question,
      })
      const client = createModelClient({
        config: deps.config,
        system: SYSTEM_PROMPT,
        firstUserMessage: userMessage,
        tools: TOOL_SCHEMAS,
        respondTool: RESPOND_TOOL,
        ...(deps.fetchImpl === undefined ? {} : { fetchImpl: deps.fetchImpl }),
      })

      const zeroUsage = { input_tokens: 0, cached_input_tokens: 0, output_tokens: 0 }

      // ---- the cap, before anything is spent ------------------------------
      if (deps.cap?.perUserDailyUsd !== undefined) {
        const rows = deps.store.read((st) =>
          Object.values(st.ai_usage ?? {}).filter((r) => r.user_id === ctx.user_id))
        const verdict = checkCap(rows, new Date(deps.clock.now()).toISOString(), deps.cap)
        if (!verdict.allowed) {
          return report({ kind: 'no_match' }, {
            usage: zeroUsage, rounds: 0, toolCalls: 0, outcome: 'capped',
            reply: null,
            refusal: `daily cap reached: $${verdict.spentUsd.toFixed(4)} of $${verdict.limitUsd}` +
              (verdict.unpricedCalls > 0 ? ` (${verdict.unpricedCalls} unpriced calls not counted)` : ''),
          })
        }
      }

      let out
      try {
        // Retry the same model for a transient failure; only then try a second
        // one. A fallback that fires on a 429 spends the cheaper model's quota
        // on a problem that would have cleared by itself.
        const loopOpts = { ...(deps.loop ?? {}), trace: trace as never }
        try {
          out = await withRetry(() => { attempts++; return runLoop(client, toolCtx, loopOpts) }, deps.retry ?? {})
        } catch (first) {
          if (deps.fallback === undefined || deps.fallback === null) throw first
          used = deps.fallback
          fellBack = true
          // The fallback starts its own count: `retries` means attempts beyond
          // the first ON THE MODEL THAT ANSWERED, which is the one being billed.
          attempts = 0
          const second = createModelClient({
            config: deps.fallback,
            system: SYSTEM_PROMPT,
            firstUserMessage: userMessage,
            tools: TOOL_SCHEMAS,
            respondTool: RESPOND_TOOL,
            ...(deps.fetchImpl === undefined ? {} : { fetchImpl: deps.fetchImpl }),
          })
          out = await withRetry(() => { attempts++; return runLoop(second, toolCtx, loopOpts) }, deps.retry ?? {})
        }
      } catch (e) {
        // A provider that is down, rate-limited or misconfigured. The turn ends
        // as an honest "I did not understand", and the reason is recorded rather
        // than shown - a user does not need to read an HTTP status.
        return report({ kind: 'no_match' }, {
          usage: zeroUsage, rounds: 0, toolCalls: 0, outcome: 'error',
          reply: null, refusal: `provider: ${String((e as Error).message).slice(0, 200)}`,
        })
      }

      if (out.kind === 'exhausted') {
        return report({ kind: 'no_match' }, {
          usage: out.usage, rounds: out.rounds, toolCalls: out.toolCalls,
          outcome: outcomeLabel(out), reply: null,
          refusal: `the assistant ran out of ${out.reason === 'max_rounds' ? 'steps' : 'time'}`,
        })
      }

      const bridged = toInterpretation(out.payload, ctx.handles)
      if (!bridged.ok) {
        return report({ kind: 'no_match' }, {
          usage: out.usage, rounds: out.rounds, toolCalls: out.toolCalls,
          outcome: 'invalid_action', reply: out.reply, refusal: bridged.reason,
        })
      }

      const problems = checkReplyShape(out.reply)
      if (!NO_TARGET_KINDS.has(bridged.interpretation.kind)) {
        problems.push(
          ...checkReplyFacts(out.reply, targetsOf(bridged.interpretation, ctx)),
        )
      }

      if (problems.length > 0) {
        // The action may well be right, but the sentence describing it is not,
        // and consent runs on the sentence. Refusing both is the safe half of a
        // choice that has no safe half.
        return report({ kind: 'no_match' }, {
          usage: out.usage, rounds: out.rounds, toolCalls: out.toolCalls,
          outcome: 'bad_reply', reply: out.reply,
          refusal: problems.map(describeProblem).join('; '),
        })
      }

      return report(bridged.interpretation, {
        usage: out.usage, rounds: out.rounds, toolCalls: out.toolCalls,
        outcome: outcomeLabel(out), reply: out.reply, refusal: null,
      })
    },
  }
}
