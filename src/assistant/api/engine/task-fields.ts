// THE field-rule validator (F-005 AC-40, platform doc § One validator, two doors).
//
// > Every field rule binds the write, not the door.
//
// Before F-005 the rules lived in `app.ts`'s `taskChangesFrom`, which is called
// **only from the two HTTP handlers**, while `applyEdit` assigned straight onto
// the row. That is L-005's shape — *a rule enforced by one entry point and
// merely intended by another* — on the door AC-36 deliberately widens: a turn
// could set an empty title, a whitespace-only note, a free-string priority and
// an empty string where AC-10 says clearing stores no value.
//
// The rules are extracted here and **both doors call `enforceFieldRules`**:
//   - `app.ts`      — the HTTP path, via `violationToApiError`
//   - `engine/plan.ts` — the turn path, via `violationToRefusedOutcome`
// A grep for `enforceFieldRules` returns both. Same rule, same rejected value,
// **outcome stated per path**: a `400 VALIDATION` with a field name to a client
// that sent a bad body, the `refused` outcome to a person who spoke a
// well-formed sentence.

import { ApiError, validation } from '../errors.ts'
import type { StoreState } from '../store/store.ts'
import type { RefusalReason, TaskChanges, TaskRow, TurnOutcome } from '../types.ts'
import {
  canonicalMonthDays,
  canonicalWeekdays,
  REPEAT_FREQUENCIES,
  REPEAT_INTERVAL_MAX,
  REPEAT_INTERVAL_MIN,
} from './recurrence.ts'
import { dateOf, isoDate } from './zone.ts'

/** Validation bounds (api-contracts § Validation bounds). Refused, never truncated. */
export const TITLE_MAX = 500
export const NOTE_MAX = 20_000
export const STEPS_PER_PARENT_MAX = 200

/** AC-8's four states. `none` is the ABSENCE of a stored value, not a string. */
export const PRIORITIES: readonly string[] = ['none', 'low', 'medium', 'high']

/**
 * The **write** vocabulary (ADR-009 §2). Narrower than `TaskStatus`: `'today'`
 * is retired as a live value and this is the write path, which is where it is
 * stopped from being minted again.
 */
export const WRITABLE_STATUSES: readonly string[] = ['inbox', 'done', 'archived']

export interface FieldViolation {
  /** the turn path's `refused` reason (closed enum — api-contracts § The refused turn) */
  reason: RefusalReason
  field: string | null
  /** the HTTP path's message; the turn path renders F-002's wording from `reason` */
  message: string
}

declare const validatedBrand: unique symbol

/**
 * Field changes that have been through `enforceFieldRules`.
 *
 * The brand is how *"every field rule binds the write, not the door"* (AC-40)
 * becomes structural rather than a convention: `engine/plan.ts`'s write phase
 * accepts only `ValidatedChanges`, and the only producer of that type is this
 * module. A future caller cannot reintroduce L-005's shape by assigning straight
 * onto the row — the compiler stops it.
 */
export interface ValidatedChanges extends TaskChanges {
  readonly [validatedBrand]?: true
}

export type FieldRulesResult =
  | { ok: true; changes: ValidatedChanges }
  | { ok: false; violation: FieldViolation }

export interface FieldRulesContext {
  /** the row being written; `null` for a create */
  target: TaskRow | null
  /** `account.timezone` — the ONE source (ADR-010); `null` = never reported */
  zone: string | null
  /** `Clock.now()`, for the `until`-before-due comparison on a create */
  nowMs: number
}

const bad = (reason: RefusalReason, field: string | null, message: string): FieldRulesResult => ({
  ok: false,
  violation: { reason, field, message },
})

const isBlank = (s: string): boolean => s.trim() === ''

/**
 * Apply every field rule to a proposed change set, returning the NORMALISED
 * changes (priority `none` → `null`, blank note → `null`, canonical recurrence
 * sets) or the first violation.
 *
 * Called by both doors. Never mutates its inputs and never writes.
 */
