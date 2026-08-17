// Display formatting — plain TS, node-testable (platform web.md).
// Raw uuids / internal refs never render (AC-4): everything shown goes
// through titles and formatted field values.

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

/** Format a due-ish datetime for row meta / diff chips. Same-day → time only
 * ("4:00 PM"); other days → "Sat, Aug 22" (+ time when not midnight). */
export function formatDue(iso: string, now: Date = new Date()): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  if (sameDay(d, now)) return clock(d)
  const label = dayLabel(d)
  const t = clock(d)
  return t === '12:00 AM' ? label : `${label}, ${t}`
}

/** Format an arbitrary diff value for display; null stays null (old=null for
 * create, new=null for delete — AC-4). */
export function formatValue(v: unknown, now: Date = new Date()): string | null {
  if (v === null || v === undefined) return null
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
export function formatStamp(iso: string, now: Date = new Date()): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const week = d.toLocaleDateString('en-US', { weekday: 'short' })
  if (sameDay(d, now)) return clock(d)
  return `${week} ${clock(d)}`
}

/** Top-bar date ("Sat, Aug 16"). */
export function formatTopDate(now: Date = new Date()): string {
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
