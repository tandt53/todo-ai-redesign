// § CarriedNotice on the phone — the SELECTION half (F-005 AC-47, AC-2, AC-43).
//
// Which rows the region holds, in which order, in which state, and what each one
// says. It is a pure function of `AppState`, for this module's standing reason:
// `components/` is React Native and cannot run in this project's node-only unit
// tier, so a decision taken inside a component is a decision nothing can test
// until a device shows up (platform mobile.md — "Unit tier = model + ports").
//
// ── WHAT THE PHONE OWES, AND WHAT IT DOES NOT ──────────────────────────────
//
// AC-47 is `(web, mobile)` and the split is exact: **the phone owes the notice's
// lifetime, reach and content; the detail-close TRIGGER stays web-only** because
// the phone has no detail surface this phase (F-005 ## Out of Scope). Two
// obligations render here regardless:
//
//   - **AC-2's mobile half.** The mobile rename is a `TextInput` that unmounts on
//     blur, so there is **no field for a refused or failed value to stay in** —
//     the phone's gap is one level earlier than the close. This region is the home
//     the value goes to, and AC-2's governing sentence requires all three of: the
//     value kept, the failure stated, **and a retry offered**. The two ACs had
//     each been pointing at the other about that retry; it lands here.
//   - **AC-43's undo offer**, which carries `(mobile)` and which the owner placed
//     in this family on 2026-08-19 rather than on the task's row — because a
//     row-local offer loses the reversal exactly when the user navigates away, and
//     **on the phone that is one tap and is primary navigation**.
//
// ── THE LIFETIME RULE, WHICH IS THE WHOLE POINT ────────────────────────────
//
// **There is no timer in this file and there must not be one anywhere.** Not a
// timeout, not a timer a focus or a hover extends, not any duration however long
// (AC-47, AC-43, and AC-33's 2.2.1 at the strength its two siblings state it).
// Every row ends by the user's own act or by a reload. Because there is no time
// limit, WCAG 2.2.1 is not engaged at all — there is nothing to adjust.
//
// The absence is the requirement, so this comment is the only place it can be
// asserted from — and `__tests__/carried.test.ts` asserts it as a source property
// as well, which is what makes it enforceable rather than a convention.
//
// **`§ SaveNotice`'s lifetime rule 3 is the thing to not build.** It clears on
// *"leaving the surface — another collection, Settings, or Talk"*. Built to that
// rule the phone would clear a refused value on the next tap to Talk — the silent
// loss AC-2's opening sentence forbids, one gesture later. That rule is routed for
// amendment; this builds to AC-47.

import {
  CN_DELETED,
  CN_FAILED,
  CN_FIELD_LABEL,
  CN_MULTI,
  CN_OFFLINE,
  CN_SUPERSEDED,
  cnUndo,
  cnUndone,
  copyField,
} from '../../_shared/model/notice-copy.ts'
import type { CopyField } from '../../_shared/model/notice-copy.ts'
import { retryableFields } from '../../_shared/model/notices.ts'
import type { AppState } from '../../_shared/model/reducer.ts'
import type { Notice, NoticeField } from '../../_shared/types.ts'

/** The six rows of § CarriedNotice → The rows. */
export type CarriedRowId =
  | 'CN-FAILED'
  | 'CN-OFFLINE'
  | 'CN-SUPERSEDED'
  | 'CN-DELETED'
  | 'CN-UNDO'
  | 'CN-UNDONE'

/** One field block inside a notice row — the per-field guarantee AC-2 requires
 * (*each keeps its own value and its own retry*). */
export interface CarriedFieldBlock {
  field: CopyField
  /** design's literal label, never the wire name prettified */
  label: string
  /** what the user typed — the thing that must not vanish */
  value: unknown
  /** the value the store holds now, when this field has been superseded */
  storedNow?: unknown
  superseded: boolean
  /** **Retry is per FIELD, not per row.** A row with two failed fields carries
   * two Retry controls and each resolves only its own field. A superseded field
   * carries none, whatever the rest of the row does — a retry there would
   * overwrite the newer stored value with the stale failed one. */
  retryable: boolean
}

export interface CarriedRow {
  id: CarriedRowId
  taskId: string
  /** the row's sentence — one literal per § CarriedNotice's message table */
  sentence: string
  /** 0 blocks for CN-UNDO / CN-UNDONE, 1..N for a notice */
  blocks: CarriedFieldBlock[]
  /** CN-UNDO only */
  action: 'put-back' | null
  /** the whole row read as one accessible name, value included */
  a11yName: string
}

/**
 * **The precedence rule — one row, several fields, one worst state.** In order:
 * deleted (task-level, so it dominates everything) → failed → offline-refused →
 * superseded. The row wears the state of its worst field; each block still states
 * its own.
 */
function worstState(n: Notice): 'deleted' | 'failed' | 'offline-refused' | 'superseded' {
  if (n.ended !== null) return 'deleted'
  const live = n.fields.filter((f) => !f.superseded)
  if (live.some((f) => f.reason === 'failed')) return 'failed'
  if (live.some((f) => f.reason === 'offline-refused')) return 'offline-refused'
  return 'superseded'
}

