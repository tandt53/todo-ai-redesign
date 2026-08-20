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
import { newTaskChanges } from './apply.ts'
import { isUndoPhrase } from './normalize.ts'
import {
  executePlan,
  planContext,
  planCreate,
  planDelete,
  planEdits,
  type ExecutedPlan,
  type PlanContext,
  type PlanStep,
} from './plan.ts'
import { serializeTurn, sessionTurns, type TaskView, type TurnWire } from './serialize.ts'
import {
  findOpenSession,
  lazyIdleClose,
  newestAppliedTurn,
  nextSeq,
  nowIso,
  openSession,
} from './sessions.ts'
import { cloneTask, taskEquals } from './task-equals.ts'
import { violationToRefusedOutcome, type FieldViolation } from './task-fields.ts'
import { performUndo, undoRefusedNoAppliedTurn } from './undo.ts'
import { accountZone, recordClientZone } from './zone.ts'

/**
 * The working alternative named by an `unsupported_query` outcome (AC-15).
 * This string is read aloud/rendered to the user, not a protocol token, so it
 * follows the product's UI language. English as of T-069 (ADR-008 — English is
 * the product language this phase; direct replacement, no i18n layer), which
 * restores the literal this constant carried before the T-015g localization
 * pass.
 *
 * DRIFT, deliberate and reported (T-069): the contract still fixes the
 * Vietnamese literal — `docs/specs/assistant/api-contracts.md` §9 and
 * `docs/specs/assistant/data-model.md` TurnOutcome both pin
 * "danh sách và bộ lọc trên màn hình", which glosses as exactly this string.
 * ADR-008 supersedes them; `docs/specs/` is spec-agent's to edit and was explicitly
 * out of scope for this task, so the code moves first and the two contract
 * lines are a named follow-up.
 */
export const UNSUPPORTED_QUERY_ALTERNATIVE = 'the on-screen list and its filters'

/**
 * Bulk-delete confirm-chip labels (T-006d). A tap sends the option's LITERAL
 * text as the turn's transcript, so the option text IS both the chip label and
 * the user's own utterance — which makes these strings the design's copy, not
 * protocol tokens. The affirmative names the action and the real count; the
 * negative is a plain refusal. Web/mobile render these verbatim, which is what
 * keeps WCAG 2.5.3 (label in name) satisfied by construction.
 *
 * English (T-069, ADR-008 — English is the product language this phase). The
 * two labels are TRANSCRIBED, not composed: they are the literal chip text
 * design published on `assistant-chip-affirm` / `assistant-chip-negative` in
 * `docs/design/assistant/screens/voice-assistant-view.html` (and its `-android`
 * twin), and they obey `docs/design/_shared/components.md` §Buttons' one-word-per-
 * concept rule — **delete** (never remove/clear) and **task** (never item /
 * to-do). This is also what fixes product-review M5: the split there was the
 * server and the client spelling the same word two ways inside one bubble, and
 * the fix is not that Vietnamese left but that both layers now take the word
 * from the same catalogue row.
 *
 * Only the plural form exists because only the plural is reachable: the gate
 * below applies a single-task delete immediately (AC-9), so `bulkDeleteOptions`
 * is never called with count < 2. A singular branch would be unreachable copy
 * design has not published.
 *
 * Classification stays positional (index 0 = affirmative, index 1 = negative,
 * see ports/fixture-interpreter.ts), so it is unaffected by the language of
 * these strings.
 */
