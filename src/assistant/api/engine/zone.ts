// Zone arithmetic and the ONE zone installer (F-005 AC-44, AC-13, ADR-010).
//
// Two responsibilities, deliberately in one file because they are one decision:
//
//  1. `recordClientZone` — the single writer of the `first-report` path. It is
//     called from app.ts's auth step, before routing, for EVERY request, and
//     both reporting channels (`X-Timezone`, `POST /assistant/turn`'s body
//     `timezone`) go through it. A grep for the name returns every door
//     (ADR-010, L-005's remedy applied in advance).
//  2. The wall-clock arithmetic every date computation needs, resolved against
//     `account.timezone` and NEVER against a request header or the server's own
//     zone (ADR-010: a silent fallback is a date that is a day out for exactly
//     the users it is invisible to).
//
// No date library: `Intl.DateTimeFormat` with a `timeZone` is the platform's
// own tz database, and Node >= 20 ships it (platform doc). Instants are epoch
// milliseconds; a "civil date" is {y, m, d} with m 1-12.

import type { AccountRow } from '../types.ts'
import type { StoreState } from '../store/store.ts'

export interface CivilDate {
  y: number
  m: number
  d: number
}

export interface CivilTime {
  h: number
  mi: number
  s: number
  ms: number
}

export type Civil = CivilDate & CivilTime

const MINUTE = 60_000
const HOUR = 60 * MINUTE
export const DAY_MS = 24 * HOUR

/** IANA zone validity, answered by the platform's own tz database. */
export function isValidZone(zone: string): boolean {
  if (typeof zone !== 'string' || zone.trim() === '') return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone })
    return true
  } catch {
    return false
  }
}

const formatterCache = new Map<string, Intl.DateTimeFormat>()

function partsFormatter(zone: string): Intl.DateTimeFormat {
  let f = formatterCache.get(zone)
  if (f === undefined) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    formatterCache.set(zone, f)
  }
  return f
}

/** The wall-clock reading an observer in `zone` takes of the instant `ms`. */
export function civilOf(ms: number, zone: string): Civil {
  const parts = partsFormatter(zone).formatToParts(new Date(ms))
  const get = (type: string): number => Number(parts.find((p) => p.type === type)?.value ?? '0')
  return {
    y: get('year'),
    m: get('month'),
    d: get('day'),
    h: get('hour'),
    mi: get('minute'),
    s: get('second'),
    ms: ms - Math.floor(ms / 1000) * 1000,
  }
}

/** Zone offset in ms (civil = UTC + offset) at the instant `ms`. */
function offsetAt(ms: number, zone: string): number {
  const c = civilOf(ms, zone)
  const asUtc = Date.UTC(c.y, c.m - 1, c.d, c.h, c.mi, c.s, 0)
  return asUtc - Math.floor(ms / 1000) * 1000
}

/**
 * The instant at which an observer in `zone` reads exactly this wall clock.
 *
 * Two passes, because the offset depends on the answer: guess with the offset
 * that applies at the naive-UTC instant, then re-read the offset at the guess
 * and correct. A wall clock that a DST spring-forward skips resolves to the
 * instant just after the gap; one that a fall-back repeats resolves to the
 * first (pre-transition) reading. Both are stable, which is what AC-44's
 * "one answer per row" needs.
 */
export function instantOf(c: Civil, zone: string): number {
  const naive = Date.UTC(c.y, c.m - 1, c.d, c.h, c.mi, c.s, c.ms)
  let guess = naive - offsetAt(naive, zone)
  const check = naive - offsetAt(guess, zone)
  if (check !== guess) guess = check
  return guess
}

/** The instant of the local start (00:00:00.000) of `date` in `zone`. */
export function startOfDay(date: CivilDate, zone: string): number {
  return instantOf({ ...date, h: 0, mi: 0, s: 0, ms: 0 }, zone)
}

/** `true` iff `ms` is the local start of its own day in `zone` (AC-13). */
export function isLocalStartOfDay(ms: number, zone: string): boolean {
  const c = civilOf(ms, zone)
  return c.h === 0 && c.mi === 0 && c.s === 0 && c.ms === 0
}

