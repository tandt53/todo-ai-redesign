// The app shell. Two peer surfaces plus a stacked one, and ONE layout branch.
//
// The root className carries the two orthogonal axes the spec keeps separate:
//   st-{idle|listening|thinking|error}  — the four surface states (AC-29)
//   mic-{available|dimmed-permission|dimmed-transient|hidden} — mic mode (AC-20..22)
// plus `is-offline` and `is-session-loading`. The mockup folded the second axis
// into the first because it could only show one screen at a time; the running
// app needs both at once.
//
// `data-surface` is the third, and it is what the ONE layout branch reads:
//
//   below `tokens.json breakpoints.split`  — exactly one surface on screen,
//       PathSwitch moves between the two peers in one action.
//   at or above it — Tasks holds the centre, Talk holds a 360–420px right
//       panel, BOTH permanently on screen, and Settings replaces the centre
//       rather than the panel: the assistant is never dismissed by navigating.
//
// **Every surface is mounted at every width and the branch lives entirely in
// CSS — a container query on this element, never a viewport read in JS.** That
// is not a shortcut: an AC that carries two mechanisms selected by width is one
// mechanism plus one nobody runs, and the branch nobody runs is the one that
// rots (owner-decision-2026-08-17-desktop-list-is-primary.md, constraint 2). No
// behaviour in this tree asks how wide it is.

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import type { AssistantController } from '../_shared/controller.ts'
import { micMode, undoableTurnId } from '../_shared/model/reducer.ts'
import { CarriedNotices, StatusAnnouncer } from './components/CarriedNotices.tsx'
import { OfflineBanner, VoiceFab } from './components/Chrome.tsx'
import { ListsMenu } from './components/ListsMenu.tsx'
import { PassedReminders } from './components/PassedReminders.tsx'
import { SettingsSurface } from './components/SettingsSurface.tsx'
import { TalkSurface } from './components/TalkSurface.tsx'
import { TaskDetail } from './components/TaskDetail.tsx'
import { TasksSurface } from './components/TasksSurface.tsx'
import { useFollowNewMessages } from './follow.ts'
import { useShell } from './shell.ts'
import { applyTheme, defaultThemeStore, readTheme, writeTheme } from './theme.ts'
import type { ThemeChoice } from './theme.ts'

export function App({ controller }: { controller: AssistantController }) {
  const state = useSyncExternalStore(
    (cb) => controller.subscribe(cb),
    () => controller.state,
    () => controller.state,
  )
  const shell = useShell(state)
  // AC-30 (BUG-004): follow the newest message only when the user is already at
  // the bottom; otherwise hold the view still and say something is waiting.
  const follow = useFollowNewMessages(state.messages)

  const [theme, setThemeState] = useState<ThemeChoice>(() => readTheme(defaultThemeStore()))
  useEffect(() => {
    applyTheme(theme)
  }, [theme])
  const setTheme = useCallback((next: ThemeChoice) => {
    writeTheme(defaultThemeStore(), next)
    setThemeState(next)
  }, [])

  const rootClass = [
    'app',
    `st-${state.surface}`,
    `mic-${micMode(state)}`,
    state.offline ? 'is-offline' : null,
    state.sessionLoad === 'loading' ? 'is-session-loading' : null,
  ]
    .filter((c) => c !== null)
    .join(' ')

  return (
    <div className={rootClass} data-surface={shell.surface}>
      {/* One banner above both surfaces — see the note on OfflineBanner. It shows
          on the detail too (IA §2, added T-152): F-005 AC-2's third state refuses an
          offline edit on that surface and states the reason there, so a banner that
          cannot show on S6 is a banner missing from the surface where the refusal
          happens. It is above `.surfaces`, so it already does. */}
      <OfflineBanner state={state} />
      {/* ── F-005 AC-47 — § CarriedNotice, at the FRAME ──────────────────────
          Outside the surface stack and outside the stacking layer, so it is
          visible on Talk and on Settings and at both widths, and S3/S4/S5 slide
          over the content and UNDER it. That placement is a requirement rather
          than a drawing: a region inside the stacking layer is invisible on two
          of the six surfaces, and AC-47 names that as the failure mode.

          Strip order, outermost first (§ CarriedNotice → Placement):
            § CarriedNotice → § InlineRetryBanner → § OfflineBanner → § SaveNotice
          — **a strip that is not about the surface it appears on outranks every
          strip that is.** OfflineBanner is a condition of the app rather than of a
          surface, which is why it keeps its place above; the two surface-owned
          strips live inside their surfaces already. */}
      <CarriedNotices state={state} controller={controller} />
      {/* AC-38's surfacing — its own family, by design's decision of 2026-08-19. */}
      <PassedReminders state={state} controller={controller} onOpenTask={shell.openDetail} />
      <div className="surfaces">
        <TalkSurface
          state={state}
          controller={controller}
          shell={shell}
          follow={follow}
          undoableTurnId={undoableTurnId(state)}
        />
        <TasksSurface state={state} controller={controller} shell={shell} />
        {/* ── F-005 AC-45 — S6, one more surface in the same stack ────────────
            It is mounted **only when it has a subject**, which is the one place this
            differs from its three peers: they are permanent and CSS chooses; this
            one has nothing to render without a task. That is not a width branch —
            `detailTaskId` is a subject, not a viewport — and the layout decision for
            it stays entirely in `styles.css`'s single container query, exactly as
            `settings` does. */}
        {shell.detailTaskId !== null && (
          <TaskDetail
            state={state}
            controller={controller}
            taskId={shell.detailTaskId}
            onClose={shell.closeDetail}
          />
        )}
        <SettingsSurface theme={theme} onTheme={setTheme} onBack={shell.backFromSettings} />
      </div>
      {/* ── Voice FAB — below split, opens Talk (T-254, replaces shell-talk-button) ──
          Positioned absolutely at the app root (which is `position:relative`).
          Hidden at or above the split by `@container app`, where Talk is
          permanently visible. Hidden when not on the Tasks surface by CSS. */}
      <VoiceFab onGo={() => shell.go('talk')} />
      {/* AC-33's 4.1.3 — the status region for every refusal and status message
          this feature states. Separate from § CarriedNotice's region so that one can
          be `aria-atomic="false"` (N rows, only the changed one announces) while a
          status message still announces whole. */}
      <StatusAnnouncer state={state} />
      {shell.menuOpen && (
        <ListsMenu
          state={state}
          active={shell.collection}
          onPick={shell.pickCollection}
          onSettings={shell.openSettings}
          onClose={() => shell.setMenuOpen(false)}
        />
      )}
    </div>
  )
}
