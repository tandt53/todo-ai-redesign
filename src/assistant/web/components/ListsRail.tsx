// The permanent Lists rail — visible at or above tokens.json breakpoints.wide
// (1536px container width). Below wide the drawer (ListsMenu) takes its place.
//
// WHAT IS NOT BUILT — `menu-list-row` and `menu-new-list-button` need a `lists`
// table and `tasks.list_id`, which do not exist (IA §7). The `YOUR LISTS`
// section is rendered as a label with no rows until the entity lands. The two
// ids stay in NOT_BUILT.
//
// The rail is a panel: bg.base on a bg.sunken canvas, radius.md, same gap as
// the other columns (tokens layout.panel pattern). CSS handles all of this via
// the same @container query that shows the rail.

import type { AppState } from '../../_shared/model/reducer.ts'
import { nowDate } from '../../_shared/model/clock.ts'
import { COLLECTION_GROUPS, collectionCount, collectionName } from '../../_shared/model/tasks.ts'
import type { Collection } from '../../_shared/model/tasks.ts'
import {
  CalendarDaysIcon,
  CheckIcon,
  ClockIcon,
  InboxIcon,
  SettingsIcon,
} from './icons.tsx'

function CollectionIcon({ c }: { c: Collection }) {
  switch (c) {
    case 'today':
      return <ClockIcon />
    case 'upcoming':
      return <CalendarDaysIcon />
    case 'inbox':
      return <InboxIcon />
    case 'done':
      return <CheckIcon />
  }
}

export function ListsRail({
  state,
  active,
  onPick,
  onSettings,
}: {
  state: AppState
  active: Collection
  onPick: (c: Collection) => void
  onSettings: () => void
}) {
  const now = nowDate()
  return (
    <aside className="rail" aria-label="Lists">
      <div className="rail-in">
        <p className="rail-word">todo-ai</p>
        {COLLECTION_GROUPS.map((group, i) => (
          <div key={group.join('-')} className={i === 0 ? 'rail-group' : 'rail-group filing'}>
            {group.map((c) => {
              const count = collectionCount(state.tasks, c, now)
              return (
                <button
                  key={c}
                  className={`rail-row${c === active ? ' on' : ''}`}
                  data-testid="rail-collection-row"
                  aria-current={c === active ? 'page' : undefined}
                  onClick={() => onPick(c)}
                >
                  <CollectionIcon c={c} />
                  {collectionName(c)}
                  {count > 0 && <span className="rail-count num">{count}</span>}
                </button>
              )
            })}
          </div>
        ))}
        <p className="rail-sub">Your lists</p>
        {/* personal-list rows go here when `lists` + `tasks.list_id` land (IA §7) */}
        <span className="spacer" />
        <button className="rail-row" data-testid="rail-settings-row" onClick={onSettings}>
          <SettingsIcon />
          Settings
        </button>
      </div>
    </aside>
  )
}
