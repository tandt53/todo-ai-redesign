// S2 · TASKS — the whole todo, by hand.
//
// It used to be a PANE beside the conversation. It is now a SURFACE: the app's
// other half and `todo-ai ADR-11`'s second path, one action away below the
// split and permanently in the centre at or above it
// (information-architecture.md §1, §1a). Nothing about the operations changed —
// AC-18's four still run through `controller.addTask / toggleTask / editTask /
// removeTask` with zero AI calls; what changed is where they happen.
//
// Copy is transcribed from design/_shared/components.md and the app-shell
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
import type { ShellHandle } from '../shell.ts'
import { AlertIcon, CheckIcon, MenuIcon, PencilIcon, PlusIcon, TrashIcon } from './icons.tsx'
import { PathSwitch } from './Chrome.tsx'

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
}: {
  task: TaskView
  mark: DiffLine | null
  /** AC-31's arrival cue — see the note on `.on-arrival` below */
  flashing: boolean
  flashPhase: 'a' | 'b'
  controller: AssistantController
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(task.title)
  const done = task.status === 'done'
  const meta =
    task.due_at !== null
      ? formatDue(task.due_at)
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
  return (
    <li
      className={`task-row${done ? ' done' : ''}${arrival}`}
      data-testid="assistant-task-row"
      data-task-id={task.id}
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
            <span className="task-title">{task.title}</span>
            {mark !== null && (
              <span
                className={`badge show ${mark.label === 'new' ? 'badge-new' : 'badge-edited'}`}
                data-testid="assistant-row-badge"
              >
                {mark.label === 'new' ? 'NEW' : 'EDITED'}
              </span>
            )}
            {meta !== null && <span className="task-meta">{meta}</span>}
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
 * skeletons carry no text; under four buckets it is a wrong heading on three
 * collections and a coin-flip on the fourth, because the first heading the read
 * produces is `Overdue` on Today whenever anything is late, `Tomorrow · {date}`
 * on Upcoming, and nothing at all on Inbox and Done. **A skeleton cannot know
 * which heading the read will produce, so it must not assert one.** The bar
 * mirrors the silhouette, which is all this section ever asked for.
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
  const now = new Date()
  const collection: Collection = shell.collection
  const tasks = collectionTasks(state.tasks, collection, now)
  // Grouping is per collection now: Today gets `Overdue` + `Today · {date}`,
  // Upcoming gets `Tomorrow · {date}` + `Later`, and Inbox and Done render
  // flat — one unlabelled group, no headings (components.md § TaskList).
  const groups = groupTasks(tasks, collection, now)
  // components.md's drawn header string — "3 tasks left today" — is TRUE only
  // of the Today collection, and its zero form ("Nothing left today") likewise.
  // On another collection the honest options were to compose a new string or to
  // render none; composing is what L-008 forbids, so the count line is omitted
  // and `Add task` carries the header alone. On Today it is the same call the
  // PathSwitch badge makes, which is the identity § PathSwitch asserts.
  const showCount = collection === 'today'
  const openToday = openTodayCount(state.tasks, now)
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
          className="icon-btn"
          data-testid="shell-lists-menu-button"
          aria-label="Lists"
          aria-expanded={shell.menuOpen}
          onClick={() => shell.setMenuOpen(!shell.menuOpen)}
        >
          <MenuIcon />
        </button>
        <h1>{collectionName(collection)}</h1>
        <span className="spacer" />
        <PathSwitch to="talk" onGo={() => shell.go('talk')} />
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
          {adding && (
            <div className="add-form">
              <input
                className="add-input"
                aria-label="New task name"
                placeholder="Task name…"
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitAdd()
                  if (e.key === 'Escape') {
                    setDraft('')
                    setAdding(false)
                  }
                }}
              />
              <button className="add-save" onClick={commitAdd}>
                Save
              </button>
            </div>
          )}

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
              onAdd={() => setAdding(true)}
            />
          )}

          {showList && (
            <>
              <div className="tasks-head">
                {showCount && (
                  <span className="count num">
                    {openToday === 0
                      ? 'Nothing left today'
                      : `${openToday} ${tasksWord(openToday)} left today`}
                  </span>
                )}
                <button
                  className="add-btn"
                  data-testid="assistant-add-task-button"
                  onClick={() => setAdding(true)}
                >
                  <PlusIcon />
                  Add task
                </button>
              </div>
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
                      />
                    ))}
                  </ul>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
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
  onAdd,
}: {
  collection: Collection
  nothingAnywhere: boolean
  onAdd: () => void
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
    // ET-FIRST — both doors: a user who arrived from a broken assistant needs
    // the hand path, a user who arrived by curiosity needs to know the fast one
    // exists.
    return (
      <div className="empty">
        <h2>No tasks yet</h2>
        <p>Add one by hand and it lands right here.</p>
        <button className="btn-primary" data-testid="tasks-empty-add-button" onClick={onAdd}>
          <PlusIcon />
          Add task
        </button>
        <p className="second-door">Or say one, on Talk.</p>
      </div>
    )
  }
  // ET-COLLECTION — never ET-FIRST's wording: telling a user with 40 tasks that
  // they have none is the lie the generic empty state tells.
  return (
    <div className="empty">
      <h2>Nothing in {collectionName(collection)}</h2>
      <p>This list is empty. Your other tasks are still where you left them.</p>
      <button className="btn-primary" data-testid="tasks-empty-add-button" onClick={onAdd}>
        <PlusIcon />
        Add task
      </button>
    </div>
  )
}
