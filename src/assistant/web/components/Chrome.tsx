// Top bar + drawer + offline banner — the app chrome around the two panes.
//
// OQ-1 (resolved in the design mockup): the assistant view sits ABOVE the
// existing navigation, it does not replace it. The drawer button stays
// reachable and switches the list's filter; the list itself never leaves the
// screen, because AC-1/AC-4 require an applied turn's changes to be visible in
// the list within the same turn.

import type { AppState } from '../../_shared/model/reducer.ts'
import type { ListFilter } from './TaskListPane.tsx'
import { formatTopDate } from '../../_shared/model/format.ts'
import { MenuIcon, WifiOffIcon } from './icons.tsx'

const FILTERS: { id: ListFilter; label: string }[] = [
  { id: 'all', label: 'Tất cả' },
  { id: 'today', label: 'Hôm nay' },
  { id: 'done', label: 'Đã xong' },
]

export function TopBar({
  drawerOpen,
  onToggleDrawer,
}: {
  drawerOpen: boolean
  onToggleDrawer: () => void
}) {
  return (
    <header className="topbar">
      <button
        className="icon-btn"
        data-testid="assistant-drawer-button"
        aria-label="Mở danh sách"
        aria-expanded={drawerOpen}
        onClick={onToggleDrawer}
      >
        <MenuIcon />
      </button>
      <span className="wordmark">todo-ai</span>
      <span className="topdate">{formatTopDate()}</span>
    </header>
  )
}

export function Drawer({
  filter,
  onPick,
}: {
  filter: ListFilter
  onPick: (f: ListFilter) => void
}) {
  return (
    <nav className="drawer" aria-label="Danh sách">
      {FILTERS.map((f) => (
        <button
          key={f.id}
          className={`drawer-row${f.id === filter ? ' active' : ''}`}
          aria-current={f.id === filter ? 'page' : undefined}
          onClick={() => onPick(f.id)}
        >
          {f.label}
        </button>
      ))}
    </nav>
  )
}

/** AC-25 / ADR-7: no half-running conversation — the surface says so and hands
 * over to the list, which keeps working by hand. A turn that was in flight
 * when the connection dropped is counted here and replays visibly. */
export function OfflineBanner({ state }: { state: AppState }) {
  if (!state.offline) return null
  const queued = state.queuedTurnId === null ? 0 : 1
  return (
    <div className="offline-banner" data-testid="assistant-offline-banner" role="status">
      <WifiOffIcon />
      Mất mạng — danh sách vẫn dùng được, việc nhập sẽ lưu tại máy.
      {queued > 0 && <span className="queued-count">{queued} câu đang chờ gửi</span>}
    </div>
  )
}
