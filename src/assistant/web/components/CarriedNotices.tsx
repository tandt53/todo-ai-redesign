// § CarriedNotice — the notice that outlives the surface it was typed in.
//
// F-005 AC-47, AC-2's failed and offline-refused states, AC-4's deletion report,
// and AC-43's hand-action undo offer, which the owner placed in this family on
// 2026-08-19 rather than on the task's row.
//
// ── WHY IT IS MOUNTED AT THE FRAME AND NOT INSIDE A SURFACE ─────────────────
//
// AC-47: *"'Persists' is not 'is visible'"*. Three readings are three different
// products — scoped to Tasks, re-appearing only on return to Tasks, or **visible
// wherever the user is** — and only the third makes AC-2's promise true. Design
// D24 tightened the verb: the reading selected is *visible*, not *reachable*,
// which rules out a badge-then-tap design in which the user's typed value is one
// navigation away during an outage. A value one navigation away is the loss this
// AC exists to prevent, wearing an affordance.
//
// So: one region docked below the top bar at the **frame**, spanning the full
// frame width, **outside the surface stack and outside the stacking layer** (IA
// §2, § CarriedNotice → Placement). S3 Lists menu, S4 Settings and S5 New list
// slide over the content and **under** this region — otherwise the family is
// invisible on Settings, and AC-47's requirement is met at three of five
// surfaces, which is the failure mode it names.
//
// **The catalogue pushed the other way and this component must not follow it:**
// the only strip family that existed was the Tasks surface's banner stack, and
// `§ SaveNotice`'s lifetime rule 3 clears on *"leaving the surface — another
// collection, Settings, or Talk"*, which is precisely what AC-47 forbids. Below
// the split `PathSwitch` is one tap and is primary navigation, so built to that
// catalogue a value refused offline is cleared by the next tap to Talk.
//
// ── THERE IS NO TIMER IN THIS FILE ─────────────────────────────────────────
//
// Not an omission — the requirement. AC-47: *"elapsing is not a resolution"*, and
// AC-43's rule at the strength AC-33's 2.2.1 now states it: **not by a timer, not
// by a timer that a focus or a hover extends, and not by any duration however
// long.** Every row ends by the user's own act or by a reload. Because there is no
// time limit, WCAG 2.2.1 is not engaged at all — there is nothing to adjust.
//
// Copy is transcribed from `docs/design/_shared/components.md § CarriedNotice`'s
// literal-message table, cited by row id, and never composed here (L-008). The
// two `verbatim` slots are the task's own title and the user's own text.

import type { AssistantController } from '../../_shared/controller.ts'
import type { AppState } from '../../_shared/model/reducer.ts'
import { retryableFields } from '../../_shared/model/notices.ts'
import type { Notice, NoticeField, UndoAction, UndoOffer } from '../../_shared/types.ts'
import { AlertIcon, CheckIcon, TrashIcon, UndoIcon, WifiOffIcon, HistoryIcon } from './icons.tsx'

/**
 * The seven **user-settable** fields `§ CarriedNotice`'s message table is keyed by
 * — the set F-005 AC-1 names, and no more.
 *
 * `due_all_day`, `parent_id`, `step_order` and `series_id` are **not user
 * controls** (AC-1), so no write of theirs can produce a notice of its own; a
 * failed reorder reports under `step`, which is the control the user actually
 * touched. `title` is spelled the same on the wire and in the copy; the other six
 * are not, and mapping them **in one closed switch** is what stops a
 * `field.replace('_',' ')` prettifier rendering fluent text for a combination
 * nobody enumerated (L-008).
 */
type CopyField = 'title' | 'note' | 'priority' | 'deadline' | 'reminder' | 'step' | 'repeat'

function copyField(wireField: string): CopyField {
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
      // The six ADR-011 repeat members, and anything a later field adds under the
      // repeat control. `repeat` is the user-settable field AC-1 names for all of
      // them, which is why the picker is one control and not six.
      return 'repeat'
  }
}

/** `§ CarriedNotice § The literal messages` — CN-FAILED. */
const CN_FAILED: Record<CopyField, (task: string) => string> = {
  title: (t) => `Couldn't rename "${t}".`,
  note: (t) => `Couldn't save the note on "${t}".`,
  priority: (t) => `Couldn't save the priority on "${t}".`,
  deadline: (t) => `Couldn't save the deadline on "${t}".`,
  reminder: (t) => `Couldn't save the reminder on "${t}".`,
  step: (t) => `Couldn't save the step on "${t}".`,
  repeat: (t) => `Couldn't save the repeat on "${t}".`,
}