const ROW_FOR: Record<string, CarriedRowId> = {
  deleted: 'CN-DELETED',
  failed: 'CN-FAILED',
  'offline-refused': 'CN-OFFLINE',
  superseded: 'CN-SUPERSEDED',
}

function blockFor(f: NoticeField, retryable: boolean): CarriedFieldBlock {
  const field = copyField(f.field)
  return {
    field,
    label: CN_FIELD_LABEL[field],
    value: f.value,
    ...(f.superseded && f.storedNow !== undefined ? { storedNow: f.storedNow } : {}),
    superseded: f.superseded,
    retryable,
  }
}

/**
 * The sentence for one notice.
 *
 * **Two forms, because one affected field and several are different facts**: one
 * field takes the per-field literal; two or more take one of `CN_MULTI`'s three,
 * and the fields are named by their blocks rather than joined into the sentence
 * (which would be a template over a list — L-008).
 */
function sentenceFor(n: Notice, state: ReturnType<typeof worstState>): string {
  if (state === 'deleted') return CN_DELETED(n.taskTitle)
  const affected = n.fields.length
  if (affected > 1) return CN_MULTI[state === 'superseded' ? 'superseded' : state](n.taskTitle)
  const only = n.fields[0]
  if (only === undefined) return CN_MULTI[state === 'superseded' ? 'superseded' : state](n.taskTitle)
  const field = copyField(only.field)
  if (only.superseded) return CN_SUPERSEDED[field](n.taskTitle)
  return only.reason === 'offline-refused'
    ? CN_OFFLINE[field](n.taskTitle)
    : CN_FAILED[field](n.taskTitle)
}

/**
 * **The row's accessible name carries the whole value**, including the part that
 * scrolled (§ CarriedNotice → Accessibility). Built from the sentence plus each
 * block's label and value, so a screen-reader user gets what a sighted user can
 * read back.
 */
function nameFor(sentence: string, blocks: CarriedFieldBlock[]): string {
  const parts = [sentence]
  for (const b of blocks) {
    parts.push(`${b.label}: you typed ${String(b.value ?? '—')}`)
    if (b.superseded && b.storedNow !== undefined) parts.push(`now saved ${String(b.storedNow)}`)
  }
  return parts.join(' ')
}

export function carriedRowFor(n: Notice): CarriedRow {
  const state = worstState(n)
  const retryable = new Set(retryableFields(n).map((f) => f.field))
  const blocks = n.fields.map((f) => blockFor(f, retryable.has(f.field)))
  const sentence = sentenceFor(n, state)
  return {
    id: ROW_FOR[state] as CarriedRowId,
    taskId: n.taskId,
    sentence,
    blocks,
    action: null,
    a11yName: nameFor(sentence, blocks),
  }
}

/**
 * Every row the region holds right now, in render order.
 *
 * **Order, and it is design's rather than arrival order:**
 *  - **At most one CN-UNDO, and it renders FIRST.** It is the newest event and the
 *    only row with a window another action closes, so it is the one the eye should
 *    reach first.
 *  - **Notices order newest first**, under it. The value the user typed most
 *    recently is the one in front of them.
 *
 * **One notice per task, never one per field** (AC-47) — that aggregation is
 * `notices.ts`'s, upstream of here; a second failed field on a task the region
 * already holds joins that task's row as a second block. The row grows; the
 * region's row count does not.
 */
export function carriedRows(state: AppState): CarriedRow[] {
  const rows: CarriedRow[] = []
  const offer = state.undoOffer
  if (offer !== null) {
    const sentence = offer.used ? cnUndone(offer.action) : cnUndo(offer.action)
    rows.push({
      id: offer.used ? 'CN-UNDONE' : 'CN-UNDO',
      taskId: offer.action.taskId,
      sentence,
      blocks: [],
      // CN-UNDONE is a report and carries no action — `Put back` has been used,
      // and the row is what tells the user the reversal happened rather than
      // vanishing and reporting nothing.
      action: offer.used ? null : 'put-back',
      a11yName: sentence,
    })
  }
  const notices = [...state.notices].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
  for (const n of notices) rows.push(carriedRowFor(n))
  return rows
}

/**
 * **The visible ceiling is a row count, not a fraction of the screen.** Two rows
 * below `breakpoints.split` — which is every width on a phone — and further rows
 * **scroll within the region**: the region never grows past that and the first row
 * is always fully visible.
 *
 * This satisfies AC-47's *"N notices do not stack into a column that obscures what
 * they report on"* **without** introducing the navigation design D24 rejected:
 * scrolling inside a visible region is not a door, nothing is hidden behind a tap,
 * and every row keeps its position and its controls.
 */
export const CARRIED_VISIBLE_ROWS_BELOW_SPLIT = 2

/** Is the region holding anything? The region itself **pre-exists and is empty
 * when there is nothing to report** — a live region injected into the tree at the
 * same moment as its content is not reliably announced, which is § SaveNotice's
 * reasoning and applies with more force here because this region is created once
 * per app rather than once per surface. */
export function carriedRegionOccupied(state: AppState): boolean {
  return state.notices.length > 0 || state.undoOffer !== null
}