export function enforceFieldRules(changes: TaskChanges, ctx: FieldRulesContext): FieldRulesResult {
  const out: TaskChanges = {}
  const target = ctx.target

  // ---- title (AC-37): never empty, and any maximum is REFUSED, not truncated
  if (changes.title !== undefined) {
    const raw = changes.title
    if (typeof raw !== 'string' || isBlank(raw)) {
      return bad('empty_title', 'title', 'title must be a non-empty string')
    }
    if (raw.length > TITLE_MAX) {
      return bad('length_exceeded', 'title', `title exceeds ${TITLE_MAX} characters`)
    }
    out.title = raw
  }

  // ---- note (AC-6): blank / whitespace-only / newline-only stores NO note at
  // all, never `""` — the distinction is observable on read-back
  if (changes.note !== undefined) {
    const raw = changes.note
    if (raw !== null && typeof raw !== 'string') {
      return bad('note_not_text', 'note', 'note must be a string or null')
    }
    if (raw !== null && raw.length > NOTE_MAX) {
      return bad('length_exceeded', 'note', `note exceeds ${NOTE_MAX} characters`)
    }
    out.note = raw === null || isBlank(raw) ? null : raw
  }

  // ---- priority (AC-8): four states; `none` stores null, reads emit "none"
  if (changes.priority !== undefined) {
    const raw = changes.priority
    if (raw !== null && (typeof raw !== 'string' || !PRIORITIES.includes(raw))) {
      return bad(
        'priority_not_in_set',
        'priority',
        `priority must be one of ${PRIORITIES.join(', ')}`,
      )
    }
    out.priority = raw === null || raw === 'none' ? null : raw
  }

  // ---- status: the write vocabulary (ADR-009 §2)
  //
  // CONTRACT GAP, chosen rather than buried: `api-contracts § The refused turn`
  // enumerates twelve reasons and none of them is *"this value is not in this
  // field's set"* for `status`. `status` IS in `TURN_WRITE_FIELDS`, and
  // `TaskStatus` has four members, so a fixture row CAN express `status:
  // 'today'`. The two alternatives are worse: silently coercing `today` to
  // `inbox` is the translation rule ADR-009 refused by name, and letting it
  // through re-mints the retired value on the one path that is not the HTTP
  // door. `structural_field_not_settable` is the least-wrong member — the field
  // cannot be set to that value — and the HTTP door renders `message`/`field`,
  // not the reason, so nothing regresses there.
  if (changes.status !== undefined) {
    const raw: string = changes.status
    if (!WRITABLE_STATUSES.includes(raw)) {
      return bad(
        'structural_field_not_settable',
        'status',
        `status must be one of ${WRITABLE_STATUSES.join(', ')}`,
      )
    }
    out.status = changes.status
  }

  // ---- the two instants. Clearing stores NO value (AC-10) — not a zero date,
  // not an empty string — which is why `''` is rejected rather than stored.
  //
  // SECOND CONTRACT GAP, same shape as `status` above and recorded once here:
  // the closed reason list has exactly one member that names a **value-type**
  // violation — `note_not_text` — and the twelve were written for the rules the
  // ACs name, not for a malformed instant, a non-boolean flag or a fractional
  // `step_order`. `note_not_text` is read here as its general form, *the value
  // is not of the field's declared type*, for every field rather than for the
  // note alone. The HTTP door renders `message` and `field`, so the reason is
  // observable only on the turn path, where these inputs are unreachable through
  // the fixture table's typed `TaskChanges`.
  for (const field of ['due_at', 'reminder_at'] as const) {
    if (changes[field] === undefined) continue
    const raw = changes[field]
    if (raw === null) {
      out[field] = null
      continue
    }
    if (typeof raw !== 'string' || isBlank(raw) || Number.isNaN(Date.parse(raw))) {
      return bad('note_not_text', field, `${field} must be an iso8601 instant or null`)
    }
    out[field] = new Date(Date.parse(raw)).toISOString()
  }

  if (changes.due_all_day !== undefined) {
    const raw = changes.due_all_day
    if (raw !== null && typeof raw !== 'boolean') {
      return bad('note_not_text', 'due_all_day', 'due_all_day must be a boolean or null')
    }
    out.due_all_day = raw
  }

  if (changes.step_order !== undefined) {
    const raw = changes.step_order
    if (raw !== null && (typeof raw !== 'number' || !Number.isInteger(raw))) {
      return bad('structural_field_not_settable', 'step_order', 'step_order must be an integer or null')
    }
    out.step_order = raw
  }

  if (changes.parent_id !== undefined) out.parent_id = changes.parent_id

  // ---- list_id (F-008 AC-10): uuid or null. Value validation (existence and
  // step constraint) is in plan.ts, where the store is available; this layer
  // handles type.
  if (changes.list_id !== undefined) {
    const raw = changes.list_id
    if (raw !== null && (typeof raw !== 'string' || isBlank(raw))) {
      return bad('note_not_text', 'list_id', 'list_id must be a uuid or null')
    }
    out.list_id = raw
  }

  // ---- sort_order (F-009 AC-5/AC-6): an integer. Where it lands is plan.ts's
  // business, the same split list_id uses — this layer only says what shape a
  // caller may send.
  if (changes.sort_order !== undefined) {
    const raw = changes.sort_order
    if (raw !== null && (typeof raw !== 'number' || !Number.isInteger(raw))) {
      return bad('note_not_text', 'sort_order', 'sort_order must be an integer')
    }
    out.sort_order = raw
  }

  // ---- recurrence (AC-21, AC-25, ADR-011)
  //
  // Shape violations carry `structural_field_not_settable`, and that reason is
  // the TRUE turn-path answer for them: a turn may not set any repeat member
  // (AC-36), so the member is refused before its value is ever read. The value
  // rules below are reachable only through the HTTP door, which renders
  // `message` and `field`.
  const repeatViolation = enforceRepeatShape(changes, out)
  if (repeatViolation !== null) return { ok: false, violation: repeatViolation }

  // ---- rules about the RESULTING row, not about one field in isolation ----
  const after = { ...(target ?? {}), ...out } as Partial<TaskRow>

  // a step may carry no repeat (AC-18)
  const parentAfter = after.parent_id ?? null
  if (parentAfter !== null && (after.repeat_frequency ?? null) !== null) {
    return bad('repeat_on_step', 'repeat_frequency', 'a step may not carry a repeat')
  }

  // `until` and `count` are mutually exclusive (AC-25)
  if ((after.repeat_until ?? null) !== null && (after.repeat_count ?? null) !== null) {
    return bad(
      'until_and_count',
      'repeat_until',
      'recurrence.until and recurrence.count are mutually exclusive',
    )
  }

  // clearing `due_at` while a repeat is set is REFUSED (AC-22) — the message
  // names the action that ends the repeat, because the invariant is the point
  if (
    out.due_at === null &&
    (after.repeat_frequency ?? null) !== null &&
    changes.repeat_frequency === undefined
  ) {
    return bad(
      'clear_due_while_repeating',
      'due_at',
      'a repeating task always has a due date — clear the repeat first',
    )
  }

  // an `until` earlier than the due date is REPORTED, not corrected (AC-25)
  const untilAfter = after.repeat_until ?? null
  if (untilAfter !== null) {
    const dueAfter = after.due_at ?? null
    if (dueAfter !== null && ctx.zone !== null) {
      const dueDate = isoDate(dateOf(Date.parse(dueAfter), ctx.zone))
      if (untilAfter < dueDate) {
        return bad(
          'end_before_due',
          'repeat_until',
          'recurrence.until is earlier than the due date',
        )
      }
    }
  }

  return { ok: true, changes: out }
}

