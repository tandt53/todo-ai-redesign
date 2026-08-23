// S2 · TASKS — the whole todo, by hand.
//
// It used to be a PANE beside the conversation. It is now a SURFACE: the app's
// other half and `todo-ai ADR-11`'s second path, one action away below the
// split and permanently in the centre at or above it
// (information-architecture.md §1, §1a). Nothing about the operations changed —
// AC-18's four still run through `controller.addTask / toggleTask / editTask /
// removeTask` with zero AI calls; what changed is where they happen.
//
// Copy is transcribed from docs/design/_shared/components.md and the app-shell
// mockup it points at — never composed here (L-008). Testids come from the
// mockup catalogue only.
//
// WHAT IS DELIBERATELY ABSENT: every personal-list affordance. `lists` and
// `tasks.list_id` do not exist (IA §7), so there is no per-row "Move to list"
// and the header never names a personal list — only the four built-in
// collections. IA §7 called those `task.status`; ADR-009 and its § Amendment
// retired that reading, and they are date predicates now with the single
// exception of Done.

import { useState } from 'react'
import * as Toggle from '@radix-ui/react-toggle'
import type { AssistantController } from '../../_shared/controller.ts'
import type { AppState } from '../../_shared/model/reducer.ts'
import type { DiffLine, TaskView } from '../../_shared/types.ts'
import { formatDue, tasksWord } from '../../_shared/model/format.ts'
import {
  collectionName,
  collectionTasks,
  groupTasks,
  groupsByDay,
  openTodayCount,
} from '../../_shared/model/tasks.ts'
import type { Collection } from '../../_shared/model/tasks.ts'
import { priorityOf, remainingSteps, rendersClockTime, seriesLive } from '../../_shared/model/task-fields.ts'
import type { Priority } from '../../_shared/types.ts'
import type { ShellHandle } from '../shell.ts'
import {
  AlertIcon,
  CheckIcon,
  ListChecksIcon,
  MenuIcon,
  MicIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  RepeatIcon,
  SearchIcon,
  SendIcon,
  TrashIcon,
} from './icons.tsx'
// PathSwitch removed from Tasks header. VoiceFab retired (T-321), replaced by
// TaskBottomBar at the bottom of this surface below split (AC-37).

/**
 * § TaskRow § The row's mark budget — **three marks, one line, one decision.**
 *
 * F-005 asks the row for three new marked meanings at once: **AC-9's urgency**,
 * **AC-17's remaining-step count** and **AC-39's repeating-series indicator**.
 * Design decided the row once rather than absorbing three independent additions,
 * and the order below is that decision, not arrival order:
 *
 *   checkbox · **title** · urgency · deadline · repeat · steps · (delete control)
 *
 * Urgency leads because it is the only item the **user** set as emphasis and it
 * changes how the title is read; the deadline follows because it is the fact most
 * often consulted; repeat explains where a row the user never typed came from; the
 * step count is a number about a different set and is last. **Four items is the
 * ceiling** — a fifth marked meaning is refused until one is removed, because the
 * row's own record spent an explicit argument keeping it clean (*"One signal, not
 * two"*) and a budget that can be topped up is not a budget.
 *
 * **None of the three carries colour.** The accent set is closed at five and every
 * one already carries an assigned meaning; this row already renders under a
 * `danger` Overdue heading on every row of Today in the live store and can also
 * carry a `NEW`/`EDITED` marker. Each mark is **shape, weight and its accessible
 * name** — which is what AC-33's 1.4.3 requires of it regardless.
 *
 * **AC-43's undo affordance is NOT one of them**: the owner placed it in
 * § CarriedNotice on 2026-08-19, not on the row.
 */
const PRIORITY_GLYPH: Record<Priority, string> = {
  none: '',
  low: '!',
  medium: '!',
  high: '!',
}

