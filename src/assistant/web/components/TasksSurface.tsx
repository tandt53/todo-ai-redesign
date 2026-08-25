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

import { useEffect, useRef, useState } from 'react'
import * as Toggle from '@radix-ui/react-toggle'
import type { AssistantController } from '../../_shared/controller.ts'
import type { AppState } from '../../_shared/model/reducer.ts'
import type { DiffLine, TaskView } from '../../_shared/types.ts'
import { formatDue } from '../../_shared/model/format.ts'
import {
  collectionName,
  collectionTasks,
  groupTasks,
  groupsByDay,
} from '../../_shared/model/tasks.ts'
import type { Collection } from '../../_shared/model/tasks.ts'
import { priorityOf, remainingSteps, rendersClockTime, seriesLive } from '../../_shared/model/task-fields.ts'
import type { Priority } from '../../_shared/types.ts'
import type { ShellHandle } from '../shell.ts'
import {
  AlertIcon,
  CheckIcon,
  CloseIcon,
  ListChecksIcon,
  MenuIcon,
  MicIcon,
  MoreHorizontalIcon,

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
        {/* AC-1 — **activating a task row opens that task's detail in ONE
            action.** The title is part of region (b): it opens the detail,
            same as clicking anywhere else on the row outside the checkbox.
            Inline rename is retired (owner decision 2026-08-25, AC-34
            amendment); renaming lives on the detail surface (F-005 AC-37).
            Keyboard-operable, with name/role/value, per AC-33's 2.1.1 and
            4.1.2. */}
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
      </div>
      <span className="row-actions">
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
  // `adding` / `draft` state REMOVED (T-359): was InlineAdd only. TaskBottomBar
  // manages its own text state internally.
  // ── F-009 AC-1, AC-2, AC-3, AC-14 — Search ──
  // Search replaces the title, it does not add a layer (components.md §
  // SearchField). The field expands from `shell-search-button`, takes focus,
  // and narrows the list with every keystroke.
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)

  // AC-14 — `/` or the platform find shortcut (`Cmd+F` / `Ctrl+F`) focuses the
  // search field from anywhere on the Tasks surface.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Platform find shortcut: Cmd+F (Mac) or Ctrl+F (others)
      if (e.key === 'f' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setSearchOpen(true)
        searchRef.current?.focus()
        return
      }
      // `/` shortcut — ignore when an input/textarea already has focus
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.key === '/') {
        e.preventDefault()
        setSearchOpen(true)
        searchRef.current?.focus()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  const closeSearch = () => {
    setSearchOpen(false)
    setSearchQuery('')
  }

  // F-005 AC-44 — **the injected clock, not an inline `new Date()`.** This was one
  // of the five inline sites the AC counts: a component minting its own instant is
  // a clock the harness cannot hold, and a `setClock` that the list ignores is the
  // *"adopted and unusable by the tier that needs it"* failure (L-014).
  const now = controller.nowDate()
  const collection: Collection = shell.collection
  const allTasks = collectionTasks(state.tasks, collection, now)
  // F-009 AC-2 — live filtering by title only. Case-insensitive substring.
  // A done row whose title matches IS visible (§ SearchField: "the mockup
  // filters by `.row-title` text, not by `.done` class"). `hide_completed`
  // does not exist yet, so the `false` branch applies — all matching rows show.
  const tasks = searchOpen && searchQuery !== ''
    ? allTasks.filter((t) => t.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : allTasks
  // Grouping is per collection: Today gets `Overdue` + `Today · {date}`,
  // Upcoming gets `Tomorrow · {date}` + `Later`, **Inbox can produce all five**
  // — it is a container, so it holds rows from every cell of the date axis —
  // and Done alone renders flat, one unlabelled group with no headings
  // (components.md § TaskList). Today and Inbox therefore draw the same overdue
  // rows under the same `Overdue` heading; that is the two axes showing
  // through, not a duplication bug.
  const groups = groupTasks(tasks, collection, now)
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

  // `commitAdd` REMOVED (T-359): was InlineAdd only. TaskBottomBar handles its
  // own add-in-context (ADR-009 §4) through its onAddTask prop.

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
        {/* F-009 AC-1 — Search replaces the title, not a separate layer. When
            open the surface title hides; in its place the search field spans
            the available header width with a close control at its trailing edge
            (components.md § SearchField). */}
        {searchOpen ? (
          <>
            <input
              ref={searchRef}
              className="search-field"
              data-testid="tasks-search-input"
              type="text"
              placeholder="Search tasks"
              aria-label="Search tasks"
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') closeSearch()
              }}
            />
            <button
              className="icon-btn search-close"
              data-testid="tasks-search-close"
              aria-label="Close search"
              onClick={closeSearch}
            >
              <CloseIcon />
            </button>
          </>
        ) : (
          <>
            <h1 className="bar-surface-title">{collectionName(collection)}</h1>
            <span className="spacer" />
            <button
              className="icon-btn"
              data-testid="shell-search-button"
              aria-label="Search"
              onClick={() => setSearchOpen(true)}
            >
              <SearchIcon />
            </button>
            {/* shell-overflow-button: the overflow menu behind it is NOT_BUILT
                (T-244). The button is inert until that surface ships. */}
            <button
              className="icon-btn"
              data-testid="shell-overflow-button"
              aria-label="More"
            >
              <MoreHorizontalIcon />
            </button>
          </>
        )}
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
              {/* `Add task` is the bottom bar (TaskBottomBar), always visible
                  below this scroll pane — the local no-AI path works offline
                  (AC-25). InlineAdd retired T-359. */}
            </div>
          )}

          {/* F-009 AC-3 — zero matches shows an empty state naming the query.
              This renders in the list area below the header while the search
              field remains open above it. No CTA — the close control is already
              on screen (components.md § Empty states — Search). */}
          {searchOpen && searchQuery !== '' && tasks.length === 0 && !loading && !failedBlank && (
            <div className="empty" data-testid="tasks-no-results">
              <h2>No tasks matching &ldquo;{searchQuery}&rdquo;</h2>
            </div>
          )}

          {!loading && !failedBlank && tasks.length === 0 && !(searchOpen && searchQuery !== '') && (
            <TasksEmpty
              collection={collection}
              nothingAnywhere={nothingAnywhere}
            />
          )}

          {showList && (
            <>
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
              {/* InlineAdd RETIRED (T-359, owner decision 2026-08-25).
                  TaskBottomBar is the sole add-task mechanism at every width. */}
            </>
          )}
        </div>
      </div>
      {/* ── TaskBottomBar — fixed field + morphing action (T-321, AC-37) ──────
          At every width (T-359: InlineAdd retired; TaskBottomBar is the sole
          add-task mechanism). A flex:none child outside the scroll container,
          so it never scrolls and the pane fills the remaining height above it.
          The morph fires on the first character entering / last character
          leaving, not on focus/blur. */}
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
}: {
  collection: Collection
  nothingAnywhere: boolean
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
    // InlineAdd retired (T-359) — TaskBottomBar below is the add mechanism.
    return (
      <div className="empty">
        <h2>No tasks yet</h2>
        <p>Add your first one — or say one, on Talk.</p>
      </div>
    )
  }
  // ET-COLLECTION — never ET-FIRST's wording: telling a user with 40 tasks that
  // they have none is the lie the generic empty state tells. The paragraph is
  // dropped: the first clause repeats the heading; the second answers a worry
  // a user standing in Today does not have.
  // InlineAdd retired (T-359) — TaskBottomBar below is the add mechanism.
  return (
    <div className="empty">
      <h2>Nothing in {collectionName(collection)}</h2>
    </div>
  )
}

/* § InlineAdd — RETIRED (T-359, owner decision 2026-08-25).
 * TaskBottomBar (below) is the sole add-task mechanism at every width.
 * The testid `tasks-inline-add` is removed from the codebase. */

/**
 * § TaskBottomBar — the canonical add-task and Talk-navigation control at every
 * width (T-359: InlineAdd retired; AC-37). One fixed bottom row holding a text
 * field and a single action button that morphs between two identities depending
 * on whether the field has text.
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
