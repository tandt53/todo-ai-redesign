// The accessibility-id contract — F-003 AC-12's second half.
//
// ONE catalogue, three spellings. The 23 values below are the design mockups'
// catalogue verbatim (`docs/design/assistant/screens/voice-assistant-view-ios.html`
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
import { talkView } from './shell.ts'
import type { ShellState } from './shell.ts'
import { linkableTaskIds, taskLinkState } from './task-link.ts'
import { EMPTY_TASKS, tasksSurfaceView } from './tasks-view.ts'
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

export type ConversationA11yId = (typeof A11Y_IDS)[keyof typeof A11Y_IDS]

/** The CONVERSATION catalogue only — the 23 ids of the three
 * `voice-assistant-view*` mockups. QA's mobile automation asserts this set
 * against that mockup exactly (`F-003-mobile-surface.spec.ts`), so the app
 * shell's ids live in `SHELL_A11Y_IDS` below and are never folded in here. */
export const ALL_A11Y_IDS: readonly ConversationA11yId[] = Object.values(A11Y_IDS)

// ---------------------------------------------------------------------------
// The APP SHELL catalogue — the second half of one contract
// ---------------------------------------------------------------------------

/**
 * `docs/design/assistant/screens/app-shell-ios.html` (`accessibilityIdentifier`),
 * `-android.html` (`resource-id`) and `app-shell.html` (`data-testid`) declare
 * **31** ids, byte-identical across the three. Seven of them are controls that
 * already existed and simply render on a different surface now — they keep
 * their ids and stay in `A11Y_IDS` above ("They are not renamed",
 * components.md § Testid catalogue — app shell). The **24** genuinely new
 * controls are here.
 *
 * Split rather than merged for a reason that is not tidiness: `ALL_A11Y_IDS` is
 * compared to the conversation mockup **in both directions** by two suites, one
 * of which this agent does not own. A merged catalogue would turn every one of
 * those comparisons into a failure the moment the shell landed.
 */
export const SHELL_A11Y_IDS = {
  // PathSwitch — below-split-only controls (components.md § AppFrame). A phone
  // is always below the split, so on mobile they are unconditional.
  pathTasks: 'shell-tasks-button',
  pathTalk: 'shell-talk-button',
  listsMenuButton: 'shell-lists-menu-button',
  // S3 Lists menu
  menuCollectionRow: 'menu-collection-row',
  menuListRow: 'menu-list-row',
  menuNewListButton: 'menu-new-list-button',
  menuSettingsRow: 'menu-settings-row',
  menuRetryButton: 'menu-retry-button',
  menuCloseButton: 'menu-close-button',
  // S4 Settings
  settingsBackButton: 'settings-back-button',
  settingsThemeControl: 'settings-theme-control',
  settingsTalkbackSwitch: 'settings-talkback-switch',
  settingsRowRetry: 'settings-row-retry',
  // S5 New list
  listEditorNameInput: 'list-editor-name-input',
  listEditorCreateButton: 'list-editor-create-button',
  listEditorCancelButton: 'list-editor-cancel-button',
  // S1 Talk
  talkSessionRetryButton: 'talk-session-retry-button',
  talkTaskLink: 'talk-task-link',
  // S2 Tasks
  tasksListRetryButton: 'tasks-list-retry-button',
  tasksEmptyAddButton: 'tasks-empty-add-button',
  tasksRenameInput: 'tasks-rename-input',
  tasksDeleteButton: 'tasks-delete-button',
  // SaveNotice — the receipt for a task that did not stay (components.md
  // § SaveNotice, T-135). Drawn in all three shell mockups; both ids are
  // recorded in `SHELL_IDS_BLOCKED` below because the component is designed
  // and not built.
  tasksSaveNotice: 'tasks-save-notice',
  tasksSaveNoticeDismiss: 'tasks-save-notice-dismiss',
  // ── § CarriedNotice (T-152) — five ids, TRANSCRIBED not invented ───────────
  //
  // F-005 AC-47's notice family. All five are published `(web, mobile)` in
  // `components.md § CarriedNotice → Testids and states`, and design records that
  // they *"close the debt `## Impact` §8(d) records as the mobile ids for
  // AC-42/AC-43's undo offer, which is an element that does not exist"*.
  //
  // **This is why they are new rather than owed to F-003.** F-003's catalogue is
  // closed and structurally asserted, and AC-9's and AC-39's mobile bounds needed
  // nothing from it — they are accessible-name assertions on the existing
  // `taskRow`. AC-43's offer is different: it is an **element that does not
  // exist**, so it is owed an id, and design published it rather than leaving it
  // to be invented here (platform mobile.md § F-005, last bullet).
  //
  // `tasksSaveNotice` above stays BLOCKED and that is not an inconsistency:
  // § SaveNotice is a **sibling** of this family, not this family widened —
  // design decided that explicitly, and the deciding reason is lifetime (rule 3
  // clears § SaveNotice on *"leaving the surface"*, which is precisely what AC-47
  // forbids, and below the split `PathSwitch` is one tap and primary navigation).
  carriedNotices: 'shell-carried-notices',
  carriedNotice: 'shell-carried-notice',
  carriedNoticeRetry: 'shell-carried-notice-retry',
  carriedNoticeUndo: 'shell-carried-notice-undo',
  carriedNoticeDismiss: 'shell-carried-notice-dismiss',
} as const

