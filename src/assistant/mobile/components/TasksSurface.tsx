// S2 Tasks — "the whole todo, by hand, working identically when the assistant
// is off, broken or offline" (`information-architecture.md § 2`).
//
// It is a PEER of Talk, not a pane inside it and not a place behind
// navigation: the reciprocal control is in the bar, the whole surface is one
// tap from the conversation, and it is what F-001 AC-24 / AC-25 hand over to.
//
// Which of the five drawn views renders is `tasksSurfaceView`'s answer, not
// this file's — the same function `expectedShellIds` reads, so the id contract
// and the rendering are one source.

import { useEffect, useState } from 'react'
import { Pressable, Text, TextInput, View } from 'react-native'
import { Menu, Plus, TriangleAlert } from 'lucide-react-native'
import type { AppState } from '../../_shared/model/reducer.ts'
import type { MobileAssistantController } from '../controller.ts'
import { A11Y_IDS, SHELL_A11Y_IDS, a11yProps } from '../model/a11y.ts'
import type { MobilePlatform } from '../model/permissions.ts'
import { SURFACE_ERROR } from '../model/shell.ts'
import { flashDurationMs } from '../model/task-link.ts'
import {
  INLINE_RETRY_BANNER,
  collectionName,
  openTodayCount,
  tasksHeadline,
  tasksSurfaceView,
} from '../model/tasks-view.ts'
import type { Collection } from '../model/tasks-view.ts'
import { spacing, tokens } from '../model/theme.ts'
import { touchProps } from '../model/touch.ts'
import { OfflineBanner } from './Chrome.tsx'
import { ShellBar } from './PathSwitch.tsx'
import { TaskList } from './TaskList.tsx'
import { VoiceFab } from './VoiceFab.tsx'
import { useStyles } from './styles.ts'

