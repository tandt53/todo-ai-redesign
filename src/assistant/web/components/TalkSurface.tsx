// S1 · TALK — "say it, see what changed".
//
// THE MODEL (information-architecture.md §4, revised 2026-08-24): Talk is
// summoned over the task list. Below the split it is an overlay — the mic opens
// it, close or Escape dismisses it. At or above the split it is a panel beside
// the list, permanently on screen. Same relationship, two drawings.
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
import { Composer } from './Composer.tsx'
import { ConversationPane } from './ConversationPane.tsx'
import { NewMessageAffordance } from './NewMessageAffordance.tsx'
import { CloseIcon } from './icons.tsx'
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
        {/* Close control — dismisses the Talk overlay (IA §4). Below the split
            this is the visible affordance beside Escape; at or above it Talk is
            a permanent panel and CSS hides this button. AC-24's reachability
            bound is met by the list being home — dismissing Talk lands on it. */}
        <button
          className="talk-close icon-btn"
          data-testid="talk-close-button"
          aria-label="Close"
          onClick={() => shell.go('tasks')}
        >
          <CloseIcon />
        </button>
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