/**
 * Shell ids design has **published in the `components.md` testid table but not yet
 * drawn into the three shell mockups**, each with what is owed and by whom.
 *
 * This is not a loophole in the anti-invention rule — it is the second half of it.
 * The rule the mockup comparison enforces is *the client invents no id*, and the
 * catalogue's upstream is normally the drawing. For § CarriedNotice it is the
 * **published table**: design added the five ids and the component's whole
 * specification on 2026-08-19 and recorded, in the same pass, that *"F-005's
 * `phase: screens` dispatch must extend the three shell mockups, not only draw the
 * detail — this family renders on Talk and Settings, which only `app-shell*.html`
 * draw"*, and that *"the `src/` catalogue assertions go red on the five new ids by
 * design; the fix belongs to whoever owns `src/`"*.
 *
 * So an id here is still traceable to design, in writing, with a row-by-row
 * specification — it is just traceable to the table rather than to the drawing. An
 * id in **neither** is invented and still fails. The entries are removed when
 * `phase: screens` extends the mockups, at which point the mockup comparison
 * covers them and a stale entry here fails on its own (asserted below).
 */
export const SHELL_IDS_AWAITING_MOCKUP: Record<string, string> = {
  [SHELL_A11Y_IDS.carriedNotices]:
    'components.md § CarriedNotice → Testids and states publishes it (web, mobile); the three shell mockups are extended at phase: screens (design, § CarriedNotice item 4)',
  [SHELL_A11Y_IDS.carriedNotice]:
    'as above — the notice row exemplar; its six row states are enumerated for the drawing pass as carried-failed … carried-undone',
  [SHELL_A11Y_IDS.carriedNoticeRetry]:
    'as above — one per field block, so a row with two failed fields carries two (AC-2: each field keeps its own retry)',
  [SHELL_A11Y_IDS.carriedNoticeUndo]:
    "as above — CN-UNDO's `Put back`, the new § Buttons `neutral` variant",
  [SHELL_A11Y_IDS.carriedNoticeDismiss]:
    "as above — any row's trailing Dismiss, icon-only with the accessible name `Dismiss`",
}

export type ShellA11yId = (typeof SHELL_A11Y_IDS)[keyof typeof SHELL_A11Y_IDS]

export const ALL_SHELL_A11Y_IDS: readonly ShellA11yId[] = Object.values(SHELL_A11Y_IDS)

export type A11yId = ConversationA11yId | ShellA11yId

/**
 * Shell ids that are DRAWN and deliberately NOT BUILT, each with the thing that
 * blocks it. This is `information-architecture.md § 7` made executable: six of
 * the drawn surfaces cannot be built from today's data model, and the three
 * platform variants make that easy to forget by making it look finished
 * everywhere.
 *
 * The wiring test reads this map: an id must be either referenced by a
 * component **or** recorded here with a reason. So building one without
 * removing its row fails, and dropping one without recording why fails — which
 * is the difference between a scope boundary and an oversight.
 */
export const SHELL_IDS_BLOCKED: Partial<Record<ShellA11yId, string>> = {
  [SHELL_A11Y_IDS.menuListRow]:
    'personal lists — no `lists` table and no `tasks.list_id` (IA §7)',
  [SHELL_A11Y_IDS.menuNewListButton]:
    'creates a personal list — needs `lists` (IA §7)',
  [SHELL_A11Y_IDS.menuRetryButton]:
    'retries the personal-lists read; the built-in collections are derived on device and never load (components.md § ListsMenu)',
  [SHELL_A11Y_IDS.listEditorNameInput]:
    'S5 New list sheet — "Do not build this without `lists`" (components.md § ListEditorSheet)',
  [SHELL_A11Y_IDS.listEditorCreateButton]:
    'S5 New list sheet — needs `lists` (components.md § ListEditorSheet)',
  [SHELL_A11Y_IDS.listEditorCancelButton]:
    'S5 New list sheet — needs `lists` (components.md § ListEditorSheet)',
  [SHELL_A11Y_IDS.settingsTalkbackSwitch]:
    'F-002 talk-back is specced and unbuilt; "a switch that toggles nothing is worse than an absent one" (components.md § SettingsRow)',
  [SHELL_A11Y_IDS.settingsRowRetry]:
    'the SettingsRow failed state — the only shipped row is Theme, which is local and cannot fail to save (IA §6, S4)',
  [SHELL_A11Y_IDS.tasksSaveNotice]:
    'SaveNotice is designed and not built — drawn by T-135 (components.md § SaveNotice), with no implementation task dispatched for it yet',
  [SHELL_A11Y_IDS.tasksSaveNoticeDismiss]:
    'the dismiss control of a notice that does not render yet; it lands with SaveNotice itself (components.md § SaveNotice)',
}

