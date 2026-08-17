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
import { OfflineBanner } from './components/Chrome.tsx'
import { ListsMenu } from './components/ListsMenu.tsx'
import { SettingsSurface } from './components/SettingsSurface.tsx'
import { TalkSurface } from './components/TalkSurface.tsx'
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
      {/* One banner above both surfaces — see the note on OfflineBanner. */}
      <OfflineBanner state={state} />
      <div className="surfaces">
        <TalkSurface
          state={state}
          controller={controller}
          shell={shell}
          follow={follow}
          undoableTurnId={undoableTurnId(state)}
        />
        <TasksSurface state={state} controller={controller} shell={shell} />
        <SettingsSurface theme={theme} onTheme={setTheme} onBack={shell.backFromSettings} />
      </div>
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
