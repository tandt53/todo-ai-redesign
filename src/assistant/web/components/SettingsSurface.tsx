// S4 · SETTINGS — "the switches that belong to you rather than to a task".
//
// A SHELL, and it says so: only rows whose every dependency already exists are
// built. Three things are drawn and deliberately absent:
//
//   * **Talk back** (`settings-talkback-switch`, `settings-row-retry`) — needs
//     F-002, which is specced to revision 3 and unbuilt. "A switch that toggles
//     nothing is worse than an absent one" (components.md § SettingsRow), and
//     `settings-row-retry` belongs to that row's failed state, so it cannot
//     exist before the row does.
//   * **Default list for new tasks** — needs `lists` + `tasks.list_id` (IA §7).
//   * **A language picker** — F-002 AC-23 makes `client.interface_language` a
//     build-time constant *because* no settings surface was a deliverable. That
//     premise is now withdrawn while the AC still stands (IA §8.2), and the
//     settings-and-lists decision says the language choice "should not ride
//     along silently". Drawing one here would be exactly the silent ride, so
//     this is flagged for spec-agent rather than resolved by an implementer.
//
// Theme and About need nothing that is missing, so they are here and they work.
//
// Above the split, Settings replaces the CENTRE and never the panel: the
// assistant is never dismissed by navigating, which is the difference between a
// panel and a screen. That is one CSS rule in styles.css, not a behaviour here.

import { APP_VERSION } from '../version.ts'
import { THEME_CHOICES, themeLabel } from '../theme.ts'
import type { ThemeChoice } from '../theme.ts'
import { BackIcon } from './icons.tsx'

export function SettingsSurface({
  theme,
  onTheme,
  onBack,
}: {
  theme: ThemeChoice
  onTheme: (c: ThemeChoice) => void
  onBack: () => void
}) {
  return (
    <div className="surface s-settings">
      <header className="topbar">
        {/* "Back always means up one level, never the previous surface"
            (IA §4): S4 is stacked on S3, so this returns to the Lists menu. */}
        <button
          className="icon-btn"
          data-testid="settings-back-button"
          aria-label="Back to Lists"
          onClick={onBack}
        >
          <BackIcon />
        </button>
        <h1>Settings</h1>
      </header>
      <div className="tasks-body">
        <div className="set-col">
          <div className="set-row">
            <span className="set-label">
              Theme
              <span className="set-sub">Dark is the default. Both are fully drawn.</span>
            </span>
            <div className="seg" data-testid="settings-theme-control" role="group" aria-label="Theme">
              {THEME_CHOICES.map((c) => (
                <button
                  key={c}
                  className={c === theme ? 'on' : undefined}
                  aria-pressed={c === theme}
                  onClick={() => onTheme(c)}
                >
                  {themeLabel(c)}
                </button>
              ))}
            </div>
          </div>

          <div className="set-row">
            <span className="set-label">About</span>
            <span className="task-meta num">todo-ai · {APP_VERSION}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
