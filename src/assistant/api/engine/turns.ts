// POST /assistant/turn engine — implements the contract's 9 processing rules
// in order (api-contracts.md):
//   1 session resolution (after lazy idle close, ADR-004)
//   2 per-status dedupe, account scope (AC-16, ADR-005)
//   3 voice-undo guard — no interpretation, no turn row (AC-5, ADR-006)
//   4 persist transcript before interpreting (AC-23)
//   5 fresh context inside the serial-queue slot (OQ 7)
//   6 atomic apply with undo_snapshot captured in the apply transaction (AC-1, AC-6)
//   7 bulk-delete gate (AC-9) with affirmative re-validation (AC-12)
//   8 one-shot question resolution (D2, AC-10/11/13)
//   9 no-match / unsupported-query honesty (AC-14, AC-15)
//
// The caller (app.ts) runs processTurn inside the per-account serial queue.

import { ApiError, notFound } from '../errors.ts'
import type { Clock } from '../ports/clock.ts'
import type {
  AnswerClass,
  Interpretation,
  Interpreter,
  InterpreterContext,
} from '../ports/interpreter.ts'
import type { Store, StoreState } from '../store/store.ts'
import type {
  ResolutionResult,
  SessionRow,
  TurnOutcome,
  TurnRow,
  TurnSource,
  UndoOutcomeWire,
} from '../types.ts'
import { applyCreate, applyDelete, applyEdit, type ApplyResult } from './apply.ts'
import { isUndoPhrase } from './normalize.ts'
import { serializeTurn, sessionTurns, type TurnWire } from './serialize.ts'
import {
  findOpenSession,
  lazyIdleClose,
  newestAppliedTurn,
  nextSeq,
  nowIso,
  openSession,
} from './sessions.ts'
import { cloneTask, taskEquals } from './task-equals.ts'
import { performUndo, undoRefusedNoAppliedTurn } from './undo.ts'

/**
 * The working alternative named by an `unsupported_query` outcome (AC-15).
 * This string is read aloud/rendered to the user, not a protocol token, so it
 * follows the product's UI language. Vietnamese as of T-015g (Gate-3
 * localization pass); the contract fixes the literal value — see
 * `specs/assistant/api-contracts.md` §9 and `specs/assistant/data-model.md`
 * TurnOutcome. Gloss: "the on-screen list and its filters".
 */
export const UNSUPPORTED_QUERY_ALTERNATIVE = 'danh sách và bộ lọc trên màn hình'

/**
 * Bulk-delete confirm-chip labels (T-006d). A tap sends the option's LITERAL
 * text as the turn's transcript, so the option text IS both the chip label and
 * the user's own utterance — which makes these strings the design's copy, not
 * protocol tokens. The affirmative names the action and the real count; the
 * negative is a plain refusal. Web/mobile render these verbatim, which is what
 * keeps WCAG 2.5.3 (label in name) satisfied by construction.
 *
 * Vietnamese (T-015b, Gate-3 product decision): the product's UI language is
 * Vietnamese, and because a tap replays the label as the user's own utterance,
 * an English chip would put English in a Vietnamese speaker's mouth. Vietnamese
 * nouns do not inflect for number, so "Xoá 1 việc" / "Xoá 3 việc" both read
 * naturally from one template — the English plural branch is dropped rather
 * than translated. Classification stays positional (index 0 = affirmative,
 * index 1 = negative, see ports/fixture-interpreter.ts), so it is unaffected by
 * the language of these strings.
 */
export const bulkDeleteOptions = (count: number): string[] => [`Xoá ${count} việc`, 'Giữ lại']

export interface TurnDeps {
  store: Store
  interpreter: Interpreter
  clock: Clock
  idleCloseMs: number
  uuid: () => string
}

export interface TurnRequest {
  session_id: string | null
  client_turn_id: string
  transcript: string
  source: TurnSource
  answer_to_turn_id: string | null
  timezone: string | null
}

export interface TurnResponseWire {
  session_id: string
  kind: 'turn' | 'undo'
  replayed: boolean
  turn: TurnWire | null
  undo: UndoOutcomeWire | null
  resolutions: { question_turn_id: string; result: ResolutionResult }[]
}

