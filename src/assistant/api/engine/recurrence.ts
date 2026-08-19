// Recurrence (F-005 AC-20..AC-30, ADR-011, ADR-014, ADR-015's neighbour).
//
// Six flat scalars, sets carried as canonical strings, and ONE enumeration
// (`RECURRENCE_MEMBERS`) that the validator, the differ and the serializer all
// read — the platform doc's *do not write the six names a fourth time*.
//
// The alignment (AC-23), the month-day clamp (AC-24) and the successor roll
// (AC-26) are ONE function, `nextOnRule`, called with different strictness.
// `POST /tasks/{id}/repeat-preview` is a dry run of the same code, which is what
// makes the disclosed date by construction the date that will be written
// (api-contracts § repeat-preview: a client-side preview would be L-004's shape
// on arithmetic four ACs depend on).
//
// All of it is civil-date arithmetic: the calendar decides the DATE, the zone
// only converts to and from an instant, and the wall-clock time of day is
// carried across unchanged — which is AC-44's *a daily 09:00 repeat rolled
// across a DST boundary is still due at 09:00 wall-clock*.

import type { RepeatFrequency, TaskRow } from '../types.ts'
import type { StoreState } from '../store/store.ts'
import {
  addMonthsClamped,
  addYearsClamped,
  civilOf,
  compareDates,
  dateFromDayNumber,
  dateOf,
  daysInMonth,
  dayNumber,
  instantOf,
  isoDate,
  todayInZone,
  weekdayIndex,
  type CivilDate,
} from './zone.ts'

/**
 * The single enumeration of the recurrence members (ADR-011). Everything that
 * needs the six names reads this: `DIFF_FIELDS`, the field validator, the
 * serializer, the turn-path write allowlist's exclusion list.
 */
export const RECURRENCE_MEMBERS = [
  'repeat_frequency',
  'repeat_interval',
  'repeat_weekdays',
  'repeat_month_days',
  'repeat_until',
  'repeat_count',
] as const

export type RecurrenceMember = (typeof RECURRENCE_MEMBERS)[number]

export const REPEAT_FREQUENCIES: readonly RepeatFrequency[] = ['day', 'week', 'month', 'year']

/** ADR-011's fixed canonical order; index 0 = Monday, matching `weekdayIndex`. */
export const WEEKDAY_ORDER = ['mo', 'tu', 'we', 'th', 'fr', 'sa', 'su'] as const

/** Validation bounds (api-contracts § Validation bounds). */
export const REPEAT_INTERVAL_MIN = 1
export const REPEAT_INTERVAL_MAX = 999
export const MONTH_DAY_MIN = 1
export const MONTH_DAY_MAX = 31
export const MONTH_DAYS_MAX_MEMBERS = 31

export interface RepeatRule {
  frequency: RepeatFrequency
  interval: number
  weekdays: string | null
  month_days: string | null
}

/** The rule a row carries, or `null` when it does not repeat. */
export function ruleOf(row: {
  repeat_frequency?: RepeatFrequency | null
  repeat_interval?: number | null
  repeat_weekdays?: string | null
  repeat_month_days?: string | null
}): RepeatRule | null {
  const frequency = row.repeat_frequency ?? null
  if (frequency === null) return null
  return {
    frequency,
    interval: row.repeat_interval ?? 1,
    weekdays: row.repeat_weekdays ?? null,
    month_days: row.repeat_month_days ?? null,
  }
}

// ---------------------------------------------------------------------------
// Canonicalisation (ADR-011: canonicalise, do not reject, a non-canonical set)
// ---------------------------------------------------------------------------

/**
 * `"th,mo"` → `"mo,th"`. A member outside the set is a shape violation, not a
 * canonicalisation problem, so it is reported rather than dropped (AC-21).
 * An empty set is not representable and is not a state (ADR-011).
 */
export function canonicalWeekdays(raw: string): { ok: string } | { bad: string } {
  const members = raw.split(',').map((s) => s.trim().toLowerCase())
  if (members.length === 0 || members.some((m) => m === '')) return { bad: 'empty weekday' }
  const seen = new Set<string>()
  for (const m of members) {
    if (!(WEEKDAY_ORDER as readonly string[]).includes(m)) return { bad: m }
    seen.add(m)
  }
  return { ok: WEEKDAY_ORDER.filter((d) => seen.has(d)).join(',') }
}

