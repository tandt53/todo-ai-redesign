// Composer — voice + text parity: typed input takes the same interpretation
// path as speech (F-001 AC-17). Never disabled: a pending question blocks
// nothing (AC-11), and offline the field still works through the local no-AI
// path (AC-25, F-003 AC-4).
//
// The mic's MODE is orthogonal to the four surface states (F-001
// AC-20/21/22): hidden when there is no capability, dimmed on permission
// denial or transient failure — the message says which, the orb only dims.
//
// F-003 AC-10: `onSubmitEditing` is the keyboard's own send action, and it
// takes exactly the same path as the send button; `blurOnSubmit={false}` keeps
// the keyboard from stealing a state change on its way out.

import { Mic, MicOff, ArrowUp } from 'lucide-react-native'
import { Pressable, TextInput, View } from 'react-native'
import { micMode } from '../../_shared/model/reducer.ts'
import type { AppState } from '../../_shared/model/reducer.ts'
import type { MobileAssistantController } from '../controller.ts'
import { A11Y_IDS, a11yProps } from '../model/a11y.ts'
import type { MobilePlatform } from '../model/permissions.ts'
import { showMic } from '../model/surface.ts'
import { tokens } from '../model/theme.ts'
import { touchProps } from '../model/touch.ts'
import { useStyles } from './styles.ts'

/** The orb's accessible name follows mode/state — the three published names are
 * `components.md` § MicControl A11y ("Tap to speak" / "Listening — tap to stop"
 * / "Microphone needs permission"). `dimmed-transient` has no published name:
 * the catalogue gives that mode a visible *message* naming the cause and says
 * only that the orb dims, so this one is implementation-authored and reported
 * as a gap for design to ratify. */
const MIC_LABEL: Record<string, string> = {
  listening: 'Listening — tap to stop',
  'dimmed-permission': 'Microphone needs permission',
  'dimmed-transient': 'Microphone temporarily unavailable',
  available: 'Tap to speak',
}

/** Composer placeholder, `components.md` § Composer "empty". The accessible
 * name is the same string so the visible label and the accessible name agree
 * (AC-19 / WCAG 2.5.3). */
const COMPOSER_PLACEHOLDER = 'Say or type what needs doing…'

export function Composer({
  state,
  controller,
  platform,
}: {
  state: AppState
  controller: MobileAssistantController
  platform: MobilePlatform
}) {
  const { styles, colors } = useStyles()
  const mode = micMode(state)
  const listening = state.surface === 'listening'
  const canSend = state.composer.trim() !== '' && state.surface !== 'thinking'
  const micLabel = listening ? MIC_LABEL['listening'] : (MIC_LABEL[mode] ?? MIC_LABEL['available'])
  const micTouch = touchProps(A11Y_IDS.micButton, platform)
  const sendTouch = touchProps(A11Y_IDS.composerSend, platform)
  const inputTouch = touchProps(A11Y_IDS.composerInput, platform)

  const submit = () => {
    if (!canSend) return
    void controller.send('typed')
  }

  return (
    <View style={styles.composer}>
      <TextInput
        {...a11yProps(A11Y_IDS.composerInput, { label: COMPOSER_PLACEHOLDER })}
        hitSlop={inputTouch.hitSlop}
        style={[styles.composerInput, listening ? styles.composerInputListening : null]}
        placeholder={COMPOSER_PLACEHOLDER}
        placeholderTextColor={colors.text.muted}
        value={state.composer}
        onChangeText={(text) => controller.composerChange(text)}
        onSubmitEditing={submit}
        blurOnSubmit={false}
        returnKeyType="send"
      />
      {showMic(state) && (
        <Pressable
          {...a11yProps(A11Y_IDS.micButton, {
            label: micLabel,
            role: 'button',
            state: { selected: listening },
          })}
          hitSlop={micTouch.hitSlop}
          style={[
            styles.mic,
            listening ? styles.micListening : null,
            state.surface === 'thinking' ? styles.micThinking : null,
            mode === 'dimmed-permission' || mode === 'dimmed-transient' ? styles.micDimmed : null,
          ]}
          onPress={() => controller.tapMic()}
        >
          {mode === 'dimmed-permission' ? (
            <MicOff
              size={tokens.icon.size.md}
              color={colors.text.primary}
              strokeWidth={tokens.icon.stroke}
            />
          ) : (
            <Mic
              size={tokens.icon.size.md}
              color={listening ? colors.accent : colors.text.primary}
              strokeWidth={tokens.icon.stroke}
            />
          )}
        </Pressable>
      )}
      <Pressable
        {...a11yProps(A11Y_IDS.composerSend, {
          label: 'Send',
          role: 'button',
          state: { disabled: !canSend },
        })}
        hitSlop={sendTouch.hitSlop}
        style={[styles.send, canSend ? null : styles.sendDisabled]}
        onPress={submit}
      >
        <ArrowUp
          size={tokens.icon.size.sm}
          color={colors.text.onAccent}
          strokeWidth={tokens.icon.stroke}
        />
      </Pressable>
    </View>
  )
}