const dedupeKey = (userId: string, clientTurnId: string): string => `${userId}:${clientTurnId}`

const inFlight = (): ApiError =>
  new ApiError(409, 'IN_FLIGHT', 'the same client_turn_id is still being processed')

const idReused = (): ApiError =>
  new ApiError(
    409,
    'CLIENT_TURN_ID_REUSED',
    'same client_turn_id with divergent transcript, source, or answer_to_turn_id — nothing executes',
  )

/**
 * Divergent-body comparison (rule 2, TC-25): transcript / source /
 * answer_to_turn_id must match the recorded request; session_id and timezone
 * are excluded — a post-close replay legitimately carries a different session.
 */
const bodyDiverges = (
  req: TurnRequest,
  rec: { transcript: string; source: TurnSource; answer_to_turn_id: string | null },
): boolean =>
  rec.transcript !== req.transcript ||
  rec.source !== req.source ||
  rec.answer_to_turn_id !== req.answer_to_turn_id

/**
 * Fast-path check, run BEFORE enqueueing: a concurrent request with a
 * client_turn_id whose turn is still pending must 409 immediately instead of
 * waiting behind it in the queue (processing rule 2) — IN_FLIGHT when the body
 * matches, CLIENT_TURN_ID_REUSED when it diverges.
 */
export function preflightInFlight(store: Store, userId: string, req: TurnRequest): void {
  const pending = store.read((s) =>
    Object.values(s.turns).find(
      (t) =>
        t.user_id === userId && t.client_turn_id === req.client_turn_id && t.status === 'pending',
    ),
  )
  if (pending === undefined) return
  if (bodyDiverges(req, { transcript: pending.transcript_raw, source: pending.source, answer_to_turn_id: pending.answer_to_turn_id })) {
    throw idReused()
  }
  throw inFlight()
}

type PhaseA =
  | { type: 'replay-turn'; sessionId: string; turnId: string }
  | { type: 'replay-undo'; sessionId: string; outcome: UndoOutcomeWire }
  | { type: 'guard-undo'; sessionId: string; outcome: UndoOutcomeWire }
  // guard refusal: no turn row, but the client_turn_id is consumed — the
  // recorded 409 must COMMIT, so it leaves the transaction as a value and is
  // thrown after (rule 3, TC-24)
  | { type: 'guard-refused'; code: string; message: string; detail: Record<string, unknown> }
  | { type: 'already-resolved'; sessionId: string; turnId: string }
  | {
      type: 'proceed'
      sessionId: string
      turnId: string
      boundQuestionTurnId: string | null
      ctx: InterpreterContext
      handleMap: Record<string, string>
    }

