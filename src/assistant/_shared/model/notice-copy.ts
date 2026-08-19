// § CarriedNotice's literal messages — **one home, both clients** (F-005 AC-47).
//
// ── WHY THIS FILE EXISTS AT ALL ────────────────────────────────────────────
//
// The copy was written first inside `web/components/CarriedNotices.tsx`, where it
// was correct and unreachable: `mobile/` cannot import from `web/` (react-dom,
// JSX), and AC-47 carries `(web, mobile)` — *"the phone's half is this family's
// lifetime, reach and content"*. Content means these sentences. A second
// transcription on the phone would be **L-004** exactly: one fact, two files,
// announcing its drift as a workaround rather than as a failure, with both copies
// green because each agrees with its own tests.
//
// So the tables live here, in `_shared/`, which is where `notices.ts`'s state
// already lives and for the same stated reason. Web's private copy is now a
// duplicate and is routed for replacement rather than edited from here.
//
// ── THE TWO RULES THAT DECIDE THE SHAPE ────────────────────────────────────
//
// 1. **Literals cited by row ID, never a template over a noun** (§ CarriedNotice,
//    § SaveNotice's rule, § NewMessageAffordance's, and **L-008**'s reason). A
//    template that interpolated the field name renders fluent text for
//    combinations nobody enumerated; here the domain is **closed at seven
//    fields**, so a literal that was never written does not exist and the gap is
//    a compile error instead of plausible prose.
// 2. `{task}` and `{value}` are design's `verbatim` slots (§ Spoken frames' closed
//    vocabulary) — the task's own title and the user's own text, **never
//    re-worded**. They are the only substitution performed.
//
// The companion assertion for rule 1 is in `__tests__`: it **parses
// `design/_shared/components.md § CarriedNotice`** and checks every cell per row
// ID, so this file goes red when the **upstream** artifact moves — the direction
// drift actually travels, and the direction a check comparing two things the
// implementation controls is blind to (L-008).

import type { UndoAction } from '../types.ts'

/**
 * The seven **user-settable** fields § CarriedNotice's message table is keyed by
 * — the set F-005 AC-1 names, and no more.
 *
 * `due_all_day`, `parent_id`, `step_order` and `series_id` are **not user
 * controls** (AC-1), so no write of theirs can produce a notice of its own.
 */
export type CopyField = 'title' | 'note' | 'priority' | 'deadline' | 'reminder' | 'step' | 'repeat'

/**
 * Wire field → copy field, **in one closed switch**.
 *
 * A `field.replace('_', ' ')` prettifier would render fluent text for a
 * combination nobody enumerated, which is the L-008 failure this whole file is
 * shaped to avoid. A failed reorder reports under `step`, the control the user
 * actually touched; the six ADR-011 repeat members all report under `repeat`,
 * which is why the picker is one control and not six.
 */
export function copyField(wireField: string): CopyField {
  switch (wireField) {
    case 'title':
      return 'title'
    case 'note':
      return 'note'
    case 'priority':
      return 'priority'
    case 'due_at':
    case 'due_all_day':
      return 'deadline'
    case 'reminder_at':
      return 'reminder'
    case 'step':
    case 'step_order':
      return 'step'
    default:
      return 'repeat'
  }
}

/**
 * The seven field **labels**, one literal each (§ CarriedNotice → Anatomy).
 *
 * **This is how AC-2's *"naming the fields that failed"* is met** — as labels on
 * the per-field blocks, not as a comma-joined noun list inside a sentence, which
 * would be a template over a list.
 */
export const CN_FIELD_LABEL: Record<CopyField, string> = {
  title: 'Name',
  note: 'Note',
  priority: 'Priority',
  deadline: 'Deadline',
  reminder: 'Reminder',
  step: 'Step',
  repeat: 'Repeat',
}

/** CN-FAILED — a write on this task failed and nothing newer has been stored. */
export const CN_FAILED: Record<CopyField, (task: string) => string> = {
  title: (t) => `Couldn't rename "${t}".`,
  note: (t) => `Couldn't save the note on "${t}".`,
  priority: (t) => `Couldn't save the priority on "${t}".`,
  deadline: (t) => `Couldn't save the deadline on "${t}".`,
  reminder: (t) => `Couldn't save the reminder on "${t}".`,
  step: (t) => `Couldn't save the step on "${t}".`,
  repeat: (t) => `Couldn't save the repeat on "${t}".`,
}

