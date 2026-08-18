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

import { useState } from 'react'
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { Check, Plus, Trash2 } from 'lucide-react-native'
import type { AppState } from '../../_shared/model/reducer.ts'
import { formatDue } from '../../_shared/model/format.ts'
import type { DiffLine, TaskView } from '../../_shared/types.ts'
import type { MobileAssistantController } from '../controller.ts'
import { A11Y_IDS, SHELL_A11Y_IDS, a11yProps } from '../model/a11y.ts'
import type { MobilePlatform } from '../model/permissions.ts'
import { tokens } from '../model/theme.ts'
import { touchProps } from '../model/touch.ts'
import {
  EMPTY_TASKS,
  collectionName,
  fillListSlot,
  groupTasks,
  groupsByDay,
} from '../model/tasks-view.ts'
import type { Collection, TasksSurfaceView } from '../model/tasks-view.ts'
import { useStyles } from './styles.ts'

function TaskRow({
  task,
  mark,
  arrived,
  controller,
  platform,
}: {
  task: TaskView
  mark: DiffLine | null
  arrived: boolean
  controller: MobileAssistantController
  platform: MobilePlatform
}) {
  const { styles, colors } = useStyles()
  const [renaming, setRenaming] = useState(false)
  const [draft, setDraft] = useState(task.title)
  const done = task.status === 'done'
  const meta =
    task.due_at !== null
      ? formatDue(task.due_at)
      : task.local === true
        ? 'saved on the device'
        : null
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
      {...a11yProps(A11Y_IDS.taskRow)}
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
          <Check size={tokens.icon.size.sm} color={colors.success} strokeWidth={tokens.icon.stroke} />
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
          {meta !== null && <Text style={styles.taskMeta}>{meta}</Text>}
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

export function TaskList({
  state,
  view,
  collection,
  controller,
  platform,
  arrivedTaskId,
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
  onAdd: () => void
}) {
  const { styles } = useStyles()
  // ONE clock for this render. The grouping is day-sensitive since ADR-009
  // § Amendment — `Overdue` and `Today · {date}` are decided by which calendar
  // day it is — and this file used to mint a second `new Date()` inline for the
  // grouping while the skeleton's header read a third. Two clocks in one render
  // can straddle midnight and put the same row under two headings.
  const now = new Date()

  if (view.view === 'loading') {
    return (
      <ScrollView keyboardShouldPersistTaps="handled">
        {/* SK-ROW sat under a REAL day header — the literal `Today · {date}` —
            which § Skeletons' own rule already forbade (skeletons carry no
            text) and the four buckets made wrong: the first heading is
            `Overdue` on Today whenever anything is late, `Tomorrow · {date}` on
            Upcoming, and nothing at all on Inbox and Done. A skeleton cannot
            know which heading the read will produce, so it draws a
            heading-shaped BAR where one will go — and nothing on the
            collections that render flat. */}
        {groupsByDay(collection) && <View style={styles.skeletonDayHead} />}
        <RowSkeletons />
      </ScrollView>
    )
  }

  if (view.tasks.length === 0) {
    return (
      <ScrollView keyboardShouldPersistTaps="handled">
        <EmptyState view={view} collection={collection} platform={platform} onAdd={onAdd} />
      </ScrollView>
    )
  }

  return (
    <ScrollView keyboardShouldPersistTaps="handled">
      {/* Grouping is per collection: Today gets `Overdue` + `Today · {date}`,
          Upcoming gets `Tomorrow · {date}` + `Later`, and Inbox and Done render
          FLAT — one unlabelled group and no headings at all (components.md
          § TaskList). `label: null` is that instruction, not a missing label. */}
      {groupTasks(view.tasks, collection, now).map((g) => (
        <View key={g.label ?? 'flat'}>
          {g.label !== null && <Text style={styles.dayHead}>{g.label}</Text>}
          {g.tasks.map((t) => (
            <TaskRow
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
    </ScrollView>
  )
}
