// The task detail's view model — plain TS, node-testable without React
// (platform/web.md: "View model first. Components are thin renderers").
//
// Everything here is a pure function over an explicit `now`. **There is no
// defaulted `now` in this file and there must not be one** (F-005 AC-44): a
// default is what makes a missed injection silently read the wall clock instead
// of raising a type error, and every caller has `controller.nowDate()` in hand.
//
// What lives here and why it is not in a component:
//
// - **AC-12's shortcuts.** Three named instants and one date-only path, each
//   resolved from the injected clock. A component computing them would be a
//   second clock the harness cannot hold.
// - **AC-16's move mode.** The keyboard-and-single-pointer alternative to
//   dragging, as a state machine with an announcement per move. jsdom cannot
//   exercise a path-based pointer gesture, so this is the unit-testable half and
//   is where the mutation coverage for ordering lives (platform/web.md § F-005);
//   the pointer drag is a web-e2e case only.
// - **AC-2's save model**, stated once so every field obeys the same one: value
//   fields save **on leaving the field**; the repeat picker is the one control
//   with an explicit preview-then-commit. No third model.

import { isStep, stepsOf } from '../_shared/model/task-fields.ts'
import type { Collection } from '../_shared/model/tasks.ts'
import { inCollection } from '../_shared/model/tasks.ts'
import type { RepeatDraft, TaskView } from '../_shared/types.ts'

// ---------------------------------------------------------------------------
// AC-1 — the surface's own account of its controls
// ---------------------------------------------------------------------------

/**
 * **The seven user-settable fields this spec names**, and the object that makes
 * AC-1's bound assertable (tester W5).
 *
 * AC-1 requires that every one of them appears in *"the surface's own account of
 * itself"* — its accessible enumeration of its own controls — **whether or not it
 * holds a value**, and that each is reachable from the opened detail in at most
 * one further action. Revision 2 stated the guarantee without naming an object,
 * which left both available tests wrong: asserting seven *visible* controls
 * over-constrains a compliant implementation that collapses empty fields behind a
 * disclosure, and "reachable" had no budget.
 *
 * `due_all_day`, `parent_id`, `step_order` and `series_id` are **excluded and that
 * is stated in the AC**: the first is a consequence of whether a time was picked
 * (AC-13) and the other three are structure.
 */
export const DETAIL_FIELDS = [
  'title',
  'note',
  'priority',
  'deadline',
  'reminder',
  'steps',
  'repeat',
] as const

export type DetailField = (typeof DETAIL_FIELDS)[number]

// ---------------------------------------------------------------------------
// AC-12 — the picker's shortcuts
// ---------------------------------------------------------------------------

export interface DateShortcut {
  id: 'today-18' | 'tomorrow-09' | 'this-weekend'
  label: string
  /** the instant it resolves to, computed from the injected clock */
  at: string
  /** AC-13 — all three shortcuts carry a TIME, so none of them is all-day. */
  allDay: false
}

/** Local-time constructor: the picker commits a wall-clock moment on a local
 * calendar day, which is what a user picking "tomorrow at 9" means. */
function atLocal(base: Date, dayOffset: number, hour: number, minute: number): string {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + dayOffset, hour, minute, 0, 0)
  return d.toISOString()
}

/**
 * AC-12 — **today at 18:00, tomorrow at 09:00, this weekend** (UC-34's main flow
 * names them). Each resolves to a specific instant computed from the clock AC-44
 * names, and a task given today's date joins the Today collection by ADR-009's
 * rule — a visible consequence, not a surprise.
 *
 * **"This weekend" is defined**, because its two siblings are exact and it was
 * not (tester T5): the **nearest of Saturday 09:00 and Sunday 09:00 that is still
 * in the future**. That answers the boundary a picker gets wrong — today already
 * being Saturday, or Saturday evening — with one rule and no hole.
 */
