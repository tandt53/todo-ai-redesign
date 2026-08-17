// App shell. Thin by design (platform web.md): every conversation decision
// already happened in `model/` and `controller.ts`; this component subscribes
// to the controller and maps state → classes → children.
//
// The root className carries the two orthogonal axes the spec keeps separate:
//   st-{idle|listening|thinking|error}  — the four surface states (AC-29)
//   mic-{available|dimmed-permission|dimmed-transient|hidden} — mic mode (AC-20..22)
// plus `is-offline`. The mockup folded the second axis into the first because
// it could only show one screen at a time; the running app needs both at once.

import { useState, useSyncExternalStore } from 'react'
import type { AssistantController } from '../_shared/controller.ts'
import { micMode, undoableTurnId } from '../_shared/model/reducer.ts'
import { Drawer, OfflineBanner, TopBar } from './components/Chrome.tsx'
import { Composer } from './components/Composer.tsx'
import { ConversationPane } from './components/ConversationPane.tsx'
import { NewMessageAffordance } from './components/NewMessageAffordance.tsx'
import { TaskListPane } from './components/TaskListPane.tsx'
import type { ListFilter } from './components/TaskListPane.tsx'
import { VoiceSurface } from './components/VoiceSurface.tsx'
import { useFollowNewMessages } from './follow.ts'

export function App({ controller }: { controller: AssistantController }) {
  const state = useSyncExternalStore(
    (cb) => controller.subscribe(cb),
    () => controller.state,
    () => controller.state,
  )
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [filter, setFilter] = useState<ListFilter>('all')
  // AC-30 (BUG-004): follow the newest message only when the user is already at
  // the bottom; otherwise hold the view still and say something is waiting.
  const follow = useFollowNewMessages(state.messages)

  return (
    <div
      className={`app st-${state.surface} mic-${micMode(state)}${state.offline ? ' is-offline' : ''}`}
    >
      <TopBar drawerOpen={drawerOpen} onToggleDrawer={() => setDrawerOpen((v) => !v)} />
      {drawerOpen && <Drawer filter={filter} onPick={setFilter} />}
      <div className="panes">
        <TaskListPane state={state} controller={controller} filter={filter} />
        <main className="conv-pane">
          <ConversationPane
            state={state}
            controller={controller}
            undoableTurnId={undoableTurnId(state)}
            scrollerRef={follow.scrollerRef}
            onScroll={follow.onScroll}
          />
          <VoiceSurface state={state} controller={controller} />
          {/* Docked just above the Composer, above the OfflineBanner when that
              is showing (components.md §NewMessageAffordance). In DOM order it
              sits between the conversation and the Composer, so Tab out of the
              conversation reaches it before the input. */}
          <NewMessageAffordance affordance={follow.affordance} onActivate={follow.activate} />
          <OfflineBanner state={state} />
          <Composer state={state} controller={controller} />
        </main>
      </div>
    </div>
  )
}
