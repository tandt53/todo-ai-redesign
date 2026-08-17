// The screen root. Thin by design (platform mobile.md: "components/ — RN
// screens/components (thin over model)"): every conversation decision already
// happened in `_shared/model` and the two controllers; this file subscribes and
// arranges.
//
// F-003 AC-10 lives here structurally: `KeyboardAvoidingView` is what keeps the
// software keyboard from occluding the composer or the newest message. It
// changes layout only — no conversation state moves when the keyboard does,
// which is why `keyboardChanged` on the controller dispatches nothing.

import { useState, useSyncExternalStore } from 'react'
import { KeyboardAvoidingView, Platform, View } from 'react-native'
import { undoableTurnId } from '../../_shared/model/reducer.ts'
import type { MobileAssistantController } from '../controller.ts'
import { OfflineBanner, TopBar } from './Chrome.tsx'
import { Composer } from './Composer.tsx'
import { ConversationList } from './ConversationList.tsx'
import { TaskList } from './TaskList.tsx'
import { VoiceSurface } from './VoiceSurface.tsx'
import { useStyles } from './styles.ts'

export function AssistantScreen({ controller }: { controller: MobileAssistantController }) {
  const { styles } = useStyles()
  const state = useSyncExternalStore(
    (cb) => controller.subscribe(cb),
    () => controller.state,
    () => controller.state,
  )
  // The list is visible by default: F-001 AC-1/AC-4 need an applied turn's
  // changes to be visible in the list within the same turn, so the drawer
  // button collapses it rather than the list living behind navigation.
  const [listOpen, setListOpen] = useState(true)
  const platform = controller.platform

  return (
    <View style={styles.screen}>
      <TopBar
        platform={platform}
        drawerOpen={listOpen}
        onToggleDrawer={() => setListOpen((v) => !v)}
      />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {listOpen && <TaskList state={state} controller={controller} platform={platform} />}
        <ConversationList
          state={state}
          controller={controller}
          undoableTurnId={undoableTurnId(state)}
          platform={platform}
        />
        <VoiceSurface state={state} controller={controller} platform={platform} />
        <OfflineBanner state={state} />
        <Composer state={state} controller={controller} platform={platform} />
      </KeyboardAvoidingView>
    </View>
  )
}
