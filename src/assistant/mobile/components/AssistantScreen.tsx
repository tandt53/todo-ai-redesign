// The app shell root. Thin by design (platform mobile.md: "components/ — RN
// screens/components (thin over model)"): every navigation decision already
// happened in `model/shell.ts` and the controller; this file subscribes and
// arranges.
//
// **Two peer surfaces, one at a time.** A phone is always below
// `tokens.json breakpoints.split`, so there is no two-pane layout here at any
// width and no viewport branch anywhere below this line — what the wide web
// frame says with position, a phone says with order, and the reciprocal control
// (§ PathSwitch) is one tap either way.
//
// **Which one opens first is F-001 Open Question 9 and it is open.** It is
// `LANDING_SURFACE`, one declared value in `model/shell.ts`, read here through
// `initialShellState()` and decided nowhere else — the owner's answer is a
// one-line change, not a refactor.
//
// The name and prop shape of this export are load-bearing beyond this module:
// `.mobile-app/App.tsx` and `.mobile-preview/main.tsx` mount it.

import { useCallback, useState, useSyncExternalStore } from 'react'
import { View } from 'react-native'
import type { MobileAssistantController } from '../controller.ts'
import { pathSwitch } from '../model/shell.ts'
import { revealTask, taskLinkState } from '../model/task-link.ts'
import { AssistantSurfaceHost } from './ShellHost.tsx'
import { ThemeChoiceContext } from './styles.ts'
import type { ThemeChoice } from './styles.ts'
import { useStyles } from './styles.ts'

export function AssistantScreen({ controller }: { controller: MobileAssistantController }) {
  // The Theme preference is a device-local view choice with no server side and
  // no conversation meaning, so it lives here rather than on the controller.
  const [theme, setTheme] = useState<ThemeChoice>('system')
  return (
    <ThemeChoiceContext.Provider value={theme}>
      <Shell controller={controller} theme={theme} onThemeChange={setTheme} />
    </ThemeChoiceContext.Provider>
  )
}

function Shell({
  controller,
  theme,
  onThemeChange,
}: {
  controller: MobileAssistantController
  theme: ThemeChoice
  onThemeChange: (t: ThemeChoice) => void
}) {
  const { styles } = useStyles()
  const state = useSyncExternalStore(
    (cb) => controller.subscribe(cb),
    () => controller.state,
    () => controller.state,
  )
  // A SECOND subscription, and it is not redundant: the shell's navigation and
  // the two read statuses are not in `AppState`, so a failed session read
  // changes no state object — and that is precisely the case (SE-SESSION) that
  // most needs to render.
  const snapshot = useSyncExternalStore(
    (cb) => controller.subscribeShell(cb),
    () => controller.shellSnapshot(),
    () => controller.shellSnapshot(),
  )
  const shell = snapshot.shell
  const platform = controller.platform

  // AC-31 — THE routine, reached from exactly one entry on a phone (a task
  // named inside a message) and never re-implemented. A grep for `revealTask`
  // returns every caller.
  const openTask = useCallback(
    (taskId: string) => {
      const next = revealTask(shell, taskId, state)
      if (next === shell) return
      controller.shellDispatch({ type: 'reveal', taskId })
    },
    [controller, shell, state],
  )

  return (
    <View style={styles.screen}>
      <AssistantSurfaceHost
        state={state}
        controller={controller}
        platform={platform}
        shell={shell}
        load={snapshot.load}
        pathView={pathSwitch(shell.surface, state.tasks)}
        theme={theme}
        onThemeChange={onThemeChange}
        onOpenTask={openTask}
        canOpenTask={(taskId) => taskLinkState(taskId, state.tasks, shell.collection) === 'link'}
      />
    </View>
  )
}
