// Plan → capture → apply (F-005 AC-46, ADR-013), shared by BOTH write doors.
//
// > An applying turn runs four phases inside one transaction: resolve, plan,
// > capture, apply. The plan is a pure function of the resolved targets and
// > current state and performs no writes; **apply consumes the planned set and
// > never re-derives it.** That constraint is part of the decision, not an
// > implementation note (ADR-013 § Consequences).
//
// The rows the plan exists for are the ones the server writes **as a
// consequence** of a write: the steps a completion cascades to (AC-19), the
// successor a repeating completion generates with its id allocated now (AC-26),
// the successor an un-complete removes (AC-28), the siblings a step move
// renumbers (ADR-015). Before this, those rows landed in neither `created_ids`,
// nor `undo_snapshot`, nor `post_apply` — so undoing a voice "done" reopened the
// occupied occurrence and left the successor standing.
//
// The HTTP door and the turn door use the SAME planner. Two implementations of
// *which completions generate and which parents cascade* is the duplication this
// project keeps paying for (L-004), so there is one.

import { randomUUID } from 'node:crypto'
import type { StoreState } from '../store/store.ts'
import type {
  AppliedAnatomy,
  DiffRow,
  TaskChanges,
  TaskRow,
} from '../types.ts'
import { DIFF_FIELDS, TURN_WRITE_FIELDS } from './apply.ts'
import { cloneTask } from './task-equals.ts'
import {
  checkParent,
  enforceFieldRules,
  type FieldViolation,
  type ValidatedChanges,
  zoneMissingViolation,
} from './task-fields.ts'
import {
  alignDue,
  RECURRENCE_MEMBERS,
  ruleOf,
  runCount,
  startOfTodayIso,
  successorDue,
} from './recurrence.ts'
import { isLocalStartOfDay } from './zone.ts'

/** ADR-015: sparse positions, gaps of 1024, per parent. First step is 1024. */
export const STEP_ORDER_GAP = 1024

/**
 * `target` = what the user asked for; `caused` = what the server wrote as a
 * consequence. The distinction is deliberate and is the first time the undo
 * record and the message anatomy can differ (ADR-013): the undo record covers
 * what the turn CAUSED, `turn.diff` / `changed_task_ids` / `created_titles` /
 * `deleted_titles` cover what the user ASKED FOR. A voice "done" on a parent
 * with eight steps therefore reverts nine rows and renders one diff.
 */
export type Origin = 'target' | 'caused'

export type PlanStep =
  | {
      kind: 'edit'
      origin: Origin
      task_id: string
      /** diff-visible field changes */
      changes: ValidatedChanges
      /** server-owned bookkeeping: never diffed, never client-settable */
      side?: Partial<TaskRow>
      /**
       * Apply even to a soft-deleted row. **One producer**: AC-30's series delete,
       * which writes `series_ended_at` on **every** row of the series — an end
       * marker is not trashing the row, and a previously-trashed occurrence that
       * kept `series_ended_at: null` would read `series_live: true` again the moment
       * it was restored, which is AC-39's third negative case leaking back in.
       */
      allow_deleted?: true
    }
  | { kind: 'create'; origin: Origin; row: TaskRow }
  /** soft delete — mints/carries the gesture id (ADR-012) */
  | { kind: 'delete'; origin: Origin; task_id: string; gesture_id: string }
  /** AC-28's HARD removal: deliberately not a soft delete, so it is not restorable */
  | { kind: 'remove'; origin: Origin; task_id: string }

export interface Plan {
  steps: PlanStep[]
  /** the row the request addressed — index into the response's `task` */
  addressed_id: string | null
}

export interface PlanContext {
  state: StoreState
  userId: string
  /** `account.timezone` — the ONE source (ADR-010) */
  zone: string | null
  nowMs: number
  at: string
  uuid: () => string
}

export type PlanResult = { ok: true; plan: Plan } | { ok: false; violation: FieldViolation }

const liveSteps = (state: StoreState, parentId: string): TaskRow[] =>
  Object.values(state.tasks)
    .filter((t) => (t.parent_id ?? null) === parentId && t.deleted_at === null)
    .sort((a, b) => (a.step_order ?? 0) - (b.step_order ?? 0) || a.id.localeCompare(b.id))

const asValidated = (c: TaskChanges): ValidatedChanges => c as ValidatedChanges

