// S6 · TASK DETAIL — every field one task has, set by hand.
//
// F-005. `information-architecture.md § S6`, `AC-45` for where it lives, `AC-1`
// for what it must show, `AC-2` for how it saves, `AC-3`/`AC-4` for what happens
// when the task changes or disappears underneath.
//
// ── IT IS ONE APPLICATION STATE PLACED BY CSS (AC-45) ──────────────────────
//
// There is **no width read in this file**, not in a hook, not in a media-query
// listener, not in a resize observer, and one must never be introduced
// (`owner-decision-2026-08-17-desktop-list-is-primary.md` constraint 2). The shell
// gained a fourth `ShellSurface` value and `styles.css`'s single container query
// decides where this lands: above `tokens.json breakpoints.split` it takes the
// centre column the task list occupies, below it, it is the surface reached from
// Tasks. `settings` is the shipped precedent — *replaces the centre, never the
// panel* — so the conversation stays rendered beside it and AC-3's arriving change
// keeps a subject.
//
// **The runtime observable is that crossing the split changes nothing this holds**
// — same task, same focused field, same dirty value, same uncommitted repeat
// preview, same outstanding notice (tester W10, and L-002's rule that a source
// grep is evidence rather than proof). Nothing in this component is keyed to
// anything but the props it is given, which is what makes that true rather than
// merely untested.
//
// ── THE SAVE MODEL, ONCE (AC-2) ────────────────────────────────────────────
//
// **Value fields save on leaving the field. The repeat picker is the one control
// with an explicit preview-then-commit**, because AC-22, AC-23 and AC-25 have
// outcomes that must be seen before they happen and a save-on-blur control has
// nowhere to render a refusal. **No third model.**
//
// ── COPY AND TESTIDS ───────────────────────────────────────────────────────
//
// `design/_shared/components.md` carries F-005's `§ CarriedNotice`, `§ TaskRow`
// marks, `§ Skeletons` SK-DETAIL and `§ SurfaceError` SE-DETAIL — all transcribed,
// never composed (L-008). It does **not** yet carry a `§ TaskDetail`: the detail's
// own field labels and testids are owed at design's `phase: screens`. The ids
// below follow the catalogue's `{surface}-{control}` convention and are reported
// as **proposed**, so adopting design's spellings is one edit here.

import { useCallback, useEffect, useRef, useState } from 'react'
import * as Toggle from '@radix-ui/react-toggle'
import type { AssistantController } from '../../_shared/controller.ts'
import type { AppState } from '../../_shared/model/reducer.ts'
import { carriedValue, noticeFor, retryableFields } from '../../_shared/model/notices.ts'
import {
  hasRepeat,
  normalizeNote,
  priorityOf,
  repeatOf,
  seriesLive,
} from '../../_shared/model/task-fields.ts'
import { collectionName } from '../../_shared/model/tasks.ts'
import { PRIORITIES } from '../../_shared/types.ts'
import type { Priority, RepeatDraft, TaskView } from '../../_shared/types.ts'
import type { RepeatPreviewWire } from '../../_shared/api/client.ts'
import {
  DETAIL_FIELDS,
  IDLE_MOVE,
  acceptsRepeat,
  acceptsSteps,
  announceMove,
  calendarDate,
  cancel as cancelMove,
  canReorder,
  collectionForDue,
  combineDateTime,
  dateInputValue,
  dateShortcuts,
  detailSteps,
  drop,
  grab,
  move,
  namedCadences,
  repeatChanged,
  repeatPatch,
  setEnd,
  stepOrderBetween,
  timeInputValue,
  toggleWeekday,
  WEEKDAYS,
} from '../detail.ts'
import type { DetailField, MoveMode } from '../detail.ts'
import {
  BellIcon,
  CalendarDaysIcon,
  CheckIcon,
  CloseIcon,
  GripIcon,
  PlusIcon,
  RepeatIcon,
  TrashIcon,
} from './icons.tsx'

/** Human labels for AC-1's seven fields. `deadline` and `step` are § Buttons'
 * one-word-per-concept rows added for F-005 — never *due date*, never *subtask*. */
const FIELD_LABEL: Record<DetailField, string> = {
  title: 'Name',
  note: 'Note',
  priority: 'Priority',
  deadline: 'Deadline',
  reminder: 'Reminder',
  steps: 'Steps',
  repeat: 'Repeat',
}

const PRIORITY_LABEL: Record<Priority, string> = {
  none: 'None',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
}

/**
 * One field's frame — and **this is AC-1's "surface's own account of itself"**
 * (tester W5).
 *
 * AC-1's guarantee is that every one of the seven appears in that account
 * *whether or not it holds a value*, and that each is reachable in at most one
 * further action. Revision 2 stated the guarantee naming no object, which left
 * both available tests wrong: asserting seven **visible** controls over-constrains
 * a compliant implementation that collapses empty fields behind a disclosure, and
 * "reachable" had no budget. The account is therefore an explicit enumeration —
 * seven `detail-field` nodes carrying `data-field` — and it is what a tier asserts
 * against instead of counting inputs.
 *
 * All seven render inline here, so the "one further action" budget is spent at
 * zero. A later disclosure design spends it at one and still satisfies the AC;
 * what it may not do is drop a field from the account.
 */
function Field({
  field,
  children,
  hint,
}: {
  field: DetailField
  children: React.ReactNode
  hint?: React.ReactNode
}) {
  return (
    <div className="detail-field" data-testid="detail-field" data-field={field}>
      <div className="detail-field-label">{FIELD_LABEL[field]}</div>
      <div className="detail-field-control">{children}</div>
      {hint !== undefined && hint !== null && <div className="detail-field-hint">{hint}</div>}
    </div>
  )
}

