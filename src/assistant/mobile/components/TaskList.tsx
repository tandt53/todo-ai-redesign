// The list body of S2 Tasks — rows, day groups, skeletons and the three empty
// states. The surface chrome around it is `TasksSurface.tsx`.
//
// F-001 AC-18 lives here and, since this build, **all four of its operations
// do**: create, complete, rename and delete, by direct touch, with zero AI
// calls. Mobile shipped two of the four until now while `F-003 ## Parity`
// listed AC-18 among the ACs that "hold identically" (`uc-coverage-map.md` D8).
// The shared controller has had `editTask` and `removeTask` all along and web
// called both; wiring them here is that divergence closing, not new behaviour.
//
// Two renderings differ from web because touch is not hover (components.md
// § Platform variants, and both differences are forced rather than stylistic):
//   - the delete control is ALWAYS VISIBLE in the row's trailing slot. A
//     hover-revealed control does not exist on touch, and hiding it behind a
//     gesture would publish an id no user can reach.
//   - rename is entered by TAPPING THE TITLE. A second per-row button would
//     crowd the delete target at 44/48.

import { useRef, useState } from 'react'
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import type { ScrollView as ScrollViewType, TextInput as TextInputType } from 'react-native'
import { Check, Plus, Repeat, Trash2 } from 'lucide-react-native'
import type { AppState } from '../../_shared/model/reducer.ts'
import { formatDue } from '../../_shared/model/format.ts'
import { priorityOf, rendersClockTime, seriesLive } from '../../_shared/model/task-fields.ts'
import type { DiffLine, Priority, TaskView } from '../../_shared/types.ts'
import type { MobileAssistantController } from '../controller.ts'
import { A11Y_IDS, SHELL_A11Y_IDS, a11yProps } from '../model/a11y.ts'
import type { MobilePlatform } from '../model/permissions.ts'
import { spacing, tokens } from '../model/theme.ts'
import { minTouchSize, touchProps } from '../model/touch.ts'
import {
  EMPTY_TASKS,
  collectionName,
  fillListSlot,
  groupTasks,
  groupsByDay,
} from '../model/tasks-view.ts'
import type { Collection, TasksSurfaceView } from '../model/tasks-view.ts'
import { useStyles } from './styles.ts'

/**
 * `components.md § TaskRow → The row's mark budget`, TR-URGENCY's accessible
 * name: **four literals, never assembled from the level name.**
 *
 * All four states are distinguished in the accessible name **regardless** of
 * whether they render a glyph (AC-9's own clause, AC-33's 4.1.2) — which is the
 * half assertable across the whole set. Three of the four render no element at
 * all, so the name lives on the **row**, not on a mark that exists only in the
 * `high` state.
 *
 * The cost of the clause is honest and design states it: an unmarked row
 * announces `no priority`, a word on every row that has none. It is here because
 * the AC requires it.
 */
const PRIORITY_A11Y: Record<Priority, string> = {
  none: 'no priority',
  low: 'low priority',
  medium: 'medium priority',
  high: 'high priority',
}

