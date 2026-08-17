// The accessibility-id contract — F-003 AC-12's second half.
//
// ONE catalogue, three spellings. The 23 values below are the design mockups'
// catalogue verbatim (`design/assistant/screens/voice-assistant-view-ios.html`
// and `-android.html`), the same 23 the web client carries as `data-testid`.
// The 23rd — `assistant-new-message-affordance` — arrived with F-001 AC-30 /
// BUG-004; the count in this file is derived from the mockups by the unit tier,
// never asserted from memory.
// Nothing here is invented and nothing is dropped: the unit tier parses both
// mockups and fails if this file and the mockups disagree in either direction.
//
// HOW THE ID REACHES THE PLATFORM (and one place this diverges from the spec's
// literal wording — flagged to the orchestrator, not decided locally):
//
//   iOS      React Native's `testID` IS `accessibilityIdentifier`. Exactly what
//            AC-12 asks for.
//   Android  React Native has ONE Android slot for text identity —
//            `accessibilityLabel`, which becomes `contentDescription`. AC-12
//            wants the id there; F-001 AC-19 (which the parity table keeps in
//            force, "the clause adds, it never narrows") wants the human label
//            there, because WCAG 2.5.3 label-in-name and TalkBack both read it.
//            Both cannot hold. This file puts the human label in
//            `accessibilityLabel` and the id in `testID` (Android exposes it as
//            the view's resource-id), because an id read aloud as
//            "assistant-mic-button" would break the AC that AC-12 exists to
//            extend. QA's Android automation therefore locates by resource-id,
//            not by content-desc.
//
// Elements with no human label (structural containers: a bubble, a row, the
// boundary marker) carry the id alone and stay out of the accessibility tree's
// naming — their content is what gets announced, via announce.ts.

import type { AppState } from '../../_shared/model/reducer.ts'
import { undoableTurnId } from '../../_shared/model/reducer.ts'
import { affordanceFor } from './follow.ts'
import type { MobilePlatform } from './permissions.ts'
import {
  chipRole,
  showCancel,
  showMic,
  showOfflineBanner,
  showPermissionCta,
  showQueuedNotice,
  showRetry,
  showRowBadge,
  showStateIndicator,
  showUndo,
} from './surface.ts'

export const A11Y_IDS = {
  addTaskButton: 'assistant-add-task-button',
  boundaryMarker: 'assistant-boundary-marker',
  cancelButton: 'assistant-cancel-button',
  chipAffirm: 'assistant-chip-affirm',
  chipNegative: 'assistant-chip-negative',
  composerInput: 'assistant-composer-input',
  composerSend: 'assistant-composer-send',
  diffNew: 'assistant-diff-new',
  diffOld: 'assistant-diff-old',
  drawerButton: 'assistant-drawer-button',
  messageBubble: 'assistant-message-bubble',
  micButton: 'assistant-mic-button',
  newMessageAffordance: 'assistant-new-message-affordance',
  offlineBanner: 'assistant-offline-banner',
  optionChip: 'assistant-option-chip',
  permissionCta: 'assistant-permission-cta',
  queuedNotice: 'assistant-queued-notice',
  retryButton: 'assistant-retry-button',
  rowBadge: 'assistant-row-badge',
  stateIndicator: 'assistant-state-indicator',
  taskCheckbox: 'assistant-task-checkbox',
  taskRow: 'assistant-task-row',
  undoButton: 'assistant-undo-button',
} as const

export type A11yId = (typeof A11Y_IDS)[keyof typeof A11Y_IDS]

export const ALL_A11Y_IDS: readonly A11yId[] = Object.values(A11Y_IDS)

/** The React Native props that carry one catalogue id (plus its human name,
 * when the element has one). Typed structurally so `model/` stays free of any
 * react-native import — that is what keeps this tier runnable under plain
 * node (platform mobile.md ## Test Harness). */
export interface A11yProps {
  testID: A11yId
  accessibilityLabel?: string
  accessibilityRole?: 'button' | 'text' | 'header' | 'checkbox' | 'alert' | 'none'
  accessibilityState?: { checked?: boolean; disabled?: boolean; selected?: boolean }
}