/**
 * AC-2 — the in-field failure and its retry.
 *
 * *"A write that fails or is refused leaves the user's value in the field, states
 * what happened, and offers a retry — it never silently reverts to the stored
 * value, because a field that snaps back while someone is looking away is
 * indistinguishable from one that saved."*
 *
 * **This retry and § CarriedNotice's are ONE write path called from two places**
 * (AC-47): both call `controller.retryNotice`, they retry the same write once and
 * resolve the same notice. Two implementations of one postcondition drift, and
 * that is L-005's shape applied to a recovery path.
 */
function FieldFailure({
  state,
  controller,
  taskId,
  wireField,
}: {
  state: AppState
  controller: AssistantController
  taskId: string
  wireField: string
}) {
  const notice = noticeFor(state.notices, taskId)
  if (notice === null) return null
  const entry = notice.fields.find((f) => f.field === wireField)
  if (entry === undefined) return null
  const canRetry = notice.ended === null && retryableFields(notice).some((f) => f.field === wireField)
  return (
    <span className="detail-field-failure" data-testid="detail-field-failure" data-field={wireField}>
      {entry.superseded
        ? 'This has changed since. What you typed was not saved.'
        : entry.reason === 'offline-refused'
          ? "You're offline, so this was not saved. Try again when you're back online."
          : 'This did not save.'}
      {canRetry && (
        <button
          className="btn-ghost"
          data-testid="detail-field-retry"
          onClick={() => void controller.retryNotice(taskId, wireField)}
        >
          Retry
        </button>
      )}
    </span>
  )
}

/**
 * A text field that saves on leaving (AC-2), keeps a dirty value through an
 * arriving change (AC-3's focus exception), and shows the notice's carried value
 * when reopened over an outstanding failure (AC-47).
 */
function useFieldDraft(
  state: AppState,
  taskId: string,
  wireField: string,
  stored: string,
): {
  value: string
  setValue: (v: string) => void
  onFocus: () => void
  onBlur: () => void
  focused: boolean
  reset: () => void
} {
  const [focused, setFocused] = useState(false)
  const [draft, setDraft] = useState<string | null>(null)
  // AC-47 — reopening the detail on a task with an outstanding notice shows that
  // field holding **the user's value**, still failed, still offering retry —
  // *unless something newer has been stored*, in which case the supersession rule
  // governs and the field shows the stored value. `carriedValue` answers `null`
  // for a superseded entry, which is exactly that rule.
  const carried = carriedValue(state.notices, taskId, wireField)
  // …and **once something newer HAS been stored, the field shows the stored
  // value** — the supersession rule governs, because *"the notice and the surface
  // never disagree"* and showing a stale failed value over a newer stored one
  // breaks AC-3's live-update guarantee for that field. So a superseded entry
  // clears the local draft rather than merely losing its retry: the notice keeps
  // the superseded text and the field moves on.
  const notice = noticeFor(state.notices, taskId)
  const superseded =
    notice !== null && notice.fields.some((f) => f.field === wireField && f.superseded)
  const value = superseded
    ? stored
    : (draft ?? (typeof carried?.value === 'string' ? carried.value : stored))
  return {
    value,
    setValue: (v) => setDraft(v),
    onFocus: () => setFocused(true),
    onBlur: () => setFocused(false),
    focused,
    reset: () => setDraft(null),
  }
}

/**
 * AC-4's terminal state — **the task being deleted underneath is a normal event,
 * not an error.**
 *
 * *"The surface says so and offers no further edits. Nothing the user had typed is
 * written back: a stale save never resurrects a deleted task and never revives a
 * field on one. The user's unsaved text is not thrown away silently either; it
 * stays legible on the surface that is telling them the task is gone."*
 *
 * **It needs an exit and it must not offer a retry** (design D8): `§ SurfaceError`
 * is the nearest existing shape and its whole anatomy is a **Retry** — the one
 * action that must never be offered here, because a retry pointed at a
 * soft-deleted row is either dead or a resurrection door. So: a way back to the
 * list, and no retry.
 */
function DeletedTerminal({
  state,
  unsaved,
  onBack,
}: {
  state: AppState
  unsaved: { field: string; value: string }[]
  onBack: () => void
}) {
  return (
    <div className="detail-terminal" data-testid="detail-deleted">
      <h2>This task was deleted</h2>
      <p>Nothing you typed was saved, and there is nothing left to save it to.</p>
      {unsaved.length > 0 && (
        <div className="detail-terminal-text" data-testid="detail-deleted-text">
          {unsaved.map((u) => (
            <div key={u.field}>
              <div className="detail-field-label">You typed</div>
              <div className="cn-value">{u.value}</div>
            </div>
          ))}
        </div>
      )}
      {/* No Retry. Deliberately. */}
      <button className="btn-primary" data-testid="detail-back-button" onClick={onBack}>
        Back to the list
      </button>
      <span className="sr-only">{state.announce?.text ?? ''}</span>
    </div>
  )
}

/** SK-DETAIL (`§ Skeletons`) — a title-sized bar, five label/value bar pairs, and
 * a three-bar step block. It exists because the loading state and the all-empty
 * task are otherwise **pixel-identical** (design D8): under AC-1 every field with
 * no value renders as an empty settable control, so a user's first look at their
 * own task would be a lie that corrects itself. Carries no text and no testid. */
