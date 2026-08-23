// The voice FAB — the floating action button that starts the Talk surface from
// Tasks (T-257). Replaces the PS-TALK path switch button below the split point.
//
// The design (`app-shell-ios.html .voice-fab`) puts it at bottom-right, accent
// coloured, 52x52, circular, with a mic icon. On a phone it is unconditional on
// the Tasks surface (hidden only at split+ width, which a phone never reaches,
// and during selection mode, which is not yet built).
//
// Pressing it switches to Talk, the same navigation PathSwitch performed for
// PS-TALK. The difference is the control: PS-TALK was a row in the header bar,
// the FAB floats over the task list.

import { Pressable } from 'react-native'
import { Mic } from 'lucide-react-native'
import { SHELL_A11Y_IDS, a11yProps } from '../model/a11y.ts'
import type { MobilePlatform } from '../model/permissions.ts'
import { tokens } from '../model/theme.ts'
import { touchProps } from '../model/touch.ts'
import { useStyles } from './styles.ts'

export function VoiceFab({
  platform,
  onPress,
}: {
  platform: MobilePlatform
  onPress: () => void
}) {
  const { styles, colors } = useStyles()
  const id = SHELL_A11Y_IDS.voiceFab
  const { hitSlop } = touchProps(id, platform)
  return (
    <Pressable
      {...a11yProps(id, { label: 'Talk', role: 'button' })}
      hitSlop={hitSlop}
      style={styles.voiceFab}
      onPress={onPress}
    >
      <Mic
        size={tokens.icon.size.lg}
        color={colors.text.onAccent}
        strokeWidth={tokens.icon.stroke}
      />
    </Pressable>
  )
}
