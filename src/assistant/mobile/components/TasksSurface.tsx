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

import { useEffect } from 'react'
import { Pressable, Text, View } from 'react-native'
import { Menu, MoreHorizontal, Plus, Search, TriangleAlert } from 'lucide-react-native'
import type { AppState } from '../../_shared/model/reducer.ts'
import type { MobileAssistantController } from '../controller.ts'
import { A11Y_IDS, SHELL_A11Y_IDS, a11yProps } from '../model/a11y.ts'
import type { MobilePlatform } from '../model/permissions.ts'
import { SURFACE_ERROR } from '../model/shell.ts'
import { flashDurationMs } from '../model/task-link.ts'
import {
  INLINE_RETRY_BANNER,
  collectionName,
  tasksSurfaceView,
} from '../model/tasks-view.ts'
import type { Collection } from '../model/tasks-view.ts'
import { tokens } from '../model/theme.ts'
import { touchProps } from '../model/touch.ts'
import { OfflineBanner } from './Chrome.tsx'
import { ShellBar } from './PathSwitch.tsx'
import { TaskList } from './TaskList.tsx'
import { TaskBottomBar } from './TaskBottomBar.tsx'
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
        title={
          <Text style={styles.barTitle} accessibilityRole="header">
            {collectionName(collection)}
          </Text>
        }
      >
        {/* T-300 defect 7: Search and overflow placed in the bar per the mockup
            (matching web's T-227). What sits BEHIND them — the search field, the
            overflow menu — is NOT_BUILT and belongs to a later surface. The
            buttons are inert until that surface ships. */}
        <Pressable
          {...a11yProps(SHELL_A11Y_IDS.shellSearchButton, { label: 'Search', role: 'button' })}
          style={styles.iconButton}
        >
          <Search size={tokens.icon.size.md} color={colors.text.primary} strokeWidth={tokens.icon.stroke} />
        </Pressable>
        <Pressable
          {...a11yProps(SHELL_A11Y_IDS.shellOverflowButton, { label: 'More', role: 'button' })}
          style={styles.iconButton}
        >
          <MoreHorizontal size={tokens.icon.size.md} color={colors.text.primary} strokeWidth={tokens.icon.stroke} />
        </Pressable>
      </ShellBar>

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
          {/* T-363: InlineAdd retired. This button's only job was to open it,
              so it has no handler. **This is a defect, recorded as its own row**
              — a control that announces "Add task" and does nothing is worse
              than an absent one. It cannot simply be deleted: the shell
              catalogue still expects `assistant-add-task-button` to be applied,
              and the design still draws it on the Talk surface, so where the id
              belongs is design's to say. */}
          <Pressable
            {...a11yProps(A11Y_IDS.addTaskButton, { label: 'Add task', role: 'button' })}
            hitSlop={addTouch.hitSlop}
            style={styles.ghostButton}
          >
            <Plus size={tokens.icon.size.sm} color={colors.accent} strokeWidth={tokens.icon.stroke} />
            <Text style={styles.ghostButtonText}>Add task</Text>
          </Pressable>
        </View>
      ) : (
        <>
          {/* T-344: count line removed — owner decision. The list already
              shows what is in it, and a number brings a tail of cases for no
              new information. The badge's accessible name stays. */}
          <TaskList
            state={state}
            view={view}
            collection={collection}
            controller={controller}
            platform={platform}
            arrivedTaskId={revealTaskId}
          />
        </>
      )}
      {/* The TaskBottomBar — fixed bottom row: text field + morphing action
          button (AC-37). Typing commits through controller.addTask (literal
          path). The sole add mechanism on mobile (T-363). */}
      <TaskBottomBar
        platform={platform}
        onGoTalk={onGoTalk}
        onAddTask={(title) => void controller.addTask(title, collection)}
      />
    </View>
  )
}