function DetailSkeleton() {
  return (
    <div className="detail-sk" aria-busy="true">
      <div className="sk sk-bar" style={{ width: '70%', height: 28 }} />
      {[0, 1, 2, 3, 4].map((i) => (
        <div className="detail-sk-pair" key={i}>
          <div className="sk sk-bar" style={{ width: '30%' }} />
          <div className="sk sk-bar" style={{ width: '55%' }} />
        </div>
      ))}
      <div className="detail-sk-steps">
        {[0, 1, 2].map((i) => (
          <div className="sk-rowline" key={i}>
            <div className="sk sk-box" />
            <div className="sk sk-bar" style={{ width: '50%' }} />
          </div>
        ))}
      </div>
    </div>
  )
}

export function TaskDetail({
  state,
  controller,
  taskId,
  onClose,
}: {
  state: AppState
  controller: AssistantController
  taskId: string
  onClose: () => void
}) {
  const task = state.tasks.find((t) => t.id === taskId && t.deleted_at === null)

  // ── The three not-a-task states, told apart rather than collapsed ──────────
  // Each has a different correct rendering and the discrimination is what makes
  // AC-45's loading clause and AC-4's terminal state both assertable:
  //   loading  → SK-DETAIL           (the read has not answered yet)
  //   failed   → SE-DETAIL           (the read answered with a failure)
  //   ok       → AC-4's terminal     (the read answered, and the task is gone)
  if (task === undefined) {
    if (state.tasksLoad === 'loading') {
      return (
        <Shell onClose={onClose} title="">
          <DetailSkeleton />
        </Shell>
      )
    }
    if (state.tasksLoad === 'failed') {
      return (
        <Shell onClose={onClose} title="">
          {/* SE-DETAIL (`§ SurfaceError`) — design's exact two lines. It takes the
              COLUMN, not the frame, so above the split the conversation stays
              beside it, and **the way back stays live**: the affordance that
              closes the detail is neither hidden nor disabled by the failure
              being recovered from (AC-45, F-001 AC-24 rev 6). */}
          <div className="surface-error" data-testid="detail-surface-error">
            <h2>Couldn't load this task</h2>
            <p>Your other tasks are unaffected. Try again, or go back to the list.</p>
            <button
              className="btn-primary"
              data-testid="detail-retry-button"
              onClick={() => void controller.refreshTasks()}
            >
              Retry
            </button>
          </div>
        </Shell>
      )
    }
    return (
      <Shell onClose={onClose} title="">
        <DeletedTerminal state={state} unsaved={[]} onBack={onClose} />
      </Shell>
    )
  }

  return (
    <Shell onClose={onClose} title={task.title}>
      <DetailBody state={state} controller={controller} task={task} onClose={onClose} />
    </Shell>
  )
}

/**
 * The frame every state shares — and **the close affordance is in it
 * unconditionally.**
 *
 * That is not tidiness: F-001 AC-24 rev 6 needs *"the one action"* out of every
 * conversation failure state to be *neither hidden nor disabled by the failure
 * being recovered from*, and while this surface is open the task list is on screen
 * at **no** width, so closing the detail IS that one action. A server outage fails
 * the write and the turn at once, so the composed state is the ordinary shape of
 * an outage rather than a rare interleaving. Putting the close control in the
 * shared frame is what makes "unconditionally available" a property of the code
 * rather than a promise in a comment.
 */
function Shell({
  onClose,
  title,
  children,
}: {
  onClose: () => void
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="surface s-detail" data-testid="detail-surface">
      <header className="topbar">
        <button
          className="icon-btn"
          data-testid="detail-close-button"
          aria-label="Back to the list"
          onClick={onClose}
        >
          <CloseIcon />
        </button>
        <h1 className="detail-heading">{title}</h1>
        <span className="spacer" />
      </header>
      <div className="detail-body">
        <div className="detail-col">{children}</div>
      </div>
    </div>
  )
}

