// S1 Talk — "where you say what needs doing, and see in the message itself
// exactly what changed".
//
// What changed with the app shell: the task list is gone from this surface
// entirely (owner decision 2026-08-17), the drawer button with it, and the bar
// now carries PS-TASKS. What did NOT change is the mechanism F-001 AC-1 is
// verified against: **the applied message carries its full per-field diff**,
// here as everywhere, with no viewport condition. There is no second mechanism
// on this surface to select between.
//
// Three of the four drawn views are new (`information-architecture.md § 6`,
// S1): a loading state for the session read, which the build previously
// withheld input during while telling the user nothing (BUG-002), and a
// full-surface failure for the read itself, which had no design at all because
// there is no thread to put an error bubble in.

import { Pressable, ScrollView, Text, View } from 'react-native'
import type { AppState } from '../../_shared/model/reducer.ts'
import { undoableTurnId } from '../../_shared/model/reducer.ts'
import type { MobileAssistantController } from '../controller.ts'
import { SHELL_A11Y_IDS, a11yProps } from '../model/a11y.ts'
import type { MobilePlatform } from '../model/permissions.ts'
import { SURFACE_ERROR, talkView } from '../model/shell.ts'
import type { PathSwitchView } from '../model/shell.ts'
import { touchProps } from '../model/touch.ts'
import { OfflineBanner } from './Chrome.tsx'
import { Composer } from './Composer.tsx'
import { ConversationList } from './ConversationList.tsx'
import { NewMessageAffordance } from './NewMessageAffordance.tsx'
import { PathSwitch, ShellBar } from './PathSwitch.tsx'
import { VoiceSurface } from './VoiceSurface.tsx'
import { useKeyboardInset } from './useKeyboardInset.ts'
import { useNewMessageFollow } from './useNewMessageFollow.ts'
import { useStyles } from './styles.ts'

/** components.md § Skeletons, SK-BUBBLE. "A loading surface never renders its
 * empty state" — a returning user who sees "Say it. I'll write it down." while
 * their conversation is still loading reads it as history lost. */
function BubbleSkeletons() {
  const { styles } = useStyles()
  return (
    <View accessibilityLabel="Getting your conversation…" accessible>
      {[70, 45, 80].map((w, i) => (
        <View key={i} style={[styles.skeletonBubble, { width: `${w}%` }]} />
      ))}
    </View>
  )
}

export function TalkSurface({
  state,
  controller,
  platform,
  pathView,
  onGoTasks,
  onOpenTask,
  canOpenTask,
}: {
  state: AppState
  controller: MobileAssistantController
  platform: MobilePlatform
  pathView: PathSwitchView
  onGoTasks: () => void
  /** AC-31 — activating a task named in a message. One routine; this prop is
   * the only way into it from the conversation. */
  onOpenTask: (taskId: string) => void
  /** AC-31's inert case: false means the list does not hold this row, and the
   * title renders as PLAIN TEXT rather than as a control that does nothing. */
  canOpenTask: (taskId: string) => boolean
}) {
  const { styles } = useStyles()
  const view = talkView(state)
  const follow = useNewMessageFollow(controller, state)
  const retryTouch = touchProps(SHELL_A11Y_IDS.talkSessionRetryButton, platform)
  const keyboardInset = useKeyboardInset()

  return (
    <View style={styles.surface}>
      <ShellBar>
        {/* AC-24's bound: this control is present and enabled in every state
            below, the two failure states included. */}
        <PathSwitch view={pathView} platform={platform} onPress={onGoTasks} />
      </ShellBar>

      {/* KeyboardAvoidingView replaced (T-240): RN 0.86 Fabric + edge-to-edge
          broke the KAV's onLayout-based measurement on both platforms. The
          useKeyboardInset hook listens to keyboard events directly and
          subtracts the safe-area bottom that SafeAreaView already accounts
          for, so the calculation never touches onLayout at all. */}
      <View style={{ flex: 1, paddingBottom: keyboardInset }}>
        {view === 'loading' && (
          <ScrollView style={styles.convPane} contentContainerStyle={styles.convContent}>
            <BubbleSkeletons />
          </ScrollView>
        )}

        {view === 'failed' && (
          // SE-SESSION. The thread cannot render at all, so an error *bubble*
          // is the wrong shape — there is no thread to put it in. PS-TASKS
          // stays live in the bar above: this is the exact moment ADR-11's
          // second path is supposed to exist.
          <View style={styles.surfaceError}>
            <Text style={styles.surfaceErrorTitle} accessibilityRole="header">
              {SURFACE_ERROR['SE-SESSION'].line1}
            </Text>
            <Text style={styles.surfaceErrorBody}>{SURFACE_ERROR['SE-SESSION'].line2}</Text>
            <Pressable
              {...a11yProps(SHELL_A11Y_IDS.talkSessionRetryButton, {
                label: 'Retry',
                role: 'button',
              })}
              hitSlop={retryTouch.hitSlop}
              style={styles.primaryButton}
              onPress={() => void controller.retrySessionRead()}
            >
              <Text style={styles.primaryButtonText}>Retry</Text>
            </Pressable>
          </View>
        )}

        {(view === 'idle' || view === 'empty') && (
          <ConversationList
            state={state}
            controller={controller}
            undoableTurnId={undoableTurnId(state)}
            platform={platform}
            scrollProps={follow.scrollProps}
            onOpenTask={onOpenTask}
            canOpenTask={canOpenTask}
          />
        )}

        <VoiceSurface state={state} controller={controller} platform={platform} />
        {/* Zero-height dock — the pill floats over the last line of the
            conversation instead of pushing history upward. */}
        <NewMessageAffordance
          view={follow.affordance}
          platform={platform}
          onPress={follow.activateAffordance}
        />
        <OfflineBanner state={state} />
        <Composer state={state} controller={controller} platform={platform} />
      </View>
    </View>
  )
}