/**
 * CN-OFFLINE — a write to a **server-owned** task refused because the app is
 * offline (AC-2's third state).
 *
 * **Scoped by row provenance, and getting that wrong removes working behaviour.**
 * The refusal covers a row the server already holds (`local !== true`) and nothing
 * else: an edit to a task the user created while offline is kept and replayed
 * today, so such an edit produces **no CN-OFFLINE row at all**. A notice saying it
 * *wasn't saved* would be false, and drawing one would assert a regression. Four
 * Gate 1 lenses found the unscoped version of that rule independently.
 *
 * **And it is not a pending indicator.** No spinner, no pending badge, no silent
 * acceptance — each implies a queue that does not exist. It says the write **did
 * not happen**, in the past tense, and the only thing that will ever retry it is
 * the user pressing `Retry`.
 */
export const CN_OFFLINE: Record<CopyField, (task: string) => string> = {
  title: (t) => `You're offline — "${t}" wasn't renamed.`,
  note: (t) => `You're offline — the note on "${t}" wasn't saved.`,
  priority: (t) => `You're offline — the priority on "${t}" wasn't saved.`,
  deadline: (t) => `You're offline — the deadline on "${t}" wasn't saved.`,
  reminder: (t) => `You're offline — the reminder on "${t}" wasn't saved.`,
  step: (t) => `You're offline — the step on "${t}" wasn't saved.`,
  repeat: (t) => `You're offline — the repeat on "${t}" wasn't saved.`,
}

/** CN-SUPERSEDED — something newer has been stored for that field, by the user's
 * retry or by an assistant turn (AC-36 made the assistant a writer of four of
 * these). **Reports; offers no retry.** */
export const CN_SUPERSEDED: Record<CopyField, (task: string) => string> = {
  title: (t) => `"${t}" has been renamed since. What you typed wasn't saved.`,
  note: (t) => `The note on "${t}" has changed since. What you typed wasn't saved.`,
  priority: (t) => `The priority on "${t}" has changed since. What you typed wasn't saved.`,
  deadline: (t) => `The deadline on "${t}" has changed since. What you typed wasn't saved.`,
  reminder: (t) => `The reminder on "${t}" has changed since. What you typed wasn't saved.`,
  step: (t) => `The step on "${t}" has changed since. What you typed wasn't saved.`,
  repeat: (t) => `The repeat on "${t}" has changed since. What you typed wasn't saved.`,
}

/** CN-DELETED — one literal. The field is named by the `You typed` label, and the
 * task is gone, so no per-field sentence exists to write. */
export const CN_DELETED = (t: string): string => `"${t}" was deleted. What you typed wasn't saved.`

/**
 * The two sentence forms for a row with **two or more** affected fields, because
 * one field and several are different facts. Three literals, and the fields are
 * named by their blocks rather than joined into the sentence.
 */
export const CN_MULTI = {
  failed: (t: string): string => `Couldn't save your changes to "${t}".`,
  'offline-refused': (t: string): string =>
    `You're offline — your changes to "${t}" weren't saved.`,
  superseded: (t: string): string => `"${t}" has changed since. What you typed wasn't saved.`,
} as const

/** CN-UNDO — four literals, one per class of undoable action in AC-43. */
export function cnUndo(a: UndoAction): string {
  switch (a.kind) {
    case 'delete-task':
      return `Deleted "${a.title}".`
    case 'delete-step':
      return `Deleted a step from "${a.title}".`
    case 'delete-series':
      return `Deleted "${a.title}" and the rest of its series.`
    case 'move-step':
      return `Moved a step in "${a.title}".`
  }
}

/** CN-UNDONE — four literals, one per class above. */
export function cnUndone(a: UndoAction): string {
  switch (a.kind) {
    case 'delete-task':
      return `"${a.title}" is back on the list.`
    case 'delete-step':
      return `The step is back in "${a.title}".`
    case 'delete-series':
      return `"${a.title}" and its series are back.`
    case 'move-step':
      return `The step is back where it was.`
  }
}

/**
 * The region's accessible name — **two literals** (§ CarriedNotice →
 * Accessibility): `Undo offer` when CN-UNDO is the only row, `Unsaved changes`
 * when it holds ≥1 notice.
 */
export function regionName(noticeCount: number): string {
  return noticeCount === 0 ? 'Undo offer' : 'Unsaved changes'
}

/** The three visible action labels, and they are prefixes of the accessible
 * names (2.5.3). `Put back` is AC-43's word for this mechanism, deliberately
 * distinct from the turn undo's `Undo` (§ Buttons' one-word-per-concept table). */
export const CN_ACTIONS = {
  retry: 'Retry',
  putBack: 'Put back',
  dismiss: 'Dismiss',
} as const

/**
 * Render a carried value as text. **Never truncated with an ellipsis**: *carries
 * the user's value* is the component's reason to exist, and a value the user
 * cannot read back is not carried. Overflow scrolls inside the block.
 */
export function valueText(v: unknown): string {
  if (v === null || v === undefined) return '—'
  if (typeof v === 'string') return v
  if (typeof v === 'boolean') return v ? 'yes' : 'no'
  return String(v)
}
