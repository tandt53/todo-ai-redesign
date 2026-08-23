// § CarriedNotice on the phone — the RENDERING half. The selection, ordering and
// copy are `model/carried.ts`'s; this file is thin over it, which is this module's
// standing rule (platform mobile.md: "components/ — RN screens/components (thin
// over model)") and the only reason any of this is testable in a node tier.
//
// ── WHY IT IS MOUNTED AT THE FRAME AND NOT INSIDE A SURFACE ─────────────────
//
// AC-47: *"'Persists' is not 'is visible'"*. Three readings are three different
// products — scoped to Tasks, re-appearing only on return to Tasks, or **visible
// wherever the user is** — and only the third makes AC-2's promise true. Design
// D24 then tightened the verb from *reachable* to **visible**, which rules out a
// badge-then-tap design in which the user's typed value is one navigation away
// during an outage: a value one navigation away is the loss this AC exists to
// prevent, wearing an affordance. So there is no badge, no collapsed pill and no
// "N unsaved changes" door.
//
// It is therefore rendered by `AssistantScreen` — the frame — and **not** by
// `ShellHost`. That is load-bearing rather than tidy: `ShellHost` returns early
// for S4 Settings, so a region mounted inside it would be **invisible on
// Settings**, and AC-47's requirement (visible on Talk and Settings) would be met
// at three of five surfaces, which is the failure mode the AC names. Design says
// the same thing structurally: the stacked surfaces slide over the content and
// **under** this region.
//
// ── THERE IS NO TIMER IN THIS FILE ─────────────────────────────────────────
//
// Not an omission — the requirement. Every row ends by the user's own act or by a
// reload; nothing here is withdrawn by elapsing, by a navigation, by a surface
// change, or by a retry that fails again. Because there is no time limit, WCAG
// 2.2.1 is not engaged at all.
//
// ── ANNOUNCEMENT ───────────────────────────────────────────────────────────
//
// `polite`, never `assertive` — nothing here is time-critical, the family's whole
// promise is that it waits, and interrupting would claim an urgency it does not
// have. React Native has no live region, so the announcement is imperative and
// goes through the controller's announcer, which is the same port and the same
// rule as every other announcement on this client. It **never takes focus**:
// focus stays where the action left it.

import { Pressable, ScrollView, Text, View } from 'react-native'
import { CornerUpLeft, History, Trash2, WifiOff, X } from 'lucide-react-native'
import { AlertCircle } from 'lucide-react-native'
import {
  CN_ACTIONS,
  regionName,
  valueText,
} from '../../_shared/model/notice-copy.ts'
import type { AppState } from '../../_shared/model/reducer.ts'
import type { MobileAssistantController } from '../controller.ts'
import {
  CARRIED_VISIBLE_ROWS_BELOW_SPLIT,
  carriedRegionOccupied,
  carriedRows,
} from '../model/carried.ts'
import type { CarriedFieldBlock, CarriedRow, CarriedRowId } from '../model/carried.ts'
import { SHELL_A11Y_IDS, a11yProps } from '../model/a11y.ts'
import type { MobilePlatform } from '../model/permissions.ts'
import { tokens } from '../model/theme.ts'
import { minTouchSize } from '../model/touch.ts'
import { useStyles } from './styles.ts'

/**
 * § CarriedNotice's icon table. **Every assignment already exists elsewhere in the
 * catalogue and none of them is a new meaning** — the words carry the meaning
 * alone, in every row (§ Colour rules 1 and 3).
 *
 * `CN-UNDO` **must not be violet**: § UndoAffordance fixes violet as *the
 * assistant's own act*, and AC-43's offer reverses the **user's** act. The
 * constraint travels with the affordance wherever it renders, which since the
 * owner's decision of 2026-08-19 is here.
 */
function RowIcon({ id, colors }: { id: CarriedRowId; colors: ReturnType<typeof useStyles>['colors'] }) {
  const size = tokens.icon.size.sm
  const stroke = tokens.icon.stroke
  switch (id) {
    case 'CN-FAILED':
      // `danger` — § InlineRetryBanner already uses a danger icon for a write that
      // failed.
      return <AlertCircle size={size} color={colors.danger} strokeWidth={stroke} />
    case 'CN-OFFLINE':
      // `attention` — § OfflineBanner already carries the offline news in that accent.
      return <WifiOff size={size} color={colors.attention} strokeWidth={stroke} />
    case 'CN-SUPERSEDED':
      // nothing is wrong and there is no action
      return <History size={size} color={colors.text.muted} strokeWidth={stroke} />
    case 'CN-DELETED':
      return <Trash2 size={size} color={colors.text.muted} strokeWidth={stroke} />
    case 'CN-UNDO':
    case 'CN-UNDONE':
      return <CornerUpLeft size={size} color={colors.text.muted} strokeWidth={stroke} />
  }
}

/**
 * One field block. **The user's own words are not chrome and are never muted** —
 * design puts the typed value at `text.primary` while its label is `text.muted`,
 * which is the opposite of the usual emphasis and is the point.
 *
 * The value renders in full, wrapping; past three lines the block's value area
 * scrolls within itself. It is **never truncated with an ellipsis**: *carries the
 * user's value* is the component's reason to exist, and a value the user cannot
 * read back is not carried.
 */