// ---------------------------------------------------------------------------
// Plan: create
// ---------------------------------------------------------------------------

export interface CreateFields extends TaskChanges {
  id?: string
}

export function planCreate(ctx: PlanContext, fields: CreateFields, origin: Origin = 'target'): PlanResult {
  const { state, userId } = ctx
  const rules = enforceFieldRules(fields, { target: null, zone: ctx.zone, nowMs: ctx.nowMs })
  if (!rules.ok) return rules
  const changes = rules.changes

  if (changes.title === undefined) {
    return {
      ok: false,
      violation: { reason: 'empty_title', field: 'title', message: 'title is required' },
    }
  }

  const parentId = changes.parent_id ?? null
  if (parentId !== null) {
    const v = checkParent(state, userId, parentId)
    if (v !== null) return { ok: false, violation: v }
  }

  const row: TaskRow = {
    id: fields.id ?? ctx.uuid(),
    user_id: userId,
    title: changes.title,
    note: changes.note ?? null,
    due_at: changes.due_at ?? null,
    due_all_day: changes.due_all_day ?? null,
    reminder_at: changes.reminder_at ?? null,
    reminder_shown_at: null,
    priority: changes.priority ?? null,
    status: changes.status ?? 'inbox',
    parent_id: parentId,
    step_order: changes.step_order ?? null,
    completed_by_parent: false,
    ever_completed: false,
    repeat_frequency: changes.repeat_frequency ?? null,
    repeat_interval: changes.repeat_interval ?? null,
    repeat_weekdays: changes.repeat_weekdays ?? null,
    repeat_month_days: changes.repeat_month_days ?? null,
    repeat_until: changes.repeat_until ?? null,
    repeat_count: changes.repeat_count ?? null,
    series_id: null,
    series_ended_at: null,
    delete_gesture_id: null,
    list_id: null,
    created_at: ctx.at,
    updated_at: ctx.at,
    deleted_at: null,
  }

  // **A create supplying `step_order` keeps it; a create supplying none is
  // appended last, positioned by the server** (ADR-015, AC-14). The
  // unconditional reading — server always assigns — silently voids AC-14's
  // offline replay while every AC still reads as satisfied.
  if (parentId !== null && row.step_order == null) {
    row.step_order = nextStepOrder(state, parentId)
  }

  // a create carrying a repeat gets a series_id and is aligned under AC-22/AC-23
  // BEFORE it is written
  if (row.repeat_frequency != null) {
    if (ctx.zone === null) return { ok: false, violation: zoneMissingViolation('repeat_frequency') }
    row.series_id = ctx.uuid()
    const settled = settleRepeatDue(row, ctx.zone, ctx.nowMs)
    if (settled === null) {
      return {
        ok: false,
        violation: {
          reason: 'structural_field_not_settable',
          field: 'repeat_frequency',
          message: 'the repeat rule admits no date',
        },
      }
    }
    row.due_at = settled.due_at
    row.due_all_day = settled.due_all_day
  } else if (row.due_at !== null && changes.due_all_day === undefined) {
    // Required on any write that sets `due_at` (data-model § due_all_day): the
    // client supplies it, or the server resolves it in the account zone. Absent
    // both, the write refuses — a read withholds a derived value, a write does
    // not guess one (ADR-010).
    if (ctx.zone === null) return { ok: false, violation: zoneMissingViolation('due_at') }
    row.due_all_day = isLocalStartOfDay(Date.parse(row.due_at), ctx.zone)
  }
  if (row.due_at === null) row.due_all_day = null

  const steps: PlanStep[] = [{ kind: 'create', origin, row }]
  return { ok: true, plan: { steps, addressed_id: row.id } }
}

export function nextStepOrder(state: StoreState, parentId: string): number {
  const siblings = liveSteps(state, parentId)
  if (siblings.length === 0) return STEP_ORDER_GAP
  const max = Math.max(...siblings.map((s) => s.step_order ?? 0))
  return max + STEP_ORDER_GAP
}

/**
 * AC-22 + AC-23, in **one order that is stated once: create, then align.**
 * Setting a repeat on a dateless task sets the due to today, all-day (AC-13's
 * date-only form, no invented time), and that created due is then aligned to the
 * rule exactly as any other due is.
 */