/** Three literals, never assembled from the level name (§ TaskRow). All four
 * states are distinguished in the accessible name **regardless** of whether they
 * render a glyph, which is the half assertable across the whole set and the half
 * AC-33's 4.1.2 covers (tester W15). */
const PRIORITY_A11Y: Record<Priority, string> = {
  none: '',
  low: 'low priority',
  medium: 'medium priority',
  high: 'high priority',
}

/** Two literals, singular and plural — not a template over a noun (§ TaskRow,
 * L-008's reason). */
function stepsLeftText(n: number): string {
  return n === 1 ? '1 step left' : `${n} steps left`
}

function DiffChips({ line }: { line: DiffLine }) {
  return (
    <span className="row-diff show">
      {line.chips
        .filter((c) => c.old !== null || c.new !== null)
        .map((c, i) => (
          <span key={`${c.field}-${i}`} className="row-diff-pair">
            {c.old !== null && (
              <span className="chip-old" data-testid="assistant-diff-old">
                {c.old}
              </span>
            )}
            {c.old !== null && c.new !== null && <span className="diff-arrow"> → </span>}
            {c.new !== null && (
              <span className="chip-new" data-testid="assistant-diff-new">
                {c.new}
              </span>
            )}
          </span>
        ))}
    </span>
  )
}