export function a11yProps(
  id: A11yId,
  opts: {
    label?: string
    role?: A11yProps['accessibilityRole']
    state?: A11yProps['accessibilityState']
  } = {},
): A11yProps {
  const props: A11yProps = { testID: id }
  if (opts.label !== undefined) props.accessibilityLabel = opts.label
  if (opts.role !== undefined) props.accessibilityRole = opts.role
  if (opts.state !== undefined) props.accessibilityState = opts.state
  return props
}

// ---------------------------------------------------------------------------
// Which ids the surface shows for a given state
// ---------------------------------------------------------------------------

export interface SurfaceContext {
  /** the drawer button lives in the top bar and is always mounted */
  tasksVisible: boolean
  /** at least one task row currently rendered */
  hasTasks: boolean
  /** F-001 AC-30: how many messages arrived while the user was away from the
   * bottom. A VIEWPORT fact and deliberately not part of `AppState` — the AC
   * adds no model state — which is why it enters through the context rather
   * than through the reducer. Zero means the newest message is on screen
   * (NMA-HIDDEN), and the affordance is then not rendered at all. */
  unseenBelowFold: number
}

/**
 * The ids that must be on screen for `state`. Built from the SAME predicates
 * the components render from (`surface.ts`), so this is not a parallel
 * description of the UI — it is the UI's own conditions, evaluated.
 *
 * Used by the unit tier to prove that the enumerated surface states between
 * them cover every catalogue id and invent none.
 */
export function expectedIds(state: AppState, ctx: SurfaceContext): Set<A11yId> {
  const ids = new Set<A11yId>()
  // chrome — always mounted (F-001: the list never leaves the screen)
  ids.add(A11Y_IDS.drawerButton)
  ids.add(A11Y_IDS.addTaskButton)
  ids.add(A11Y_IDS.composerInput)
  ids.add(A11Y_IDS.composerSend)
  if (showMic(state)) ids.add(A11Y_IDS.micButton)
  if (showStateIndicator(state)) ids.add(A11Y_IDS.stateIndicator)
  if (showCancel(state)) ids.add(A11Y_IDS.cancelButton)
  if (showOfflineBanner(state)) ids.add(A11Y_IDS.offlineBanner)
  // AC-30(d): ONE affordance, however many messages arrived — a Set makes the
  // count structural, and the view mounts a single control whose props change.
  if (affordanceFor(ctx.unseenBelowFold, state.messages) !== null) {
    ids.add(A11Y_IDS.newMessageAffordance)
  }

  if (ctx.tasksVisible && ctx.hasTasks) {
    ids.add(A11Y_IDS.taskRow)
    ids.add(A11Y_IDS.taskCheckbox)
    for (const t of state.tasks) {
      if (showRowBadge(state, t.id)) ids.add(A11Y_IDS.rowBadge)
    }
  }

  const undoTarget = undoableTurnId(state)
  for (const m of state.messages) {
    if (showQueuedNotice(m)) ids.add(A11Y_IDS.queuedNotice)
    if (showUndo(m, undoTarget)) ids.add(A11Y_IDS.undoButton)
    if (showRetry(m)) ids.add(A11Y_IDS.retryButton)
    if (showPermissionCta(m)) ids.add(A11Y_IDS.permissionCta)
    if (m.kind === 'boundary') ids.add(A11Y_IDS.boundaryMarker)
    if (m.kind !== 'user' && m.kind !== 'boundary') ids.add(A11Y_IDS.messageBubble)
    if (m.kind === 'question') {
      m.options.forEach((_opt, i) => {
        const role = chipRole(m.qkind, i)
        ids.add(
          role === 'affirm'
            ? A11Y_IDS.chipAffirm
            : role === 'negative'
              ? A11Y_IDS.chipNegative
              : A11Y_IDS.optionChip,
        )
      })
    }
    if (m.kind === 'applied') {
      for (const line of m.lines) {
        for (const chip of line.chips) {
          if (chip.old !== null) ids.add(A11Y_IDS.diffOld)
          if (chip.new !== null) ids.add(A11Y_IDS.diffNew)
        }
      }
    }
  }
  return ids
}

/** iOS reads `testID` as `accessibilityIdentifier`; Android exposes it as the
 * view's resource-id. Both platforms therefore carry the same values — the
 * function exists so the claim is executable rather than asserted in a
 * comment. */
export function identityAttribute(platform: MobilePlatform): 'accessibilityIdentifier' | 'resource-id' {
  return platform === 'ios' ? 'accessibilityIdentifier' : 'resource-id'
}