function settleRepeatDue(
  row: Pick<TaskRow, 'due_at' | 'due_all_day' | 'repeat_frequency' | 'repeat_interval' | 'repeat_weekdays' | 'repeat_month_days'>,
  zone: string,
  nowMs: number,
): { due_at: string; due_all_day: boolean; created: boolean; moved: boolean } | null {
  const rule = ruleOf(row)
  if (rule === null) return null
  let created = false
  let due = row.due_at
  let allDay = row.due_all_day ?? null
  if (due === null) {
    due = startOfTodayIso(nowMs, zone)
    allDay = true
    created = true
  } else if (allDay === null) {
    allDay = isLocalStartOfDay(Date.parse(due), zone)
  }
  const aligned = alignDue(due, rule, zone)
  if (aligned === null) return null
  return { due_at: aligned.due_at, due_all_day: allDay, created, moved: aligned.moved }
}

/** The dry run `POST /tasks/{id}/repeat-preview` serves — the same code path. */
export function previewRepeat(
  row: TaskRow,
  proposed: TaskChanges,
  zone: string,
  nowMs: number,
): { due_at: string | null; due_all_day: boolean; created: boolean; moved: boolean } | null {
  const merged = {
    due_at: proposed.due_at !== undefined ? proposed.due_at : row.due_at,
    due_all_day: proposed.due_all_day !== undefined ? proposed.due_all_day : row.due_all_day ?? null,
    repeat_frequency:
      proposed.repeat_frequency !== undefined ? proposed.repeat_frequency : row.repeat_frequency ?? null,
    repeat_interval:
      proposed.repeat_interval !== undefined ? proposed.repeat_interval : row.repeat_interval ?? null,
    repeat_weekdays:
      proposed.repeat_weekdays !== undefined ? proposed.repeat_weekdays : row.repeat_weekdays ?? null,
    repeat_month_days:
      proposed.repeat_month_days !== undefined
        ? proposed.repeat_month_days
        : row.repeat_month_days ?? null,
  }
  if (merged.repeat_frequency === null) {
    // clearing the repeat leaves the current occurrence in place as an ordinary
    // task, keeping its due date (AC-25) — nothing is created and nothing moves
    return {
      due_at: merged.due_at,
      due_all_day:
        merged.due_all_day ??
        (merged.due_at === null ? false : isLocalStartOfDay(Date.parse(merged.due_at), zone)),
      created: false,
      moved: false,
    }
  }
  return settleRepeatDue(merged, zone, nowMs)
}

// ---------------------------------------------------------------------------
// Plan: edits, and everything they cause
// ---------------------------------------------------------------------------

export interface EditRequest {
  task_id: string
  changes: TaskChanges
}

export interface PlanEditOpts {
  /**
   * `turn` applies AC-36's allowlist and AC-35's step exclusion before the field
   * rules; `http` has its own allowlist at the body parser.
   */
  door: 'http' | 'turn'
}

