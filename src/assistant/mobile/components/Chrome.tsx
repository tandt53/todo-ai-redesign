// Top bar, drawer button and the offline banner — the chrome around the two
// panes. Thin renderers: every decision was already made in `model/`.

import { Pressable, Text, View } from 'react-native'
import { Menu, WifiOff } from 'lucide-react-native'
import type { AppState } from '../../_shared/model/reducer.ts'
import { formatTopDate } from '../../_shared/model/format.ts'
import { A11Y_IDS, a11yProps } from '../model/a11y.ts'
import type { MobilePlatform } from '../model/permissions.ts'
import { showOfflineBanner } from '../model/surface.ts'
import { tokens } from '../model/theme.ts'
import { touchProps } from '../model/touch.ts'
import { useStyles } from './styles.ts'

export function TopBar({
  platform,
  drawerOpen,
  onToggleDrawer,
}: {
  platform: MobilePlatform
  drawerOpen: boolean
  onToggleDrawer: () => void
}) {
  const { styles, colors } = useStyles()
  const { hitSlop } = touchProps(A11Y_IDS.drawerButton, platform)
  return (
    <View style={styles.topBar}>
      <Pressable
        {...a11yProps(A11Y_IDS.drawerButton, {
          label: 'Open list',
          role: 'button',
          state: { selected: drawerOpen },
        })}
        hitSlop={hitSlop}
        style={styles.iconButton}
        onPress={onToggleDrawer}
      >
        <Menu size={tokens.icon.size.md} color={colors.primary} strokeWidth={tokens.icon.stroke} />
      </Pressable>
      <Text style={styles.wordmark}>todo-ai</Text>
      <Text style={styles.topDate}>{formatTopDate()}</Text>
    </View>
  )
}

/** F-001 AC-25 / F-003 AC-4: no half-running conversation — the surface says
 * it is offline and hands over to the list, which keeps working by hand. */
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
