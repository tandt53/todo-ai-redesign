// F-005 AC-38 — a reminder whose moment has passed is shown when the app opens.
//
// **This is the whole of reminder delivery in this phase and it is deliberately not
// scheduling:** no scheduler, no push, no notification permission prompt, and no
// dependency on UC-26.
//
// ── WHY THIS IS ITS OWN COMPONENT AND NOT § CarriedNotice ───────────────────
//
// AC-47 and AC-38 both ask design to decide **once** whether the two share a
// family, so that a single family, if chosen, is chosen deliberately rather than by
// whichever AC is built first. Design answered on 2026-08-19 (T-152):
// **two families**, and `§ CarriedNotice` *"may not carry a passed reminder"*.
// Three reasons, the first being AC-38's own observation:
//
//   1. **Their lifetimes are opposite.** That family never self-retires and ends
//      only by the user's own act; this surfacing **retires on acknowledgement**.
//      A shared family would need a per-instance lifetime rule.
//   2. **Different objects, opposite news.** That family reports the app failing to
//      keep something the user typed; this reports a moment that has passed — the
//      app doing exactly its job.
//   3. **Different verbs.** Retry / put back / dismiss, against *acknowledge*.
//      Merged, one strip carries four verbs and the one that retires a reminder
//      sits beside the one that dismisses a notice — two gestures a keystroke apart
//      with opposite consequences.
//
// ── WHAT DESIGN HAS NOT DECIDED, AND WHAT THIS OBEYS ANYWAY ─────────────────
//
// `§ CarriedNotice § What is owed elsewhere` item 1: *"AC-38's passed-reminder
// surfacing has no component yet. This pass decided only that it is not this
// family."* Whether it is `§ LandingSummary` widened or a third family is **the
// open call**, and it is design's.
//
// So this component is a **placeholder that satisfies every constraint design did
// name**, and it is reported as owed rather than presented as the answer. The
// constraints, each honoured below:
//
//   - it renders **on open** — and *open* is two doors, `init()` and
//     `onForeground()`, which is why the read is `controller.openingSync()` and not
//     a mount effect here;
//   - **N passed reminders are ONE surfacing**, ordered oldest first;
//   - each carries a **deliberate per-reminder acknowledge control**, and there is
//     **no bulk dismissal**;
//   - **rendering is not acknowledgement**, and neither is opening the task or
//     scrolling past;
//   - it **names its task and is reachable from there**;
//   - it carries `(api, web, mobile)`.
//
// The one thing it invents is placement, and it is the least-committing choice
// available: a region beside `§ CarriedNotice`'s at the frame, so the surfacing is
// visible below the split (where the app opens on Talk, and where
// `§ LandingSummary` owns what is said on open) without being folded into a family
// design has ruled it out of.

import type { AssistantController } from '../../_shared/controller.ts'
import type { AppState } from '../../_shared/model/reducer.ts'
import { formatDue } from '../../_shared/model/format.ts'
import { BellIcon, CheckIcon } from './icons.tsx'

export function PassedReminders({
  state,
  controller,
  onOpenTask,
}: {
  state: AppState
  controller: AssistantController
  onOpenTask: (taskId: string) => void
}) {
  if (state.reminders.length === 0) return null
  const now = controller.nowDate()
  return (
    <div
      className="passed-reminders"
      data-testid="shell-passed-reminders"
      role="status"
      aria-live="polite"
      aria-atomic="false"
      aria-label={state.reminders.length === 1 ? 'A reminder has passed' : 'Reminders have passed'}
    >
      {state.reminders.map((r) => (
        <div className="pr-row" data-testid="shell-passed-reminder" data-task-id={r.taskId} key={r.taskId}>
          <span className="pr-icon" aria-hidden="true">
            <BellIcon />
          </span>
          <div className="pr-body">
            {/* Names its task, and is reachable from there (AC-38). Opening the
                task **does not count as acknowledging** — that is one of the three
                readings the owner ruled out by name, along with scrolling past and
                rendering. */}
            <button
              className="pr-open"
              data-testid="shell-passed-reminder-open"
              onClick={() => onOpenTask(r.taskId)}
            >
              {r.title}
            </button>
            <span className="pr-when">{formatDue(r.reminderAt, now)}</span>
          </div>
          {/* **The deliberate, per-reminder act.** There is no bulk dismissal and
              the cost of that is accepted knowingly: ten passed reminders take ten
              gestures. A single gesture that retires reminders the user has not read
              is the looser reading wearing a convenience label, and it fails on the
              same case — a user taps to look, is interrupted, closes the app, and
              under any looser reading the reminder is spent permanently, on every
              device, while the task is still undone. A reminder wrongly retired is
              not recoverable; the N-gesture cost is a later, cheap addition. */}
          <button
            className="btn-ghost pr-ack"
            data-testid="shell-passed-reminder-ack"
            aria-label={`Mark the reminder for “${r.title}” as seen`}
            onClick={() => void controller.acknowledgeReminder(r.taskId)}
          >
            <CheckIcon />
            Got it
          </button>
        </div>
      ))}
    </div>
  )
}