export function planEdits(ctx: PlanContext, edits: EditRequest[], opts: PlanEditOpts): PlanResult {
  const { state } = ctx
  const steps: PlanStep[] = []
  let addressed: string | null = null

  for (const edit of edits) {
    const target = state.tasks[edit.task_id]
    if (target === undefined || target.user_id !== ctx.userId || target.deleted_at !== null) continue
    if (addressed === null) addressed = target.id

    if (opts.door === 'turn') {
      // AC-35: a step is never offered to the interpreter, so reaching one here
      // is a rule violation rather than an ordinary edit.
      if ((target.parent_id ?? null) !== null) {
        return {
          ok: false,
          violation: {
            reason: 'step_not_addressable',
            field: null,
            message: 'a step is not addressable by the assistant',
          },
        }
      }
      const illegal = Object.keys(edit.changes).find(
        (k) => edit.changes[k as keyof TaskChanges] !== undefined && !(TURN_WRITE_FIELDS as readonly string[]).includes(k),
      )
      if (illegal !== undefined) {
        return {
          ok: false,
          violation: {
            reason: 'structural_field_not_settable',
            field: illegal,
            message: `${illegal} is not settable by the assistant`,
          },
        }
      }
    }

    const rules = enforceFieldRules(edit.changes, {
      target,
      zone: ctx.zone,
      nowMs: ctx.nowMs,
    })
    if (!rules.ok) return rules
    const changes: TaskChanges = { ...rules.changes }
    const side: Partial<TaskRow> = {}

    // ---- the zone-dependent halves ------------------------------------------
    const repeatTouched = RECURRENCE_MEMBERS.some((m) => changes[m] !== undefined)
    const repeatAfter =
      changes.repeat_frequency !== undefined
        ? changes.repeat_frequency
        : target.repeat_frequency ?? null

    if (repeatTouched && repeatAfter !== null) {
      if (ctx.zone === null) return { ok: false, violation: zoneMissingViolation('repeat_frequency') }
      const merged = {
        due_at: changes.due_at !== undefined ? changes.due_at : target.due_at,
        due_all_day:
          changes.due_all_day !== undefined ? changes.due_all_day : target.due_all_day ?? null,
        repeat_frequency: repeatAfter,
        repeat_interval:
          changes.repeat_interval !== undefined ? changes.repeat_interval : target.repeat_interval ?? null,
        repeat_weekdays:
          changes.repeat_weekdays !== undefined ? changes.repeat_weekdays : target.repeat_weekdays ?? null,
        repeat_month_days:
          changes.repeat_month_days !== undefined
            ? changes.repeat_month_days
            : target.repeat_month_days ?? null,
      }
      const settled = settleRepeatDue(merged, ctx.zone, ctx.nowMs)
      if (settled === null) {
        return {
          ok: false,
          violation: {
            reason: 'structural_field_not_settable',
            field: 'repeat_frequency',
            message: 'the repeat rule admits no date',
          },
        }
      }
      changes.due_at = settled.due_at
      changes.due_all_day = settled.due_all_day
      // `series_id` is assigned when a repeat is FIRST set and never cleared
      // (AC-25) — which is exactly why it must not be the liveness predicate.
      if ((target.series_id ?? null) === null) side.series_id = ctx.uuid()
    } else if (changes.due_at != null && changes.due_all_day === undefined) {
      if (ctx.zone === null) return { ok: false, violation: zoneMissingViolation('due_at') }
      changes.due_all_day = isLocalStartOfDay(Date.parse(changes.due_at), ctx.zone)
    }
    if (changes.due_at === null) changes.due_all_day = null

    // ---- F-008 AC-13: a step may not carry a list_id ---------------------------
    if (changes.list_id !== undefined) {
      const isStepRow = (target.parent_id ?? null) !== null
      if (isStepRow) {
        return {
          ok: false,
          violation: {
            reason: 'structural_field_not_settable',
            field: 'list_id',
            message: "A step's filing follows its parent",
          },
        }
      }
    }

    // ---- AC-10: writing OR clearing `reminder_at` clears `reminder_shown_at`
    // A reminder moved to a new moment is a new reminder and surfaces again.
    if (changes.reminder_at !== undefined && changes.reminder_at !== target.reminder_at) {
      side.reminder_shown_at = null
    }

    // ---- status transitions, and everything they cause ----------------------
    const statusAfter = changes.status !== undefined ? changes.status : target.status
    const wasDone = target.status === 'done'
    const isDone = statusAfter === 'done'
    const isStep = (target.parent_id ?? null) !== null

    if (isDone && !wasDone) {
      // ADR-014: `ever_completed` is set BY THE TRANSITION, never by a recount
      if (target.ever_completed !== true) side.ever_completed = true
      // AC-19 — parent completed: the steps are completed with it, and which
      // steps the cascade ticked is RECORDED, not inferred
      if (!isStep) {
        for (const step of liveSteps(state, target.id)) {
          if (step.status === 'done') continue
          steps.push({
            kind: 'edit',
            origin: 'caused',
            task_id: step.id,
            changes: asValidated({ status: 'done' }),
            side: { completed_by_parent: true },
          })
        }
        const generated = planSuccessor(ctx, target)
        if (!generated.ok) return generated
        steps.push(...generated.plan.steps)
      }
    }

    if (!isDone && wasDone) {
      // AC-19 — parent un-completed: **the cascade is undone, and only the
      // cascade.** A step the user had already ticked before stays ticked.
      if (!isStep) {
        for (const step of liveSteps(state, target.id)) {
          if (step.completed_by_parent !== true) continue
          steps.push({
            kind: 'edit',
            origin: 'caused',
            task_id: step.id,
            changes: asValidated({ status: 'inbox' }),
            side: { completed_by_parent: false },
          })
        }
        steps.push(...plannedSuccessorRemoval(ctx, target))
      }
    }

    // AC-19: `completed_by_parent` is cleared by ANY hand tick or untick of that
    // step — the flag records the cascade, so a hand action ends its claim.
    if (isStep && changes.status !== undefined && target.completed_by_parent === true) {
      side.completed_by_parent = false
    }

    // ---- ADR-015: a move writes ONE row, unless its gap is exhausted --------
    if (changes.step_order !== undefined && isStep && changes.step_order !== target.step_order) {
      steps.push({
        kind: 'edit',
        origin: 'target',
        task_id: target.id,
        changes: asValidated(changes),
        ...(Object.keys(side).length > 0 ? { side } : {}),
      })
      steps.push(...plannedRenumber(state, target, changes.step_order ?? null))
      continue
    }

    steps.push({
      kind: 'edit',
      origin: 'target',
      task_id: target.id,
      changes: asValidated(changes),
      ...(Object.keys(side).length > 0 ? { side } : {}),
    })
  }

  return { ok: true, plan: { steps, addressed_id: addressed } }
}