function TaskRow({
  task,
  mark,
  arrived,
  controller,
  platform,
  now,
}: {
  task: TaskView
  mark: DiffLine | null
  arrived: boolean
  controller: MobileAssistantController
  platform: MobilePlatform
  /** F-005 AC-44 — one clock for the whole render, the controller's. */
  now: Date
}) {
  const { styles, colors } = useStyles()
  const [renaming, setRenaming] = useState(false)
  const [draft, setDraft] = useState(task.title)
  const done = task.status === 'done'
  const priority = priorityOf(task)
  const repeats = seriesLive(task)
  const meta =
    task.due_at !== null
      ? // ── F-005 AC-13, and the behaviour it forbids was already shipped here ──
        // `formatDue` returned a clock time unconditionally for a same-day due, and
        // `dueAtForCollection('today')` writes **local midnight** for every task
        // created while viewing Today — the default landing collection. So those
        // rows rendered as **"12:00 AM"**: a time the user never picked, on the
        // phone as well as on web, which is why AC-13 carries `(mobile)`.
        //
        // `due_all_day` is what tells a date-only deadline from one at midnight,
        // and `null` (NOT DETERMINED) suppresses the clock too — that is the
        // direction AC-13 exists to protect, so `rendersClockTime` prints a clock
        // only for an explicit `false`.
        formatDue(task.due_at, now, { allDay: !rendersClockTime(task) })
      : task.local === true
        ? 'saved on the device'
        : null
  // ── AC-9 + AC-39 — the row's accessible name carries every mark ─────────────
  // The mobile bound for both is an accessible-name assertion on the EXISTING
  // `taskRow` id: `F-003`'s catalogue is closed and structurally asserted, and
  // neither mark is a control, so neither is owed a new id (platform mobile.md).
  //
  // AC-9's `(mobile)` reason is the owner's voice answer, not a mobile surface:
  // AC-36 makes `priority` settable by voice and the turn path runs on both
  // clients, so a phone user can say *"make this high priority"*, have the write
  // succeed, and find the phone byte-identical afterwards — the write-only data
  // path AC-38 exists to close, rebuilt for a different field.
  //
  // AC-39 is read from the wire's `series_live` and **never keyed off
  // `series_id`**, which is never cleared: that predicate passes the positive case
  // and marks every ex-repeating task forever. `seriesLive` is `_shared/`'s single
  // reader, so all four of AC-25's endings are the server's to evaluate.
  //
  // TR-STEPS is **web only** (§ TaskRow), so the phone's name carries two marks.
  const rowName = [task.title, PRIORITY_A11Y[priority], repeats ? 'repeats' : '']
    .filter((s) => s !== '')
    .join(', ')
  const rowTouch = touchProps(A11Y_IDS.taskRow, platform)
  const boxTouch = touchProps(A11Y_IDS.taskCheckbox, platform)
  const delTouch = touchProps(SHELL_A11Y_IDS.tasksDeleteButton, platform)

  const commitRename = () => {
    setRenaming(false)
    // `editTask` is a no-op on an unchanged or empty title, so the cancel case
    // needs no branch here.
    void controller.editTask(task.id, draft)
  }

  return (
    <View
      {...a11yProps(A11Y_IDS.taskRow, { label: rowName })}
      style={[styles.taskRow, arrived ? styles.rowArrived : null]}
      hitSlop={rowTouch.hitSlop}
    >
      <Pressable
        {...a11yProps(A11Y_IDS.taskCheckbox, {
          label: `Mark “${task.title}” as ${done ? 'not done' : 'done'}`,
          role: 'checkbox',
          state: { checked: done },
        })}
        hitSlop={boxTouch.hitSlop}
        style={[styles.checkbox, done ? styles.checkboxDone : null]}
        onPress={() => void controller.toggleTask(task.id)}
      >
        {done ? (
          <Check size={tokens.icon.size.sm} color={colors.bg.base} strokeWidth={tokens.icon.stroke} />
        ) : null}
      </Pressable>

      {renaming ? (
        <TextInput
          {...a11yProps(SHELL_A11Y_IDS.tasksRenameInput, { label: 'Task name' })}
          style={styles.renameInput}
          value={draft}
          autoFocus
          onChangeText={setDraft}
          onSubmitEditing={commitRename}
          onBlur={commitRename}
        />
      ) : (
        <Pressable
          accessibilityLabel={`Rename “${task.title}”`}
          accessibilityRole="button"
          style={{ flex: 1 }}
          onPress={() => {
            setDraft(task.title)
            setRenaming(true)
          }}
        >
          <Text style={[styles.taskTitle, done ? styles.taskTitleDone : null]}>{task.title}</Text>
          {mark !== null && (
            // AC-4's row-level marker carries a TEXT label, never colour alone.
            <Text
              {...a11yProps(A11Y_IDS.rowBadge)}
              style={[styles.badge, mark.label === 'new' ? styles.badgeNew : styles.badgeEdited]}
            >
              {mark.label === 'new' ? 'NEW' : 'EDITED'}
            </Text>
          )}
          {/* § TaskRow's mark budget, in its fixed order:
                title · urgency · deadline · repeat · (steps — web only).
              Neither mark carries colour: the accent set is closed at five and
              every one already has an assigned meaning, this row already renders
              under a `danger` Overdue heading, and urgency has levels a single hue
              cannot encode. Each is shape, weight and its accessible name — which
              is what AC-33's 1.4.3 requires of it regardless. */}
          <View style={styles.rowMarks}>
            {/* TR-URGENCY — **a single `!`, and only `high` wears it.** AC-9 fixes
                the vocabulary at one glyph, deliberately *"not Apple's graduated
                `!` / `!!` / `!!!`"*, and 1.4.3 forbids carrying the level in
                colour; one glyph cannot render three levels perceivably, so
                `none`, `low` and `medium` render nothing and all four states are
                distinguished in the row's name instead. */}
            {priority === 'high' && (
              <Text style={styles.urgencyMark} accessibilityElementsHidden importantForAccessibility="no">
                !
              </Text>
            )}
            {meta !== null && <Text style={styles.taskMeta}>{meta}</Text>}
            {/* TR-REPEAT — Lucide `repeat`, `text.muted`, on a row belonging to a
                LIVE series. It explains where a row the user never typed came
                from, which is the whole of AC-39. */}
            {repeats && (
              <Repeat
                size={tokens.icon.size.sm}
                color={colors.text.muted}
                strokeWidth={tokens.icon.stroke}
              />
            )}
          </View>
        </Pressable>
      )}

      <Pressable
        {...a11yProps(SHELL_A11Y_IDS.tasksDeleteButton, {
          label: `Delete “${task.title}”`,
          role: 'button',
        })}
        hitSlop={delTouch.hitSlop}
        style={styles.rowDelete}
        onPress={() => void controller.removeTask(task.id)}
      >
        <Trash2 size={tokens.icon.size.sm} color={colors.text.muted} strokeWidth={tokens.icon.stroke} />
      </Pressable>
    </View>
  )
}

