// S4 Settings — components.md § SettingsRow.
//
// Two rows ship, and the count is the point. **Theme** is a capability the app
// has had all along with nowhere to control it: `tokens.json` publishes both
// palettes in full and the client only ever read the OS
// (`information-architecture.md § 3`, "a capability that exists today with no
// surface"). **About** is static.
//
// The **Talk back** row is drawn and is NOT built: F-002 is specced to
// revision 3 and unbuilt, and "a switch that toggles nothing is worse than an
// absent one" (§ SettingsRow). Its id is recorded in `SHELL_IDS_BLOCKED`.
// The `settings-row-retry` failed state is absent for a related reason with a
// different cause: the only shipped preference is local, so no row can fail to
// save. Both come back with the thing that makes them real.
//
// The "Settings" vocabulary collision (§ App shell, and IA § 8.1) has NOT been
// tripped by this file: the four permission messages that send a user to the OS
// Settings app render on Talk, and nothing here renders a permission message.
// The day one does, the OS one must be qualified — "system Settings" on iOS,
// "App info" on Android — in the same change.

import { Pressable, Text, View } from 'react-native'
import { ChevronLeft } from 'lucide-react-native'
import { SHELL_A11Y_IDS, a11yProps } from '../model/a11y.ts'
import type { MobilePlatform } from '../model/permissions.ts'
import { tokens } from '../model/theme.ts'
import { touchProps } from '../model/touch.ts'
import { useStyles } from './styles.ts'
import type { ThemeChoice } from './styles.ts'

const THEME_SEGMENTS: { value: ThemeChoice; label: string }[] = [
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
  { value: 'system', label: 'System' },
]

export function SettingsSurface({
  platform,
  theme,
  onThemeChange,
  onBack,
}: {
  platform: MobilePlatform
  theme: ThemeChoice
  onThemeChange: (t: ThemeChoice) => void
  onBack: () => void
}) {
  const { styles, colors } = useStyles()
  const backTouch = touchProps(SHELL_A11Y_IDS.settingsBackButton, platform)
  const segTouch = touchProps(SHELL_A11Y_IDS.settingsThemeControl, platform)

  return (
    <View style={styles.surface}>
      <View style={styles.topBar}>
        <Pressable
          {...a11yProps(SHELL_A11Y_IDS.settingsBackButton, { label: 'Back to Lists', role: 'button' })}
          hitSlop={backTouch.hitSlop}
          style={styles.ghostButton}
          onPress={onBack}
        >
          <ChevronLeft size={tokens.icon.size.md} color={colors.accent} strokeWidth={tokens.icon.stroke} />
          <Text style={styles.ghostButtonText}>Lists</Text>
        </Pressable>
        <View style={styles.barSpacer} />
        <Text style={styles.wordmark} accessibilityRole="header">
          Settings
        </Text>
        <View style={styles.barSpacer} />
      </View>

      <View style={styles.settingsRow}>
        <View>
          <Text style={styles.settingsLabel}>Theme</Text>
          <Text style={styles.settingsSub}>Dark is the default. Both are fully drawn.</Text>
        </View>
        <View
          {...a11yProps(SHELL_A11Y_IDS.settingsThemeControl, { label: 'Theme', role: 'none' })}
          style={styles.segment}
        >
          {THEME_SEGMENTS.map((s) => (
            <Pressable
              key={s.value}
              accessibilityLabel={s.label}
              accessibilityRole="button"
              accessibilityState={{ selected: theme === s.value }}
              hitSlop={segTouch.hitSlop}
              style={[styles.segmentButton, theme === s.value ? styles.segmentButtonOn : null]}
              onPress={() => onThemeChange(s.value)}
            >
              <Text style={[styles.segmentText, theme === s.value ? styles.segmentTextOn : null]}>
                {s.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.settingsRow}>
        <Text style={styles.settingsLabel}>About</Text>
        <View style={styles.barSpacer} />
        <Text style={styles.settingsSub}>todo-ai</Text>
      </View>
    </View>
  )
}