function TaskRow({
  task,
  mark,
  flashing,
  flashPhase,
  controller,
  now,
  stepsLeft,
  onOpen,
}: {
  task: TaskView
  mark: DiffLine | null
  /** AC-31's arrival cue — see the note on `.on-arrival` below */
  flashing: boolean
  flashPhase: 'a' | 'b'
  controller: AssistantController
  /** F-005 AC-44 — the injected clock, never a fresh `new Date()`. */
  now: Date
  /** AC-17 — a **different number about a different set**, computed once per
   * render for the whole list and never sourced from `collectionCount` (L-004). */
  stepsLeft: number
  /** AC-1 — activating the row opens its detail in ONE action. */
  onOpen: (taskId: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(task.title)
  const done = task.status === 'done'
  const priority = priorityOf(task)
  const meta =
    task.due_at !== null
      ? // F-005 AC-13 — **a due date set without a time never displays or behaves
        // as a time the user did not choose.** `formatDue` returned a clock time
        // unconditionally for a same-day due, so a task created while viewing Today
        // rendered as **"12:00 AM"** — the behaviour AC-13 forbids, shipped, on the
        // default landing collection. `due_all_day` is what tells a date-only
        // deadline apart from one at midnight, and `null` (NOT DETERMINED) suppresses
        // the clock too: that is the direction AC-13 exists to protect.
        formatDue(task.due_at, now, { allDay: !rendersClockTime(task) })
      : task.local === true
        ? 'saved on this device'
        : null
  // The tint is a MOMENT, not a state: it renders only while an arrival is
  // being announced. A permanent green row in the default rendering would read
  // as a selection and spend the one signal add-green carries (app-shell.html,
  // the note beside `.on-arrival`). The `-a` / `-b` alternation exists so a
  // second tap on the same task restarts the CSS animation rather than
  // inheriting a class that never changed.
  const arrival = flashing ? ` on-arrival on-arrival-${flashPhase}` : ''
  const repeats = seriesLive(task)
  // **The row's accessible name carries every mark** (AC-9, AC-17, AC-39, and
  // AC-33's 4.1.2): all four priority states are distinguished here even though
  // `none` renders no glyph, because one glyph cannot render three levels and
  // 1.4.3 forbids carrying the difference in colour.
  const rowName = [
    task.title,
    PRIORITY_A11Y[priority],
    repeats ? 'repeats' : '',
    stepsLeft > 0 ? stepsLeftText(stepsLeft) : '',
  ]
    .filter((s) => s !== '')
    .join(', ')
  return (
    <li
      className={`task-row${done ? ' done' : ''}${arrival}`}
      data-testid="assistant-task-row"
      data-task-id={task.id}
      aria-label={rowName}
    >
      <Toggle.Root
        className="checkbox"
        data-testid="assistant-task-checkbox"
        pressed={done}
        onPressedChange={() => void controller.toggleTask(task.id)}
        aria-label={`Mark “${task.title}” ${done ? 'not done' : 'done'}`}
      >
        {done ? <CheckIcon /> : null}
      </Toggle.Root>
      <div className="task-main">
        {editing ? (
          <input
            className="task-edit-input rename-input"
            data-testid="tasks-rename-input"
            aria-label="Task name"
            value={draft}
            autoFocus
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                void controller.editTask(task.id, draft)
                setEditing(false)
              }
              if (e.key === 'Escape') {
                setDraft(task.title)
                setEditing(false)
              }
            }}
            onBlur={() => {
              void controller.editTask(task.id, draft)
              setEditing(false)
            }}
          />
        ) : (
          <>
            {/* AC-1 — **activating a task row opens that task's detail in ONE
                action**, and **the activation gesture is distinct from the inline
                rename**: F-001 AC-18 puts an inline rename on this row, so a
                title-tap that opened the detail would take a shipped affordance
                away by collision. The rename keeps the pencil control it already
                has; the title becomes the activation. Keyboard-operable, with
                name/role/value, per AC-33's 2.1.1 and 4.1.2. */}
            <button
              className="task-title task-open"
              data-testid="tasks-row-open"
              aria-label={`Open “${task.title}”`}
              onClick={() => onOpen(task.id)}
            >
              {task.title}
            </button>
            {/* TR-URGENCY — the one item in this line that is not muted, which is
                the "weight" half of *shape, weight, name*. `none` renders NO mark,
                so the marks stay meaningful. */}
            {priority !== 'none' && (
              <span
                className="task-mark task-priority"
                data-testid="tasks-row-priority-mark"
                data-priority={priority}
                aria-hidden="true"
              >
                {PRIORITY_GLYPH[priority]}
              </span>
            )}
            {mark !== null && (
              <span
                className={`badge show ${mark.label === 'new' ? 'badge-new' : 'badge-edited'}`}
                data-testid="assistant-row-badge"
              >
                {mark.label === 'new' ? 'NEW' : 'EDITED'}
              </span>
            )}
            {meta !== null && <span className="task-meta">{meta}</span>}
            {/* TR-REPEAT — AC-39: **a generated successor is never
                indistinguishable from a task the user created.** Read from
                `series_live` on the wire, NEVER keyed off `series_id`: that field is
                assigned when a repeat is first set and never cleared, so a
                predicate built on it passes the positive case and marks every task
                that ever repeated as repeating for good — which on the phone is
                wrong on the only thing that explains the row. */}
            {repeats && (
              <span
                className="task-mark task-repeat"
                data-testid="tasks-row-repeat-mark"
                aria-hidden="true"
              >
                <RepeatIcon />
              </span>
            )}
            {/* TR-STEPS — AC-17, **web only**. A task with no steps shows nothing;
                the count is the remaining set and is never `collectionCount`. */}
            {stepsLeft > 0 && (
              <span
                className="task-mark task-steps"
                data-testid="tasks-row-steps-mark"
                aria-hidden="true"
              >
                <ListChecksIcon />
                <span className="num">{stepsLeft}</span>
              </span>
            )}
            {mark !== null && mark.label === 'edit' && mark.chips.length > 0 && (
              <DiffChips line={mark} />
            )}
          </>
        )}
      </div>
      <span className="row-actions">
        <button
          className="row-action"
          aria-label={`Edit “${task.title}”`}
          onClick={() => {
            setDraft(task.title)
            setEditing(true)
          }}
        >
          <PencilIcon />
        </button>
        <button
          className="row-action row-del"
          data-testid="tasks-delete-button"
          aria-label={`Delete “${task.title}”`}
          onClick={() => void controller.removeTask(task.id)}
        >
          <TrashIcon />
        </button>
      </span>
    </li>
  )
}

