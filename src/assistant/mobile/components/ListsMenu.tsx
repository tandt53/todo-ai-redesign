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
// the thing that breaks" — the four collections and Settings are derivable on
// device, so no failure state can take them away.
//
// **TWO GROUPS, NOT ONE COLUMN** (components.md § ListsMenu, "Where the Inbox
// row sits"). `Today · Upcoming · Done`, a break, then Inbox at the head of the
// filing rows — the same order and the same break as the web client, because
// both read `COLLECTION_GROUPS` rather than each spelling the order for itself
// (F-003 AC-1's parity claim is only true if that is one fact, not two that
// agree today). The built-ins stopped being four of a kind at ADR-009
// § Amendment 2: three are views computed from the task's own fields, Inbox is
// the container a task lives in. The break also retires an arithmetic claim the
// uniform column was making — Inbox's count CONTAINS Today's and Upcoming's, so
// the column does not sum to a headcount, and the overlap lives exactly where
// the break is drawn.
//
// The break is **space** — no rule, no header, no divider view. A header would
// have to be a word true of both Inbox and the user's own lists, and there is
// none: `Lists` inside the Lists menu is self-referential, `Your lists` is
// false of Inbox, which belongs to the app.
//
// **No id moves.** Inbox keeps `menuCollectionRow`: LM-COLLECTION means rows
// the app always has and derives on device, which Inbox is whichever group it
// renders in.
//
// **Every row, not a subset.** F-001 AC-24's reachability bound rests on the
// FILING axis since § Amendment 2 § 6 — it is total and every cell of it is
// openable, today Inbox alone holding every open task. Upcoming's own row is
// narrowed rather than retracted: without it a future-dated task is unreachable
// *as a dated task*, with nothing erroring.

import { Pressable, Text, View } from 'react-native'
import { CalendarDays, Check, Clock, Inbox, Settings, X } from 'lucide-react-native'
import type { AppState } from '../../_shared/model/reducer.ts'
import { SHELL_A11Y_IDS, a11yProps } from '../model/a11y.ts'
import type { MobilePlatform } from '../model/permissions.ts'
import { COLLECTION_GROUPS, collectionCount, collectionName } from '../model/tasks-view.ts'
import type { Collection } from '../model/tasks-view.ts'
import { tokens } from '../model/theme.ts'
import { touchProps } from '../model/touch.ts'
import { useStyles } from './styles.ts'

// Upcoming is Lucide `calendar-days` (components.md § ListsMenu, "Look"):
// Today already carries `clock`, and clock-versus-calendar reads as
// now-versus-ahead without a label. `Record<Collection, …>` is what makes a
// fifth collection a typecheck failure here rather than a blank icon.
const ICON: Record<Collection, typeof Clock> = {
  today: Clock,
  upcoming: CalendarDays,
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
            <X size={tokens.icon.size.md} color={colors.accent} strokeWidth={tokens.icon.stroke} />
          </Pressable>
        </View>

        {COLLECTION_GROUPS.map((group, i) => (
          // The break is the gap between these views — space, no divider. The
          // first group carries no top margin so nothing above it moves.
          <View key={group.join('-')} style={i === 0 ? undefined : styles.menuFilingGroup}>
            {group.map((c) => {
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
                    color={active ? colors.accent : colors.text.primary}
                    strokeWidth={tokens.icon.stroke}
                  />
                  <Text style={[styles.menuRowText, active ? styles.menuRowTextActive : null]}>
                    {collectionName(c)}
                  </Text>
                  {/* counts are omitted at zero — "a badge reading 0 is a
                      number pretending to be news" */}
                  {count > 0 && <Text style={styles.menuCount}>{count}</Text>}
                </Pressable>
              )
            })}
          </View>
        ))}

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
