// The voice surface — the ONE place `gradient.voice` is legal (DESIGN.md
// colour rule 4, tokens.gradient.voice.scope). It exists only while listening
// or thinking, which is what makes F-001 AC-29's exclusivity observable by
// construction rather than by styling.
//
// The Cancel pill is F-001 AC-3's thinking-state cancel and is CLIENT-LOCAL:
// there is no cancel endpoint, the sent turn still completes server-side, and
// its late outcome renders honestly as a message.

import { Pressable, Text, View } from 'react-native'
import { Defs, LinearGradient, Rect, Stop, Svg } from 'react-native-svg'
import type { AppState } from '../../_shared/model/reducer.ts'
import type { MobileAssistantController } from '../controller.ts'
import { A11Y_IDS, a11yProps } from '../model/a11y.ts'
import type { MobilePlatform } from '../model/permissions.ts'
import { showCancel, showStateIndicator } from '../model/surface.ts'
import { voiceGradient } from '../model/theme.ts'
import { touchProps } from '../model/touch.ts'
import { useStyles } from './styles.ts'

/** The cyan→violet aurora band. Both stops and the angle come from
 * `tokens.gradient.voice`; nothing here picks a colour. */
function AuroraBand({ listening }: { listening: boolean }) {
  const [from, to] = voiceGradient.stops
  return (
    <Svg height={6} width="100%" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Defs>
        <LinearGradient id="voice" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={from} stopOpacity={listening ? 1 : 0.5} />
          <Stop offset="1" stopColor={to} stopOpacity={listening ? 0.5 : 1} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="6" fill="url(#voice)" />
    </Svg>
  )
}

export function VoiceSurface({
  state,
  controller,
  platform,
}: {
  state: AppState
  controller: MobileAssistantController
  platform: MobilePlatform
}) {
  const { styles } = useStyles()
  if (!showStateIndicator(state)) return null
  const listening = state.surface === 'listening'
  const cancelTouch = touchProps(A11Y_IDS.cancelButton, platform)

  return (
    <View style={styles.voiceSurface}>
      <AuroraBand listening={listening} />
      <View
        {...a11yProps(A11Y_IDS.stateIndicator, {
          label: listening ? 'Listening…' : 'Thinking…',
        })}
        accessible
        style={styles.stateIndicator}
      >
        <Text style={styles.stateWord}>{listening ? 'Listening…' : 'Thinking…'}</Text>
        {showCancel(state) && (
          <Pressable
            {...a11yProps(A11Y_IDS.cancelButton, {
              label: 'Cancel — your words stay in the composer',
              role: 'button',
            })}
            hitSlop={cancelTouch.hitSlop}
            style={styles.cancelButton}
            onPress={() => controller.cancelThinking()}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </Pressable>
        )}
      </View>
    </View>
  )
}