/**
 * SK-ROW — checkbox square + a title bar, five rows, under a **heading-shaped
 * bar** on the collections that group and nothing at all on the flat ones
 * (components.md § Skeletons, changed 2026-08-18 T-128).
 *
 * This drew `todayGroupLabel(now)` — the literal `Today · {date}` — over every
 * collection's skeleton. That already contradicted § Skeletons' own rule that
 * skeletons carry no text, and it is a wrong heading on every collection but
 * one: the first heading the read produces is `Overdue` on Today whenever
 * anything is late, `Tomorrow · {date}` on Upcoming, `Overdue` again on Inbox
 * since T-139 — it groups now, and is the only collection that can produce all
 * five — and nothing at all on Done. **A skeleton cannot know which heading the
 * read will produce, so it must not assert one.** The bar mirrors the
 * silhouette, which is all this section ever asked for. `groupsByDay` is the
 * one answer both the skeleton and the read take, so a collection that starts
 * or stops grouping moves both together.
 *
 * No spinner in a void anywhere in this app, and no testid: nothing about a
 * skeleton is assertable except that it is not the empty state.
 */
function TaskSkeletons({ collection }: { collection: Collection }) {
  const widths = ['62%', '48%', '66%', '40%', '56%']
  return (
    <div className="day-group" aria-busy="true">
      {groupsByDay(collection) && <div className="sk sk-head" />}
      <div>
        {widths.map((w) => (
          <div className="sk-rowline" key={w}>
            <div className="sk sk-box" />
            <div className="sk sk-bar" style={{ width: w }} />
          </div>
        ))}
      </div>
    </div>
  )
}

