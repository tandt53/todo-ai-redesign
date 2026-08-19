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
// **TWO GROUPS, NOT ONE COLUMN** (components.md § ListsMenu, "Where the Inbox
// row sits"). `Today · Upcoming · Done`, a break, then Inbox at the head of the
// filing rows. The four built-ins stopped being four of a kind at ADR-009
// § Amendment 2: three are views computed from the task's own fields and Inbox
// is a container — the first cell of an axis whose other cells are the personal
// lists two families down. A uniform column asserts a kinship the model does
// not have, in the one place a user reads the model at all, and it asserts the
// arithmetic too: Inbox's count CONTAINS Today's and Upcoming's, so the column
// does not sum to a headcount. Numbers look like they should add up when the
// rows carrying them look like siblings; the break is what retires that claim.
// The overlap lives between the groups, which is where the break is drawn.
//
// **The break is space — no rule, no header.** Whitespace groups before borders
// do, and a header would have to be a word true of both Inbox and the user's
// own lists: `Lists` inside the Lists menu is self-referential, and `Your lists`
// is false of Inbox, which belongs to the app.
//
// **The testid does not move, and that is the correct split rather than a
// convenience.** Inbox keeps `menu-collection-row`: LM-COLLECTION means *rows
// the app always has and computes on device*, LM-LIST means *rows fetched per
// user, which can skeleton and can fail*. Inbox is a built-in by that test
// whichever group it renders in — and in the failed state it must still render
// its count, because a menu whose failure strands every open task is exactly
// what "navigation must never be the thing that breaks" forbids.
//
// **Every row, not a subset.** F-001 AC-24's reachability bound rests on the
// FILING axis since § Amendment 2 § 6: that axis is total and every cell of it
// is openable, which today is Inbox alone holding every open task. Upcoming's
// own row is narrowed rather than retracted — without it a future-dated task is
// unreachable *as a dated task*. `Upcoming` ships with no count in every account
// today, because nothing in the live store is dated in the future; that is the
// omit-at-zero rule working, not a broken row.

import { useEffect } from 'react'
import type { AppState } from '../../_shared/model/reducer.ts'
import { nowDate } from '../../_shared/model/clock.ts'
import { COLLECTION_GROUPS, collectionCount, collectionName } from '../../_shared/model/tasks.ts'
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

  // F-005 AC-44 — **the injected clock, not an inline `new Date()`.** The per-row
  // counts here are date computations, so they resolve against the one seam like
  // every other one; `nowDate()` reads the provider `web/main.tsx` installs from
  // `ControllerDeps.now`, which `window.__assistantSeams.setClock` drives. A
  // component minting its own instant is a clock the harness cannot hold.
  const now = nowDate()
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
          {COLLECTION_GROUPS.map((group, i) => (
            // The group break is the gap between these blocks — space, not a
            // rule and not a header. `menu-group` after the first carries the
            // margin; the rows inside are identical in every other respect,
            // which is the point: same anatomy, same testid, different kind.
            <div key={group.join('-')} className={i === 0 ? 'menu-group' : 'menu-group filing'}>
              {group.map((c) => {
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
          ))}
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