export const bulkDeleteOptions = (count: number): string[] => [
  `Delete ${count} tasks`,
  'Keep them',
]

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
    // ADR-010: the turn body's `timezone` is the SECOND reporting channel and it
    // goes through the SAME installer as `X-Timezone` (which app.ts's auth step
    // records). Neither is ever read by a computation — every computation reads
    // `account.timezone`. A grep for `recordClientZone` returns every door.
    recordClientZone(s, userId, req.timezone, at)
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
    //
    // **The handle list excludes steps** (F-005 AC-35, AC-36). A task with eight
    // steps contributes ONE handle, not nine — otherwise the assistant can
    // rename, complete and bulk-delete steps by name and read step titles aloud
    // in a `bulk_delete` confirmation. It also closes F-001 AC-31's
    // door-to-nowhere: that door opens by bringing a row into view IN THE TASK
    // LIST, which AC-35 makes empty for a step, so the assistant would report
    // changing a task and the link would be inert with no explanation.
    const liveTasks = Object.values(s.tasks)
      .filter((t) => t.user_id === userId && t.deleted_at === null && (t.parent_id ?? null) === null)
      .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
    const handleMap: Record<string, string> = {}
    // **The assistant must be able to read what it may write** (AC-36): `note`
    // and `reminder_at` join the context, because *"push the reminder an hour
    // later"* had nothing to read and the note was invisible to the model that
    // may now change it.
    const ctxTasks = liveTasks.map((t, i) => {
      const handle = `t${i + 1}`
      handleMap[handle] = t.id
      return {
        handle,
        title: t.title,
        status: t.status,
        note: t.note ?? null,
        due_at: t.due_at,
        reminder_at: t.reminder_at,
        priority: t.priority,
      }
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
        turn: serializeTurn(turn, taskView(s, userId, clock)),
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
    const turnWire = store.read((s) =>
      serializeTurn(s.turns[turnId]!, taskView(s, userId, clock)),
    )
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
      applyInterpretation(
        s,
        userId,
        turnId,
        boundQuestionTurnId,
        handleMap,
        interp,
        nowIso(clock),
        uuid,
        clock.now(),
      )
    })
  } catch (err) {
    if (err instanceof ApiError) throw err
    markFailed()
    const turnWire = store.read((s) =>
      serializeTurn(s.turns[turnId]!, taskView(s, userId, clock)),
    )
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

/** The derived-field context every serializer needs (`serialize.ts § TaskView`). */
export const taskView = (s: StoreState, userId: string, clock: Clock): TaskView => ({
  state: s,
  zone: accountZone(s, userId),
  nowMs: clock.now(),
})

function attachApply(turn: TurnRow, res: ExecutedPlan): void {
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
  nowMs: number,
): void {
  const turn = s.turns[turnId]!
  const session = s.sessions[turn.session_id]!
  // **This is the turn path's half of AC-40's *one validator, two doors*.** The turn
  // door reaches `engine/task-fields.ts enforceFieldRules` through `planCreate` /
  // `planEdits` — the same planner `app.ts`'s HTTP handlers call — and renders the
  // violation with `violationToRefusedOutcome` where the HTTP door renders it with
  // `violationToApiError`. So a grep for `engine/task-fields.ts` returns BOTH doors,
  // and `ValidatedChanges` makes the route structural rather than conventional:
  // nothing can reach the write phase without having been through the validator.
  const plans: PlanContext = planContext(s, userId, accountZone(s, userId), nowMs, at, uuid)

  const noMatch = (): void =>
    setResolved(turn, { kind: 'no_match', heard_transcript: turn.transcript_raw }, at)

  /**
   * The seventh `TurnOutcome` member (AC-36/AC-40). **The task is unchanged and
   * the refusal is whole-write** (AC-18): a turn carrying one legal and one
   * illegal field writes nothing at all, the task does not enter
   * `changed_task_ids`, no diff row is emitted, and no message can name a task
   * and then fail to say what happened to it. Because `changed_task_ids` is empty
   * and no `undo_snapshot` is captured, a refused turn never occupies or advances
   * the undo window — exactly like `no_match`, which is why no new turn status is
   * needed and the turn's `status` stays `applied`.
   *
   * The three improvisations are excluded by name: `no_match` is a lie (the task
   * WAS matched), the `500` failure envelope reports a server fault for a healthy
   * turn, and *write nothing and say nothing* passes AC-40's own fixture row.
   */
  const refused = (violation: FieldViolation, taskId: string | null): void =>
    setResolved(turn, violationToRefusedOutcome(violation, taskId), at)

  const runPlan = (steps: PlanStep[]): ExecutedPlan =>
    executePlan(plans, { steps, addressed_id: null })

  const boundTurn = boundQuestionTurnId === null ? undefined : s.turns[boundQuestionTurnId]
  const bound =
    boundTurn !== undefined && boundTurn.question !== null && boundTurn.question.resolution === null
      ? boundTurn
      : undefined

  if (bound !== undefined) {
    if (interp.kind === 'answer') {
      handleAnswer(plans, turn, bound, interp.answer, handleMap, at)
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
      // the turn-path create allowlist is `NewTaskFields`, widened to
      // TURN_WRITE_FIELDS (AC-36): `applyCreate` used to hard-code
      // `reminder_at: null` and carry no note
      const steps: PlanStep[] = []
      for (const fields of interp.tasks) {
        const planned = planCreate(plans, newTaskChanges(fields))
        if (!planned.ok) return refused(planned.violation, null)
        steps.push(...planned.plan.steps)
      }
      const res = runPlan(steps)
      attachApply(turn, res)
      setResolved(turn, { kind: 'applied', ...structuredClone(res.anatomy) }, at)
      return
    }
    case 'edit': {
      const edits = interp.edits
        .map((e) => ({ task_id: handleMap[e.handle] ?? '', changes: e.changes }))
        .filter((e) => e.task_id !== '')
      if (edits.length === 0) return noMatch()
      const planned = planEdits(plans, edits, { door: 'turn' })
      if (!planned.ok) return refused(planned.violation, edits[0]?.task_id ?? null)
      const res = executePlan(plans, planned.plan)
      if (res.anatomy.changed_task_ids.length === 0) return noMatch()
      attachApply(turn, res)
      setResolved(turn, { kind: 'applied', ...structuredClone(res.anatomy) }, at)
      return
    }
    case 'delete': {
      const ids = idsFromHandles(interp.handles)
      if (ids.length === 0) return noMatch()
      if (ids.length === 1) {
        // single-task delete applies immediately with undo (AC-9); AC-19 takes
        // its steps with it and ADR-012 mints one gesture id for the cluster
        const planned = planDelete(plans, ids, 'occurrence')
        if (!planned.ok) return refused(planned.violation, ids[0] ?? null)
        const res = executePlan(plans, planned.plan)
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
  plans: PlanContext,
  turn: TurnRow,
  bound: TurnRow,
  answer: AnswerClass,
  handleMap: Record<string, string>,
  at: string,
): void {
  const s = plans.state
  const q = bound.question!

  const resolve = (result: ResolutionResult): void => {
    q.resolution = { result, resolved_by_turn_id: turn.id, resolved_at: at }
    turn.caused_resolutions.push({ question_turn_id: bound.id, result })
  }
  const unclassifiable = (): void =>
    setResolved(turn, { kind: 'unclassifiable', question_turn_id: bound.id }, at)
  const executed = (res: ExecutedPlan): void => {
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
      const planned = planDelete(plans, survivors, 'occurrence')
      if (!planned.ok) return unclassifiable()
      executed(executePlan(plans, planned.plan))
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
      const planned =
        op.op === 'delete'
          ? planDelete(plans, [taskId], 'occurrence')
          : planEdits(plans, [{ task_id: taskId, changes: op.changes }], { door: 'turn' })
      if (!planned.ok) {
        setResolved(turn, violationToRefusedOutcome(planned.violation, taskId), at)
        // the question is still resolved by this answer — it was classified
        resolve('executed')
        return
      }
      executed(executePlan(plans, planned.plan))
      return
    }
    return unclassifiable()
  }
  if (answer.type === 'negative') return declined()
  return unclassifiable()
}