export function TasksSurface({
  state,
  controller,
  shell,
}: {
  state: AppState
  controller: AssistantController
  shell: ShellHandle
}) {
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')
  // F-005 AC-44 — **the injected clock, not an inline `new Date()`.** This was one
  // of the five inline sites the AC counts: a component minting its own instant is
  // a clock the harness cannot hold, and a `setClock` that the list ignores is the
  // *"adopted and unusable by the tier that needs it"* failure (L-014).
  const now = controller.nowDate()
  const collection: Collection = shell.collection
  const tasks = collectionTasks(state.tasks, collection, now)
  // Grouping is per collection: Today gets `Overdue` + `Today · {date}`,
  // Upcoming gets `Tomorrow · {date}` + `Later`, **Inbox can produce all five**
  // — it is a container, so it holds rows from every cell of the date axis —
  // and Done alone renders flat, one unlabelled group with no headings
  // (components.md § TaskList). Today and Inbox therefore draw the same overdue
  // rows under the same `Overdue` heading; that is the two axes showing
  // through, not a duplication bug.
  const groups = groupTasks(tasks, collection, now)
  // components.md's drawn header string — "3 tasks left today" — is TRUE only
  // of the Today collection, and its zero form ("Nothing left today") likewise.
  // On another collection the honest options were to compose a new string or to
  // render none; composing is what L-008 forbids, so the count line is omitted
  // and `Add task` carries the header alone. On Today it is the same call the
  // PathSwitch badge makes, which is the identity § PathSwitch asserts.
  const showCount = collection === 'today'
  const openToday = openTodayCount(state.tasks, now)
  // ── F-005 AC-35, the web trio: `nothingAnywhere` / `loading` / `failedBlank` ──
  //
  // These are three of the **six readers** AC-35 names — and they *"decide behaviour
  // from raw row cardinality and never consult `inCollection`"*, which is exactly
  // why the AC names them separately from the one gate that reaches both clients.
  //
  // **The reading is deliberate and it is the AC's own** (tester-mobile M11,
  // verified by running that account through all three): in the account AC-35
  // names — every parent excluded from the collection on screen, so `collectionTasks`
  // is empty while `state.tasks` is not — `nothingAnywhere` is **false**, so the
  // surface renders the **empty-collection** state and not the first-run one. Telling
  // a user with 40 tasks that they have none is the lie the generic empty state tells.
  //
  // So this stays `state.tasks.length === 0` and is NOT rewritten to read
  // `collectionTasks`: revision 3 offered that as equally satisfying the AC and it
  // is wrong — in the very account the same sentence names, `collectionTasks` is
  // empty, so the surface would return the first-run state the sentence forbids two
  // lines earlier. What DOES change is that steps never reach `collectionTasks` at
  // all (the `inCollection` gate), so a step is never drawn as a top-level row.
  const nothingAnywhere = state.tasks.length === 0
  const loading = state.tasksLoad === 'loading' && state.tasks.length === 0
  // SE-TASKS is only for the case where there is genuinely nothing to show.
  // With anything known, the list is never replaced by an error — it takes the
  // InlineRetryBanner instead and stays editable (components.md §
  // InlineRetryBanner: "a fallback that blanks itself on a network error has
  // failed at the one job it has").
  const failedBlank = state.tasksLoad === 'failed' && nothingAnywhere
  const failedWithContent = state.tasksLoad === 'failed' && !nothingAnywhere

  const commitAdd = () => {
    // Add-in-context (ADR-009 §4): the collection on screen is passed through,
    // and on Today it becomes the row's DATE. Dropping it here is what would
    // make the default landing collection show an empty list right after the
    // user added something to it.
    if (draft.trim() !== '') void controller.addTask(draft, collection)
    setDraft('')
    setAdding(false)
  }

  const showList = !loading && !failedBlank && tasks.length > 0

  return (
    <div className="surface s-tasks">
      <header className="topbar">
        <button
          className="icon-btn hide-wide"
          data-testid="shell-lists-menu-button"
          aria-label="Lists"
          aria-expanded={shell.menuOpen}
          onClick={() => shell.setMenuOpen(!shell.menuOpen)}
        >
          <MenuIcon />
        </button>
        <h1 className="bar-surface-title">{collectionName(collection)}</h1>
        <span className="spacer" />
        {/* shell-search-button and shell-overflow-button: the controls are placed in
            the bar per the mockup (T-227); what sits BEHIND them — the search field,
            the overflow menu — is NOT_BUILT and belongs to a later surface. The buttons
            are inert until that surface ships. */}
        <button
          className="icon-btn"
          data-testid="shell-search-button"
          aria-label="Search"
        >
          <SearchIcon />
        </button>
        <button
          className="icon-btn"
          data-testid="shell-overflow-button"
          aria-label="More"
        >
          <MoreHorizontalIcon />
        </button>
      </header>

      {failedWithContent && (
        <div className="banner banner-retry">
          <AlertIcon />
          Couldn't refresh your tasks — showing what's on this device.
          <button
            className="btn-ghost"
            data-testid="tasks-list-retry-button"
            onClick={() => void controller.refreshTasks()}
          >
            Retry
          </button>
        </div>
      )}

      <div className="tasks-body" ref={shell.tasksRef}>
        <div className="tasks-col">
          {loading && <TaskSkeletons collection={collection} />}

          {failedBlank && (
            <div className="surface-error">
              <h2>Couldn't load your tasks</h2>
              <p>Nothing is saved on this device yet. You can still add one by hand.</p>
              <button
                className="btn-primary"
                data-testid="tasks-list-retry-button"
                onClick={() => void controller.refreshTasks()}
              >
                Retry
              </button>
              {/* `Add task` stays LIVE: the local no-AI path works offline
                  (AC-25), and disabling a working control to look consistent is
                  a lie about what the app can do. */}
              <button className="btn-ghost" onClick={() => setAdding(true)}>
                <PlusIcon />
                Add task
              </button>
            </div>
          )}

          {!loading && !failedBlank && tasks.length === 0 && (
            <TasksEmpty
              collection={collection}
              nothingAnywhere={nothingAnywhere}
              adding={adding}
              draft={draft}
              setDraft={setDraft}
              onCommit={commitAdd}
              onCancel={() => { setDraft(''); setAdding(false) }}
              onActivate={() => setAdding(true)}
            />
          )}

          {showList && (
            <>
              {/* The count line exists to report how many remain; drop it when the
                  answer is none — "0 tasks left today" says what the empty state
                  heading already says. The header button is removed: the inline
                  field at the end of the list is the single add affordance
                  (briefing item 4). */}
              {showCount && openToday > 0 && (
                <div className="tasks-head">
                  <span className="count num">
                    {`${openToday} ${tasksWord(openToday)} left today`}
                  </span>
                </div>
              )}
              {groups.map((g) => (
                <div className="day-group" key={g.label ?? 'flat'}>
                  {/* `null` is the flat collections' instruction, not a missing
                      label: draw the rows and draw no heading. */}
                  {g.label !== null && <div className="day-head">{g.label}</div>}
                  <ul className="tasks">
                    {g.tasks.map((t) => (
                      <TaskRow
                        key={t.id}
                        task={t}
                        mark={state.marks?.byTask[t.id] ?? null}
                        flashing={shell.flashTaskId === t.id}
                        flashPhase={shell.flashPhase}
                        controller={controller}
                        now={now}
                        stepsLeft={remainingSteps(state.tasks, t.id)}
                        onOpen={shell.openDetail}
                      />
                    ))}
                  </ul>
                </div>
              ))}
              {/* Inline new-task row — at the END of the list. Tapping turns
                  it into a text field; Enter creates, Escape/empty cancels.
                  Testid: tasks-inline-add (design mockup catalogue). */}
              <InlineAdd adding={adding} draft={draft} setDraft={setDraft} onCommit={commitAdd} onCancel={() => { setDraft(''); setAdding(false) }} onActivate={() => setAdding(true)} />
            </>
          )}
        </div>
      </div>
      {/* ── TaskBottomBar — fixed field + morphing action (T-321, AC-37) ──────
          Below breakpoints.split only (CSS hides it at split+). A flex:none
          child outside the scroll container, so it never scrolls and the pane
          fills the remaining height above it. The morph fires on the first
          character entering / last character leaving, not on focus/blur. */}
      <TaskBottomBar
        onGoTalk={() => shell.go('talk')}
        onAddTask={(title: string) => {
          void controller.addTask(title, collection)
        }}
      />
    </div>
  )
}