/**
 * AC-26 — **completing an occurrence generates exactly one successor for that
 * occurrence**: no occurrence generates a second, and no occurrence in a live
 * series generates none. The per-occurrence form is what makes it idempotent —
 * re-completing an occurrence AC-28 left standing is a second *path* generating
 * nothing, which is why the guard is `ever_completed`, the flag the row's FIRST
 * completion sets (ADR-014).
 *
 * The successor's id is allocated **now**, in the plan, so capture can record it
 * (ADR-013). If apply aborts the id is discarded with the transaction.
 */
function planSuccessor(ctx: PlanContext, target: TaskRow): PlanResult {
  const empty: PlanResult = { ok: true, plan: { steps: [], addressed_id: null } }
  const rule = ruleOf(target)
  if (rule === null) return empty
  if (target.ever_completed === true) return empty // this occurrence already ran
  if (ctx.zone === null) return { ok: false, violation: zoneMissingViolation('status') }
  const seriesId = target.series_id ?? null
  const runsAfter = (seriesId === null ? 0 : runCount(ctx.state, seriesId)) + 1
  const due = successorDue(target, ctx.state, ctx.zone, runsAfter)
  if (due === null) return empty

  const successorId = ctx.uuid()
  // AC-27: the reminder travels, keeping its OFFSET from the due date — an alert
  // copied verbatim onto next month's task is already in the past.
  let reminder: string | null = null
  if (target.reminder_at !== null && target.due_at !== null) {
    const offset = Date.parse(target.reminder_at) - Date.parse(target.due_at)
    reminder = new Date(Date.parse(due) + offset).toISOString()
  }
  const successor: TaskRow = {
    id: successorId,
    user_id: target.user_id,
    title: target.title,
    note: target.note ?? null,
    due_at: due,
    due_all_day: target.due_all_day ?? null,
    reminder_at: reminder,
    // AC-27: `reminder_shown_at` clear — a successor inheriting it carries a
    // reminder that never fires
    reminder_shown_at: null,
    priority: target.priority,
    status: 'inbox',
    parent_id: null,
    step_order: null,
    completed_by_parent: false,
    ever_completed: false,
    repeat_frequency: target.repeat_frequency ?? null,
    repeat_interval: target.repeat_interval ?? null,
    repeat_weekdays: target.repeat_weekdays ?? null,
    repeat_month_days: target.repeat_month_days ?? null,
    repeat_until: target.repeat_until ?? null,
    repeat_count: target.repeat_count ?? null,
    series_id: seriesId ?? successorId,
    series_ended_at: null,
    delete_gesture_id: null,
    list_id: target.list_id ?? null,
    created_at: ctx.at,
    updated_at: ctx.at,
    deleted_at: null,
  }
  const steps: PlanStep[] = [{ kind: 'create', origin: 'caused', row: successor }]

  // AC-27: **and every step, all unticked** (and with `completed_by_parent`
  // clear, so a cascade on the new occurrence reverses correctly).
  for (const step of liveSteps(ctx.state, target.id)) {
    steps.push({
      kind: 'create',
      origin: 'caused',
      row: {
        ...cloneTask(step),
        id: ctx.uuid(),
        parent_id: successorId,
        status: 'inbox',
        completed_by_parent: false,
        ever_completed: false,
        reminder_shown_at: null,
        delete_gesture_id: null,
        created_at: ctx.at,
        updated_at: ctx.at,
        deleted_at: null,
      },
    })
  }
  return { ok: true, plan: { steps, addressed_id: null } }
}