/** `"31,1,15"` → `"1,15,31"`; ascending ints 1-31, de-duplicated (ADR-011). */
export function canonicalMonthDays(raw: string): { ok: string } | { bad: string } {
  const members = raw.split(',').map((s) => s.trim())
  if (members.length === 0 || members.some((m) => m === '')) return { bad: 'empty month day' }
  const seen = new Set<number>()
  for (const m of members) {
    if (!/^\d{1,2}$/.test(m)) return { bad: m }
    const n = Number(m)
    if (n < MONTH_DAY_MIN || n > MONTH_DAY_MAX) return { bad: m }
    seen.add(n)
  }
  if (seen.size > MONTH_DAYS_MAX_MEMBERS) return { bad: `${seen.size} members` }
  return { ok: [...seen].sort((a, b) => a - b).join(',') }
}

const parseWeekdays = (canonical: string): number[] =>
  canonical
    .split(',')
    .map((d) => (WEEKDAY_ORDER as readonly string[]).indexOf(d))
    .filter((i) => i >= 0)
    .sort((a, b) => a - b)

const parseMonthDays = (canonical: string): number[] =>
  canonical
    .split(',')
    .map(Number)
    .filter((n) => Number.isInteger(n))
    .sort((a, b) => a - b)

/**
 * AC-24: day 31 in a 30-day month lands on the 30th, in February on the 28th
 * or 29th — never spilling into the next month and never skipping the month.
 * **Candidates are de-duplicated AFTER clamping**: `{30, 31}` in April both
 * resolve to the 30th, and a rule that produces one date twice is a defect that
 * only becomes visible once the set has two members (architect F13).
 */
export function clampMonthDays(days: number[], y: number, m: number): number[] {
  const last = daysInMonth(y, m)
  const clamped = new Set(days.map((d) => Math.min(d, last)))
  return [...clamped].sort((a, b) => a - b)
}

// ---------------------------------------------------------------------------
// The one date engine: alignment (AC-23), the roll (AC-26), the clamp (AC-24)
// ---------------------------------------------------------------------------

const weekStartDayNumber = (d: CivilDate): number => dayNumber(d) - weekdayIndex(d)

/** Candidate dates the rule admits, ascending, starting at or before `from`. */
function* candidateDates(from: CivilDate, rule: RepeatRule): Generator<CivilDate> {
  const interval = Math.max(1, rule.interval)
  switch (rule.frequency) {
    case 'day': {
      for (let k = 0; ; k += 1) yield dateFromDayNumber(dayNumber(from) + k * interval)
    }
    case 'week': {
      if (rule.weekdays === null) {
        for (let k = 0; ; k += 1) yield dateFromDayNumber(dayNumber(from) + k * 7 * interval)
      }
      const wds = parseWeekdays(rule.weekdays)
      const anchor = weekStartDayNumber(from)
      for (let k = 0; ; k += 1) {
        const weekStart = anchor + k * 7 * interval
        for (const wd of wds) yield dateFromDayNumber(weekStart + wd)
      }
    }
    case 'month': {
      if (rule.month_days === null) {
        for (let k = 0; ; k += 1) yield addMonthsClamped(from, k * interval)
      }
      const days = parseMonthDays(rule.month_days)
      for (let k = 0; ; k += 1) {
        const anchorMonth = addMonthsClamped({ y: from.y, m: from.m, d: 1 }, k * interval)
        for (const d of clampMonthDays(days, anchorMonth.y, anchorMonth.m)) {
          yield { y: anchorMonth.y, m: anchorMonth.m, d }
        }
      }
    }
    case 'year': {
      for (let k = 0; ; k += 1) yield addYearsClamped(from, k * interval)
    }
  }
}

/** Guard against a rule shape that admits nothing — no unbounded generator. */
const CANDIDATE_BUDGET = 512

/**
 * The nearest date the rule admits, at or after `from` (`strictlyAfter: false`
 * — AC-23's alignment, which never moves backward) or strictly after it
 * (`strictlyAfter: true` — AC-26's roll, computed **from the previous due, not
 * from the moment of completion**).
 *
 * One function, both callers, so the aligned date and the rolled date can never
 * disagree about what the rule admits.
 */
export function nextOnRule(
  from: CivilDate,
  rule: RepeatRule,
  opts: { strictlyAfter: boolean },
): CivilDate | null {
  let budget = CANDIDATE_BUDGET
  for (const candidate of candidateDates(from, rule)) {
    if (budget-- <= 0) return null
    const cmp = compareDates(candidate, from)
    if (opts.strictlyAfter ? cmp > 0 : cmp >= 0) return candidate
  }
  return null
}

export interface DueMove {
  /** the resulting instant, ISO */
  due_at: string
  /** whether the date moved at all (AC-23's *moved forward onto the rule*) */
  moved: boolean
}

/**
 * Move a due instant onto the rule, preserving its wall-clock time of day in
 * `zone` (AC-23, AC-44). Returns `null` only when the rule admits no date,
 * which the validator's shape rules make unreachable.
 */
