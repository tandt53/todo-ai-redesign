// Shell chrome: the offline banner.
//
// `shell-tasks-button` (PathSwitch) is RETIRED (T-333). The task list is home
// at every width (information-architecture.md §4, revised 2026-08-24): there is
// no surface to switch to, so there is no switch. The way to Talk is the mic —
// AC-37's TaskBottomBar below the split; above it, Talk is always on screen.
// Dismissing Talk returns to the list (close or Escape).
//
// `shell-talk-button` was RETIRED by T-227.
// `assistant-voice-fab` (VoiceFab) was RETIRED by T-321.

import type { AppState } from '../../_shared/model/reducer.ts'
import { WifiOffIcon } from './icons.tsx'

/**
 * AC-25 / ADR-7: no half-running conversation — the surface says so and hands
 * over to the list, which keeps working by hand.
 *
 * **One banner, at the app root, and that is a deliberate departure from where
 * the mockup draws it.** AC-25 rev 4 requires the notice on the list *as well
 * as* on the conversation; `app-shell.html` draws it twice, once per surface,
 * under one testid. Two nodes would mean two visible banners side by side at or
 * above the split, where both surfaces are on screen — and two implementations
 * of one obligation, which is the shape L-005 records. Rendered once above both
 * surfaces it is on the conversation and on the list at every width, by
 * construction, and the id still resolves to exactly one element.
 */
export function OfflineBanner({ state }: { state: AppState }) {
  if (!state.offline) return null
  const queued = state.queuedTurnId === null ? 0 : 1
  return (
    <div className="offline-banner" data-testid="assistant-offline-banner" role="status">
      <WifiOffIcon />
      No connection — the list still works, and what you type is saved on the device.
      {queued > 0 && <span className="queued-count">{queued} waiting to send</span>}
    </div>
  )
}