/**
 * AC-28 — **un-completing removes the successor only when the successor is
 * untouched.** All five conditions, conjunctive: same `series_id`, created no
 * earlier than the completion, never edited (`updated_at` equals `created_at`),
 * not itself done, and **no step of it ticked or changed**. Otherwise both rows
 * stay.
 *
 * The removal is HARD (api-contracts § `removed`): a soft-removed successor
 * would be restorable by `POST /tasks/{id}/restore` and would produce the second
 * open occurrence the recurrence section rests on not having.
 */
function plannedSuccessorRemoval(ctx: PlanContext, target: TaskRow): PlanStep[] {
  const seriesId = target.series_id ?? null
  if (seriesId === null) return []
  const completedAt = target.updated_at
  // **Condition 2 identifies exactly ONE row**, and *"created no earlier than the
  // completion"* alone does not: a series can hold several later occurrences (the
  // successor's own completion generates a third), and any of them satisfies the
  // inequality. THE successor is the EARLIEST row created at or after this
  // completion — the one this completion generated. Reading condition 2 as a bare
  // filter removes a row a different completion produced, which is a hard delete of
  // an occurrence the user is currently working in.
  const candidate = Object.values(ctx.state.tasks)
    .filter(
      (row) =>
        row.id !== target.id &&
        (row.series_id ?? null) === seriesId &&
        row.created_at >= completedAt,
    )
    .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))[0]
  if (candidate === undefined) return []
  if (candidate.updated_at !== candidate.created_at) return [] // condition 3: never edited
  if (candidate.status === 'done') return [] // condition 4: not itself done
  if (candidate.deleted_at !== null) return []
  const steps = liveSteps(ctx.state, candidate.id)
  // condition 5 touches the STEP's row, not the successor's — which is why the
  // whole-row `taskEquals` comparison cannot express it (ADR-013)
  if (steps.some((s) => s.status === 'done' || s.updated_at !== s.created_at)) return []
  return [
    { kind: 'remove', origin: 'caused', task_id: candidate.id },
    ...steps.map((s): PlanStep => ({ kind: 'remove', origin: 'caused', task_id: s.id })),
  ]
}

/**
 * ADR-015: when the gap between neighbours is exhausted — the requested position
 * collides with a sibling — renumber every sibling to fresh multiples of 1024 in
 * the same transaction and **return every row it changed**. The move is still one
 * request and is undone as one unit.
 */
function plannedRenumber(state: StoreState, moved: TaskRow, requested: number | null): PlanStep[] {
  const parentId = moved.parent_id ?? null
  if (parentId === null || requested === null) return []
  const siblings = liveSteps(state, parentId)
  const collides = siblings.some((s) => s.id !== moved.id && s.step_order === requested)
  if (!collides) return []
  const ordered = siblings
    .map((s) => ({ row: s, order: s.id === moved.id ? requested : s.step_order ?? 0 }))
    // the moved step sorts BEFORE the sibling it landed on, which is what a drop
    // onto an occupied position means
    .sort((a, b) => a.order - b.order || (a.row.id === moved.id ? -1 : b.row.id === moved.id ? 1 : 0))
  const out: PlanStep[] = []
  ordered.forEach(({ row }, i) => {
    const next = (i + 1) * STEP_ORDER_GAP
    if (row.id === moved.id) {
      out.push({
        kind: 'edit',
        origin: 'caused',
        task_id: row.id,
        changes: asValidated({ step_order: next }),
      })
      return
    }
    if (row.step_order === next) return
    out.push({
      kind: 'edit',
      origin: 'caused',
      task_id: row.id,
      changes: asValidated({ step_order: next }),
    })
  })
  return out
}

// ---------------------------------------------------------------------------
// Plan: deletes
// ---------------------------------------------------------------------------

export type DeleteScope = 'occurrence' | 'series'

