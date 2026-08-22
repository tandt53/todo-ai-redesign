// The voice surface — exists only while listening or thinking, which is what
// makes F-001 AC-29's exclusivity observable by construction rather than by
// styling.
//
// The aurora gradient and its glow shadows are RETIRED (tokens.json motion
// rule). The surface now renders without the band; state is communicated by
// the state word alone.
//
// The Cancel pill is F-001 AC-3's thinking-state cancel and is CLIENT-LOCAL:
// there is no cancel endpoint, the sent turn still completes server-side, and
// its late outcome renders honestly as a message.

import { Pressable, Text, View } from 'react-native'
import type { AppState } from '../../_shared/model/reducer.ts'
import type { MobileAssistantController } from '../controller.ts'
import { A11Y_IDS, a11yProps } from '../model/a11y.ts'
import type { MobilePlatform } from '../model/permissions.ts'
import { showCancel, showStateIndicator } from '../model/surface.ts'
import { touchProps } from '../model/touch.ts'
import { useStyles } from './styles.ts'

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
