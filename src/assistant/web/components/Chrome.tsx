// Shell chrome: the PathSwitch, VoiceFab and the offline banner.
//
// OQ-1 IS ANSWERED (F-001 rev 4, Open Questions 1). The assistant does not sit
// above the list's navigation and does not replace it: the two are PEERS. So
// the drawer that used to toggle a pane beside the conversation is gone, and
// with it `assistant-drawer-button` — "retired by this IA … the hamburger stops
// toggling a pane and becomes navigation to a different surface, which is a
// different control wearing the same glyph" (components.md § Testid catalogue —
// app shell). Its replacement is `shell-lists-menu-button` on the Tasks bar.
//
// `shell-talk-button` is RETIRED. T-227 removed it from all three mockups;
// its below-split route to Talk is now `assistant-voice-fab` — the floating
// action button positioned at the bottom-right of the Tasks surface. The FAB
// opens Talk in one tap, which is the same guarantee PathSwitch carried.

import type { AppState } from '../../_shared/model/reducer.ts'
import { ListIcon, MicIcon, WifiOffIcon } from './icons.tsx'

/**
 * PS-TASKS — `todo-ai ADR-11`'s second path made reachable in one action from
 * the Talk surface, most of all from a failure.
 *
 * **Below-split-only, and by design.** At or above `tokens.json
 * breakpoints.split` both paths are permanently on screen, so this control
 * would switch to what the user is already looking at; styles.css hides it
 * there and a desktop selector for `shell-tasks-button` will not resolve,
 * which is the documented contract (components.md § AppFrame). The guarantee
 * it carries — visible and enabled in EVERY Talk failure state — is met more
 * strongly at that width, because the second path is never left at all.
 * Nothing here is ever disabled: AC-24's reachability bound requires the
 * affordance to survive the failure it is escaping from.
 *
 * The Talk direction (`shell-talk-button`) was retired by T-227 and replaced
 * by the VoiceFab below.
 */
export function PathSwitch({
  count,
  onGo,
}: {
  /** open tasks due today; zero renders NO badge — "a badge reading 0 is a
   * number pretending to be news" (components.md § PathSwitch) */
  count?: number
  onGo: () => void
}) {
  const showBadge = count !== undefined && count > 0
  // The badge is never the whole accessible name: a screen-reader user must not
  // have to guess what "3" counts (components.md § PathSwitch, A11y).
  const name = showBadge ? `Tasks, ${count} left today` : 'Tasks'
  return (
    <button
      className="path"
      data-testid="shell-tasks-button"
      aria-label={name}
      onClick={onGo}
    >
      <ListIcon />
      Tasks{' '}
      {/* `path-badge`, not `badge`: `.badge` is already the TaskRow's
          AI-change marker and is `display:none` until `.show` — reusing the
          name would have made this count invisible for a reason nothing on
          screen could explain. */}
      {showBadge && <span className="path-badge num">{count}</span>}
    </button>
  )
}

/**
 * Voice FAB — the floating action button that opens Talk below the split.
 *
 * **Replaces `shell-talk-button`** (retired T-227). Positioned absolutely at the
 * bottom-right of the `.app` container, hidden at or above the split (where the
 * Talk panel is permanently visible and a button to "go there" would be dead).
 * Hidden during selection mode (`data-selection`), since bulk operations own
 * the bottom of the screen.
 *
 * The mockup (app-shell.html, app-shell-ios.html) draws this as a circle with
 * the mic icon, accent background. Accessible name is "Talk" — AC-37:
 * the control navigates to the Talk surface, it does not start capture.
 */
export function VoiceFab({ onGo }: { onGo: () => void }) {
  return (
    <button
      className="voice-fab"
      data-testid="assistant-voice-fab"
      aria-label="Talk"
      onClick={onGo}
    >
      <MicIcon />
    </button>
  )
}

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