export async function processTurn(
  deps: TurnDeps,
  userId: string,
  req: TurnRequest,
): Promise<TurnResponseWire> {
  const { store, interpreter, clock, idleCloseMs, uuid } = deps

  const phaseA: PhaseA = store.transact((s) => {
    const at = nowIso(clock)
    lazyIdleClose(s, userId, clock, idleCloseMs)

    // rule 1 — session resolution
    let session: SessionRow
    if (req.session_id !== null) {
      const named = s.sessions[req.session_id]
      if (named === undefined || named.user_id !== userId) throw notFound('unknown session_id')
      if (named.status === 'closed') {
        throw new ApiError(
          409,
          'SESSION_CLOSED',
          'closed sessions accept no turns — re-sync via GET /assistant/session and replay the same client_turn_id',
        )
      }
      session = named
    } else {
      session = findOpenSession(s, userId) ?? openSession(s, userId, uuid(), at)
    }

    // rule 2 — dedupe, per status, account scope
    let retryTurn: TurnRow | undefined
    const existing = Object.values(s.turns).find(
      (t) => t.user_id === userId && t.client_turn_id === req.client_turn_id,
    )
    if (existing !== undefined) {
      // divergent body under a recorded id is reuse, not replay (rule 2, TC-25)
      if (
        bodyDiverges(req, {
          transcript: existing.transcript_raw,
          source: existing.source,
          answer_to_turn_id: existing.answer_to_turn_id,
        })
      ) {
        throw idReused()
      }
      if (existing.status === 'pending') throw inFlight()
      if (existing.status === 'failed') {
        // failed → pending under the same id; the re-attempt targets the
        // resolved (possibly new) session at a fresh receipt seq (AC-16)
        existing.session_id = session.id
        existing.seq = nextSeq(s, session.id)
        existing.status = 'pending'
        existing.transcript_raw = req.transcript
        existing.source = req.source
        existing.answer_to_turn_id = req.answer_to_turn_id
        existing.outcome = null
        existing.resolved_at = null
        existing.changed_task_ids = []
        existing.diff = []
        existing.caused_resolutions = []
        retryTurn = existing
      } else {
        // applied | asked | undone → re-serve the recorded outcome
        return { type: 'replay-turn', sessionId: session.id, turnId: existing.id }
      }
    }
    const undoRecord = s.undo_records[dedupeKey(userId, req.client_turn_id)]
    if (undoRecord !== undefined) {
      if (bodyDiverges(req, undoRecord)) throw idReused()
      if (undoRecord.outcome !== null) {
        return {
          type: 'replay-undo',
          sessionId: undoRecord.session_id,
          outcome: structuredClone(undoRecord.outcome),
        }
      }
      // recorded guard refusal: re-served without re-evaluating — it never
      // undoes a turn applied in between (rule 3, TC-24)
      const refusal = undoRecord.refusal!
      throw new ApiError(409, refusal.code, refusal.message, {
        detail: structuredClone(refusal.detail),
      })
    }

    // 404 for an answer_to_turn_id unknown to this account (error table)
    let answerTo: TurnRow | undefined
    if (req.answer_to_turn_id !== null) {
      answerTo = s.turns[req.answer_to_turn_id]
      if (answerTo === undefined || answerTo.user_id !== userId) {
        throw notFound('unknown answer_to_turn_id')
      }
    }

    // rule 3 — voice-undo guard: not interpreted, no turn row created (AC-5)
    if (isUndoPhrase(req.transcript)) {
      const recordBase = {
        session_id: session.id,
        transcript: req.transcript,
        source: req.source,
        answer_to_turn_id: req.answer_to_turn_id,
      }
      const target = newestAppliedTurn(s, session.id)
      if (target === undefined) {
        // a guard refusal still consumes the client_turn_id (rule 3, TC-24)
        const err = undoRefusedNoAppliedTurn()
        const detail = structuredClone(err.opts.detail ?? {})
        s.undo_records[dedupeKey(userId, req.client_turn_id)] = {
          ...recordBase,
          outcome: null,
          refusal: { code: err.code, message: err.message, detail },
        }
        return { type: 'guard-refused', code: err.code, message: err.message, detail }
      }
      const outcome = performUndo(s, target, 'voice', at, req.transcript)
      s.undo_records[dedupeKey(userId, req.client_turn_id)] = {
        ...recordBase,
        outcome: structuredClone(outcome),
        refusal: null,
      }
      return { type: 'guard-undo', sessionId: session.id, outcome }
    }

    // rule 4 — persist transcript_raw before interpretation (AC-23)
    let turn: TurnRow
    if (retryTurn !== undefined) {
      turn = retryTurn
    } else {
      turn = {
        id: uuid(),
        session_id: session.id,
        user_id: userId,
        seq: nextSeq(s, session.id),
        client_turn_id: req.client_turn_id,
        status: 'pending',
        transcript_raw: req.transcript,
        source: req.source,
        answer_to_turn_id: req.answer_to_turn_id,
        outcome: null,
        changed_task_ids: [],
        diff: [],
        undo_snapshot: null,
        question: null,
        undo_result: null,
        created_at: at,
        resolved_at: null,
        post_apply: null,
        created_ids: [],
        pending_op: null,
        caused_resolutions: [],
      }
      s.turns[turn.id] = turn
    }
    session.last_activity_at = at

    // answer binding (AC-10): a tap carries an explicit binding; voice/typed
    // bind to the newest unresolved question
    let boundQuestionTurnId: string | null = null
    if (answerTo !== undefined && answerTo.question !== null) {
      if (answerTo.question.resolution !== null) {
        // one-shot: an answer arriving after resolution applies nothing and
        // yields a visible already-resolved outcome — deterministically, with
        // no interpretation call
        turn.status = 'applied'
        turn.outcome = {
          kind: 'resolution',
          result: 'already_resolved',
          question_turn_id: answerTo.id,
        }
        turn.resolved_at = at
        turn.caused_resolutions.push({
          question_turn_id: answerTo.id,
          result: 'already_resolved',
        })
        return { type: 'already-resolved', sessionId: session.id, turnId: turn.id }
      }
      boundQuestionTurnId = answerTo.id
    } else if (answerTo === undefined) {
      const newestUnresolved = sessionTurns(s, session.id)
        .filter((t) => t.status === 'asked' && t.question !== null && t.question.resolution === null)
        .at(-1)
      if (newestUnresolved !== undefined) boundQuestionTurnId = newestUnresolved.id
    }

    // rule 5 — interpretation context read fresh inside this queue slot (OQ 7),
    // handed to the model as opaque handles t1..tn — never uuids (ADR-002)
    const liveTasks = Object.values(s.tasks)
      .filter((t) => t.user_id === userId && t.deleted_at === null)
      .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
    const handleMap: Record<string, string> = {}
    const ctxTasks = liveTasks.map((t, i) => {
      const handle = `t${i + 1}`
      handleMap[handle] = t.id
      return { handle, title: t.title, status: t.status, due_at: t.due_at, priority: t.priority }
    })
    const recent = sessionTurns(s, session.id)
      .filter((t) => t.status !== 'pending')
      .slice(-10) // sliding interpretation window (ADR-003)
      .map((t) => ({ transcript: t.transcript_raw, outcome_kind: t.outcome?.kind ?? null }))
    const boundQuestion =
      boundQuestionTurnId === null ? null : s.turns[boundQuestionTurnId]?.question ?? null

    const ctx: InterpreterContext = {
      transcript: req.transcript,
      source: req.source,
      timezone: req.timezone,
      tasks: ctxTasks,
      recent_turns: recent,
      question:
        boundQuestion === null
          ? null
          : {
              kind: boundQuestion.kind,
              task_titles: [...boundQuestion.task_titles],
              options: [...boundQuestion.options],
            },
    }
    return { type: 'proceed', sessionId: session.id, turnId: turn.id, boundQuestionTurnId, ctx, handleMap }
  })

  const respondWithTurn = (sessionId: string, turnId: string, replayed: boolean): TurnResponseWire =>
    store.read((s) => {
      const turn = s.turns[turnId]!
      return {
        session_id: sessionId,
        kind: 'turn' as const,
        replayed,
        turn: serializeTurn(turn),
        undo: null,
        resolutions: structuredClone(turn.caused_resolutions),
      }
    })

  switch (phaseA.type) {
    case 'replay-turn':
      return respondWithTurn(phaseA.sessionId, phaseA.turnId, true)
    case 'replay-undo':
      return {
        session_id: phaseA.sessionId,
        kind: 'undo',
        replayed: true,
        turn: null,
        undo: phaseA.outcome,
        resolutions: [],
      }
    case 'guard-undo':
      return {
        session_id: phaseA.sessionId,
        kind: 'undo',
        replayed: false,
        turn: null,
        undo: phaseA.outcome,
        resolutions: [],
      }
    case 'guard-refused':
      // thrown AFTER the transaction so the consumed-id record commits
      throw new ApiError(409, phaseA.code, phaseA.message, { detail: phaseA.detail })
    case 'already-resolved':
      return respondWithTurn(phaseA.sessionId, phaseA.turnId, false)
    case 'proceed':
      break
  }

  const { sessionId, turnId, boundQuestionTurnId, ctx, handleMap } = phaseA

  const markFailed = (): void => {
    store.transact((s) => {
      const turn = s.turns[turnId]!
      turn.status = 'failed'
      turn.resolved_at = nowIso(clock)
    })
  }

  // interpretation — the only step the fixture stub replaces (spec Test strategy)
  let interp: Interpretation
  try {
    interp = await interpreter.interpret(ctx)
  } catch (err) {
    markFailed() // the turn row and transcript persist; retry re-attempts (AC-23, AC-16)
    const turnWire = store.read((s) => serializeTurn(s.turns[turnId]!))
    const message = err instanceof Error ? err.message : 'interpretation failed'
    throw new ApiError(502, 'AI_ERROR', `interpretation failed: ${message}`, {
      bodyExtra: { turn: turnWire },
    })
  }

  // rule 6 — atomic apply: one transaction; a mid-apply throw discards every
  // write (zero partial writes, AC-1); the turn resolves failed with its
  // transcript preserved (AC-23) and the same id re-attempts (TC-02)
  try {
    store.transact((s) => {
      applyInterpretation(s, userId, turnId, boundQuestionTurnId, handleMap, interp, nowIso(clock), uuid)
    })
  } catch (err) {
    if (err instanceof ApiError) throw err
    markFailed()
    const turnWire = store.read((s) => serializeTurn(s.turns[turnId]!))
    throw new ApiError(
      500,
      'APPLY_FAILED',
      'apply transaction aborted atomically — retry with the same client_turn_id',
      { bodyExtra: { turn: turnWire } },
    )
  }

  return respondWithTurn(sessionId, turnId, false)
}