/**
 * ADR-012 — **every delete mints ONE `delete_gesture_id` and writes it on every
 * row it trashes**, in the same transaction as `deleted_at`. That is what
 * `POST /tasks/{id}/restore` replays; nothing infers the membership afterwards.
 *
 * `occurrence` soft-deletes the row and its steps (AC-19). `series` soft-deletes
 * every unfinished occurrence of the row's series and their steps, **leaves
 * every completed one** — those are a record of work that was actually done —
 * and writes `series_ended_at` on **every** row of the series including the
 * surviving completed ones, which is AC-25's fourth ending and AC-39's third
 * negative case (a series that no longer exists must stop reading as live).
 */
export function planDelete(
  ctx: PlanContext,
  taskIds: string[],
  scope: DeleteScope,
  gestureId?: string,
): PlanResult {
  const { state } = ctx
  const gesture = gestureId ?? ctx.uuid()
  const steps: PlanStep[] = []
  const seen = new Set<string>()
  let addressed: string | null = null

  const softDelete = (row: TaskRow, origin: Origin): void => {
    if (seen.has(row.id)) return
    seen.add(row.id)
    steps.push({ kind: 'delete', origin, task_id: row.id, gesture_id: gesture })
  }

  for (const taskId of taskIds) {
    const target = state.tasks[taskId]
    if (target === undefined || target.user_id !== ctx.userId || target.deleted_at !== null) continue
    if (addressed === null) addressed = target.id

    if (scope === 'series') {
      const seriesId = target.series_id ?? null
      if (seriesId === null) {
        return {
          ok: false,
          violation: {
            reason: 'structural_field_not_settable',
            field: 'scope',
            message: 'scope=series requires a task in a series',
          },
        }
      }
      const members = Object.values(state.tasks).filter((t) => (t.series_id ?? null) === seriesId)
      for (const member of members) {
        // the end marker goes on EVERY row of the series, trashed or surviving —
        // setting an end marker is not trashing the row
        if ((member.series_ended_at ?? null) === null) {
          steps.push({
            kind: 'edit',
            origin: member.id === target.id ? 'target' : 'caused',
            task_id: member.id,
            changes: asValidated({}),
            side: { series_ended_at: ctx.at },
            ...(member.deleted_at !== null ? { allow_deleted: true as const } : {}),
          })
        }
        if (member.status === 'done' || member.deleted_at !== null) continue
        softDelete(member, member.id === target.id ? 'target' : 'caused')
        for (const step of liveSteps(state, member.id)) softDelete(step, 'caused')
      }
      continue
    }

    softDelete(target, 'target')
    // AC-19 — parent deleted: its steps go with it, and the undo restores the
    // whole cluster in one call
    for (const step of liveSteps(state, target.id)) softDelete(step, 'caused')
  }

  return { ok: true, plan: { steps, addressed_id: addressed } }
}

// ---------------------------------------------------------------------------
// Capture, then apply (ADR-013 phases 3 and 4)
// ---------------------------------------------------------------------------

export interface ExecutedPlan {
  /** what the USER asked for — target-origin rows only (ADR-013) */
  anatomy: AppliedAnatomy
  /** pre-state of every planned row that already exists */
  snapshot: TaskRow[]
  /** every planned row that did not exist yet — a direct create AND a successor */
  created_ids: string[]
  /** state of every row actually written, keyed by id */
  post_apply: Record<string, TaskRow>
  /** rows HARD-removed by this write (AC-28) */
  removed_ids: string[]
  /** every row this write changed, addressed row first (the multi-row response rule) */
  touched: TaskRow[]
  /** ADR-015: the pre-write value of each field the addressed row's write changed */
  prior: Record<string, unknown>
  addressed_id: string | null
}

/**
 * Capture over the planned set, then apply it. **Apply consumes the plan and
 * never re-derives it** (ADR-013), which is why every caused row is already in
 * `steps` before a single write happens.
 */