/** components.md § Skeletons, SK-ROW: the row's own silhouette under a real day
 * header, five of them. No spinner, no text, no testid — "nothing about them is
 * assertable except that they are not the empty state". */
function RowSkeletons() {
  const { styles } = useStyles()
  return (
    <View>
      {[62, 48, 66, 40, 56].map((w, i) => (
        <View key={i} style={styles.skeletonRow}>
          <View style={styles.skeletonBox} />
          <View style={[styles.skeletonBar, { width: `${w}%` }]} />
        </View>
      ))}
    </View>
  )
}

function EmptyState({
  view,
  collection,
  platform,
  onAdd,
}: {
  view: TasksSurfaceView
  collection: Collection
  platform: MobilePlatform
  onAdd: () => void
}) {
  const { styles, colors } = useStyles()
  const row = view.empty
  if (row === null) return null
  const copy = EMPTY_TASKS[row]
  const { hitSlop } = touchProps(SHELL_A11Y_IDS.tasksEmptyAddButton, platform)
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyHead}>{fillListSlot(copy.head, collection)}</Text>
      {copy.body !== null && <Text style={styles.emptyBody}>{copy.body}</Text>}
      {copy.action !== null && (
        <Pressable
          {...a11yProps(SHELL_A11Y_IDS.tasksEmptyAddButton, { label: copy.action, role: 'button' })}
          hitSlop={hitSlop}
          style={styles.primaryButton}
          onPress={onAdd}
        >
          <Plus size={tokens.icon.size.sm} color={colors.text.onAccent} strokeWidth={tokens.icon.stroke} />
          <Text style={styles.primaryButtonText}>{copy.action}</Text>
        </Pressable>
      )}
      {copy.secondDoor !== null && <Text style={styles.secondDoor}>{copy.secondDoor}</Text>}
    </View>
  )
}

/**
 * § InlineAdd — the `+ Add a task` row at the END of the task list.
 *
 * Ported from web's `TasksSurface.tsx § InlineAdd`. In its resting state it is
 * a tappable row with a plus icon and the label "Add a task". Tapping replaces
 * the label with a text input. Submit (keyboard return) commits if non-empty;
 * blur-with-empty cancels and returns to the resting state; blur-with-content
 * commits — the same rule the existing rename uses.
 *
 * Empty, whitespace-only and newline-only are all refused (web parity).
 *
 * Testid: `tasks-inline-add` — from `SHELL_A11Y_IDS`, never invented.
 */
function InlineAdd({
  adding,
  draft,
  setDraft,
  onCommit,
  onCancel,
  onActivate,
  platform,
}: {
  adding: boolean
  draft: string
  setDraft: (v: string) => void
  onCommit: () => void
  onCancel: () => void
  onActivate: () => void
  platform: MobilePlatform
}) {
  const { styles, colors } = useStyles()

  if (adding) {
    return (
      <View
        {...a11yProps(SHELL_A11Y_IDS.tasksInlineAdd, { label: 'New task name' })}
        style={[styles.inlineAdd, styles.inlineAddEditing]}
      >
        <Plus size={tokens.icon.size.sm} color={colors.text.muted} strokeWidth={tokens.icon.stroke} />
        <TextInput
          accessibilityLabel="New task name"
          placeholder="Task name…"
          placeholderTextColor={colors.text.muted}
          style={styles.inlineAddInput}
          value={draft}
          autoFocus
          onChangeText={setDraft}
          onSubmitEditing={onCommit}
          onBlur={() => {
            // Blur with content commits; blur with empty cancels — the same
            // rule the existing rename uses (web parity).
            if (draft.trim() === '') onCancel()
            else onCommit()
          }}
        />
      </View>
    )
  }

  return (
    <Pressable
      {...a11yProps(SHELL_A11Y_IDS.tasksInlineAdd, { label: 'Add a task', role: 'button' })}
      style={[styles.inlineAdd, minTouchSize(platform)]}
      onPress={onActivate}
    >
      <Plus size={tokens.icon.size.sm} color={colors.text.muted} strokeWidth={tokens.icon.stroke} />
      <Text style={styles.inlineAddLabel}>Add a task</Text>
    </Pressable>
  )
}