/** The civil date `ms` falls on, for an observer in `zone`. */
export const dateOf = (ms: number, zone: string): CivilDate => {
  const c = civilOf(ms, zone)
  return { y: c.y, m: c.m, d: c.d }
}

const pad = (n: number, width = 2): string => String(n).padStart(width, '0')

/** ISO calendar date (`YYYY-MM-DD`) — the shape `repeat_until` carries. */
export const isoDate = (d: CivilDate): string => `${pad(d.y, 4)}-${pad(d.m)}-${pad(d.d)}`

/** Today's calendar date in the account's zone — `series_live`'s `repeat_until` test. */
export const todayInZone = (nowMs: number, zone: string): string => isoDate(dateOf(nowMs, zone))

/** Days in a civil month (1-12). */
export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

/** 0 = Monday … 6 = Sunday, matching ADR-011's canonical weekday order. */
export function weekdayIndex(d: CivilDate): number {
  const dow = new Date(Date.UTC(d.y, d.m - 1, d.d)).getUTCDay() // 0 = Sunday
  return (dow + 6) % 7
}

/** Day number since the epoch, for exact civil-date comparison and stepping. */
export function dayNumber(d: CivilDate): number {
  return Math.floor(Date.UTC(d.y, d.m - 1, d.d) / DAY_MS)
}

export function dateFromDayNumber(n: number): CivilDate {
  const dt = new Date(n * DAY_MS)
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() }
}

export const compareDates = (a: CivilDate, b: CivilDate): number => dayNumber(a) - dayNumber(b)

/** Add `n` months, clamping the day to the target month's last day (AC-24). */
export function addMonthsClamped(d: CivilDate, n: number): CivilDate {
  const total = (d.y * 12 + (d.m - 1)) + n
  const y = Math.floor(total / 12)
  const m = (total % 12) + 1
  return { y, m, d: Math.min(d.d, daysInMonth(y, m)) }
}

/** Add `n` years, clamping 29 Feb into a non-leap year (AC-24's reason). */
export function addYearsClamped(d: CivilDate, n: number): CivilDate {
  const y = d.y + n
  return { y, m: d.m, d: Math.min(d.d, daysInMonth(y, d.m)) }
}

// ---------------------------------------------------------------------------
// The installer (ADR-010). One function, two reporting channels, one writer.
// ---------------------------------------------------------------------------

/**
 * Record what this client reports and, if the account has no zone yet, adopt
 * it. Creates the account row lazily on the first authenticated request.
 *
 * Rules, verbatim from ADR-010:
 *  - `timezone` is set from the FIRST report and never overwritten by a later
 *    one — a same-request upsert would make each device resolve rows in its own
 *    zone, the *one row, three answers* defect arriving through the writer.
 *  - a differing report is recorded as `timezone_last_report` and changes
 *    nothing, so a client can OFFER the change rather than take it.
 *  - a malformed zone is ignored entirely: it is a report, never a stored value.
 *  - `PATCH /account` (source `user`) is the only way to change an established
 *    zone.
 */
export function recordClientZone(
  state: StoreState,
  userId: string,
  reported: string | null,
  at: string,
): AccountRow {
  const accounts = (state.accounts ??= {})
  let account = accounts[userId]
  if (account === undefined) {
    account = {
      user_id: userId,
      timezone: null,
      timezone_source: null,
      timezone_set_at: null,
      timezone_last_report: null,
      timezone_last_report_at: null,
      created_at: at,
    }
    accounts[userId] = account
  }
  if (reported === null || !isValidZone(reported)) return account
  account.timezone_last_report = reported
  account.timezone_last_report_at = at
  if (account.timezone === null) {
    account.timezone = reported
    account.timezone_source = 'first-report'
    account.timezone_set_at = at
  }
  return account
}

/**
 * The zone every date computation reads — and the only reader of it.
 * `null` when the account has never reported one; callers decide whether that
 * refuses (a write) or withholds a derived value (a read).
 */
export function accountZone(state: StoreState, userId: string): string | null {
  return state.accounts?.[userId]?.timezone ?? null
}