export function executePlan(ctx: PlanContext, plan: Plan): ExecutedPlan {
  const { state } = ctx
  const out: ExecutedPlan = {
    anatomy: { changed_task_ids: [], diff: [], created_titles: [], deleted_titles: [] },
    snapshot: [],
    created_ids: [],
    post_apply: {},
    removed_ids: [],
    touched: [],
    prior: {},
    addressed_id: plan.addressed_id,
  }

  // ---- phase 3: capture ---------------------------------------------------
  const captured = new Set<string>()
  for (const step of plan.steps) {
    if (step.kind === 'create') {
      out.created_ids.push(step.row.id)
      continue
    }
    if (captured.has(step.task_id)) continue
    const row = state.tasks[step.task_id]
    if (row === undefined) continue
    captured.add(step.task_id)
    out.snapshot.push(cloneTask(row))
  }

  // ---- phase 4: apply -----------------------------------------------------
  const touchedIds: string[] = []
  const markTouched = (id: string): void => {
    if (!touchedIds.includes(id)) touchedIds.push(id)
  }

  for (const step of plan.steps) {
    switch (step.kind) {
      case 'create': {
        state.tasks[step.row.id] = step.row
        markTouched(step.row.id)
        if (step.origin === 'target') {
          out.anatomy.changed_task_ids.push(step.row.id)
          out.anatomy.created_titles.push(step.row.title)
          for (const field of DIFF_FIELDS) {
            const value = step.row[field] ?? null
            if (value !== null) {
              out.anatomy.diff.push({ task_id: step.row.id, field, old: null, new: value })
            }
          }
        }
        out.post_apply[step.row.id] = cloneTask(step.row)
        break
      }
      case 'edit': {
        const cur = state.tasks[step.task_id]
        if (cur === undefined) break
        if (cur.deleted_at !== null && step.allow_deleted !== true) break
        const diffs: DiffRow[] = []
        for (const field of DIFF_FIELDS) {
          const next = step.changes[field]
          if (next === undefined) continue
          const before = cur[field] ?? null
          if (next === before) continue
          diffs.push({ task_id: step.task_id, field, old: before, new: next })
          if (step.task_id === plan.addressed_id && step.origin === 'target') {
            out.prior[field] = before
          }
          ;(cur as unknown as Record<string, unknown>)[field] = next
        }
        let sideChanged = false
        for (const [key, value] of Object.entries(step.side ?? {})) {
          if ((cur as unknown as Record<string, unknown>)[key] === value) continue
          ;(cur as unknown as Record<string, unknown>)[key] = value
          sideChanged = true
        }
        // **A drop where the step already was writes nothing** (ADR-015) — the
        // observable AC-43's *no undo entry* and AC-16's *announces nothing* are
        // asserted against. Generalised: a write that changes no field does not
        // advance `updated_at`.
        if (diffs.length === 0 && !sideChanged) break
        cur.updated_at = ctx.at
        markTouched(step.task_id)
        if (step.origin === 'target') {
          if (!out.anatomy.changed_task_ids.includes(step.task_id)) {
            out.anatomy.changed_task_ids.push(step.task_id)
          }
          out.anatomy.diff.push(...diffs)
        }
        out.post_apply[step.task_id] = cloneTask(cur)
        break
      }
      case 'delete': {
        const cur = state.tasks[step.task_id]
        if (cur === undefined || cur.deleted_at !== null) break
        if (step.origin === 'target') {
          out.anatomy.changed_task_ids.push(step.task_id)
          out.anatomy.deleted_titles.push(cur.title)
          for (const field of DIFF_FIELDS) {
            const value = cur[field] ?? null
            if (value !== null) {
              out.anatomy.diff.push({ task_id: step.task_id, field, old: value, new: null })
            }
          }
        }
        cur.deleted_at = ctx.at
        cur.updated_at = ctx.at
        cur.delete_gesture_id = step.gesture_id
        markTouched(step.task_id)
        out.post_apply[step.task_id] = cloneTask(cur)
        break
      }
      case 'remove': {
        const cur = state.tasks[step.task_id]
        if (cur === undefined) break
        delete state.tasks[step.task_id]
        out.removed_ids.push(step.task_id)
        break
      }
    }
  }

  out.touched = touchedIds
    .map((id) => state.tasks[id])
    .filter((r): r is TaskRow => r !== undefined)
  // the addressed row is never repeated in `changed`, so it sorts first
  if (plan.addressed_id !== null) {
    out.touched.sort((a, b) =>
      a.id === plan.addressed_id ? -1 : b.id === plan.addressed_id ? 1 : 0,
    )
  }
  return out
}

/** A plan context built from a store draft; `randomUUID` unless a test injects one. */
export const planContext = (
  state: StoreState,
  userId: string,
  zone: string | null,
  nowMs: number,
  at: string,
  uuid: () => string = randomUUID,
): PlanContext => ({ state, userId, zone, nowMs, at, uuid })