function DetailBody({
  state,
  controller,
  task,
  onClose,
}: {
  state: AppState
  controller: AssistantController
  task: TaskView
  onClose: () => void
}) {
  const now = controller.nowDate()
  const steps = detailSteps(state.tasks, task.id)

  // ── Title (AC-37) and note (AC-6) ────────────────────────────────────────
  const title = useFieldDraft(state, task.id, 'title', task.title)
  const note = useFieldDraft(state, task.id, 'note', task.note ?? '')

  // ── Steps: the add field and AC-16's move mode ────────────────────────────
  const [stepDraft, setStepDraft] = useState('')
  const [moveMode, setMoveMode] = useState<MoveMode>(IDLE_MOVE)

  // ── The repeat picker — the ONE preview-then-commit control (AC-20) ───────
  const [repeatDraft, setRepeatDraft] = useState<RepeatDraft | null>(null)
  const [preview, setPreview] = useState<RepeatPreviewWire | null>(null)
  const committed = repeatOf(task)

  /**
   * AC-45 / AC-48 — **an uncommitted repeat preview is discarded, and it is
   * discarded VISIBLY.**
   *
   * It is *"neither an in-flight write, a failed write, nor an offline-refused
   * write, and it is not a failure at all"*, so AC-47's notice never carries it and
   * AC-2's states do not reach it. AC-48 decided the case at the swap door — the
   * preview is discarded and the user is told, once, as a status message under
   * AC-33's 4.1.3 — **and the same rule applies at the close door**, for the reason
   * AC-48 gives: it is the only control in the feature with a deliberate
   * multi-step configuration, the user has already seen AC-23's disclosure, and
   * silence is the same silence AC-2 spends a whole sub-bullet forbidding for a
   * smaller object.
   *
   * *Without this the sequence is ordinary and the outcome differs by door:
   * configure a repeat, see the disclosure, tap `Talk` before committing — silent
   * at the close door, announced at the swap door, same object, same release.
   * L-005's shape on a door revision 3 opened.*
   *
   * A cleanup effect keyed on the **task id** covers the swap door (AC-48) and the
   * unmount covers the close door and every navigation that closes the detail
   * (AC-45's edge list), so one mechanism answers both rather than two agreeing.
   */
  const pending = useRef<boolean>(false)
  pending.current = repeatDraft !== null && repeatChanged(committed, repeatDraft)
  const announceDiscard = useCallback(() => {
    if (!pending.current) return
    controller.announce('The repeat you were setting up was not saved.')
  }, [controller])
  useEffect(() => {
    return () => {
      announceDiscard()
    }
    // Keyed on the task id so the SWAP door (AC-48 — same component, new subject)
    // runs it too, not only the unmount.
  }, [task.id, announceDiscard])

  const openRepeat = () => {
    setRepeatDraft(committed)
    setPreview(null)
  }
  const editRepeat = (next: RepeatDraft) => {
    setRepeatDraft(next)
    setPreview(null)
  }

  /**
   * AC-22 / AC-23 — **any date this operation adds or moves is shown before the
   * repeat is committed**, and announced under AC-33's 4.1.3.
   *
   * The preview is a **server** dry run of the same code the commit runs
   * (`POST /tasks/{id}/repeat-preview`), so the disclosed date is by construction
   * the date that will be written. A client-side preview would be a second
   * implementation of the alignment, the month-day clamp and the exclusivity rules
   * — L-004's shape on arithmetic the spec spends four ACs on.
   *
   * The **collection** is derived client-side from the returned date, because the
   * server has no opinion about collections (ADR-009) and returning one there would
   * make it a second definition of a number four artifacts already agree on.
   */
  const runPreview = async (draft: RepeatDraft) => {
    const res = await controller.repeatPreview(task.id, repeatPatch(committed, draft))
    if (res === null) return
    setPreview(res)
    const where = collectionName(collectionForDue(res.due_at, now))
    if (res.refusals.length > 0) {
      controller.announce(res.refusals.map((r) => r.message).join(' '))
      return
    }
    if (res.created) {
      controller.announce(`This will get a deadline of ${dateInputValue(res.due_at)}, in ${where}.`)
    } else if (res.moved) {
      controller.announce(`The deadline will move to ${dateInputValue(res.due_at)}, in ${where}.`)
    }
  }

  const commitRepeat = async () => {
    if (repeatDraft === null) return
    const patch = repeatPatch(committed, repeatDraft)
    if (Object.keys(patch).length === 0) {
      setRepeatDraft(null)
      return
    }
    const ok = await controller.writeField(task.id, patch)
    if (ok) {
      setRepeatDraft(null)
      setPreview(null)
    }
  }

  // ── AC-2 — save on leaving the field, one field per request ───────────────
  const saveTitle = async () => {
    title.onBlur()
    // AC-37 — an empty title is REFUSED and the task keeps the name it had. The
    // refusal is stated (`editTask` announces it) and the draft is reset so the
    // field shows the name the task actually has, which is what "keeps the name it
    // had" means on screen as well as in the store.
    if (title.value.trim() === '') {
      controller.announce('A task needs a name — this one kept the name it had.')
      title.reset()
      return
    }
    if (title.value.trim() === task.title) {
      title.reset()
      return
    }
    const ok = await controller.writeField(task.id, { title: title.value.trim() })
    if (ok) title.reset()
  }

  const saveNote = async () => {
    note.onBlur()
    // AC-6 — empty, whitespace-only and newline-only input is stored as **no note
    // at all, never as an empty string**, and the distinction is observable on
    // read-back. Line breaks inside a real note survive the round trip untouched.
    const next = normalizeNote(note.value)
    if (next === (task.note ?? null)) {
      note.reset()
      return
    }
    const ok = await controller.writeField(task.id, { note: next })
    if (ok) note.reset()
  }

  const setPriority = (p: Priority) => {
    // AC-8 — four states, each settable and clearable in ONE action. `none` is the
    // absence of a stored value, so clearing writes `null` and the wire reads it
    // back as `"none"`; a literal `'none'` would add a `priority: none` row to
    // F-001 AC-4's message on every create and report every pre-F-005 row modified
    // in the very gate AC-34 exists to protect.
    void controller.writeField(task.id, { priority: p === 'none' ? null : p })
  }

  const setDue = (at: string | null, allDay: boolean | null) => {
    // AC-10 — set and cleared by picker, with **zero AI calls**. Clearing stores no
    // value (not a zero date, not an empty string), observable on read-back.
    //
    // The flag travels with the instant because AC-13's whole point is that they
    // are one fact: a date-only deadline must be distinguishable from one at
    // midnight, or a fabricated 00:00 shows up as a time the user never picked.
    void controller.writeField(task.id, { due_at: at, due_all_day: at === null ? null : allDay })
  }

  const setReminder = (at: string | null) => {
    // AC-10's sub-bullet — writing or clearing `reminder_at` clears
    // `reminder_shown_at`, **server-side, in the same write**: the marker is keyed
    // to the instant that was surfaced, so a reminder moved to a new moment is a
    // new reminder and surfaces again. Without it the SECOND reminder a user ever
    // sets on a task is dead on arrival, invisibly.
    void controller.writeField(task.id, { reminder_at: at })
  }

  // ── AC-16's move mode, driven by keyboard and by a single pointer ─────────
  const startMove = (stepId: string) => {
    const next = grab(steps, stepId)
    setMoveMode(next)
    if (next.state.phase !== 'idle') {
      controller.announce(`${announceMove(next.state.index, steps.length)} — grabbed`)
    }
  }
  const stepMove = (delta: number) => {
    const next = move(moveMode, delta)
    setMoveMode(next)
    if (next.state.phase !== 'idle') {
      controller.announce(announceMove(next.state.index, next.order.length))
    }
  }
  const commitMove = async () => {
    const target = drop(moveMode)
    const order = moveMode.order
    setMoveMode(IDLE_MOVE)
    // The drop where the step already was: **writes nothing, creates no undo
    // entry, announces nothing** (AC-15, AC-16, AC-43). One condition, answered in
    // `drop`, so a caller cannot get two of the three right.
    if (target === null) return
    const before = target.before === null ? null : (state.tasks.find((t) => t.id === target.before)?.step_order ?? null)
    const after = target.after === null ? null : (state.tasks.find((t) => t.id === target.after)?.step_order ?? null)
    await controller.moveStep(target.taskId, stepOrderBetween(before, after))
    controller.announce(announceMove(order.indexOf(target.taskId), order.length))
  }
  const abandonMove = () => {
    const { returnedTo } = cancelMove(moveMode)
    setMoveMode(IDLE_MOVE)
    // AC-16's `cancelled` state has an entry condition and an announcement: the
    // step **returns to the position it held**, announced like any other position
    // change (tester W13 — revision 2 left this state with no trigger at all).
    if (returnedTo !== null) controller.announce(announceMove(returnedTo, steps.length))
  }

  const addStep = async () => {
    if (stepDraft.trim() === '') return
    const ok = await controller.addStep(task.id, stepDraft)
    if (ok) setStepDraft('')
  }

  const shortcuts = dateShortcuts(now)
  const priority = priorityOf(task)
  const draft = repeatDraft
  const dueCollection = task.due_at === null ? null : collectionName(collectionForDue(task.due_at, now))

  return (
    <div
      className="detail-fields"
      // AC-1's account, as one region with a name — the seven `detail-field`
      // children below are its enumeration.
      role="group"
      aria-label={`Details for ${task.title}`}
      data-testid="detail-fields"
      data-field-count={DETAIL_FIELDS.length}
    >
      {/* ── title (AC-37) ─────────────────────────────────────────────────── */}
      <Field
        field="title"
        hint={
          <FieldFailure state={state} controller={controller} taskId={task.id} wireField="title" />
        }
      >
        <input
          className="detail-input"
          data-testid="detail-title-input"
          aria-label="Name"
          value={title.value}
          onFocus={title.onFocus}
          onChange={(e) => title.setValue(e.target.value)}
          onBlur={() => void saveTitle()}
        />
      </Field>

      {/* ── note (AC-6) — long notes scroll and are NEVER truncated ───────── */}
      <Field
        field="note"
        hint={
          <FieldFailure state={state} controller={controller} taskId={task.id} wireField="note" />
        }
      >
        <textarea
          className="detail-note"
          data-testid="detail-note-input"
          aria-label="Note"
          rows={4}
          value={note.value}
          onFocus={note.onFocus}
          onChange={(e) => note.setValue(e.target.value)}
          onBlur={() => void saveNote()}
        />
      </Field>

      {/* ── priority (AC-8) — four states, each settable and clearable in one
             action, name/role/value on every one (AC-33's 4.1.2) ──────────── */}
      <Field
        field="priority"
        hint={
          <FieldFailure
            state={state}
            controller={controller}
            taskId={task.id}
            wireField="priority"
          />
        }
      >
        <div
          className="detail-priority"
          data-testid="detail-priority-control"
          role="radiogroup"
          aria-label="Priority"
        >
          {PRIORITIES.map((p) => (
            <button
              key={p}
              className={`detail-priority-option${priority === p ? ' is-on' : ''}`}
              data-testid="detail-priority-option"
              data-priority={p}
              role="radio"
              aria-checked={priority === p}
              onClick={() => setPriority(p)}
            >
              {PRIORITY_LABEL[p]}
            </button>
          ))}
        </div>
      </Field>

      {/* ── deadline (AC-10, AC-11, AC-12, AC-13) ─────────────────────────── */}
      <Field
        field="deadline"
        hint={
          <>
            {/* AC-12's *visible consequence, not a surprise*: a task given today's
                date joins the Today collection by ADR-009's rule. */}
            {dueCollection !== null && (
              <span className="detail-hint-text" data-testid="detail-deadline-collection">
                In {dueCollection}
                {task.due_all_day !== false ? ' · no time set' : ''}
              </span>
            )}
            <FieldFailure
              state={state}
              controller={controller}
              taskId={task.id}
              wireField="due_at"
            />
          </>
        }
      >
        <div className="detail-datetime">
          <span className="detail-field-icon" aria-hidden="true">
            <CalendarDaysIcon />
          </span>
          <input
            type="date"
            className="detail-input"
            data-testid="detail-deadline-date"
            aria-label="Deadline date"
            value={dateInputValue(task.due_at)}
            onChange={(e) => {
              if (e.target.value === '') {
                setDue(null, null)
                return
              }
              // AC-13 — a date picked with no time is **all-day**, and that path is
              // REQUIRED (design D7): all three shortcuts carry times, and an
              // implementer left to choose the calendar's default picks one,
              // shipping the exact defect AC-13 cites from the original product
              // (say "Friday", get 9:00).
              // **The time carried forward is the one the CONTROL shows, not the
              // one the instant happens to hold.** An all-day due is stored at
              // that day's local start, so `timeInputValue` reads `00:00` from it —
              // and feeding that back would turn every date change into a
              // deliberate midnight, which is the fabricated time AC-13 forbids,
              // reintroduced by the control that exists to avoid it.
              const heldTime = task.due_all_day === false ? timeInputValue(task.due_at) : ''
              const combined = combineDateTime(e.target.value, heldTime)
              if (combined !== null) setDue(combined.at, combined.allDay)
            }}
          />
          <input
            type="time"
            className="detail-input detail-time"
            data-testid="detail-deadline-time"
            aria-label="Deadline time"
            value={task.due_all_day === false ? timeInputValue(task.due_at) : ''}
            onChange={(e) => {
              const date = dateInputValue(task.due_at) || dateInputValue(now.toISOString())
              const combined = combineDateTime(date, e.target.value)
              if (combined !== null) setDue(combined.at, combined.allDay)
            }}
          />
          <button
            className="btn-ghost"
            data-testid="detail-deadline-clear"
            aria-label="Clear the deadline"
            // AC-22 — clearing the due date of a repeating task is **refused**, with
            // a message naming the action that ends the repeat. The refusal is the
            // server's (`clear_due_while_repeating`); the control stays live so the
            // user meets a stated refusal rather than a control that is silently
            // dead.
            onClick={() => setDue(null, null)}
          >
            Clear
          </button>
        </div>
        <div className="detail-shortcuts">
          {shortcuts.map((s) => (
            <button
              key={s.id}
              className="btn-ghost detail-shortcut"
              data-testid="detail-deadline-shortcut"
              data-shortcut={s.id}
              onClick={() => setDue(s.at, s.allDay)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </Field>

      {/* ── reminder (AC-10, AC-11) ───────────────────────────────────────── */}
      <Field
        field="reminder"
        hint={
          <>
            {/* AC-11 — **they are two moments, and the surface says which one makes
                a sound.** Setting a deadline never creates a reminder: *"the report
                is due Friday, remind me Wednesday"* is an ordinary sentence a single
                merged field cannot express. The permanent-disclaimer requirement is
                GONE (AC-38 delivers), so this control can name itself honestly. */}
            <span className="detail-hint-text">This is the one that alerts you.</span>
            <FieldFailure
              state={state}
              controller={controller}
              taskId={task.id}
              wireField="reminder_at"
            />
          </>
        }
      >
        <div className="detail-datetime">
          <span className="detail-field-icon" aria-hidden="true">
            <BellIcon />
          </span>
          <input
            type="date"
            className="detail-input"
            data-testid="detail-reminder-date"
            aria-label="Reminder date"
            value={dateInputValue(task.reminder_at)}
            onChange={(e) => {
              if (e.target.value === '') {
                setReminder(null)
                return
              }
              const combined = combineDateTime(e.target.value, timeInputValue(task.reminder_at))
              if (combined !== null) setReminder(combined.at)
            }}
          />
          <input
            type="time"
            className="detail-input detail-time"
            data-testid="detail-reminder-time"
            aria-label="Reminder time"
            value={timeInputValue(task.reminder_at)}
            onChange={(e) => {
              const date = dateInputValue(task.reminder_at) || dateInputValue(now.toISOString())
              const combined = combineDateTime(date, e.target.value)
              if (combined !== null) setReminder(combined.at)
            }}
          />
          <button
            className="btn-ghost"
            data-testid="detail-reminder-clear"
            aria-label="Clear the reminder"
            onClick={() => setReminder(null)}
          >
            Clear
          </button>
        </div>
      </Field>

      {/* ── steps (AC-14, AC-15, AC-16, AC-18) ────────────────────────────── */}
      <Field
        field="steps"
        hint={
          <FieldFailure state={state} controller={controller} taskId={task.id} wireField="step" />
        }
      >
        {!acceptsSteps(task) ? (
          // AC-18 — **a step has no steps of its own.** The surface does not offer
          // the gesture the write path refuses; the refusal is still the server's
          // (`nesting_too_deep`), this is the surface not setting a trap.
          <p className="detail-hint-text" data-testid="detail-steps-refused">
            A step cannot have steps of its own.
          </p>
        ) : (
          <div className="detail-steps" data-testid="detail-steps">
            <ul className="detail-step-list">
              {steps.map((s, i) => {
                const held = moveMode.state.phase !== 'idle' && moveMode.state.taskId === s.id
                return (
                  <li
                    className={`detail-step${held ? ' is-held' : ''}`}
                    data-testid="detail-step-row"
                    data-task-id={s.id}
                    key={s.id}
                  >
                    <Toggle.Root
                      className="checkbox"
                      data-testid="detail-step-checkbox"
                      pressed={s.status === 'done'}
                      // AC-14 — tick and untick each one, with zero AI calls.
                      onPressedChange={() => void controller.toggleTask(s.id)}
                      aria-label={`Mark the step “${s.title}” ${s.status === 'done' ? 'not done' : 'done'}`}
                    >
                      {s.status === 'done' ? <CheckIcon /> : null}
                    </Toggle.Root>
                    <input
                      className="detail-step-name"
                      data-testid="detail-step-name"
                      aria-label={`Step ${i + 1} name`}
                      defaultValue={s.title}
                      // AC-14's rename, on the same save-on-leaving model as every
                      // other value field (AC-2). AC-37's guard binds here too —
                      // `editTask` refuses an empty title and states the refusal.
                      onBlur={(e) => void controller.editTask(s.id, e.target.value)}
                    />
                    {/* AC-16 — **the move mode, and it is not a drag.** Dragging is
                        never the only way (2.5.1), and the mode is keyboard-operable
                        (2.1.1). It does not appear on a one-step list, because there
                        is nowhere to drop it (AC-15). */}
                    {canReorder(steps) && (
                      <button
                        className={`detail-step-move${held ? ' is-held' : ''}`}
                        data-testid="detail-step-move"
                        aria-label={held ? `Moving “${s.title}”` : `Move “${s.title}”`}
                        aria-pressed={held}
                        onClick={() => (held ? void commitMove() : startMove(s.id))}
                        onKeyDown={(e) => {
                          if (!held) return
                          if (e.key === 'ArrowUp') {
                            e.preventDefault()
                            stepMove(-1)
                          }
                          if (e.key === 'ArrowDown') {
                            e.preventDefault()
                            stepMove(1)
                          }
                          if (e.key === 'Escape') {
                            e.preventDefault()
                            abandonMove()
                          }
                        }}
                      >
                        <GripIcon />
                      </button>
                    )}
                    <button
                      className="row-action row-del"
                      data-testid="detail-step-delete"
                      aria-label={`Delete the step “${s.title}”`}
                      // AC-14 / AC-43 — deleting a step is otherwise the one thing in
                      // this feature you can destroy irreversibly, on the surface
                      // where deletion is most casual. The undo offer follows the
                      // write's result and renders in § CarriedNotice.
                      onClick={() => void controller.removeTask(s.id)}
                    >
                      <TrashIcon />
                    </button>
                  </li>
                )
              })}
            </ul>
            <div className="detail-step-add">
              <input
                className="detail-input"
                data-testid="detail-step-add-input"
                aria-label="New step"
                placeholder="Add a step…"
                value={stepDraft}
                onChange={(e) => setStepDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void addStep()
                }}
              />
              <button
                className="btn-ghost"
                data-testid="detail-step-add-button"
                onClick={() => void addStep()}
              >
                <PlusIcon />
                Add step
              </button>
            </div>
          </div>
        )}
      </Field>

      {/* ── repeat (AC-20 … AC-25, AC-30) ─────────────────────────────────── */}
      <Field
        field="repeat"
        hint={
          <FieldFailure
            state={state}
            controller={controller}
            taskId={task.id}
            wireField="repeat_frequency"
          />
        }
      >
        {!acceptsRepeat(task) ? (
          // AC-18 / AC-21 — only a top-level task can repeat.
          <p className="detail-hint-text" data-testid="detail-repeat-refused">
            Only a whole task can repeat, not one of its steps.
          </p>
        ) : draft === null ? (
          <div className="detail-repeat-summary">
            <span className="detail-field-icon" aria-hidden="true">
              <RepeatIcon />
            </span>
            <span data-testid="detail-repeat-summary">
              {hasRepeat(task) ? describeRepeat(committed) : 'Does not repeat'}
            </span>
            <button className="btn-ghost" data-testid="detail-repeat-edit" onClick={openRepeat}>
              {hasRepeat(task) ? 'Change' : 'Set a repeat'}
            </button>
            {hasRepeat(task) && (
              <button
                className="btn-ghost"
                data-testid="detail-repeat-clear"
                // AC-25 — clearing the repeat **leaves the current occurrence in
                // place as an ordinary task**, keeping its deadline, its steps and
                // everything else: ending a repeat is not deleting a task. It also
                // leaves `series_id` on the row (AC-25), which is exactly why
                // `series_live` and not `series_id` is the mark's predicate.
                onClick={() =>
                  void controller.writeField(task.id, {
                    repeat_frequency: null,
                    repeat_interval: null,
                    repeat_weekdays: null,
                    repeat_month_days: null,
                    repeat_until: null,
                    repeat_count: null,
                  })
                }
              >
                End the repeat
              </button>
            )}
          </div>
        ) : (
          // **The ONE control with preview-then-commit** (AC-2, AC-20, design D5),
          // because AC-22, AC-23 and AC-25 have outcomes that must be visible
          // BEFORE they happen and a save-on-blur control has nowhere to render a
          // refusal.
          <div className="detail-repeat-picker" data-testid="detail-repeat-picker">
            <div className="detail-cadences">
              {namedCadences().map((c) => (
                <button
                  key={c.id}
                  className="btn-ghost"
                  data-testid="detail-repeat-cadence"
                  data-cadence={c.id}
                  onClick={() => {
                    const next = { ...c.draft, repeat_until: draft.repeat_until, repeat_count: draft.repeat_count }
                    editRepeat(next)
                    void runPreview(next)
                  }}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <label className="detail-interval">
              Every
              <input
                type="number"
                min={1}
                className="detail-input detail-number"
                data-testid="detail-repeat-interval"
                aria-label="Repeat interval"
                value={draft.repeat_interval ?? 1}
                onChange={(e) => {
                  const next = { ...draft, repeat_interval: Math.max(1, Number(e.target.value) || 1) }
                  editRepeat(next)
                  void runPreview(next)
                }}
              />
              {draft.repeat_frequency ?? 'day'}(s)
            </label>
            {/* AC-21 — a WEEKLY rule may name weekdays; a daily rule may not.
                *"Daily, but only Mondays and Fridays" is not daily, it is weekly on
                two days*, and offering both is two paths to one cadence. */}
            {draft.repeat_frequency === 'week' && (
              <div className="detail-weekdays" role="group" aria-label="Days of the week">
                {WEEKDAYS.map((d) => {
                  const on = (draft.repeat_weekdays ?? '').split(',').includes(d)
                  return (
                    <button
                      key={d}
                      className={`detail-weekday${on ? ' is-on' : ''}`}
                      data-testid="detail-repeat-weekday"
                      data-weekday={d}
                      aria-pressed={on}
                      onClick={() => {
                        const next = toggleWeekday(draft, d)
                        editRepeat(next)
                        void runPreview(next)
                      }}
                    >
                      {d}
                    </button>
                  )
                })}
              </div>
            )}
            {/* AC-25 — a series ends by an end date OR by a number of runs, NEVER
                both. The picker offers one, and `setEnd` is what makes that true of
                the draft rather than of the markup. */}
            <div className="detail-repeat-end" role="group" aria-label="When the repeat ends">
              <button
                className="btn-ghost"
                data-testid="detail-repeat-end"
                data-end="never"
                onClick={() => {
                  const next = setEnd(draft, { kind: 'never' })
                  editRepeat(next)
                  void runPreview(next)
                }}
              >
                Never ends
              </button>
              <label>
                On
                <input
                  type="date"
                  className="detail-input"
                  data-testid="detail-repeat-until"
                  aria-label="Repeat until"
                  value={draft.repeat_until ?? ''}
                  onChange={(e) => {
                    const next = setEnd(draft, { kind: 'until', date: e.target.value })
                    editRepeat(next)
                    void runPreview(next)
                  }}
                />
              </label>
              <label>
                After
                <input
                  type="number"
                  min={1}
                  className="detail-input detail-number"
                  data-testid="detail-repeat-count"
                  aria-label="Number of runs"
                  value={draft.repeat_count ?? ''}
                  onChange={(e) => {
                    const next = setEnd(draft, { kind: 'count', count: Math.max(1, Number(e.target.value) || 1) })
                    editRepeat(next)
                    void runPreview(next)
                  }}
                />
                runs
              </label>
            </div>
            {/* AC-22 / AC-23's disclosure — the created-or-moved date, and the
                collection it lands in, BEFORE the user commits. */}
            {preview !== null && (
              <div className="detail-preview" data-testid="detail-repeat-preview">
                {preview.refusals.length > 0 ? (
                  <ul>
                    {preview.refusals.map((r) => (
                      <li key={`${r.code}-${r.field ?? ''}`} data-testid="detail-repeat-refusal">
                        {r.message}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>
                    {preview.created
                      ? 'This task has no deadline, so setting a repeat gives it one: '
                      : preview.moved
                        ? 'The deadline moves forward onto the rule: '
                        : 'Deadline: '}
                    <strong data-testid="detail-repeat-preview-date">
                      {dateInputValue(preview.due_at)}
                    </strong>
                    {' · '}
                    <span data-testid="detail-repeat-preview-collection">
                      {collectionName(collectionForDue(preview.due_at, now))}
                    </span>
                  </p>
                )}
              </div>
            )}
            <div className="detail-repeat-actions">
              <button
                className="btn-primary"
                data-testid="detail-repeat-commit"
                disabled={preview !== null && preview.refusals.length > 0}
                onClick={() => void commitRepeat()}
              >
                Save the repeat
              </button>
              <button
                className="btn-ghost"
                data-testid="detail-repeat-cancel"
                onClick={() => {
                  // The discard is announced by the unmount effect only when the
                  // SURFACE goes; cancelling in place is an explicit act the user
                  // just took, so the announcement would be telling them what they
                  // asked for. The state is cleared here so the effect does not
                  // then announce it as a silent loss.
                  setRepeatDraft(null)
                  setPreview(null)
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </Field>

      {/* ── delete, and the series delete (AC-30, AC-31) ───────────────────── */}
      <div className="detail-danger">
        <button
          className="btn-ghost detail-delete"
          data-testid="detail-delete-button"
          // AC-31 — the detail can delete its task. The delete is soft, as it
          // already is, and it offers AC-43's immediate undo, rendered in
          // § CarriedNotice rather than on the row. **No confirmation dialog**: the
          // source refuses one here on the grounds that an action with an undo does
          // not also need a question (UC-33 AC-33.2).
          onClick={() => {
            void controller.removeTask(task.id).then(() => onClose())
          }}
        >
          <TrashIcon />
          Delete this task
        </button>
        {/* AC-30 — **two controls, not one control that asks sometimes** (design
            D11). "Delete the whole series" is present ONLY on a task in a live
            series. One control that interrogates on some tasks and not others has
            no vocabulary in the catalogue anyway: `§ OptionChip` is bound to Talk's
            question bubbles and `§ Buttons`' danger variant is *"confirm-delete
            contexts only"* — the very question the precedent refuses. */}
        {seriesLive(task) && (
          <button
            className="btn-ghost detail-delete"
            data-testid="detail-delete-series-button"
            onClick={() => {
              void controller.removeSeries(task.id).then(() => onClose())
            }}
          >
            <TrashIcon />
            Delete the whole series
          </button>
        )}
      </div>
    </div>
  )
}

/**
 * A repeat rule in words. **Not a template over the frequency name** — a closed
 * switch, because a `${interval} ${frequency}s` builder renders "1 days" and
 * "every 1 weeks" for combinations nobody enumerated, which is L-008's defect on
 * the smallest possible object.
 */
function describeRepeat(r: RepeatDraft): string {
  const every = r.repeat_interval ?? 1
  const base =
    r.repeat_frequency === 'day'
      ? every === 1
        ? 'Every day'
        : `Every ${every} days`
      : r.repeat_frequency === 'week'
        ? every === 1
          ? 'Every week'
          : `Every ${every} weeks`
        : r.repeat_frequency === 'month'
          ? every === 1
            ? 'Every month'
            : `Every ${every} months`
          : every === 1
            ? 'Every year'
            : `Every ${every} years`
  const days = r.repeat_weekdays === null ? '' : ` on ${r.repeat_weekdays}`
  const end =
    r.repeat_until !== null
      ? `, until ${r.repeat_until}`
      : r.repeat_count !== null
        ? `, ${r.repeat_count} times`
        : ''
  return `${base}${days}${end}`
}
