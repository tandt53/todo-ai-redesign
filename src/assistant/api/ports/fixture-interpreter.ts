// Fixture-driven Interpreter stub (ADR-001, spec ## Test strategy).
// Rows are keyed by normalized utterance and answer-context; targets are
// written as task TITLES for readability — the stub resolves titles to the
// engine's per-turn handles using the context it receives, so the engine stays
// strictly handle-based (ADR-002) while fixtures stay human-readable.
// An unmatched utterance interprets as no_match.

import { normalizeTranscript } from '../engine/normalize.ts'
import type { PendingOp, TaskChanges } from '../types.ts'
import type { NewTaskFields } from '../engine/apply.ts'
import type {
  AnswerClass,
  Interpretation,
  Interpreter,
  InterpreterContext,
} from './interpreter.ts'

export type FixtureResult =
  /** create carries `NewTaskFields` — widened in F-005 so a spoken note and a
   * spoken reminder are EXPRESSIBLE, which is what makes AC-36's permitted half
   * a capability rather than a permission (one fixture row per permitted field,
   * on the create path as well as the edit path). */
  | { kind: 'create'; tasks: NewTaskFields[] }
  | { kind: 'edit'; targets: string[]; changes: TaskChanges }
  | { kind: 'delete'; targets: string[] }
  | { kind: 'clarify'; targets: string[]; pending_op: PendingOp }
  | { kind: 'no_match' }
  | { kind: 'query' }
  | {
      kind: 'answer'
      answer:
        | { type: 'affirmative' }
        | { type: 'negative' }
        | { type: 'unclassifiable' }
        | { type: 'selection'; target: string }
    }
  | { kind: 'fail'; message?: string }

export interface FixtureRow {
  /** matched against the normalized transcript */
  utterance: string
  /**
   * answer-context guard: 'bulk_delete' / 'clarify' match only when the turn
   * is bound to a pending question of that kind; 'question' matches any
   * pending question; absent = fallback for turns with no bound question
   * (also used as last resort when no context row matches).
   */
  when?: 'bulk_delete' | 'clarify' | 'question'
  result: FixtureResult
  /** interpretation latency injection (IN_FLIGHT / serial-order tests) */
  delay_ms?: number
  /** fail the first N interpretations that hit this row (retry tests, AC-16) */
  fail_times?: number
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

export class FixtureInterpreter implements Interpreter {
  private readonly rows: FixtureRow[]
  private readonly failCounts = new Map<number, number>()

  constructor(rows: FixtureRow[]) {
    this.rows = rows
  }

  async interpret(ctx: InterpreterContext): Promise<Interpretation> {
    const utterance = normalizeTranscript(ctx.transcript)

    // Option-literal classification (T-006d). A tap sends the chip's literal
    // text, and those labels are human copy carrying the real count ("Delete 3
    // tasks"), so no static fixture row can enumerate them. Classify against
    // the question's OWN options — still the stub's job (answer classification
    // is what the stub replaces), still count-independent and deterministic.
    // Spoken answers fall through to the fixture rows below.
    if (ctx.question !== null) {
      const options = ctx.question.options.map(normalizeTranscript)
      const picked = options.indexOf(utterance)
      if (picked !== -1) {
        if (ctx.question.kind === 'bulk_delete') {
          // [0] = affirmative label, [1] = negative label
          return {
            kind: 'answer',
            answer: picked === 0 ? { type: 'affirmative' } : { type: 'negative' },
          }
        }
        // clarify: the option text is the candidate's title
        const title = ctx.question.options[picked]!
        const handles = this.toHandles([title], ctx)
        return {
          kind: 'answer',
          answer:
            handles.length > 0
              ? { type: 'selection', handle: handles[0]! }
              : { type: 'unclassifiable' },
        }
      }
    }

    const matches = this.rows
      .map((row, index) => ({ row, index }))
      .filter(({ row }) => normalizeTranscript(row.utterance) === utterance)

    let hit = undefined
    if (ctx.question !== null) {
      hit =
        matches.find(({ row }) => row.when === ctx.question!.kind) ??
        matches.find(({ row }) => row.when === 'question') ??
        matches.find(({ row }) => row.when === undefined)
    } else {
      hit = matches.find(({ row }) => row.when === undefined)
    }
    if (hit === undefined) return { kind: 'no_match' }

    const { row, index } = hit
    if (row.delay_ms !== undefined) await sleep(row.delay_ms)
    if (row.fail_times !== undefined) {
      const failed = this.failCounts.get(index) ?? 0
      if (failed < row.fail_times) {
        this.failCounts.set(index, failed + 1)
        throw new Error('fixture: injected interpretation failure')
      }
    }
    return this.translate(row.result, ctx)
  }

  private translate(result: FixtureResult, ctx: InterpreterContext): Interpretation {
    switch (result.kind) {
      case 'fail':
        throw new Error(result.message ?? 'fixture: interpretation failed')
      case 'create':
      case 'no_match':
      case 'query':
        return result
      case 'edit':
        return {
          kind: 'edit',
          edits: this.toHandles(result.targets, ctx).map((handle) => ({
            handle,
            changes: result.changes,
          })),
        }
      case 'delete':
        return { kind: 'delete', handles: this.toHandles(result.targets, ctx) }
      case 'clarify':
        return {
          kind: 'clarify',
          handles: this.toHandles(result.targets, ctx),
          pending_op: result.pending_op,
        }
      case 'answer': {
        if (result.answer.type !== 'selection') {
          return { kind: 'answer', answer: result.answer }
        }
        const handles = this.toHandles([result.answer.target], ctx)
        const answer: AnswerClass =
          handles.length > 0
            ? { type: 'selection', handle: handles[0]! }
            : { type: 'unclassifiable' }
        return { kind: 'answer', answer }
      }
    }
  }

  /** exact (case-insensitive) title match against the turn's context tasks */
  private toHandles(targets: string[], ctx: InterpreterContext): string[] {
    const handles: string[] = []
    for (const target of targets) {
      const want = target.trim().toLowerCase()
      for (const task of ctx.tasks) {
        if (task.title.trim().toLowerCase() === want) handles.push(task.handle)
      }
    }
    return handles
  }
}
