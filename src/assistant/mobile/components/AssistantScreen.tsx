// The app shell root. Thin by design (platform mobile.md: "components/ — RN
// screens/components (thin over model)"): every navigation decision already
// happened in `model/shell.ts` and the controller; this file subscribes and
// arranges.
//
// **Tasks is home, Talk is summoned over it** (information-architecture.md § 4,
// 2026-08-24). A phone is always below `tokens.json breakpoints.split`, so
// there is no two-pane layout here at any width and no viewport branch below.
//
// The name and prop shape of this export are load-bearing beyond this module:
// `.mobile-app/App.tsx` and `.mobile-preview/main.tsx` mount it.

import { useCallback, useState, useSyncExternalStore } from 'react'
import { View } from 'react-native'
import type { MobileAssistantController } from '../controller.ts'
import { taskLinkState } from '../model/task-link.ts'
import { CarriedNotices } from './CarriedNotices.tsx'
import { AssistantSurfaceHost } from './ShellHost.tsx'
import { PlatformContext, ThemeChoiceContext } from './styles.ts'
import type { ThemeChoice } from './styles.ts'
import { useStyles } from './styles.ts'

export function AssistantScreen({ controller }: { controller: MobileAssistantController }) {
  // The Theme preference is a device-local view choice with no server side and
  // no conversation meaning, so it lives here rather than on the controller.
  const [theme, setTheme] = useState<ThemeChoice>('system')
  // T-300 defect 6: PlatformContext was never provided — the default ('ios')
  // won on both platforms, so Android rendered iOS font sizes. The code in
  // `font.sizeFor(platform)` is correct and was unreachable.
  return (
    <PlatformContext.Provider value={controller.platform}>
      <ThemeChoiceContext.Provider value={theme}>
        <Shell controller={controller} theme={theme} onThemeChange={setTheme} />
      </ThemeChoiceContext.Provider>
    </PlatformContext.Provider>
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
  // A SECOND subscription, and it is not redundant: the shell's navigation is
  // a view fact with no server side, so it lives on the controller (one state,
  // two doors — see `handleBack`) and notifies separately. The two READ
  // STATUSES are not here: they are `AppState.sessionLoad` / `tasksLoad`,
  // dispatched by the shared controller and therefore identical on both
  // clients.
  const shell = useSyncExternalStore(
    (cb) => controller.subscribeShell(cb),
    () => controller.shellState(),
    () => controller.shellState(),
  )
  const platform = controller.platform

  // AC-31 — THE routine, reached from exactly one entry on a phone (a task named
  // inside a message) and never re-implemented. It is the CONTROLLER's method
  // since revision 7, because the routine now switches collection before
  // revealing and this view used to compute that switch and then dispatch a bare
  // `{ type: 'reveal' }` of its own — throwing the switch away. A grep for
  // `revealTask` returns the controller method and the routine, and nothing else.
  const openTask = useCallback(
    (taskId: string) => {
      controller.revealTask(taskId)
    },
    [controller],
  )

  return (
    <View style={styles.screen}>
      {/* ── § CarriedNotice — AT THE FRAME, and that placement is a requirement ──
          F-005 AC-47: the notice is **visible wherever the user is** — not merely
          reachable from there — including Talk and Settings. It is docked directly
          below the top bar, in flow, **outside the surface stack**: the stacked
          surfaces (S3 Lists menu, S4 Settings) slide over the content and UNDER
          this region.

          Mounted here rather than in `ShellHost` because `ShellHost` returns early
          for S4 Settings — a region inside it would be invisible there, meeting
          AC-47's requirement at three of five surfaces, which is the failure mode
          the AC names. It also outranks every surface-owned strip
          (§ OfflineBanner, § InlineRetryBanner, § SaveNotice): a notice about a
          task the user cannot see would otherwise be buried by a condition of the
          screen they happen to be standing on. */}
      <CarriedNotices state={state} controller={controller} platform={platform} />
      <AssistantSurfaceHost
        state={state}
        controller={controller}
        platform={platform}
        shell={shell}
        theme={theme}
        onThemeChange={onThemeChange}
        onOpenTask={openTask}
        canOpenTask={(taskId) => taskLinkState(taskId, state.tasks) === 'link'}
      />
    </View>
  )
}