// ---------------------------------------------------------------------------

function attachApply(turn: TurnRow, res: ApplyResult): void {
  turn.changed_task_ids = [...res.anatomy.changed_task_ids]
  turn.diff = structuredClone(res.anatomy.diff)
  turn.undo_snapshot = res.snapshot.map(cloneTask)
  turn.post_apply = Object.fromEntries(
    Object.entries(res.post_apply).map(([id, t]) => [id, cloneTask(t)]),
  )
  turn.created_ids = [...res.created_ids]
}

function setResolved(turn: TurnRow, outcome: TurnOutcome, at: string): void {
  turn.status = 'applied'
  turn.outcome = outcome
  turn.resolved_at = at
}

function applyInterpretation(
  s: StoreState,
  userId: string,
  turnId: string,
  boundQuestionTurnId: string | null,
  handleMap: Record<string, string>,
  interp: Interpretation,
  at: string,
  uuid: () => string,
): void {
  const turn = s.turns[turnId]!
  const session = s.sessions[turn.session_id]!

  const noMatch = (): void =>
    setResolved(turn, { kind: 'no_match', heard_transcript: turn.transcript_raw }, at)

  const boundTurn = boundQuestionTurnId === null ? undefined : s.turns[boundQuestionTurnId]
  const bound =
    boundTurn !== undefined && boundTurn.question !== null && boundTurn.question.resolution === null
      ? boundTurn
      : undefined

  if (bound !== undefined) {
    if (interp.kind === 'answer') {
      handleAnswer(s, turn, bound, interp.answer, handleMap, at)
      return
    }
    if (interp.kind === 'no_match') {
      // not affirmative, not negative, not an interpretable command:
      // nothing executes and the question stays pending (AC-10)
      setResolved(turn, { kind: 'unclassifiable', question_turn_id: bound.id }, at)
      return
    }
    // any unrelated interpretable command supersedes the question — the
    // question is declined and the command proceeds normally (D2, AC-10)
    bound.question!.resolution = {
      result: 'declined_superseded',
      resolved_by_turn_id: turn.id,
      resolved_at: at,
    }
    turn.caused_resolutions.push({ question_turn_id: bound.id, result: 'declined_superseded' })
  }

  const idsFromHandles = (handles: string[]): string[] => {
    const seen = new Set<string>()
    for (const handle of handles) {
      const id = handleMap[handle]
      if (id === undefined) continue
      const cur = s.tasks[id]
      if (cur === undefined || cur.user_id !== userId || cur.deleted_at !== null) continue
      seen.add(id)
    }
    return [...seen]
  }

  switch (interp.kind) {
    case 'create': {
      const res = applyCreate(s, userId, interp.tasks, at, uuid)
      attachApply(turn, res)
      setResolved(turn, { kind: 'applied', ...structuredClone(res.anatomy) }, at)
      return
    }
    case 'edit': {
      const edits = interp.edits
        .map((e) => ({ task_id: handleMap[e.handle] ?? '', changes: e.changes }))
        .filter((e) => e.task_id !== '')
      const res = applyEdit(s, edits, at)
      if (res.anatomy.changed_task_ids.length === 0) return noMatch()
      attachApply(turn, res)
      setResolved(turn, { kind: 'applied', ...structuredClone(res.anatomy) }, at)
      return
    }
    case 'delete': {
      const ids = idsFromHandles(interp.handles)
      if (ids.length === 0) return noMatch()
      if (ids.length === 1) {
        // single-task delete applies immediately with undo (AC-9)
        const res = applyDelete(s, ids, at)
        attachApply(turn, res)
        setResolved(turn, { kind: 'applied', ...structuredClone(res.anatomy) }, at)
        return
      }
      // rule 7 — bulk-delete gate: refused-to-apply, question names count+titles
      askQuestion(s, turn, 'bulk_delete', ids, bulkDeleteOptions(ids.length), null, at)
      return
    }
    case 'clarify': {
      const ids = idsFromHandles(interp.handles)
      if (ids.length === 0) return noMatch()
      const titles = ids.map((id) => s.tasks[id]!.title)
      askQuestion(s, turn, 'clarify', ids, titles, interp.pending_op, at)
      return
    }
    case 'query':
      // rule 9 — honest unsupported-query naming the working alternative (AC-15)
      setResolved(
        turn,
        { kind: 'unsupported_query', alternative: UNSUPPORTED_QUERY_ALTERNATIVE },
        at,
      )
      return
    case 'no_match':
      return noMatch()
    case 'answer':
      // an answer with no pending question answers nothing (rule 9 honesty)
      return noMatch()
  }
  void session
}