export function alignDue(dueIso: string, rule: RepeatRule, zone: string): DueMove | null {
  const ms = Date.parse(dueIso)
  if (Number.isNaN(ms)) return null
  const clock = civilOf(ms, zone)
  const target = nextOnRule({ y: clock.y, m: clock.m, d: clock.d }, rule, { strictlyAfter: false })
  if (target === null) return null
  if (compareDates(target, { y: clock.y, m: clock.m, d: clock.d }) === 0) {
    return { due_at: new Date(ms).toISOString(), moved: false }
  }
  const at = instantOf({ ...target, h: clock.h, mi: clock.mi, s: clock.s, ms: clock.ms }, zone)
  return { due_at: new Date(at).toISOString(), moved: true }
}

/** The successor's due: the next date the rule admits after this one (AC-26). */
export function rollDue(dueIso: string, rule: RepeatRule, zone: string): string | null {
  const ms = Date.parse(dueIso)
  if (Number.isNaN(ms)) return null
  const clock = civilOf(ms, zone)
  const target = nextOnRule({ y: clock.y, m: clock.m, d: clock.d }, rule, { strictlyAfter: true })
  if (target === null) return null
  return new Date(
    instantOf({ ...target, h: clock.h, mi: clock.mi, s: clock.s, ms: clock.ms }, zone),
  ).toISOString()
}

/** The local start of today in `zone`, as an instant — AC-22's created due. */
export function startOfTodayIso(nowMs: number, zone: string): string {
  const today = dateOf(nowMs, zone)
  return new Date(instantOf({ ...today, h: 0, mi: 0, s: 0, ms: 0 }, zone)).toISOString()
}

// ---------------------------------------------------------------------------
// Liveness (AC-25's four endings) and the run count (ADR-014)
// ---------------------------------------------------------------------------

/**
 * `run_count(S) = count(rows where series_id = S and ever_completed)` — ADR-014.
 * **Soft-deleted rows are still rows, so they still count**, which is what
 * AC-25 requires: a series delete never silently satisfies its own run count,
 * because the delete trashes only unfinished occurrences whose flag is `false`.
 */
export function runCount(state: StoreState, seriesId: string): number {
  let n = 0
  for (const row of Object.values(state.tasks)) {
    if (row.series_id === seriesId && row.ever_completed === true) n += 1
  }
  return n
}

/**
 * `series_live` — DERIVED, never stored, and **never keyed off `series_id`**
 * (AC-25, AC-39): `series_id` survives clearing the repeat, so an
 * implementation keyed off it marks every task that ever repeated as repeating
 * for good.
 *
 * `true` iff the repeat is still set and none of AC-25's four endings has
 * fired. Clearing the repeat is the fourth and needs no marker — it clears
 * `repeat_frequency`, so the first conjunct is false.
 *
 * With no account zone the `repeat_until` ending cannot be evaluated (there is
 * no *today* to compare against). It is treated as **not yet fired**: a read
 * withholds a derived value rather than inventing one, and this direction keeps
 * the row marked as repeating — visible on the surface — rather than silently
 * unmarking a series that may still be running.
 */
export function seriesLive(
  row: TaskRow,
  state: StoreState,
  nowMs: number,
  zone: string | null,
): boolean {
  if ((row.repeat_frequency ?? null) === null) return false
  if ((row.series_ended_at ?? null) !== null) return false
  const until = row.repeat_until ?? null
  if (until !== null && zone !== null && until < todayInZone(nowMs, zone)) return false
  const count = row.repeat_count ?? null
  if (count !== null && row.series_id != null && runCount(state, row.series_id) >= count) {
    return false
  }
  return true
}

/**
 * Whether a completion of `row` should generate a successor, and with what due
 * (AC-25's *completing the last occurrence under an end date now passed, or
 * under a run count now reached, generates no successor*).
 *
 * Called from the PLAN phase only (ADR-013: the plan is the only producer of
 * the caused set; apply consumes it and never re-derives it).
 */
export function successorDue(
  row: TaskRow,
  state: StoreState,
  zone: string,
  runsAfterThisCompletion: number,
): string | null {
  const rule = ruleOf(row)
  if (rule === null) return null
  if ((row.series_ended_at ?? null) !== null) return null
  const count = row.repeat_count ?? null
  if (count !== null && runsAfterThisCompletion >= count) return null
  if (row.due_at === null) return null
  const next = rollDue(row.due_at, rule, zone)
  if (next === null) return null
  const until = row.repeat_until ?? null
  if (until !== null && isoDate(dateOf(Date.parse(next), zone)) > until) return null
  void state
  return next
}
