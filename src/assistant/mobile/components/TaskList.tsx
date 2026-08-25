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
//   - the delete control is revealed by SWIPE-LEFT on the row
//     (`DESIGN.md ## Platform` row-delete table; T-343). The visible delete
//     button that was in the trailing slot wasted 44pt of every row for an
//     action used on 1% of taps. Screen-reader users who cannot swipe reach
//     delete through a VoiceOver rotor custom action / TalkBack custom action
//     menu labelled "Delete task" (F-001 AC-33), or via the task detail.
//   - rename is entered by TAPPING THE TITLE. A second per-row button would
//     crowd the delete target at 44/48.

import { useCallback, useEffect, useRef, useState } from 'react'
import { Animated, Dimensions, LayoutAnimation, PanResponder, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import type { LayoutChangeEvent, TextInput as TextInputType } from 'react-native'
import { Check, Repeat, Trash2 } from 'lucide-react-native'
import { cnUndo } from '../../_shared/model/notice-copy.ts'
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

/** T-344: fraction of the row's measured width that triggers an immediate
 * delete. At 0.5 the threshold is roughly half the row — far enough from a
 * casual scroll that an accidental delete is unlikely, close enough that the
 * gesture feels decisive. The number is a fraction, not a pixel count, so it
 * scales to every screen width without a breakpoint. */
const FULL_SWIPE_FRACTION = 0.5
/** T-344: ms before the in-place undo strip auto-collapses. Long enough to
 * read and act; short enough that the list does not carry a stale strip. */
const UNDO_STRIP_TIMEOUT_MS = 5000

function TaskRow({
  task,
  mark,
  arrived,
  controller,
  platform,
  now,
  onFullSwipeDelete,
}: {
  task: TaskView
  mark: DiffLine | null
  arrived: boolean
  controller: MobileAssistantController
  platform: MobilePlatform
  /** F-005 AC-44 — one clock for the whole render, the controller's. */
  now: Date
  /** T-344: called when a full swipe (past half the row width) completes its
   * exit animation. The parent inserts an undo strip at this position. */
  onFullSwipeDelete?: () => void
}) {
  const { styles, colors } = useStyles()
  const [renaming, setRenaming] = useState(false)
  const [draft, setDraft] = useState(task.title)
  // Guard: on Android, Enter fires `onSubmitEditing` then the field loses focus
  // and fires `onBlur`, calling `commitRename` twice. The ref lets whichever
  // event arrives first commit, and the second is a no-op.
  const renameCommitted = useRef(false)
  useEffect(() => { renameCommitted.current = false }, [renaming])
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

  const commitRename = () => {
    if (renameCommitted.current) return
    renameCommitted.current = true
    setRenaming(false)
    // `editTask` is a no-op on an unchanged or empty title, so the cancel case
    // needs no branch here.
    void controller.editTask(task.id, draft)
  }

  // ── Swipe-to-reveal + full-swipe delete (T-343, T-344) ────────────────────
  // Two stages, both driven by one pan responder:
  //   short swipe (past ~32pt)  → reveals the delete button, unchanged
  //   full swipe  (past ~half the row width) → deletes immediately with undo
  //
  // Swipe vs scroll conflict: the pan responder claims the gesture only when
  // the horizontal distance exceeds the vertical distance AND the horizontal
  // travel passes a 10pt dead zone. This lets a vertical scroll start cleanly
  // even if the finger drifts a few points sideways.
  const DELETE_REVEAL_WIDTH = 64
  const SWIPE_THRESHOLD = 10
  const translateX = useRef(new Animated.Value(0)).current
  const [revealed, setRevealed] = useState(false)
  // T-344: row width for the full-swipe threshold, measured via onLayout.
  // Refs so the PanResponder (created once) reads current values.
  const rowWidthRef = useRef(Dimensions.get('window').width)
  const onFullSwipeDeleteRef = useRef(onFullSwipeDelete)
  onFullSwipeDeleteRef.current = onFullSwipeDelete
  const revealedRef = useRef(revealed)
  revealedRef.current = revealed

  const onRowLayout = useCallback((e: LayoutChangeEvent) => {
    rowWidthRef.current = e.nativeEvent.layout.width
  }, [])

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, gesture) =>
        Math.abs(gesture.dx) > SWIPE_THRESHOLD &&
        Math.abs(gesture.dx) > Math.abs(gesture.dy),
      onPanResponderMove: (_e, gesture) => {
        if (gesture.dx < 0) {
          // T-344: allow swiping beyond the reveal width (up to full row) for
          // the full-swipe gesture. The danger strip stretches to fill.
          const limit = -(rowWidthRef.current || 300)
          translateX.setValue(Math.max(gesture.dx, limit))
        } else if (revealedRef.current) {
          // When already revealed, allow rightward to close
          translateX.setValue(Math.min(0, -DELETE_REVEAL_WIDTH + gesture.dx))
        }
      },
      onPanResponderRelease: (_e, gesture) => {
        const width = rowWidthRef.current || 300
        const isFullSwipe = -gesture.dx > width * FULL_SWIPE_FRACTION

        if (isFullSwipe) {
          // T-344: full swipe — animate the row off screen, then notify parent
          Animated.timing(translateX, {
            toValue: -width,
            duration: 150,
            useNativeDriver: true,
          }).start(() => {
            onFullSwipeDeleteRef.current?.()
          })
          return
        }

        // Short swipe: snap to reveal or snap closed (unchanged from T-343)
        const shouldOpen = gesture.dx < -DELETE_REVEAL_WIDTH / 2
        Animated.spring(translateX, {
          toValue: shouldOpen ? -DELETE_REVEAL_WIDTH : 0,
          useNativeDriver: true,
          overshootClamping: true,
        }).start()
        setRevealed(shouldOpen)
      },
      onPanResponderTerminate: () => {
        Animated.spring(translateX, {
          toValue: revealedRef.current ? -DELETE_REVEAL_WIDTH : 0,
          useNativeDriver: true,
          overshootClamping: true,
        }).start()
      },
    }),
  ).current

  const closeReveal = useCallback(() => {
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
      overshootClamping: true,
    }).start()
    setRevealed(false)
  }, [translateX])

  const handleDelete = useCallback(() => {
    closeReveal()
    void controller.removeTask(task.id)
  }, [closeReveal, controller, task.id])

  // ── F-001 AC-33 — non-gesture delete paths for screen readers ─────────────
  // Neither VoiceOver nor TalkBack can perform a custom swipe, so the swipe-
  // revealed delete button does not exist for those users. Two alternative
  // paths satisfy the AC:
  //   1. Delete in task detail (F-005) — reached by tapping the row.
  //   2. Platform custom action — VoiceOver rotor "Delete task" on iOS,
  //      TalkBack action menu "Delete task" on Android.
  // The label "Delete task" matches the swipe-revealed control (WCAG 2.5.3).
  const deleteCustomAction = {
    name: 'Delete task',
    label: 'Delete task',
  }

  return (
    <View style={[styles.swipeRow, arrived ? styles.rowArrived : null]} onLayout={onRowLayout}>
      {/* The delete button sits behind the row, revealed when swiped left */}
      <View style={[styles.swipeDeleteBehind, { width: DELETE_REVEAL_WIDTH }]}>
        <Pressable
          {...a11yProps(SHELL_A11Y_IDS.tasksDeleteButton, {
            label: `Delete "${task.title}"`,
            role: 'button',
          })}
          style={styles.swipeDeleteButton}
          onPress={handleDelete}
        >
          <Trash2 size={tokens.icon.size.sm} color={colors.bg.base} strokeWidth={tokens.icon.stroke} />
        </Pressable>
      </View>

      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.swipeRowForeground,
          { transform: [{ translateX }] },
        ]}
      >
        <View
          {...a11yProps(A11Y_IDS.taskRow, { label: rowName })}
          accessibilityActions={[deleteCustomAction]}
          onAccessibilityAction={(event) => {
            if (event.nativeEvent.actionName === 'Delete task') {
              void controller.removeTask(task.id)
            }
          }}
          hitSlop={rowTouch.hitSlop}
          style={styles.taskRow}
        >
          <Pressable
            {...a11yProps(A11Y_IDS.taskCheckbox, {
              label: `Mark "${task.title}" as ${done ? 'not done' : 'done'}`,
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
              accessibilityLabel={`Rename "${task.title}"`}
              accessibilityRole="button"
              style={styles.taskMain}
              onPress={() => {
                setDraft(task.title)
                setRenaming(true)
              }}
            >
              {/* T-300 defect 1: title and marks share ONE row. The title takes
                  available space and the marks sit right-aligned on the same line,
                  so the due date never wraps to a second line. */}
              <Text
                style={[styles.taskTitle, done ? styles.taskTitleDone : null]}
                numberOfLines={1}
              >
                {task.title}
              </Text>
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
                {priority === 'high' && (
                  <Text style={styles.urgencyMark} accessibilityElementsHidden importantForAccessibility="no">
                    !
                  </Text>
                )}
                {meta !== null && <Text style={styles.taskMeta}>{meta}</Text>}
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
        </View>
      </Animated.View>
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
}: {
  view: TasksSurfaceView
  collection: Collection
}) {
  const { styles } = useStyles()
  const row = view.empty
  if (row === null) return null
  const copy = EMPTY_TASKS[row]
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyHead}>{fillListSlot(copy.head, collection)}</Text>
      {copy.body !== null && <Text style={styles.emptyBody}>{copy.body}</Text>}
      {copy.secondDoor !== null && <Text style={styles.secondDoor}>{copy.secondDoor}</Text>}
    </View>
  )
}