function askQuestion(
  s: StoreState,
  turn: TurnRow,
  kind: 'bulk_delete' | 'clarify',
  taskIds: string[],
  options: string[],
  pendingOp: TurnRow['pending_op'],
  at: string,
): void {
  const tasks = taskIds.map((id) => s.tasks[id]!)
  turn.status = 'asked'
  turn.question = {
    kind,
    task_ids: [...taskIds],
    task_titles: tasks.map((t) => t.title),
    options,
    ask_snapshot: tasks.map(cloneTask), // AC-12 re-validation baseline
    resolution: null,
  }
  turn.pending_op = pendingOp
  turn.outcome = { kind: 'question' } // an asking turn applies nothing (AC-1 carve-out)
  turn.resolved_at = at
}

function handleAnswer(
  s: StoreState,
  turn: TurnRow,
  bound: TurnRow,
  answer: AnswerClass,
  handleMap: Record<string, string>,
  at: string,
): void {
  const q = bound.question!

  const resolve = (result: ResolutionResult): void => {
    q.resolution = { result, resolved_by_turn_id: turn.id, resolved_at: at }
    turn.caused_resolutions.push({ question_turn_id: bound.id, result })
  }
  const unclassifiable = (): void =>
    setResolved(turn, { kind: 'unclassifiable', question_turn_id: bound.id }, at)
  const executed = (res: ApplyResult): void => {
    attachApply(turn, res)
    setResolved(
      turn,
      {
        kind: 'resolution',
        result: 'executed',
        question_turn_id: bound.id,
        executed: structuredClone(res.anatomy),
      },
      at,
    )
    resolve('executed')
  }
  const declined = (): void => {
    setResolved(turn, { kind: 'resolution', result: 'declined', question_turn_id: bound.id }, at)
    resolve('declined')
  }

  if (q.kind === 'bulk_delete') {
    if (answer.type === 'affirmative') {
      // rule 7 / AC-12: re-validate by snapshot comparison against ask-time
      // state; changed or deleted tasks are dropped
      const askById = new Map(q.ask_snapshot.map((t) => [t.id, t]))
      const survivors = q.task_ids.filter((id) => {
        const cur = s.tasks[id]
        return cur !== undefined && cur.deleted_at === null && taskEquals(cur, askById.get(id))
      })
      executed(applyDelete(s, survivors, at))
      return
    }
    if (answer.type === 'negative') return declined()
    return unclassifiable()
  }

  // clarify
  if (answer.type === 'selection') {
    const taskId = handleMap[answer.handle]
    if (taskId !== undefined && q.task_ids.includes(taskId) && s.tasks[taskId] !== undefined) {
      const op = bound.pending_op ?? { op: 'delete' }
      const res =
        op.op === 'delete'
          ? applyDelete(s, [taskId], at)
          : applyEdit(s, [{ task_id: taskId, changes: op.changes }], at)
      executed(res)
      return
    }
    return unclassifiable()
  }
  if (answer.type === 'negative') return declined()
  return unclassifiable()
}
