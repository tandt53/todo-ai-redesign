// The offline banner — the one piece of chrome that belongs to BOTH peers.
//
// `TopBar` and its `assistant-drawer-button` are GONE. The drawer toggled a
// task pane inside the conversation; with the list on its own surface the
// conversation has no pane to toggle, and the hamburger that remains is
// navigation on the Tasks surface — "a different control wearing the same
// glyph" (components.md § Testid catalogue — app shell), carrying
// `shell-lists-menu-button`. The bar each peer draws is `ShellBar` in
// `PathSwitch.tsx`, so the reciprocal control cannot end up in two places.

import { Text, View } from 'react-native'
import { WifiOff } from 'lucide-react-native'
import type { AppState } from '../../_shared/model/reducer.ts'
import { A11Y_IDS, a11yProps } from '../model/a11y.ts'
import { showOfflineBanner } from '../model/surface.ts'
import { tokens } from '../model/theme.ts'
import { useStyles } from './styles.ts'

/** F-001 AC-25 / F-003 AC-4: no half-running conversation — the surface says
 * it is offline and hands over to the list, which keeps working by hand.
 *
 * Rendered on **both** peers, which is AC-25's rev-4 addition: "a handover that
 * delivers the user to a surface which looks healthy — while their creates are
 * local-only and their queued turn is unsent — has told them the truth on the
 * one surface they just left. The banner belongs on both, or the handover is a
 * demotion disguised as a fallback." */
export function OfflineBanner({ state }: { state: AppState }) {
  const { styles, colors } = useStyles()
  if (!showOfflineBanner(state)) return null
  const queued = state.queuedTurnId === null ? 0 : 1
  return (
    <View {...a11yProps(A11Y_IDS.offlineBanner)} style={styles.offlineBanner} accessible>
      <WifiOff size={tokens.icon.size.sm} color={colors.question} strokeWidth={tokens.icon.stroke} />
      {/* Banner copy is `components.md` § OfflineBanner, verbatim. The
          queued-turn count is only described there ("Shows queued-turn count
          when one is in flight"), not worded — reported as a copy gap. */}
      <Text style={styles.offlineText}>
        No connection — the list still works, and what you type is saved on the device.
        {queued > 0 ? ` ${queued} waiting to send.` : ''}
      </Text>
    </View>
  )
}
