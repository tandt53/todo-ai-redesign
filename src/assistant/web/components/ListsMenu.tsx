// S3 · LISTS MENU — a slide-over panel from the left, at EVERY width.
//
// Considered and rejected by design: a permanent rail at ≥ 1024px. "It is
// navigation you visit and leave, not a frame you work inside, and two
// presentations mean two behaviours to spec, build and test — one of which (the
// rail) has no close control, so its testid can never resolve at desktop"
// (components.md § ListsMenu). One presentation, one contract.
//
// WHAT IS NOT BUILT, AND WHY — the personal-lists section (LM-LIST) and the
// `New list` row (LM-ACTION). Both need a `lists` table and `tasks.list_id`,
// and neither exists in `src/assistant/api/types.ts` (IA §7). Drawing them here
// with nothing behind them is exactly the half-built failure §7 exists to
// prevent, so `menu-list-row`, `menu-new-list-button` and `menu-retry-button`
// (which reports a personal-lists read that never happens) are absent rather
// than inert.
//
// The built-in collections are derivable on device and never wait on a network,
// so this menu has no loading state of its own — which is also why the failed
// state that `menu-retry-button` belongs to cannot arise yet. What it does keep
// is the rule underneath all of that: **navigation must never be the thing that
// breaks.** Settings and the four collections are live unconditionally.
//
// **All four rows, not three.** Rendering `COLLECTIONS` in full is what makes
// F-001 AC-24's reachability bound true since ADR-009 § Amendment: Inbox stopped
// being a superset of every open task, so the bound rests on the four buckets
// being total, and totality is only reachability if every bucket is openable.
// Drop the Upcoming row and a future-dated task is in no collection the user can
// reach — and nothing errors. `Upcoming` ships with no count in every account
// today, because nothing in the live store is dated in the future; that is the
// omit-at-zero rule working, not a broken row.

import { useEffect } from 'react'
import type { AppState } from '../../_shared/model/reducer.ts'
import { COLLECTIONS, collectionCount, collectionName } from '../../_shared/model/tasks.ts'
import type { Collection } from '../../_shared/model/tasks.ts'
import {
  CalendarDaysIcon,
  CheckIcon,
  ClockIcon,
  CloseIcon,
  InboxIcon,
  SettingsIcon,
} from './icons.tsx'

/** A `switch` over the closed union rather than a chain ending in a fallback:
 * the fallback used to hand `Done`'s check to anything it did not recognise, so
 * adding Upcoming would have drawn a tick beside it and nothing would have
 * failed. Now a fifth collection is a typecheck error here. */
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

export function ListsMenu({
  state,
  active,
  onPick,
  onSettings,
  onClose,
}: {
  state: AppState
  active: Collection
  onPick: (c: Collection) => void
  onSettings: () => void
  onClose: () => void
}) {
  // A slide-over that cannot be dismissed from the keyboard is a trap; the
  // close control is the visible half of the same obligation.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    globalThis.addEventListener('keydown', onKey)
    return () => globalThis.removeEventListener('keydown', onKey)
  }, [onClose])

  const now = new Date()
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <nav className="menu" aria-label="Lists">
        <div className="menu-head">
          <span className="wordmark">todo-ai</span>
          <button
            className="icon-btn"
            data-testid="menu-close-button"
            aria-label="Close"
            onClick={onClose}
          >
            <CloseIcon />
          </button>
        </div>
        <div className="menu-scroll">
          {COLLECTIONS.map((c) => {
            const count = collectionCount(state.tasks, c, now)
            return (
              <button
                key={c}
                className={`menu-row${c === active ? ' active' : ''}`}
                data-testid="menu-collection-row"
                aria-current={c === active ? 'page' : undefined}
                onClick={() => onPick(c)}
              >
                <CollectionIcon c={c} />
                {collectionName(c)}{' '}
                {/* omitted at zero, for the same reason PS-TASKS omits its
                    badge (components.md § ListsMenu) */}
                {count > 0 && <span className="mcount num">{count}</span>}
              </button>
            )
          })}
        </div>
        <div className="menu-foot">
          <button className="menu-row" data-testid="menu-settings-row" onClick={onSettings}>
            <SettingsIcon />
            Settings
          </button>
        </div>
      </nav>
    </>
  )
}