function enforceRepeatShape(changes: TaskChanges, out: TaskChanges): FieldViolation | null {
  const structural = (field: string, message: string): FieldViolation => ({
    reason: 'structural_field_not_settable',
    field,
    message,
  })

  if (changes.repeat_frequency !== undefined) {
    const raw = changes.repeat_frequency
    if (raw !== null && !REPEAT_FREQUENCIES.includes(raw)) {
      return structural(
        'repeat_frequency',
        `repeat_frequency must be one of ${REPEAT_FREQUENCIES.join(', ')}`,
      )
    }
    out.repeat_frequency = raw
  }

  if (changes.repeat_interval !== undefined) {
    const raw = changes.repeat_interval
    if (raw !== null && (typeof raw !== 'number' || !Number.isInteger(raw))) {
      return structural('repeat_interval', 'repeat_interval must be an integer or null')
    }
    if (raw !== null && (raw < REPEAT_INTERVAL_MIN || raw > REPEAT_INTERVAL_MAX)) {
      return {
        reason: 'length_exceeded',
        field: 'repeat_interval',
        message: `repeat_interval must be between ${REPEAT_INTERVAL_MIN} and ${REPEAT_INTERVAL_MAX}`,
      }
    }
    out.repeat_interval = raw
  }

  if (changes.repeat_weekdays !== undefined) {
    const raw = changes.repeat_weekdays
    if (raw === null) out.repeat_weekdays = null
    else if (typeof raw !== 'string' || isBlank(raw)) {
      // an empty set is not representable and is not a state (ADR-011)
      return structural('repeat_weekdays', 'repeat_weekdays must be a non-empty weekday set or null')
    } else {
      const canonical = canonicalWeekdays(raw)
      if ('bad' in canonical) {
        return structural('repeat_weekdays', `repeat_weekdays: unknown weekday ${canonical.bad}`)
      }
      out.repeat_weekdays = canonical.ok
    }
  }

  if (changes.repeat_month_days !== undefined) {
    const raw = changes.repeat_month_days
    if (raw === null) out.repeat_month_days = null
    else if (typeof raw !== 'string' || isBlank(raw)) {
      return structural(
        'repeat_month_days',
        'repeat_month_days must be a non-empty day set or null',
      )
    } else {
      const canonical = canonicalMonthDays(raw)
      if ('bad' in canonical) {
        return structural(
          'repeat_month_days',
          `repeat_month_days: ${canonical.bad} is outside 1-31`,
        )
      }
      out.repeat_month_days = canonical.ok
    }
  }

  if (changes.repeat_until !== undefined) {
    const raw = changes.repeat_until
    if (raw === null) out.repeat_until = null
    else if (typeof raw !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      return structural('repeat_until', 'repeat_until must be an iso8601 calendar date or null')
    } else out.repeat_until = raw
  }

  if (changes.repeat_count !== undefined) {
    const raw = changes.repeat_count
    if (raw === null) out.repeat_count = null
    else if (typeof raw !== 'number' || !Number.isInteger(raw) || raw < 1) {
      return structural('repeat_count', 'repeat_count must be an integer >= 1')
    } else out.repeat_count = raw
  }

  // AC-21's two deliberate exclusions: no weekday selection under a daily rule
  // ("daily, but only Mondays and Fridays" is not daily, it is weekly on two
  // days), and month-days belong to a monthly rule. Checked against the
  // frequency this write RESULTS in, so the pair can be set in one request.
  const freq = out.repeat_frequency !== undefined ? out.repeat_frequency : undefined
  if (freq !== undefined) {
    if (out.repeat_weekdays != null && freq !== 'week') {
      return structural('repeat_weekdays', 'recurrence.weekdays names a weekly rule only')
    }
    if (out.repeat_month_days != null && freq !== 'month') {
      return structural('repeat_month_days', 'recurrence.month_days names a monthly rule only')
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// The two doors' renderings of one violation
// ---------------------------------------------------------------------------

/** The HTTP door: `400 VALIDATION` with the field named (or `409` for the zone). */
export function violationToApiError(v: FieldViolation): ApiError {
  if (v.reason === 'timezone_unknown') return timezoneUnknown()
  return validation(v.message, v.field ?? undefined)
}

/** The turn door: the seventh `TurnOutcome` member (AC-36/AC-40). */
export function violationToRefusedOutcome(
  v: FieldViolation,
  taskId: string | null,
): TurnOutcome & { kind: 'refused' } {
  return { kind: 'refused', reason: v.reason, field: v.field, task_id: taskId }
}

/**
 * `409 TIMEZONE_UNKNOWN` (ADR-010). Reachable only for a client that has never
 * sent `X-Timezone` on any request, because `recordClientZone` runs in the auth
 * step before routing — a client contract violation addressed to the client,
 * not a state a user can be in and cannot act on.
 */
export const timezoneUnknown = (): ApiError =>
  new ApiError(409, 'TIMEZONE_UNKNOWN', 'a date computation requires the account timezone', {
    detail: { header: 'X-Timezone' },
  })

export const zoneMissingViolation = (field: string | null): FieldViolation => ({
  reason: 'timezone_unknown',
  field,
  message: 'a date computation requires the account timezone',
})

/**
 * `parent_id` must name a **live, non-step row of the caller's** (AC-18). A step
 * of a step is refused — one level, and the refusal is stated rather than
 * flattened or silently dropped.
 */
export function checkParent(
  state: StoreState,
  userId: string,
  parentId: string,
): FieldViolation | null {
  const parent = state.tasks[parentId]
  if (parent === undefined || parent.user_id !== userId || parent.deleted_at !== null) {
    return {
      reason: 'step_not_addressable',
      field: 'parent_id',
      message: 'parent_id must name a live task of this account',
    }
  }
  if ((parent.parent_id ?? null) !== null) {
    return {
      reason: 'nesting_too_deep',
      field: 'parent_id',
      message: 'a step has no steps of its own — one level only',
    }
  }
  const steps = Object.values(state.tasks).filter(
    (t) => t.parent_id === parentId && t.deleted_at === null,
  )
  if (steps.length >= STEPS_PER_PARENT_MAX) {
    return {
      reason: 'length_exceeded',
      field: 'parent_id',
      message: `a task may hold at most ${STEPS_PER_PARENT_MAX} steps`,
    }
  }
  return null
}