/**
 * RETIRED. `assistant-drawer-button` toggled the task pane inside the
 * conversation; with the list on its own surface the hamburger becomes
 * navigation to a different surface, "which is a different control wearing the
 * same glyph" (components.md § Testid catalogue — app shell), and that control
 * is `shell-lists-menu-button`.
 *
 * The id stays in `A11Y_IDS` because the three `voice-assistant-view*` mockups
 * still declare it and design owns those files; removing it here would break
 * the both-directions comparison against a mockup this agent may not edit. What
 * changes is that **no component renders it** — asserted positively in
 * `__tests__/a11y.test.ts` so re-adding it fails rather than passing quietly.
 */
export const RETIRED_A11Y_IDS: readonly ConversationA11yId[] = [A11Y_IDS.drawerButton]

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
  /** the task list is currently rendered. Before the app shell this meant "the
   * pane beside the conversation is not collapsed"; it now means "S2 Tasks is
   * the surface on screen". The predicate it gates is the same one either way —
   * are the row-level ids on screen — which is why the field keeps its name and
   * its default. */
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
  // The composer belongs to Talk and is always mounted there. `drawerButton` is
  // NOT here any more: it is retired (see RETIRED_A11Y_IDS) — the hamburger is
  // navigation now and carries `shell-lists-menu-button`.
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

  if (ctx.tasksVisible) {
    // the Tasks surface's own header control (F-001 AC-18's create, by hand)
    ids.add(A11Y_IDS.addTaskButton)
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

/**
 * The SHELL ids on screen for a given shell + conversation state — the same
 * job `expectedIds` does for the conversation, built from the same predicates
 * the shell components render from (`shell.ts`, `tasks-view.ts`), so the
 * catalogue and the rendering are one source rather than two descriptions that
 * agree.
 *
 * Nothing here is gated on width: a phone is always below
 * `tokens.json breakpoints.split`, so PathSwitch always exists (components.md
 * § AppFrame).
 */
export function expectedShellIds(
  shell: ShellState,
  state: AppState,
  /** the row whose title was tapped — rename is entered by TAPPING THE TITLE
   * on touch, so there is no separate control and no id for one. Every other
   * input this function needs is already in `state` (the two read statuses
   * included). */
  ui: { renaming?: string | null } = {},
): Set<ShellA11yId> {
  const ids = new Set<ShellA11yId>()

  if (shell.overlay === 'settings') {
    ids.add(SHELL_A11Y_IDS.settingsBackButton)
    ids.add(SHELL_A11Y_IDS.settingsThemeControl)
    return ids
  }
  if (shell.overlay === 'menu') {
    ids.add(SHELL_A11Y_IDS.menuCloseButton)
    ids.add(SHELL_A11Y_IDS.menuCollectionRow)
    ids.add(SHELL_A11Y_IDS.menuSettingsRow)
    return ids
  }

  if (shell.surface === 'talk') {
    // AC-24's reachability bound: present in EVERY Talk state, failures
    // included, and never disabled.
    ids.add(SHELL_A11Y_IDS.pathTasks)
    const view = talkView(state)
    if (view === 'failed') ids.add(SHELL_A11Y_IDS.talkSessionRetryButton)
    // AC-31 rev 7: a task title is a control iff **the task still exists**. Not
    // "the list currently holds it" — the route switches collection (`revealTask`),
    // so a filter here would be a second gate. One condition, both clients.
    for (const m of state.messages) {
      for (const taskId of linkableTaskIds(m)) {
        if (taskLinkState(taskId, state.tasks) === 'link') {
          ids.add(SHELL_A11Y_IDS.talkTaskLink)
        }
      }
    }
    return ids
  }

  ids.add(SHELL_A11Y_IDS.pathTalk)
  ids.add(SHELL_A11Y_IDS.listsMenuButton)
  const tasks = tasksSurfaceView(state, shell.collection)
  if (tasks.banner === 'retry' || tasks.view === 'error') {
    ids.add(SHELL_A11Y_IDS.tasksListRetryButton)
  }
  if (tasks.empty !== null && EMPTY_TASKS[tasks.empty].action !== null) {
    ids.add(SHELL_A11Y_IDS.tasksEmptyAddButton)
  }
  if (tasks.tasks.length > 0) {
    // touch is not hover: the delete control is ALWAYS visible in the row's
    // trailing slot (components.md § Platform variants)
    ids.add(SHELL_A11Y_IDS.tasksDeleteButton)
    const renaming = ui.renaming ?? null
    if (renaming !== null && tasks.tasks.some((t) => t.id === renaming)) {
      ids.add(SHELL_A11Y_IDS.tasksRenameInput)
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