export function dateShortcuts(now: Date): DateShortcut[] {
  return [
    { id: 'today-18', label: 'Today, 6:00 PM', at: atLocal(now, 0, 18, 0), allDay: false },
    { id: 'tomorrow-09', label: 'Tomorrow, 9:00 AM', at: atLocal(now, 1, 9, 0), allDay: false },
    { id: 'this-weekend', label: 'This weekend', at: thisWeekend(now), allDay: false },
  ]
}

/**
 * The nearest of Saturday 09:00 and Sunday 09:00 that is **still in the future**.
 *
 * Written as a scan over the next eight days rather than as day arithmetic, so
 * the three boundaries that break the arithmetic version are covered by
 * construction: today is Saturday before 09:00 (→ today), today is Saturday
 * evening (→ tomorrow, Sunday), today is Sunday evening (→ next Saturday).
 * Eight days rather than seven because a Sunday-evening `now` needs to reach the
 * Saturday after next week's start.
 */
export function thisWeekend(now: Date): string {
  for (let offset = 0; offset <= 8; offset++) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset, 9, 0, 0, 0)
    const dow = day.getDay() // 0 = Sunday, 6 = Saturday
    if (dow !== 6 && dow !== 0) continue
    if (day.getTime() > now.getTime()) return day.toISOString()
  }
  // Unreachable: any 8-day window contains at least two weekend mornings, and at
  // most one of them can be in the past. Stated rather than silently returning a
  // wrong instant, because a picker that answers "now" for a weekend shortcut is
  // the fabricated-time defect AC-13 exists to prevent.
  /* c8 ignore next */
  throw new Error('thisWeekend: no weekend morning in the next eight days')
}

/**
 * AC-12 / AC-13 — **the calendar's date-only path, which is required rather than
 * optional** (design D7).
 *
 * AC-13 forbids a fabricated time on a date-only due and revision 1 gave the user
 * **no way to produce one**: all three shortcuts carry times, and an implementer
 * left to choose the calendar's default will pick a time — shipping the exact
 * defect AC-13 cites from the original product (say "Friday", get 9:00).
 *
 * So a calendar pick is **all-day**: the instant is that day's local start and the
 * flag says the time was never chosen. The instant alone is not enough — a bare
 * local midnight is indistinguishable from a deliberate 00:00, which is what
 * `due_all_day` exists to tell apart.
 */
export function calendarDate(yyyyMmDd: string): { at: string; allDay: true } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(yyyyMmDd)
  if (m === null) return null
  const y = Number(m[1])
  const mo = Number(m[2]) - 1
  const d = Number(m[3])
  const local = new Date(y, mo, d, 0, 0, 0, 0)
  if (local.getFullYear() !== y || local.getMonth() !== mo || local.getDate() !== d) return null
  return { at: local.toISOString(), allDay: true }
}

/** The `<input type="date">` value for a stored instant — the local calendar day,
 * never the UTC one, or a due at 23:00 local shows as tomorrow in the control the
 * user sets it with. */