export function TasksSurface({
  state,
  controller,
  platform,
  collection,
  revealTaskId,
  onGoTalk,
  onOpenMenu,
  onRevealConsumed,
}: {
  state: AppState
  controller: MobileAssistantController
  platform: MobilePlatform
  collection: Collection
  revealTaskId: string | null
  onGoTalk: () => void
  onOpenMenu: () => void
  onRevealConsumed: () => void
}) {
  const { styles, colors } = useStyles()
  const [draft, setDraft] = useState('')
  const [adding, setAdding] = useState(false)
  // F-005 AC-44 — one clock for this surface, the controller's. Passed explicitly
  // rather than left to the parameter's default so the surface and the list it
  // renders cannot straddle a day boundary between two reads of the same seam.
  const now = controller.nowDate()
  const view = tasksSurfaceView(state, collection, now)
  const menuTouch = touchProps(SHELL_A11Y_IDS.listsMenuButton, platform)
  const addTouch = touchProps(A11Y_IDS.addTaskButton, platform)
  const retryTouch = touchProps(SHELL_A11Y_IDS.tasksListRetryButton, platform)

  // AC-31: "flashed exactly once". The arrival cue is AC-4's own
  // `diffFlashHold` + `diffFlashFade` from `tokens.json`; when it has run, the
  // shell clears the target so the same row can be arrived at again later and
  // flash again rather than being swallowed as "no change".
  useEffect(() => {
    if (revealTaskId === null) return
    const t = setTimeout(onRevealConsumed, flashDurationMs())
    return () => clearTimeout(t)
  }, [revealTaskId, onRevealConsumed])

  const commit = () => {
    // Add-in-context (ADR-009 §4) — the same call the web surface makes, with
    // the same collection argument. F-003 AC-1's parity claim is only true if
    // both clients date the row identically, which is why the instant is fixed
    // in `dueAtForCollection` rather than chosen here.
    if (draft.trim() !== '') void controller.addTask(draft, collection)
    setDraft('')
    setAdding(false)
  }

  return (
    <View style={styles.surface}>
      <ShellBar
        left={
          <Pressable
            {...a11yProps(SHELL_A11Y_IDS.listsMenuButton, { label: 'Lists', role: 'button' })}
            hitSlop={menuTouch.hitSlop}
            style={styles.iconButton}
            onPress={onOpenMenu}
          >
            <Menu size={tokens.icon.size.md} color={colors.accent} strokeWidth={tokens.icon.stroke} />
          </Pressable>
        }
      >
        {/* T-257: the Talk affordance on the Tasks surface is the voice FAB,
            not a path switch button in the header. The bar's right slot is
            empty here; the FAB floats at the bottom of the surface. */}
        <View />
      </ShellBar>

      <Text style={styles.largeTitle} accessibilityRole="header">
        {collectionName(collection)}
      </Text>

      {/* § InlineRetryBanner — the list is NEVER replaced by an error while
          anything is known. This strip sits above rows that are all still
          rendered and still editable. */}
      {view.banner === 'retry' && (
        <View style={styles.retryBanner}>
          <TriangleAlert size={tokens.icon.size.sm} color={colors.danger} strokeWidth={tokens.icon.stroke} />
          <Text style={styles.retryBannerText}>{INLINE_RETRY_BANNER}</Text>
          <Pressable
            {...a11yProps(SHELL_A11Y_IDS.tasksListRetryButton, { label: 'Retry', role: 'button' })}
            hitSlop={retryTouch.hitSlop}
            style={styles.ghostButton}
            onPress={() => void controller.retryTasks()}
          >
            <Text style={styles.ghostButtonText}>Retry</Text>
          </Pressable>
        </View>
      )}
      {/* AC-25: the offline notice is visible ON THE LIST as well as on the
          conversation. A handover that delivers the user to a surface which
          looks healthy has told them the truth on the one surface they left. */}
      <OfflineBanner state={state} />

      {view.view === 'error' ? (
        // SE-TASKS. `Add task` stays LIVE: the local no-AI path works offline
        // (AC-25) and disabling a working control to look consistent is a lie.
        <View style={styles.surfaceError}>
          <Text style={styles.surfaceErrorTitle} accessibilityRole="header">
            {SURFACE_ERROR['SE-TASKS'].line1}
          </Text>
          <Text style={styles.surfaceErrorBody}>{SURFACE_ERROR['SE-TASKS'].line2}</Text>
          <Pressable
            {...a11yProps(SHELL_A11Y_IDS.tasksListRetryButton, { label: 'Retry', role: 'button' })}
            hitSlop={retryTouch.hitSlop}
            style={styles.primaryButton}
            onPress={() => void controller.retryTasks()}
          >
            <Text style={styles.primaryButtonText}>Retry</Text>
          </Pressable>
          <Pressable
            {...a11yProps(A11Y_IDS.addTaskButton, { label: 'Add task', role: 'button' })}
            hitSlop={addTouch.hitSlop}
            style={styles.ghostButton}
            onPress={() => setAdding(true)}
          >
            <Plus size={tokens.icon.size.sm} color={colors.accent} strokeWidth={tokens.icon.stroke} />
            <Text style={styles.ghostButtonText}>Add task</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <View style={styles.listHead}>
            <Text style={styles.listCount}>{tasksHeadline(openTodayCount(state.tasks))}</Text>
          </View>
          {/* The standalone add-form stays for the empty/failedBlank states
              where the inline row is not visible (inline lives inside the list
              body, which requires tasks). The empty-state CTA sets
              `adding=true`, and this form catches it.
              NOT `renameInput` — that style carries `flex: 1`, which in this
              column parent means "take all remaining height". This field gets
              its own single-line style instead. */}
          {adding && view.tasks.length === 0 && (
            <TextInput
              accessibilityLabel="New task name"
              placeholder="Task name…"
              placeholderTextColor={colors.text.muted}
              style={[styles.emptyAddInput, { marginHorizontal: spacing.gutter_mobile }]}
              value={draft}
              autoFocus
              onChangeText={setDraft}
              onSubmitEditing={commit}
              onBlur={commit}
            />
          )}
          <TaskList
            state={state}
            view={view}
            collection={collection}
            controller={controller}
            platform={platform}
            arrivedTaskId={revealTaskId}
            adding={adding}
            draft={draft}
            setDraft={setDraft}
            onCommit={commit}
            onCancel={() => { setDraft(''); setAdding(false) }}
            onActivate={() => setAdding(true)}
            onAdd={() => setAdding(true)}
          />
        </>
      )}
      {/* T-257: the voice FAB — floating mic button that switches to Talk.
          Positioned absolute bottom-right per the design (app-shell-ios.html
          .voice-fab). Always present on the Tasks surface on a phone. */}
      <VoiceFab platform={platform} onPress={onGoTalk} />
    </View>
  )
}