export function TaskList({
  state,
  view,
  collection,
  controller,
  platform,
  arrivedTaskId,
  adding,
  draft,
  setDraft,
  onCommit,
  onCancel,
  onActivate,
  onAdd,
}: {
  state: AppState
  view: TasksSurfaceView
  collection: Collection
  controller: MobileAssistantController
  platform: MobilePlatform
  /** AC-31's arrival target — flashed once, then cleared by the surface after
   * `flashDurationMs()`. */
  arrivedTaskId: string | null
  /** Whether the inline add row is in editing mode. */
  adding: boolean
  draft: string
  setDraft: (v: string) => void
  onCommit: () => void
  onCancel: () => void
  onActivate: () => void
  onAdd: () => void
}) {
  const { styles } = useStyles()
  const scrollRef = useRef<ScrollViewType>(null)
  // ONE clock for this render. The grouping is day-sensitive since ADR-009
  // § Amendment — `Overdue` and `Today · {date}` are decided by which calendar
  // day it is — and this file used to mint a second `new Date()` inline for the
  // grouping while the skeleton's header read a third. Two clocks in one render
  // can straddle midnight and put the same row under two headings.
  // F-005 AC-44 — the injected seam. This was the other mobile inline site the AC
  // counts: the single render clock that decides the Overdue/Today grouping. The
  // note below about "two clocks in one render" was already this file's own
  // argument; AC-44 extends it from two clocks in one render to two clocks on one
  // client, and the controller's is the one that wins.
  const now = controller.nowDate()

  if (view.view === 'loading') {
    return (
      <ScrollView keyboardShouldPersistTaps="handled">
        {/* SK-ROW sat under a REAL day header — the literal `Today · {date}` —
            which § Skeletons' own rule already forbade (skeletons carry no
            text) and the collections made wrong: the first heading is
            `Overdue` on Today whenever anything is late, `Tomorrow · {date}` on
            Upcoming, `Overdue` again on Inbox since T-139 (it groups now, and
            can produce all five headings), and nothing at all on Done. A
            skeleton cannot know which heading the read will produce, so it
            draws a heading-shaped BAR where one will go — and nothing on the
            one collection that renders flat. */}
        {groupsByDay(collection) && <View style={styles.skeletonDayHead} />}
        <RowSkeletons />
      </ScrollView>
    )
  }

  if (view.tasks.length === 0) {
    return (
      <ScrollView keyboardShouldPersistTaps="handled">
        {/* Hide the empty state while the standalone add field is open: a CTA
            offering to do the thing the user is already doing is noise. */}
        {!adding && (
          <EmptyState view={view} collection={collection} platform={platform} onAdd={onAdd} />
        )}
      </ScrollView>
    )
  }

  return (
    <ScrollView
      ref={scrollRef}
      keyboardShouldPersistTaps="handled"
      onContentSizeChange={() => {
        // When the inline add input opens, scroll to the bottom so the row
        // stays visible above the keyboard.
        if (adding) scrollRef.current?.scrollToEnd({ animated: true })
      }}
    >
      {/* Grouping is per collection: Today gets `Overdue` + `Today · {date}`,
          Upcoming gets `Tomorrow · {date}` + `Later`, and Inbox and Done render
          FLAT — one unlabelled group and no headings at all (components.md
          § TaskList). `label: null` is that instruction, not a missing label. */}
      {groupTasks(view.tasks, collection, now).map((g) => (
        <View key={g.label ?? 'flat'}>
          {g.label !== null && <Text style={styles.dayHead}>{g.label}</Text>}
          {g.tasks.map((t) => (
            <TaskRow
              now={now}
              key={t.id}
              task={t}
              mark={state.marks?.byTask[t.id] ?? null}
              arrived={t.id === arrivedTaskId}
              controller={controller}
              platform={platform}
            />
          ))}
        </View>
      ))}
      {/* Inline new-task row — at the END of the list, matching the web
          surface. Only shown when the list has content; the empty state keeps
          its own CTA because an end-of-list row has no list to sit at the end
          of. */}
      <InlineAdd
        adding={adding}
        draft={draft}
        setDraft={setDraft}
        onCommit={onCommit}
        onCancel={onCancel}
        onActivate={onActivate}
        platform={platform}
      />
    </ScrollView>
  )
}