export function dateInputValue(iso: string | null): string {
  if (iso === null) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** The `<input type="time">` value for a stored instant, local. */
export function timeInputValue(iso: string | null): string {
  if (iso === null) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Combine a local date and an optional local time into an instant. With no time
 * the result is all-day (AC-13); with one it is a moment the user chose. */
export function combineDateTime(
  yyyyMmDd: string,
  hhMm: string,
): { at: string; allDay: boolean } | null {
  const dateOnly = calendarDate(yyyyMmDd)
  if (dateOnly === null) return null
  if (hhMm === '') return dateOnly
  const t = /^(\d{2}):(\d{2})$/.exec(hhMm)
  if (t === null) return null
  const base = new Date(dateOnly.at)
  const d = new Date(
    base.getFullYear(),
    base.getMonth(),
    base.getDate(),
    Number(t[1]),
    Number(t[2]),
    0,
    0,
  )
  return { at: d.toISOString(), allDay: false }
}

/**
 * AC-12's *"visible consequence, not a surprise"* — which collection a date lands
 * the task in.
 *
 * It is derived from the **client's own** `inCollection` and from nothing else:
 * `POST /tasks/{id}/repeat-preview` deliberately does **not** return the
 * collection, because the server has no opinion about collections (ADR-009) and
 * adding one there would make it a second definition of a number four artifacts
 * already agree on (L-004).
 */
export function collectionForDue(due: string | null, now: Date): Collection {
  const probe = { due_at: due, status: 'inbox', parent_id: null } as unknown as TaskView
  if (inCollection(probe, 'today', now)) return 'today'
  if (inCollection(probe, 'upcoming', now)) return 'upcoming'
  return 'inbox'
}

// ---------------------------------------------------------------------------
// AC-16 — the move mode: reordering without a drag
// ---------------------------------------------------------------------------

/**
 * AC-16 — **reordering has a keyboard-operable, single-pointer alternative;
 * dragging is never the only way** (WCAG 2.1 **2.5.1** pointer gestures, **2.1.1**
 * keyboard).
 *
 * *"This is not a nicety on a voice-first product whose MANIFEST standard is WCAG
 * 2.1 AA: a path-based gesture as the sole mechanism excludes exactly the users
 * the second path exists for."* Naming the shape here is what stops the accessible
 * path being built last and worst on the feature whose own AC says that path is
 * who the second path exists for.
 *
 * The five states are design D10's: `idle → grabbed → moving → dropped →
 * cancelled`, with **a position announced on every move** (4.1.3).
 */
export type MoveState =
  | { phase: 'idle' }
  | { phase: 'grabbed'; taskId: string; index: number; from: number }
  | { phase: 'moving'; taskId: string; index: number; from: number }

export interface MoveMode {
  state: MoveState
  /** the ordered step ids the mode is operating over, captured at grab */
  order: string[]
}

export const IDLE_MOVE: MoveMode = { state: { phase: 'idle' }, order: [] }

/**
 * AC-15 / AC-16 — **the mode does not appear on a one-step list**, because there
 * is nowhere to drop it. Returned as a predicate rather than checked at each call
 * site so the control's presence and the mode's entry condition cannot disagree.
 */
export function canReorder(steps: readonly TaskView[]): boolean {
  return steps.length > 1
}

/** `idle → grabbed`. Nothing is written; the order is captured so a change
 * arriving underneath cannot renumber the move in flight (AC-3's step-list
 * clause: a reorder in flight when the steps change underneath must not snap and
 * must not silently discard). */
export function grab(steps: readonly TaskView[], taskId: string): MoveMode {
  if (!canReorder(steps)) return IDLE_MOVE
  const order = steps.map((s) => s.id)
  const index = order.indexOf(taskId)
  if (index < 0) return IDLE_MOVE
  return { state: { phase: 'grabbed', taskId, index, from: index }, order }
}

/**
 * `grabbed|moving → moving`. Moves the held step one position and returns the new
 * mode; the caller announces `announceMove`'s sentence. Nothing is written until
 * `drop`, which is what makes `cancel` able to return the step to where it was.
 */
export function move(mode: MoveMode, delta: number): MoveMode {
  const s = mode.state
  if (s.phase === 'idle') return mode
  const next = s.index + delta
  if (next < 0 || next >= mode.order.length) return mode
  const order = [...mode.order]
  const [held] = order.splice(s.index, 1)
  order.splice(next, 0, held as string)
  return { state: { phase: 'moving', taskId: s.taskId, index: next, from: s.from }, order }
}

/**
 * `moving → dropped`. Returns the neighbours the write needs, or `null` for **the
 * drop where the step already was** — which writes nothing, creates **no undo
 * entry** (AC-15, AC-43) and **announces nothing** (AC-16).
 *
 * The three are one condition and are answered here once, so a caller cannot get
 * two of the three right.
 */
export function drop(mode: MoveMode): { taskId: string; before: string | null; after: string | null } | null {
  const s = mode.state
  if (s.phase === 'idle') return null
  if (s.index === s.from) return null
  const before = s.index > 0 ? (mode.order[s.index - 1] ?? null) : null
  const after = s.index < mode.order.length - 1 ? (mode.order[s.index + 1] ?? null) : null
  return { taskId: s.taskId, before, after }
}

/**
 * `→ cancelled`, and **it has an entry condition** (tester W13): the user abandons
 * the move — the keyboard cancel, or a pointer release outside the list — and the
 * step **returns to the position it held**, announced like any other position
 * change (4.1.3). Revision 2 left this state with no trigger at all.
 */
export function cancel(mode: MoveMode): { mode: MoveMode; returnedTo: number | null } {
  const s = mode.state
  if (s.phase === 'idle') return { mode: IDLE_MOVE, returnedTo: null }
  return { mode: IDLE_MOVE, returnedTo: s.from }
}

/**
 * AC-16's *"a position announced on every move"* (4.1.3).
 *
 * One-based, and it names the total, because "position 3" alone does not say
 * whether the step has reached the end. Literals per shape rather than a template
 * over the numbers is not achievable here — the numbers *are* the content — so the
 * two shapes it can take are written out and neither interpolates a **noun**,
 * which is the part L-008 is about.
 */
export function announceMove(index: number, total: number): string {
  return `Step ${index + 1} of ${total}`
}

/**
 * ADR-015 — the `step_order` a move writes: **the midpoint of its two new
 * neighbours, or `neighbour ± 1024` at an end.**
 *
 * The server owns this arithmetic and re-derives it; the client computes it too
 * because `PATCH /tasks/{id}` takes `step_order` as a value and not as a pair of
 * neighbours. Where the gap is smaller than 2 the server renumbers every sibling
 * in the same transaction and returns every row it changed (AC-26), so a client
 * value the server refines is corrected by the response the client already applies.
 */
export const STEP_GAP = 1024

export function stepOrderBetween(before: number | null, after: number | null): number {
  if (before === null && after === null) return STEP_GAP
  if (before === null) return (after as number) - STEP_GAP
  if (after === null) return before + STEP_GAP
  return Math.floor((before + after) / 2)
}

/** The steps of a task, in the user's order — one implementation (AC-15). */
export function detailSteps(tasks: readonly TaskView[], parentId: string): TaskView[] {
  return stepsOf(tasks, parentId)
}

/**
 * AC-18 — **a step has no steps of its own.** The detail refuses to render a step
 * list for a row that is itself a step, so the surface cannot offer the gesture
 * the write path refuses. The refusal is still the server's (`nesting_too_deep`);
 * this is the surface not setting a trap.
 */
export function acceptsSteps(task: TaskView): boolean {
  return !isStep(task)
}

/**
 * AC-18 / AC-21 — **only a top-level task can repeat.** Same shape as
 * `acceptsSteps`, same reason.
 */
export function acceptsRepeat(task: TaskView): boolean {
  return !isStep(task)
}

// ---------------------------------------------------------------------------
// AC-20 / AC-21 / AC-25 — the repeat picker's draft
// ---------------------------------------------------------------------------

/**
 * AC-20's **named cadences** (product F12).
 *
 * *"Every weekday"* is expressible — weekly, interval 1, five weekdays — but a
 * user looking for it looks under **Daily**, which is exactly where AC-21 removed
 * it, so the correct model reads as a missing feature for a common cadence. Named
 * cadences cost no model change: they are **labels over rules that already
 * exist**, which is why each row below is a complete `RepeatDraft` and not a new
 * concept.
 */
export interface NamedCadence {
  id: string
  label: string
  draft: RepeatDraft
}

const NONE: RepeatDraft = {
  repeat_frequency: null,
  repeat_interval: null,
  repeat_weekdays: null,
  repeat_month_days: null,
  repeat_until: null,
  repeat_count: null,
}

export function namedCadences(): NamedCadence[] {
  return [
    { id: 'daily', label: 'Every day', draft: { ...NONE, repeat_frequency: 'day', repeat_interval: 1 } },
    {
      id: 'weekdays',
      label: 'Every weekday',
      draft: {
        ...NONE,
        repeat_frequency: 'week',
        repeat_interval: 1,
        repeat_weekdays: 'mo,tu,we,th,fr',
      },
    },
    { id: 'weekly', label: 'Every week', draft: { ...NONE, repeat_frequency: 'week', repeat_interval: 1 } },
    { id: 'monthly', label: 'Every month', draft: { ...NONE, repeat_frequency: 'month', repeat_interval: 1 } },
    { id: 'yearly', label: 'Every year', draft: { ...NONE, repeat_frequency: 'year', repeat_interval: 1 } },
  ]
}

/**
 * AC-25 — **a series ends by an end date OR by a number of runs, never both.**
 *
 * The picker offers one, and this is the function that makes "offers one" true of
 * the draft rather than of the markup: choosing an end date clears the count and
 * vice versa. A write carrying both is refused server-side (`until_and_count`);
 * the picker not being able to express it is what stops the user meeting that
 * refusal for a state the control let them build.
 */
export function setEnd(
  draft: RepeatDraft,
  end: { kind: 'never' } | { kind: 'until'; date: string } | { kind: 'count'; count: number },
): RepeatDraft {
  switch (end.kind) {
    case 'never':
      return { ...draft, repeat_until: null, repeat_count: null }
    case 'until':
      return { ...draft, repeat_until: end.date, repeat_count: null }
    case 'count':
      return { ...draft, repeat_until: null, repeat_count: end.count }
  }
}

/** AC-21's weekday vocabulary, in the canonical wire order. A weekly rule may
 * name weekdays; **a daily rule may not** — *"daily, but only Mondays and
 * Fridays" is not daily, it is weekly on two days*, and offering both is two
 * paths to one cadence. */
export const WEEKDAYS = ['mo', 'tu', 'we', 'th', 'fr', 'sa', 'su'] as const

export function toggleWeekday(draft: RepeatDraft, day: string): RepeatDraft {
  if (draft.repeat_frequency !== 'week') return draft
  const held = new Set((draft.repeat_weekdays ?? '').split(',').filter((s) => s !== ''))
  if (held.has(day)) held.delete(day)
  else held.add(day)
  // Canonical: a subset of "mo,tu,we,th,fr,sa,su" **in that order**. A set the
  // user built by clicking is in click order, and the wire's canonical form is the
  // only one `taskEquals` and the diff can compare.
  const canonical = WEEKDAYS.filter((d) => held.has(d)).join(',')
  return { ...draft, repeat_weekdays: canonical === '' ? null : canonical }
}

/** Whether two drafts differ — what decides if the picker's commit has anything
 * to write, and what makes AC-2's *"the request carries the fields the user
 * changed and no others"* true for the one control that batches. */
export function repeatChanged(a: RepeatDraft, b: RepeatDraft): boolean {
  return (
    a.repeat_frequency !== b.repeat_frequency ||
    a.repeat_interval !== b.repeat_interval ||
    a.repeat_weekdays !== b.repeat_weekdays ||
    a.repeat_month_days !== b.repeat_month_days ||
    a.repeat_until !== b.repeat_until ||
    a.repeat_count !== b.repeat_count
  )
}

/** The changed members only — AC-2's field-level write, for the one control whose
 * commit touches several fields at once. */
export function repeatPatch(from: RepeatDraft, to: RepeatDraft): Partial<RepeatDraft> {
  const out: Record<string, unknown> = {}
  for (const k of Object.keys(to) as (keyof RepeatDraft)[]) {
    if (from[k] !== to[k]) out[k] = to[k]
  }
  return out as Partial<RepeatDraft>
}
