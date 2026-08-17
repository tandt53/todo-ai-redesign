// Which surface is on screen, and what stacks over it.
//
// Separated from `AssistantScreen` so the root holds the two subscriptions and
// this holds the arrangement — and so the shape below reads as what it is: a
// total function of `ShellState`, with no width test and no default branch.
//
// `information-architecture.md § 4`: S3 and S4 STACK over the peer (they
// "replace the surface" on a phone), S1 ⇄ S2 is a switch between peers.

import { View } from 'react-native'
import type { AppState } from '../../_shared/model/reducer.ts'
import type { MobileAssistantController } from '../controller.ts'
import type { MobilePlatform } from '../model/permissions.ts'
import type { PathSwitchView, ShellState } from '../model/shell.ts'
import type { Collection } from '../model/tasks-view.ts'
import { ListsMenu } from './ListsMenu.tsx'
import { SettingsSurface } from './SettingsSurface.tsx'
import { TalkSurface } from './TalkSurface.tsx'
import { TasksSurface } from './TasksSurface.tsx'
import type { ThemeChoice } from './styles.ts'
import { useStyles } from './styles.ts'

export function AssistantSurfaceHost({
  state,
  controller,
  platform,
  shell,
  pathView,
  theme,
  onThemeChange,
  onOpenTask,
  canOpenTask,
}: {
  state: AppState
  controller: MobileAssistantController
  platform: MobilePlatform
  shell: ShellState
  pathView: PathSwitchView
  theme: ThemeChoice
  onThemeChange: (t: ThemeChoice) => void
  onOpenTask: (taskId: string) => void
  canOpenTask: (taskId: string) => boolean
}) {
  const { styles } = useStyles()

  if (shell.overlay === 'settings') {
    return (
      <SettingsSurface
        platform={platform}
        theme={theme}
        onThemeChange={onThemeChange}
        onBack={() => controller.shellDispatch({ type: 'back' })}
      />
    )
  }

  const peer =
    shell.surface === 'talk' ? (
      <TalkSurface
        state={state}
        controller={controller}
        platform={platform}
        pathView={pathView}
        onGoTasks={() => controller.shellDispatch({ type: 'go', surface: 'tasks' })}
        onOpenTask={onOpenTask}
        canOpenTask={canOpenTask}
      />
    ) : (
      <TasksSurface
        state={state}
        controller={controller}
        platform={platform}
        collection={shell.collection}
        pathView={pathView}
        revealTaskId={shell.reveal === null ? null : shell.reveal.taskId}
        onGoTalk={() => controller.shellDispatch({ type: 'go', surface: 'talk' })}
        onOpenMenu={() => controller.shellDispatch({ type: 'open-menu' })}
        onRevealConsumed={() => controller.shellDispatch({ type: 'reveal-consumed' })}
      />
    )

  return (
    <View style={styles.surface}>
      {peer}
      {shell.overlay === 'menu' && (
        <ListsMenu
          state={state}
          platform={platform}
          collection={shell.collection}
          onSelect={(c: Collection) => controller.shellDispatch({ type: 'select-collection', collection: c })}
          onClose={() => controller.shellDispatch({ type: 'close-menu' })}
          onOpenSettings={() => controller.shellDispatch({ type: 'open-settings' })}
        />
      )}
    </View>
  )
}