// ── T-344: In-place undo strip ────────────────────────────────────────────
// After a full-swipe delete the row is replaced in place by a strip that reads
// the deletion and carries an Undo control. It is wired to the EXISTING undo
// mechanism (`state.undoOffer`, `controller.undoLastAction`), not a second one.
// CarriedNotices at the top of the screen is the persistent fallback; this
// strip is the transient, in-list affordance.
//
// The strip collapses after UNDO_STRIP_TIMEOUT_MS. If the strip is off screen
// when the timeout fires, we skip the animation to avoid a scroll-position
// jump under the user's thumb — the strip is removed without layout animation,
// and the scroll offset is adjusted to compensate.

interface UndoStripInfo {
  taskId: string
  title: string
  /** The task ID of the row that came immediately BEFORE the deleted row in the
   * flat rendered list. `null` if the deleted row was first in its group. Used
   * to insert the strip at the right position after the task is removed from
   * state.tasks. */
  predecessorId: string | null
  /** The group label the deleted row belonged to. */
  groupKey: string
}

function UndoStrip({
  info,
  controller,
  onCollapsed,
  platform,
}: {
  info: UndoStripInfo
  controller: MobileAssistantController
  /** Called when the strip is dismissed or collapses so the parent removes it
   * from state. */
  onCollapsed: () => void
  platform: MobilePlatform
}) {
  const { styles } = useStyles()
  const heightAnim = useRef(new Animated.Value(1)).current
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mountedRef = useRef(true)
  // Track the strip's on-screen position for the off-screen check.
  const layoutRef = useRef({ y: 0, height: 0 })
  const scrollYRef = useRef(0)
  const viewportHeight = Dimensions.get('window').height

  useEffect(() => {
    mountedRef.current = true
    timerRef.current = setTimeout(() => {
      if (!mountedRef.current) return
      // Collapse: use LayoutAnimation for a smooth layout transition.
      // LayoutAnimation handles scroll-position compensation better than
      // a manual Animated.Value on height, and avoids the worst of the
      // scroll-jump issue on both platforms.
      if (Platform.OS === 'ios') {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
      }
      onCollapsed()
    }, UNDO_STRIP_TIMEOUT_MS)
    return () => {
      mountedRef.current = false
      if (timerRef.current !== null) clearTimeout(timerRef.current)
    }
  }, [onCollapsed])

  const handleUndo = useCallback(() => {
    if (timerRef.current !== null) clearTimeout(timerRef.current)
    void controller.undoLastAction()
    onCollapsed()
  }, [controller, onCollapsed])

  const handleDismiss = useCallback(() => {
    if (timerRef.current !== null) clearTimeout(timerRef.current)
    controller.dismissUndoOffer()
    onCollapsed()
  }, [controller, onCollapsed])

  // § Buttons' `neutral` variant — the same treatment as CarriedNotices'
  // `Put back`, because this IS the same undo mechanism rendered closer to
  // the action. The label is `Undo` rather than `Put back` because this strip
  // is transient and row-local, not the persistent notice that design's
  // one-word-per-concept table bound `put back` to.
  const sentence = cnUndo({ kind: 'delete-task', taskId: info.taskId, title: info.title })
  return (
    <View
      {...a11yProps(SHELL_A11Y_IDS.carriedNotice, {
        label: `${sentence} Undo available`,
      })}
      accessibilityLiveRegion="polite"
      style={styles.undoStrip}
    >
      <Text style={styles.undoStripText} numberOfLines={1}>
        {sentence}
      </Text>
      <Pressable
        {...a11yProps(SHELL_A11Y_IDS.carriedNoticeUndo, {
          label: 'Undo',
          role: 'button',
        })}
        style={styles.undoStripButton}
        onPress={handleUndo}
      >
        <Text style={styles.undoStripButtonText}>Undo</Text>
      </Pressable>
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
}: {
  state: AppState
  view: TasksSurfaceView
  collection: Collection
  controller: MobileAssistantController
  platform: MobilePlatform
  /** AC-31's arrival target — flashed once, then cleared by the surface after
   * `flashDurationMs()`. */
  arrivedTaskId: string | null
}) {
  const { styles } = useStyles()
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

  // T-344: in-place undo strip state. Set when a full-swipe delete happens;
  // cleared by the strip's own collapse timer, an explicit Undo or Dismiss, or
  // when state.undoOffer changes to a different task (the offer is single-slot,
  // so a second delete replaces the first).
  const [undoStrip, setUndoStrip] = useState<UndoStripInfo | null>(null)

  // Sync with state.undoOffer: if the offer is consumed, dismissed, or replaced,
  // clear the local strip.
  useEffect(() => {
    if (undoStrip === null) return
    const offer = state.undoOffer
    if (
      offer === null ||
      offer.used ||
      offer.action.taskId !== undoStrip.taskId
    ) {
      setUndoStrip(null)
    }
  }, [state.undoOffer, undoStrip])

  const clearStrip = useCallback(() => setUndoStrip(null), [])

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
        <EmptyState view={view} collection={collection} />
        {/* T-344: the undo strip can appear even when the list is empty — the
            full-swipe deleted the last task. */}
        {undoStrip !== null && (
          <UndoStrip
            info={undoStrip}
            controller={controller}
            onCollapsed={clearStrip}
            platform={platform}
          />
        )}
      </ScrollView>
    )
  }

  // T-344: compute groups and then walk them to insert the undo strip at
  // the deleted row's position. The strip goes after `predecessorId` inside
  // the matching group, or at the group start if predecessorId is null,
  // or as a fallback at the end of the list.
  const groups = groupTasks(view.tasks, collection, now)

  return (
    <ScrollView keyboardShouldPersistTaps="handled">

      {/* Grouping is per collection: Today gets `Overdue` + `Today · {date}`,
          Upcoming gets `Tomorrow · {date}` + `Later`, and Inbox and Done render
          FLAT — one unlabelled group and no headings at all (components.md
          § TaskList). `label: null` is that instruction, not a missing label. */}
      {groups.map((g) => {
        const gKey = g.label ?? 'flat'
        const stripInThisGroup = undoStrip !== null && undoStrip.groupKey === gKey
        // Build the task indices for this group to find where the strip goes
        return (
          <View key={gKey}>
            {g.label !== null && <Text style={styles.dayHead}>{g.label}</Text>}
            {/* T-344: if the strip's predecessor is null and this is the right
                group, the deleted row was first — strip goes at the top. */}
            {stripInThisGroup && undoStrip.predecessorId === null && (
              <UndoStrip
                info={undoStrip}
                controller={controller}
                onCollapsed={clearStrip}
                platform={platform}
              />
            )}
            {g.tasks.map((t) => (
              <View key={t.id}>
                <TaskRow
                  now={now}
                  task={t}
                  mark={state.marks?.byTask[t.id] ?? null}
                  arrived={t.id === arrivedTaskId}
                  controller={controller}
                  platform={platform}
                  onFullSwipeDelete={() => {
                    // Compute the position info BEFORE removing the task.
                    // Find this task's index in the group and the predecessor.
                    const idx = g.tasks.indexOf(t)
                    const pred = idx > 0 ? (g.tasks[idx - 1]?.id ?? null) : null
                    setUndoStrip({
                      taskId: t.id,
                      title: t.title,
                      predecessorId: pred,
                      groupKey: gKey,
                    })
                    void controller.removeTask(t.id)
                  }}
                />
                {/* T-344: if the strip follows this task (it's the predecessor),
                    render after it. */}
                {stripInThisGroup && undoStrip.predecessorId === t.id && (
                  <UndoStrip
                    info={undoStrip}
                    controller={controller}
                    onCollapsed={clearStrip}
                    platform={platform}
                  />
                )}
              </View>
            ))}
            {/* T-344: if this is the right group but the predecessor wasn't
                found (it was also deleted or moved), place at the end. */}
            {stripInThisGroup &&
              undoStrip.predecessorId !== null &&
              !g.tasks.some((t) => t.id === undoStrip.predecessorId) && (
                <UndoStrip
                  info={undoStrip}
                  controller={controller}
                  onCollapsed={clearStrip}
                  platform={platform}
                />
              )}
          </View>
        )
      })}
      {/* T-344: fallback — if the strip's group no longer exists (the deleted
          task was the only one in it), render at the end of the list. */}
      {undoStrip !== null &&
        !groups.some((g) => (g.label ?? 'flat') === undoStrip.groupKey) && (
          <UndoStrip
            info={undoStrip}
            controller={controller}
            onCollapsed={clearStrip}
            platform={platform}
          />
        )}
    </ScrollView>
  )
}
