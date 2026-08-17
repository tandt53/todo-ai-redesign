// components.md § PathSwitch — the reciprocal one-tap move between the two
// peers, and on a phone the whole of `todo-ai ADR-11`'s second path.
//
// Unconditional on mobile. Above `tokens.json breakpoints.split` this control
// does not exist at all (both surfaces are on screen, and a control that
// switches to what you are already looking at is dead) — but a phone is never
// above the split, so there is no width branch here and none in `shell.ts`.
//
// **Visible and enabled in EVERY state, failures included** (F-001 AC-24's
// reachability bound). Nothing in this file can disable it: there is no
// `disabled` prop, which is a cheaper guarantee than remembering not to pass
// one.

import type { ReactNode } from 'react'
import { Pressable, Text, View } from 'react-native'
import { List, Mic } from 'lucide-react-native'
import { SHELL_A11Y_IDS, a11yProps } from '../model/a11y.ts'
import type { MobilePlatform } from '../model/permissions.ts'
import type { PathSwitchView } from '../model/shell.ts'
import { tokens } from '../model/theme.ts'
import { touchProps } from '../model/touch.ts'
import { useStyles } from './styles.ts'

export function PathSwitch({
  view,
  platform,
  onPress,
}: {
  view: PathSwitchView
  platform: MobilePlatform
  onPress: () => void
}) {
  const { styles, colors } = useStyles()
  const id = view.row === 'PS-TASKS' ? SHELL_A11Y_IDS.pathTasks : SHELL_A11Y_IDS.pathTalk
  const { hitSlop } = touchProps(id, platform)
  const Icon = view.row === 'PS-TASKS' ? List : Mic
  return (
    <Pressable
      {...a11yProps(id, { label: view.accessibleName, role: 'button' })}
      hitSlop={hitSlop}
      style={styles.pathButton}
      onPress={onPress}
    >
      <Icon size={tokens.icon.size.md} color={colors.text.primary} strokeWidth={tokens.icon.stroke} />
      <Text style={styles.pathLabel}>{view.label}</Text>
      {/* Zero renders NO badge — "a badge reading 0 is a number pretending to
          be news". The count is never the accessible name on its own; the name
          is the label plus the count as a sentence, so a screen-reader user
          does not have to guess what "3" counts. */}
      {view.badge !== null && (
        <Text style={styles.pathBadge} accessibilityElementsHidden importantForAccessibility="no">
          {view.badge}
        </Text>
      )}
    </Pressable>
  )
}

/** The bar PathSwitch sits in: wordmark left, control right. Shared by both
 * peers so the control cannot end up in two different places. */
export function ShellBar({ left, children }: { left?: ReactNode; children: ReactNode }) {
  const { styles } = useStyles()
  return (
    <View style={styles.topBar}>
      {left}
      <View style={styles.barSpacer} />
      {children}
    </View>
  )
}