/**
 * Three empty states, because they are three different facts and one message
 * for all of them tells at least two users something untrue (components.md §
 * Empty states — Tasks).
 */
function TasksEmpty({
  collection,
  nothingAnywhere,
  adding,
  draft,
  setDraft,
  onCommit,
  onCancel,
  onActivate,
}: {
  collection: Collection
  nothingAnywhere: boolean
  adding: boolean
  draft: string
  setDraft: (v: string) => void
  onCommit: () => void
  onCancel: () => void
  onActivate: () => void
}) {
  // ET-DONE: no CTA. No action fills this list directly, and inventing one
  // would be a shrug dressed as an invitation.
  if (collection === 'done') {
    return (
      <div className="empty">
        <h2>Nothing completed yet</h2>
      </div>
    )
  }
  if (nothingAnywhere) {
    // ET-FIRST — voice is the primary path. A user who arrived from a broken
    // assistant needs the hand path too, but speaking must not read as the
    // fallback: this is a voice-first app and the first screen should lead
    // with it (T-297, owner note).
    return (
      <div className="empty">
        <h2>No tasks yet</h2>
        <p>Add your first one — or say one, on Talk.</p>
        <InlineAdd adding={adding} draft={draft} setDraft={setDraft} onCommit={onCommit} onCancel={onCancel} onActivate={onActivate} />
      </div>
    )
  }
  // ET-COLLECTION — never ET-FIRST's wording: telling a user with 40 tasks that
  // they have none is the lie the generic empty state tells. The paragraph is
  // dropped: the first clause repeats the heading; the second answers a worry
  // a user standing in Today does not have.
  return (
    <div className="empty">
      <h2>Nothing in {collectionName(collection)}</h2>
      <InlineAdd adding={adding} draft={draft} setDraft={setDraft} onCommit={onCommit} onCancel={onCancel} onActivate={onActivate} />
    </div>
  )
}

