// S1 · TALK — "say it, see what changed".
//
// THE CONSTRAINT THAT GOVERNS THIS FILE: the applied message carries its FULL
// per-field diff at every width — in a 360–420px panel exactly as at 375px.
// Nothing in here reads a viewport, so there is no place for a second mechanism
// to grow. Where a task list is also on screen (at or above
// `tokens.json breakpoints.split`) it is an ADDITION, and AC-1's acceptance is
// read off this message alone — never off the centre list and never off the
// `Tasks · N` count, "because a number cannot say which task changed"
// (F-001 AC-1 rev 4; owner-decision-2026-08-17-desktop-list-is-primary.md
// constraint 2).
//
// The surface's own four states (idle / listening / thinking / error, AC-29)
// ride the app root's `st-*` class as they always have. `sessionLoad` is not a
// fifth state — it is how the session READ went, and it is what the S1 loading
// and session-failure renderings hang on (IA §6 S1).

import type { AssistantController } from '../../_shared/controller.ts'
import type { AppState } from '../../_shared/model/reducer.ts'
import type { FollowHandle } from '../follow.ts'
import type { ShellHandle } from '../shell.ts'
import { openTodayCount } from '../../_shared/model/tasks.ts'
import { Composer } from './Composer.tsx'
import { ConversationPane } from './ConversationPane.tsx'
import { NewMessageAffordance } from './NewMessageAffordance.tsx'
import { PathSwitch } from './Chrome.tsx'
import { VoiceSurface } from './VoiceSurface.tsx'

export function TalkSurface({
  state,
  controller,
  shell,
  follow,
  undoableTurnId,
}: {
  state: AppState
  controller: AssistantController
  shell: ShellHandle
  follow: FollowHandle
  undoableTurnId: string | null
}) {
  return (
    <div className="surface s-talk">
      <header className="topbar">
        <span className="wordmark">todo-ai</span>
        {/* The panel's own name — hidden below the split, where Talk IS the app
            and the wordmark stands for it. One string, shown or not by CSS. */}
        <span className="panel-title">Talk</span>
        <span className="spacer" />
        <PathSwitch
          to="tasks"
          count={openTodayCount(state.tasks)}
          onGo={() => shell.go('tasks')}
        />
      </header>

      <ConversationPane
        state={state}
        controller={controller}
        undoableTurnId={undoableTurnId}
        reveal={shell}
        scrollerRef={follow.scrollerRef}
        onScroll={follow.onScroll}
      />
      <VoiceSurface state={state} controller={controller} />
      {/* Docked just above the Composer (components.md § NewMessageAffordance).
          In DOM order it sits between the conversation and the Composer, so Tab
          out of the conversation reaches it before the input. */}
      <NewMessageAffordance affordance={follow.affordance} onActivate={follow.activate} />
      {/* The cause line for the dimmed orb while the session read is in flight
          (IA §6 S1). It states the transient cause, which is what
          distinguishes it from permission-denied (AC-22's rule, applied to a
          cause that is not a capability failure). */}
      {state.sessionLoad === 'loading' && (
        <div className="mic-note">Getting your conversation…</div>
      )}
      <Composer state={state} controller={controller} />
    </div>
  )
}
