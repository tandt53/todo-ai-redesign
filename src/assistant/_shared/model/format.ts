// Display formatting — plain TS, node-testable (platform web.md).
// Raw uuids / internal refs never render (AC-4): everything shown goes
// through titles and formatted field values.

import { nowDate } from './clock.ts'

/** Strict ISO detector — only reformat values that are actually timestamps;
 * display strings like "2:00 PM" or "due today" pass through verbatim. */
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/

function clock(d: Date): string {
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function dayLabel(d: Date): string {
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

/**
 * Format a due-ish datetime for row meta / diff chips. Same-day → time only
 * ("4:00 PM"); other days → "Sat, Aug 22" (+ time when not midnight).
 *
 * ── F-005 AC-13 — `allDay` is not cosmetic, it fixes a shipped defect ────────
 *
 * *"A due date set without a time never displays or behaves as a time the user did
 * not choose."* This function returned `clock(d)` **unconditionally** for a
 * same-day due, and `dueAtForCollection('today')` writes **local midnight** for
 * every task created while viewing Today — so those rows rendered as **"12:00 AM"**,
 * today, on the default landing collection, on both clients. That is the exact
 * defect AC-13 cites from the original product (say "Friday", get 9:00), already
 * in the build.
 *
 * **`due_all_day` is what tells a date-only deadline apart from one at midnight.**
 * A stored flag is authoritative wherever present; `null` on the wire means NOT
 * DETERMINED and **also** suppresses the clock, because that is the direction
 * AC-13 exists to protect — never a time nobody picked (ADR-010). So callers pass
 * `allDay: true` for both, and only an explicit `due_all_day: false` prints a time.
 *
 * **The stored instant does not change; the flag and the formatter do** (tester
 * W11). Two shipped web assertions pin `dueAtForCollection('today')` writing the
 * local start of the day and cite ADR-009 §4 as the reason
 * (`web/__tests__/collections.test.ts`, `app.test.tsx`) — and AC-13 *"does not ask
 * anyone to turn them red"*. Nothing here touches what is written.
 *
 * The parameter is optional so that the diff-chip path (`formatValue`) keeps
 * working: a diff row carries a bare value with no flag beside it, and it renders
 * the same string it always did. That is the honest scope of the change — the row
 * meta knows the flag and the diff does not.
 */
export function formatDue(
  iso: string,
  now: Date = nowDate(),
  opts: { allDay?: boolean } = {},
): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  if (opts.allDay === true) {
    // No clock time at all — not even for today, where the alternative was the
    // "12:00 AM" this parameter exists to remove. `Today` as a word is the day
    // group's heading (§ TaskList), so the row does not repeat it.
    return sameDay(d, now) ? 'Today' : dayLabel(d)
  }
  if (sameDay(d, now)) return clock(d)
  const label = dayLabel(d)
  const t = clock(d)
  return t === '12:00 AM' ? label : `${label}, ${t}`
}

/** Format an arbitrary diff value for display; null stays null (old=null for
 * create, new=null for delete — AC-4). */
export function formatValue(v: unknown, now: Date = nowDate()): string | null {
  if (v === null || v === undefined) return null
  // Booleans are internal flags (e.g. due_all_day), not user-facing values —
  // rendering `String(false)` is a leaked internal that reached the screen.
  if (typeof v === 'boolean') return null
  const s = String(v)
  if (ISO_RE.test(s)) return formatDue(s, now)
  return s
}

/** Message-meta clock ("2:04 PM"). */
export function formatClock(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return clock(d)
}

/** Boundary-marker stamp ("Fri 11:42 PM" / "Fri, Aug 15 · 11:42 PM"). */
export function formatStamp(iso: string, now: Date = nowDate()): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const week = d.toLocaleDateString('en-US', { weekday: 'short' })
  if (sameDay(d, now)) return clock(d)
  return `${week} ${clock(d)}`
}

/** Top-bar date ("Sat, Aug 16"). */
export function formatTopDate(now: Date = nowDate()): string {
  return dayLabel(now)
}

/** "task" / "tasks" — the house noun (components.md §Buttons: never item,
 * to-do, entry or note). */
export function tasksWord(n: number): string {
  return n === 1 ? 'task' : 'tasks'
}

/** The applied-message head: "Edited 1 task · added 1", "Added 1 task",
 * "Deleted 3 tasks" (design mockup wording — English per ADR-008). Only the
 * FIRST segment carries the noun; later segments are the bare verb + count,
 * exactly as the mockup renders "Edited 1 task · added 1". */
export function appliedHead(counts: { edited: number; created: number; deleted: number }): string {
  const segs: string[] = []
  const push = (lead: string, verb: string, n: number) => {
    if (n <= 0) return
    if (segs.length === 0) segs.push(`${lead} ${n} ${tasksWord(n)}`)
    else segs.push(`${verb} ${n}`)
  }
  push('Edited', 'edited', counts.edited)
  push('Added', 'added', counts.created)
  push('Deleted', 'deleted', counts.deleted)
  return segs.length === 0 ? 'Done' : segs.join(' · ')
}