/** CN-OFFLINE. **No spinner, no pending badge, no silent acceptance** — AC-2's
 * third state is a refusal, and nothing on the surface may imply the edit is kept
 * for later, because nothing keeps it. */
const CN_OFFLINE: Record<CopyField, (task: string) => string> = {
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
const CN_SUPERSEDED: Record<CopyField, (task: string) => string> = {
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
const CN_DELETED = (t: string): string => `"${t}" was deleted. What you typed wasn't saved.`

/** CN-UNDO — four literals, one per class of undoable action in AC-43. */
function cnUndo(a: UndoAction): string {
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
function cnUndone(a: UndoAction): string {
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

/** Render a carried value as text. Never truncated with an ellipsis: *carries the
 * user's value* is the component's reason to exist, and a value the user cannot
 * read back is not carried. Overflow scrolls inside the row (styles.css). */
function valueText(v: unknown): string {
  if (v === null || v === undefined) return '—'
  if (typeof v === 'string') return v
  if (typeof v === 'boolean') return v ? 'yes' : 'no'
  return String(v)
}

function DismissButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      className="cn-dismiss"
      data-testid="shell-carried-notice-dismiss"
      aria-label={label}
      onClick={onClick}
    >
      <CheckIcon />
    </button>
  )
}

/**
 * One notice row. **One per task, never one per field** (AC-47) — a second failed
 * field on a task the region already holds joins that task's row rather than
 * creating a second, which is the same aggregation AC-2 requires of concurrent
 * in-field failures and for the same 4.1.3 reason.
 */
function NoticeRow({
  notice,
  controller,
}: {
  notice: Notice
  controller: AssistantController
}) {
  const deleted = notice.ended === 'task-deleted'
  const retryable = retryableFields(notice)
  // The row's accessible name carries the WHOLE value, including any part that
  // scrolled out of view.
  const lines: string[] = []
  const state: string = deleted
    ? 'carried-deleted'
    : retryable.length > 0
      ? retryable[0]?.reason === 'offline-refused'
        ? 'carried-offline'
        : 'carried-failed'
      : 'carried-superseded'

  const sentence = (f: NoticeField): string => {
    const cf = copyField(f.field)
    if (deleted) return CN_DELETED(notice.taskTitle)
    if (f.superseded) return CN_SUPERSEDED[cf](notice.taskTitle)
    return f.reason === 'offline-refused'
      ? CN_OFFLINE[cf](notice.taskTitle)
      : CN_FAILED[cf](notice.taskTitle)
  }
  for (const f of notice.fields) lines.push(`${sentence(f)} You typed: ${valueText(f.value)}`)

  return (
    <div
      className={`cn-row cn-${state}`}
      data-testid="shell-carried-notice"
      data-cn-state={state}
      data-task-id={notice.taskId}
      aria-label={lines.join(' ')}
    >
      <span className="cn-icon" aria-hidden="true">
        {deleted ? (
          <TrashIcon />
        ) : retryable.length === 0 ? (
          <HistoryIcon />
        ) : retryable[0]?.reason === 'offline-refused' ? (
          <WifiOffIcon />
        ) : (
          <AlertIcon />
        )}
      </span>
      <div className="cn-body">
        {notice.fields.map((f) => (
          <div className="cn-field" key={f.field}>
            <div className="cn-sentence">{sentence(f)}</div>
            {/* The user's own words are not chrome and are never muted. */}
            <div className="cn-label">You typed</div>
            <div className="cn-value">{valueText(f.value)}</div>
            {f.superseded && (
              <>
                <div className="cn-label">Now saved</div>
                <div className="cn-value">{valueText(f.storedNow)}</div>
              </>
            )}
          </div>
        ))}
      </div>
      <span className="cn-actions">
        {/* Neither CN-SUPERSEDED nor CN-DELETED offers a retry, and that is a rule
            rather than an omission: a retry on a superseded field OVERWRITES the
            newer stored value with the stale failed one, and a retry on a deleted
            task is dead or a resurrection. Retyping is the available action, and
            it is an ordinary edit rather than a recovery path. */}
        {retryable.map((f) => (
          <button
            key={f.field}
            className="btn-ghost cn-retry"
            data-testid="shell-carried-notice-retry"
            onClick={() => void controller.retryNotice(notice.taskId, f.field)}
          >
            Retry
          </button>
        ))}
        <DismissButton
          label="Dismiss"
          onClick={() => controller.dismissNotice(notice.taskId)}
        />
      </span>
    </div>
  )
}

/** CN-UNDO / CN-UNDONE. **At most one**, and it renders FIRST — it is the newest
 * event and the only row with a window another action closes. */
function UndoRow({ offer, controller }: { offer: UndoOffer; controller: AssistantController }) {
  const text = offer.used ? cnUndone(offer.action) : cnUndo(offer.action)
  return (
    <div
      className={`cn-row cn-${offer.used ? 'carried-undone' : 'carried-undo'}`}
      data-testid="shell-carried-notice"
      data-cn-state={offer.used ? 'carried-undone' : 'carried-undo'}
      aria-label={text}
    >
      <span className="cn-icon" aria-hidden="true">
        {/* MUST NOT be violet: § UndoAffordance fixes violet as *the assistant's
            own act* and AC-43's offer reverses the USER's act. The constraint
            travels with the affordance, wherever it renders. */}
        <UndoIcon />
      </span>
      <div className="cn-body">
        <div className="cn-sentence">{text}</div>
      </div>
      <span className="cn-actions">
        {!offer.used && (
          <button
            className="btn-neutral cn-undo"
            data-testid="shell-carried-notice-undo"
            onClick={() => void controller.undoLastAction()}
          >
            Put back
          </button>
        )}
        <DismissButton label="Dismiss" onClick={() => controller.dismissUndoOffer()} />
      </span>
    </div>
  )
}

/**
 * The region.
 *
 * **It pre-exists and is empty when there is nothing to report.** A live region
 * injected into the DOM at the same moment as its content is not reliably
 * announced — `§ SaveNotice`'s reasoning, which applies with more force here
 * because this region is created once per app rather than once per surface.
 *
 * `aria-atomic="false"` is where it diverges from `§ SaveNotice`: that one is a
 * single sentence and re-announces whole, while this holds N rows, and re-reading
 * all of them when the third arrives is the *"N polite announcements"* failure
 * AC-2 and AC-47 both aggregate to avoid. `polite`, never `assertive` — nothing
 * here is time-critical, since the family's whole promise is that it waits.
 *
 * **It never takes focus**: focus stays where the action left it.
 */
export function CarriedNotices({
  state,
  controller,
}: {
  state: AppState
  controller: AssistantController
}) {
  const offer = state.undoOffer
  // Notices order **newest first**, under CN-UNDO: the value the user typed most
  // recently is the one in front of them.
  const notices = [...state.notices].reverse()
  const label = notices.length > 0 ? 'Unsaved changes' : 'Undo offer'
  return (
    <div
      className="carried-notices"
      data-testid="shell-carried-notices"
      role="status"
      aria-live="polite"
      aria-atomic="false"
      aria-label={label}
    >
      {offer !== null && <UndoRow offer={offer} controller={controller} />}
      {notices.map((n) => (
        <NoticeRow key={n.taskId} notice={n} controller={controller} />
      ))}
    </div>
  )
}

/**
 * AC-33's 4.1.3 — **every refusal and every status message this feature states is
 * announced.** A rule, not an enumeration: a closed list is exactly how four
 * announcements (AC-40's turn-path refusals, AC-2's offline refusal, AC-38's
 * surfacing, AC-47's own notice) ended up asserted by nobody.
 *
 * This is a separate region from `§ CarriedNotice`'s. The notice region's live
 * announcements are its rows; this one carries the transient status messages that
 * are **not** notices — a refusal, a discarded repeat preview, a move-mode
 * position, a reminder surfacing. Keeping them apart is what lets the notice
 * region be `aria-atomic="false"` while a status message still announces whole.
 *
 * The `key` is the sequence number, so the same sentence twice is two
 * announcements rather than a DOM no-op the live region ignores.
 */
export function StatusAnnouncer({ state }: { state: AppState }) {
  return (
    <div className="sr-only" role="status" aria-live="polite" data-testid="shell-status-announcer">
      {state.announce !== null && <span key={state.announce.seq}>{state.announce.text}</span>}
    </div>
  )
}
