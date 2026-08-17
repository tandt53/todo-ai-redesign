// S3 Lists menu — components.md § ListsMenu.
//
// A slide-over panel from the left with a scrim and an explicit close control,
// at every width and on every platform (on Android that is Material's own
// navigation drawer; on iOS it is borrowed knowingly rather than forking the id
// catalogue between a push and a sheet).
//
// WHAT IS DELIBERATELY MISSING, AND WHY IT IS NOT AN OVERSIGHT
//
// The **personal-lists section** and the **New list** row are absent. They need
// a `lists` table and `tasks.list_id`, and neither exists
// (`information-architecture.md § 7`; `src/assistant/api/types.ts` has `status`
// and nothing else that groups). Their ids are recorded in
// `SHELL_IDS_BLOCKED` with that reason, so the omission is a decision a test
// can read rather than a gap someone has to notice. The same goes for
// `menu-retry-button`: it retries the personal-lists read, and the built-in
// collections are derived on device and never load.
//
// What IS here is § ListsMenu's own floor: "the menu is never empty, it always
// holds the built-ins, New list and Settings", and "navigation must never be
// the thing that breaks" — the three collections and Settings are derivable on
// device, so no failure state can take them away.

import { Pressable, Text, View } from 'react-native'
import { Check, Clock, Inbox, Settings, X } from 'lucide-react-native'
import type { AppState } from '../../_shared/model/reducer.ts'
import { SHELL_A11Y_IDS, a11yProps } from '../model/a11y.ts'
import type { MobilePlatform } from '../model/permissions.ts'
import { COLLECTIONS, collectionCount, collectionName } from '../model/tasks-view.ts'
import type { Collection } from '../model/tasks-view.ts'
import { tokens } from '../model/theme.ts'
import { touchProps } from '../model/touch.ts'
import { useStyles } from './styles.ts'

const ICON: Record<Collection, typeof Clock> = {
  today: Clock,
  inbox: Inbox,
  done: Check,
}

export function ListsMenu({
  state,
  platform,
  collection,
  onSelect,
  onClose,
  onOpenSettings,
}: {
  state: AppState
  platform: MobilePlatform
  collection: Collection
  onSelect: (c: Collection) => void
  onClose: () => void
  onOpenSettings: () => void
}) {
  const { styles, colors } = useStyles()
  const closeTouch = touchProps(SHELL_A11Y_IDS.menuCloseButton, platform)
  const rowTouch = touchProps(SHELL_A11Y_IDS.menuCollectionRow, platform)
  const settingsTouch = touchProps(SHELL_A11Y_IDS.menuSettingsRow, platform)

  return (
    <>
      <Pressable style={styles.scrim} accessibilityLabel="Close" onPress={onClose} />
      <View style={styles.menuPanel} accessibilityViewIsModal accessibilityLabel="Lists">
        <View style={styles.menuHead}>
          <Text style={styles.wordmark}>todo-ai</Text>
          <View style={styles.barSpacer} />
          <Pressable
            {...a11yProps(SHELL_A11Y_IDS.menuCloseButton, { label: 'Close', role: 'button' })}
            hitSlop={closeTouch.hitSlop}
            style={styles.iconButton}
            onPress={onClose}
          >
            <X size={tokens.icon.size.md} color={colors.primary} strokeWidth={tokens.icon.stroke} />
          </Pressable>
        </View>

        {COLLECTIONS.map((c) => {
          const Icon = ICON[c]
          const active = c === collection
          const count = collectionCount(state.tasks, c)
          return (
            <Pressable
              key={c}
              {...a11yProps(SHELL_A11Y_IDS.menuCollectionRow, {
                label: count === 0 ? collectionName(c) : `${collectionName(c)}, ${count}`,
                role: 'button',
                state: { selected: active },
              })}
              hitSlop={rowTouch.hitSlop}
              style={[styles.menuRow, active ? styles.menuRowActive : null]}
              onPress={() => onSelect(c)}
            >
              <Icon
                size={tokens.icon.size.md}
                color={active ? colors.primary : colors.text.primary}
                strokeWidth={tokens.icon.stroke}
              />
              <Text style={[styles.menuRowText, active ? styles.menuRowTextActive : null]}>
                {collectionName(c)}
              </Text>
              {/* counts are omitted at zero, for the same reason PS-TASKS omits
                  its badge */}
              {count > 0 && <Text style={styles.menuCount}>{count}</Text>}
            </Pressable>
          )
        })}

        <View style={styles.menuFoot}>
          <Pressable
            {...a11yProps(SHELL_A11Y_IDS.menuSettingsRow, { label: 'Settings', role: 'button' })}
            hitSlop={settingsTouch.hitSlop}
            style={styles.menuRow}
            onPress={onOpenSettings}
          >
            <Settings size={tokens.icon.size.md} color={colors.text.primary} strokeWidth={tokens.icon.stroke} />
            <Text style={styles.menuRowText}>Settings</Text>
          </Pressable>
        </View>
      </View>
    </>
  )
}