function FieldBlock({
  block,
  taskId,
  controller,
  platform,
}: {
  block: CarriedFieldBlock
  taskId: string
  controller: MobileAssistantController
  platform: MobilePlatform
}) {
  const { styles } = useStyles()
  // F-003 AC-9 — built to 44/48 by construction rather than measured against a
  // floor design has not published yet (see `minTouchSize`). The rendered
  // measurement stays device-lab debt, as it does for every AC-9 obligation.
  const minTouch = minTouchSize(platform)
  return (
    <View style={styles.cnBlock}>
      <Text style={styles.cnFieldLabel}>{block.label}</Text>
      <ScrollView style={styles.cnValueScroll} nestedScrollEnabled>
        <Text style={styles.cnValue}>{valueText(block.value)}</Text>
      </ScrollView>
      {/* CN-SUPERSEDED's per-field report: what the field holds instead, so the
          notice says WHICH newer value it holds rather than merely that it moved. */}
      {block.superseded && block.storedNow !== undefined && (
        <Text style={styles.cnSuperseded}>Now saved {valueText(block.storedNow)}</Text>
      )}
      {/* **Retry is per field, not per row** (AC-2: each keeps its own value and
          its own retry). A row with two failed fields carries two of these and each
          resolves only its own field. A superseded field carries NONE — a retry
          there overwrites the newer stored value with the stale failed one, which
          is the resurrection door AC-4 and AC-47 close everywhere else.

          It keeps § Buttons' `ghost` variant: retry is not an undo, and
          § InlineRetryBanner and § SurfaceError already ship a ghost Retry — one
          word, one treatment, three sites. */}
      {block.retryable && (
        <Pressable
          {...a11yProps(SHELL_A11Y_IDS.carriedNoticeRetry, {
            label: `${CN_ACTIONS.retry} ${block.label}`,
            role: 'button',
          })}
          style={[styles.cnGhostButton, minTouch]}
          onPress={() => void controller.retryNotice(taskId, block.field)}
        >
          <Text style={styles.cnGhostButtonText}>{CN_ACTIONS.retry}</Text>
        </Pressable>
      )}
    </View>
  )
}

function NoticeRow({
  row,
  controller,
  platform,
}: {
  row: CarriedRow
  controller: MobileAssistantController
  platform: MobilePlatform
}) {
  const { styles, colors } = useStyles()
  const minTouch = minTouchSize(platform)
  const isOffer = row.id === 'CN-UNDO' || row.id === 'CN-UNDONE'
  return (
    <View
      {...a11yProps(SHELL_A11Y_IDS.carriedNotice, { label: row.a11yName })}
      style={styles.cnRow}
    >
      <RowIcon id={row.id} colors={colors} />
      <View style={styles.cnBody}>
        <Text style={styles.cnSentence}>{row.sentence}</Text>
        {row.blocks.map((b) => (
          <FieldBlock
            key={b.field}
            block={b}
            taskId={row.taskId}
            controller={controller}
            platform={platform}
          />
        ))}
      </View>
      {/* CN-UNDO's `Put back` — the ONE control in the catalogue with an explicit
          prohibition on the ghost variant's colour, which is why § Buttons' `neutral`
          variant exists. `put back` is also its own word in the one-word-per-concept
          table: AC-43 requires one word for this mechanism DISTINCT from the turn
          undo's, because § Buttons binds *undo* to reversing an assistant turn and
          this explicitly is not that. */}
      {row.action === 'put-back' && (
        <Pressable
          {...a11yProps(SHELL_A11Y_IDS.carriedNoticeUndo, {
            label: CN_ACTIONS.putBack,
            role: 'button',
          })}
          style={[styles.cnNeutralButton, minTouch]}
          onPress={() => void controller.undoLastAction()}
        >
          <Text style={styles.cnNeutralButtonText}>{CN_ACTIONS.putBack}</Text>
        </Pressable>
      )}
      {/* One Dismiss for the row — dismissal is of the notice, and there is one
          notice per task. Icon-only with the accessible name `Dismiss` (2.5.3). */}
      <Pressable
        {...a11yProps(SHELL_A11Y_IDS.carriedNoticeDismiss, {
          label: CN_ACTIONS.dismiss,
          role: 'button',
        })}
        style={[styles.cnDismiss, minTouch]}
        onPress={() =>
          isOffer ? controller.dismissUndoOffer() : controller.dismissNotice(row.taskId)
        }
      >
        <X size={tokens.icon.size.sm} color={colors.text.muted} strokeWidth={tokens.icon.stroke} />
      </Pressable>
    </View>
  )
}

/**
 * The region. **It pre-exists and is empty when there is nothing to report** — a
 * live region created at the same moment as its content is not reliably announced,
 * which is § SaveNotice's reasoning and applies with more force here because this
 * one is created once per app rather than once per surface. So the container
 * always renders and carries `shell-carried-notices`; only its rows are
 * conditional.
 */
export function CarriedNotices({
  state,
  controller,
  platform,
}: {
  state: AppState
  controller: MobileAssistantController
  platform: MobilePlatform
}) {
  const { styles } = useStyles()
  const rows = carriedRows(state)
  const occupied = carriedRegionOccupied(state)
  return (
    <View
      {...a11yProps(SHELL_A11Y_IDS.carriedNotices, {
        label: regionName(state.notices.length),
      })}
      accessibilityLiveRegion="polite"
      style={occupied ? styles.cnRegion : styles.cnRegionEmpty}
    >
      {/* The visible ceiling is a ROW COUNT, not a fraction of the screen: two rows
          below the split — every width on a phone — and further rows scroll within
          the region, which never grows past that and always shows the first row in
          full. Scrolling inside a visible region is not the navigation D24 rejected:
          nothing is hidden behind a tap and every row keeps its controls. */}
      <ScrollView
        style={
          rows.length > CARRIED_VISIBLE_ROWS_BELOW_SPLIT ? styles.cnScrollCapped : undefined
        }
        nestedScrollEnabled
      >
        {rows.map((row) => (
          <NoticeRow
            key={`${row.id}:${row.taskId}`}
            row={row}
            controller={controller}
            platform={platform}
          />
        ))}
      </ScrollView>
    </View>
  )
}