/**
 * § InlineAdd — the `+ Add a task` row at the end of the task list.
 *
 * In its resting state it is a clickable row with a plus icon and the label
 * "Add a task". Activating it (click, Enter, Space) replaces the label with a
 * text input. Enter commits (if the title is non-empty after trimming);
 * Escape or blur-with-empty cancels and returns to the resting state.
 *
 * Empty titles are refused: blank, whitespace-only and newline-only all count
 * as empty (F-005 AC-37 applied to creation).
 *
 * Testid: `tasks-inline-add` — from the design mockup catalogue.
 */
function InlineAdd({
  adding,
  draft,
  setDraft,
  onCommit,
  onCancel,
  onActivate,
}: {
  adding: boolean
  draft: string
  setDraft: (v: string) => void
  onCommit: () => void
  onCancel: () => void
  onActivate: () => void
}) {
  if (adding) {
    return (
      <div className="inline-new inline-new-editing" data-testid="tasks-inline-add">
        <span className="plus">
          <PlusIcon />
        </span>
        <input
          className="inline-input"
          aria-label="New task name"
          placeholder="Task name…"
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onCommit()
            if (e.key === 'Escape') onCancel()
          }}
          onBlur={() => {
            // Blur with empty text cancels; blur with content commits.
            if (draft.trim() === '') onCancel()
            else onCommit()
          }}
        />
      </div>
    )
  }
  return (
    <div
      className="inline-new"
      role="button"
      tabIndex={0}
      data-testid="tasks-inline-add"
      aria-label="Add a task"
      onClick={onActivate}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onActivate()
        }
      }}
    >
      <span className="plus">
        <PlusIcon />
      </span>
      <span className="inline-label">Add a task</span>
    </div>
  )
}

/**
 * § TaskBottomBar — the canonical add-task and Talk-navigation control below
 * `breakpoints.split` (AC-37). One fixed bottom row holding a text field and a
 * single action button that morphs between two identities depending on whether
 * the field has text.
 *
 * **When the field is empty:** mic icon, accessible name "Talk", tapping
 * navigates to the Talk surface. Does NOT start capture.
 * **When the field holds text:** send arrow, accessible name "Add task", tapping
 * commits the title through the literal add path (controller.addTask).
 *
 * The morph fires on the first character entering or the last character leaving
 * the field, not on focus or blur (AC-37).
 *
 * Testids: `tasks-bar-input` (the text field), `tasks-bar-action` (the
 * morphing button) — from the design mockup catalogue (T-321).
 */
function TaskBottomBar({
  onGoTalk,
  onAddTask,
}: {
  onGoTalk: () => void
  onAddTask: (title: string) => void
}) {
  const [text, setText] = useState('')
  const hasText = text.length > 0

  const handleSubmit = () => {
    const trimmed = text.trim()
    if (trimmed === '') return
    onAddTask(trimmed)
    setText('')
  }

  return (
    <div className="task-bar">
      <div className="task-bar-in">
        <input
          className="tbar-input"
          type="text"
          placeholder="Add a task"
          aria-label="Add a task"
          data-testid="tasks-bar-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSubmit()
          }}
        />
        <button
          className={`tbar-action${hasText ? ' tbar-action-send' : ''}`}
          data-testid="tasks-bar-action"
          aria-label={hasText ? 'Add task' : 'Talk'}
          onClick={() => {
            if (hasText) handleSubmit()
            else onGoTalk()
          }}
        >
          {hasText ? <SendIcon /> : <MicIcon />}
        </button>
      </div>
    </div>
  )
}
