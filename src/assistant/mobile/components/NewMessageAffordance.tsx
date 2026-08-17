// The new-message affordance — F-001 AC-30, BUG-004's visible half.
//
// ONE control, however many messages arrived (AC-30(d)). That is structural
// here rather than asserted: this component is mounted once by
// `AssistantScreen` and only its props change, so N arrivals cannot produce N
// controls, and arrival number two cannot re-mount the control arrival number
// one put on screen.
//
// It decides nothing. Which row to show, what it says and what a screen reader
// hears are all `model/follow.ts`'s answers, transcribed from
// `design/_shared/components.md` § NewMessageAffordance — this file draws them.
//
// Tapping ONLY scrolls (components.md). It never answers, dismisses or resolves
// anything: the question's OptionChips remain the only way to answer (F-001
// AC-10), so the pill cannot become a second, quieter answer path.

import { Pressable, Text, View } from 'react-native'
import { ArrowDown } from 'lucide-react-native'
import { A11Y_IDS, a11yProps } from '../model/a11y.ts'
import type { AffordanceView } from '../model/follow.ts'
import type { MobilePlatform } from '../model/permissions.ts'
import { tokens } from '../model/theme.ts'
import { touchProps } from '../model/touch.ts'
import { useStyles } from './styles.ts'

export function NewMessageAffordance({
  view,
  platform,
  onPress,
}: {
  /** `null` is NMA-HIDDEN: the newest message is on screen. */
  view: AffordanceView | null
  platform: MobilePlatform
  onPress: () => void
}) {
  const { styles, colors } = useStyles()
  const { hitSlop } = touchProps(A11Y_IDS.newMessageAffordance, platform)
  const waiting = view !== null && view.row === 'NMA-WAITING'

  // The dock is always rendered and always zero-height, so NMA-HIDDEN reflows
  // nothing on the way in or out.
  return (
    <View style={styles.nmDock} pointerEvents="box-none">
      {view !== null && (
        <View style={styles.nmWrap} pointerEvents="box-none">
          <Pressable
            {...a11yProps(A11Y_IDS.newMessageAffordance, {
              // WCAG 2.5.3: the accessible name is the visible label followed by
              // the action, so the visible text is always a PREFIX of the name
              // and never a replacement.
              label: view.accessibleName,
              role: 'button',
            })}
            hitSlop={hitSlop}
            style={[styles.nmPill, waiting ? styles.nmPillWaiting : null]}
            onPress={onPress}
          >
            <ArrowDown
              size={tokens.icon.size.sm}
              color={waiting ? colors.question : colors.text.secondary}
              strokeWidth={tokens.icon.stroke}
            />
            {/* Two lines, not one. At 375pt a single non-wrapping line
                ellipsises the question away and leaves "Waiting for your answer
                — Delete …", which announces that something is pending while
                withholding what — the exact failure NMA-WAITING exists to
                prevent. `numberOfLines={2}` is the clamp; the accessible name
                above carries the untruncated string either way. */}
            <Text
              numberOfLines={2}
              style={[styles.nmLabel, waiting ? styles.nmLabelWaiting : null]}
            >
              {view.label}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  )
}
