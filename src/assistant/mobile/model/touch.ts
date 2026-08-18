// Touch targets — F-003 AC-9.
//
// The AC's load-bearing clause is "measured as hit area rather than painted
// size". The design mockups are honest about this: the drawer button paints
// 40×40, the task checkbox 22×22, the send button 36×36 — all below the
// platform minimum, and all correct as *paint*, because the design system's
// visual rhythm is not the same thing as the finger's target. React Native
// separates the two with `hitSlop`, which extends the touchable region beyond
// the painted view without moving a pixel.
//
// So this module holds one map (what each interactive element paints, derived
// from the mockup CSS and the spacing/typography tokens) and one function
// (the slop that lifts it to the minimum). Components read both; the unit tier
// asserts the resulting hit area for every interactive id on both platforms —
// which is the part a device pass then confirms in the real world.

import type { MobilePlatform } from './permissions.ts'
import { A11Y_IDS, SHELL_A11Y_IDS, type A11yId } from './a11y.ts'
import { font, lineHeightFor, spacing } from './theme.ts'

/** iOS Human Interface Guidelines: 44×44 pt. Material Design: 48×48 dp.
 * Named by AC-9 itself — these are the AC's numbers, not a local choice. */
export const MIN_TOUCH_TARGET: Record<MobilePlatform, number> = { ios: 44, android: 48 }

export interface Size {
  width: number
  height: number
}

export interface HitSlop {
  top: number
  bottom: number
  left: number
  right: number
}

/** Painted height of a text control: its own line box plus vertical padding —
 * computed from tokens so a spacing or type-scale change moves the hit area
 * with it instead of leaving a stale constant behind. */
function textControlHeight(fontSize: number, verticalPadding: number, kind: 'body' | 'meta' = 'body'): number {
  return lineHeightFor(fontSize, kind) + verticalPadding * 2
}

/**
 * What each interactive element paints, per the mockup CSS
 * (design/assistant/screens/voice-assistant-view-ios.html). Widths for
 * text-sized controls are their minimum content width; a wider label only ever
 * increases the hit area, so the minimum is the case worth asserting.
 *
 * The content-width floors that cannot simply be read off a CSS rule are
 * published in `design/_shared/components.md` § "Touch — minimum content
 * widths": add-task 92, task-row 320, undo 80, retry 68, permission CTA 136.
 * A floor is a multiple of 4 at or below the rendered width — not the tightest
 * such multiple, because these are measured in an HTML mockup while the control
 * ships through React Native's text shaping, and the slack absorbs a difference
 * that is real. Under-stating is the safe direction: a floor that over-states
 * makes `hitSlopFor` believe the box is wider than it is and under-compute the
 * slop, which on a genuinely narrow control yields a hit area below the
 * platform minimum while every test stays green.
 *
 * **Re-measured 2026-08-17 (T-062) for the English copy — every floor moved,
 * because every label did.** Three shrank and one GREW: the permission CTA went
 * 112 → 136, because its shortest label is now "Open Settings" (renders 138.3)
 * where the superseded catalogue's shortest rendered 114.3. That direction is
 * the one worth naming: a carried-over floor would have under-sized a tap
 * target rather
 * than merely mis-describing it, which is the accessibility failure the floors
 * exist to prevent. Where a label varies by state, the floor comes from the
 * shortest label the control can carry — for the CTA that is "Open Settings",
 * against 166.8 for "Allow microphone" and 169.3 for "Open app settings".
 *
 * Both corrections this file took BEFORE that re-measure were over-statements,
 * and both had the same tell — a number that belonged to a different string.
 * `retryButton` carried `addTaskButton`'s 96, and `permissionCta` carried 140,
 * which sat between its shortest and longest label rather than at either.
 */
export const PAINTED: Record<InteractiveId, Size> = {
  // .icon-btn { width: 40px; height: 40px }
  [A11Y_IDS.drawerButton]: { width: 40, height: 40 },
  // .add-btn { padding: xs sm } around meta-size text — icon + "Add task",
  // floor published in components.md (renders 94.2)
  [A11Y_IDS.addTaskButton]: {
    width: 92,
    height: textControlHeight(font.size.meta, spacing.xs, 'meta'),
  },
  // .task-row { padding: sm gutter } — full width row
  [A11Y_IDS.taskRow]: {
    width: 320,
    height: textControlHeight(font.size.body, spacing.sm),
  },
  // .checkbox { width: 22px; height: 22px }
  [A11Y_IDS.taskCheckbox]: { width: 22, height: 22 },
  // .composer-input { height: 40px }
  [A11Y_IDS.composerInput]: { width: 200, height: 40 },
  // .mic { width: 52px; height: 52px } — the one control already above both minima
  [A11Y_IDS.micButton]: { width: 52, height: 52 },
  // .send { width: 36px; height: 36px }
  [A11Y_IDS.composerSend]: { width: 36, height: 36 },
  // .undo-btn { padding: xs md } — icon + "Undo", floor published in
  // components.md (renders 83.4)
  [A11Y_IDS.undoButton]: {
    width: 80,
    height: textControlHeight(font.size.body, spacing.xs),
  },
  // .retry-btn { padding: sm lg } — "Retry", floor published in components.md
  // (renders 72.4; the tightest multiple of 4 below that is 72, and one step
  // down keeps the slack the section calls deliberate)
  [A11Y_IDS.retryButton]: {
    width: 68,
    height: textControlHeight(font.size.body, spacing.sm),
  },
  // .retry-btn shape, permission CTA copy. Floor published in components.md:
  // the label varies by catalogue row, so the SHORTEST one binds — "Open
  // Settings" renders 138.3, against 166.8 and 169.3 for the other two. This is
  // the one floor the English re-measure moved UP (was 112 for the superseded
  // catalogue's shorter label), so it is the one where carrying the old number
  // over would have under-sized a real tap target instead of merely
  // mis-describing it.
  [A11Y_IDS.permissionCta]: {
    width: 136,
    height: textControlHeight(font.size.body, spacing.sm),
  },
  // .cancel-btn { padding: xs md } at meta size
  [A11Y_IDS.cancelButton]: {
    width: 64,
    height: textControlHeight(font.size.meta, spacing.xs, 'meta'),
  },
  // .chip { padding: xs lg }
  [A11Y_IDS.chipAffirm]: {
    width: 120,
    height: textControlHeight(font.size.body, spacing.xs),
  },
  [A11Y_IDS.chipNegative]: {
    width: 90,
    height: textControlHeight(font.size.body, spacing.xs),
  },
  [A11Y_IDS.optionChip]: {
    width: 140,
    height: textControlHeight(font.size.body, spacing.xs),
  },
  // .nm-pill { padding: sm lg } around body text at emphasis weight, plus a
  // down arrow at icon.size.sm (F-001 AC-30 / components.md
  // § NewMessageAffordance). The HEIGHT is derived the same way every other
  // padded text control here is, and it is the dimension that binds: one line
  // of body type inside `sm` padding sits below both platform minima, so this
  // control needs slop exactly as the AC's a11y floor requires.
  //
  // The WIDTH is deliberately NOT a measurement. components.md publishes no
  // content-width floor for this control — "those floors are measured from a
  // shipped control and this one does not exist yet" — so there is nothing to
  // adopt, and inventing a number would put a fabricated measurement in a file
  // whose other numbers are real. The platform maximum minimum (48) is the
  // safe placeholder: this section's own rule is that under-stating is the safe
  // direction, because an over-stated width under-computes the slop a genuinely
  // narrow control would need. Once the control ships, design measures it and
  // publishes the row; the published-floors test below adopts it automatically.
  [A11Y_IDS.newMessageAffordance]: {
    width: MIN_TOUCH_TARGET.android,
    height: textControlHeight(font.size.body, spacing.sm),
  },

  // ── App shell (design/assistant/screens/app-shell-ios.html CSS) ───────────
  //
  // WIDTHS. components.md § Testid catalogue — app shell states it plainly:
  // "No content-width floor is published for any control above. § Touch's
  // floors are measured from a shipped control; none of these has shipped."
  // So every shell control below takes the same safe placeholder the
  // new-message affordance takes and for the same reason — the platform
  // maximum minimum, which under-states. Under-stating is the safe direction
  // (see the § at the head of PAINTED): an over-stated width makes
  // `hitSlopFor` believe the box is wider than it is and under-compute the
  // slop. When design measures and publishes these rows, the published-floors
  // test adopts them automatically and these placeholders become failures.
  //
  // HEIGHTS are real, read off the mockup CSS rule named on each line.

  // .path { min-height: 44px } — PS-TASKS / PS-TALK
  [SHELL_A11Y_IDS.pathTasks]: { width: MIN_TOUCH_TARGET.android, height: 44 },
  [SHELL_A11Y_IDS.pathTalk]: { width: MIN_TOUCH_TARGET.android, height: 44 },
  // .icon-btn { width: 44px; height: 44px }
  [SHELL_A11Y_IDS.listsMenuButton]: { width: 44, height: 44 },
  [SHELL_A11Y_IDS.menuCloseButton]: { width: 44, height: 44 },
  // .menu-row { min-height: 44px }
  [SHELL_A11Y_IDS.menuCollectionRow]: { width: MIN_TOUCH_TARGET.android, height: 44 },
  [SHELL_A11Y_IDS.menuSettingsRow]: { width: MIN_TOUCH_TARGET.android, height: 44 },
  // .back-btn { height: 44px }
  [SHELL_A11Y_IDS.settingsBackButton]: { width: MIN_TOUCH_TARGET.android, height: 44 },
  // .seg button { min-height: 32px } — the id sits on the group, but the
  // finger lands on a segment, and the segment is what must clear the minimum.
  [SHELL_A11Y_IDS.settingsThemeControl]: { width: MIN_TOUCH_TARGET.android, height: 32 },
  // .btn-primary / .btn-ghost { min-height: 44px }
  [SHELL_A11Y_IDS.talkSessionRetryButton]: { width: MIN_TOUCH_TARGET.android, height: 44 },
  [SHELL_A11Y_IDS.tasksListRetryButton]: { width: MIN_TOUCH_TARGET.android, height: 44 },
  [SHELL_A11Y_IDS.tasksEmptyAddButton]: { width: MIN_TOUCH_TARGET.android, height: 44 },
  // .row-del { width: 44px; height: 44px } — ALWAYS visible on touch, so it is
  // always a real target rather than one that appears on hover
  [SHELL_A11Y_IDS.tasksDeleteButton]: { width: 44, height: 44 },
  // .tasklink — inline text inside the bubble, no padding of its own: one line
  // box, and everything above the line box is slop. components.md
  // § MessageTaskLink: "Hit area follows the platform minimum via `hitSlop`."
  [SHELL_A11Y_IDS.talkTaskLink]: {
    width: MIN_TOUCH_TARGET.android,
    height: lineHeightFor(font.size.body),
  },
  // .rename-input { padding: var(--sp-sm) } around body text
  [SHELL_A11Y_IDS.tasksRenameInput]: {
    width: MIN_TOUCH_TARGET.android,
    height: textControlHeight(font.size.body, spacing.sm),
  },
}

/** The catalogue ids a finger can activate. The rest of the catalogue is
 * structural or purely informative (a bubble, a badge, the boundary marker, the offline
 * banner, the state indicator, the queued notice, the two diff chips), and
 * AC-9 scopes itself to "every interactive element". */
export const INTERACTIVE_IDS = [
  A11Y_IDS.drawerButton,
  A11Y_IDS.addTaskButton,
  A11Y_IDS.taskRow,
  A11Y_IDS.taskCheckbox,
  A11Y_IDS.composerInput,
  A11Y_IDS.micButton,
  A11Y_IDS.composerSend,
  A11Y_IDS.undoButton,
  A11Y_IDS.retryButton,
  A11Y_IDS.permissionCta,
  A11Y_IDS.cancelButton,
  A11Y_IDS.chipAffirm,
  A11Y_IDS.chipNegative,
  A11Y_IDS.optionChip,
  A11Y_IDS.newMessageAffordance,
] as const

/**
 * The app shell's interactive controls, kept in a SECOND list rather than
 * appended to the one above — for the same reason `SHELL_A11Y_IDS` is a second
 * catalogue. `INTERACTIVE_IDS` is asserted against the
 * `voice-assistant-view-ios` mockup by a suite this module does not own
 * (`qa/assistant/automation/mobile/F-003-mobile-surface.spec.ts`: "every
 * interactive element is drawn from the catalogue"), and that assertion is
 * correct — a conversation control that is not in the conversation mockup is a
 * real defect. Shell controls are drawn in the shell mockups instead.
 *
 * The ten shell ids absent from this list are the ones `SHELL_IDS_BLOCKED`
 * records as drawn and deliberately unbuilt; a hit area for a control that does
 * not exist would be a measurement of nothing.
 */
export const SHELL_INTERACTIVE_IDS = [
  SHELL_A11Y_IDS.pathTasks,
  SHELL_A11Y_IDS.pathTalk,
  SHELL_A11Y_IDS.listsMenuButton,
  SHELL_A11Y_IDS.menuCloseButton,
  SHELL_A11Y_IDS.menuCollectionRow,
  SHELL_A11Y_IDS.menuSettingsRow,
  SHELL_A11Y_IDS.settingsBackButton,
  SHELL_A11Y_IDS.settingsThemeControl,
  SHELL_A11Y_IDS.talkSessionRetryButton,
  SHELL_A11Y_IDS.tasksListRetryButton,
  SHELL_A11Y_IDS.tasksEmptyAddButton,
  SHELL_A11Y_IDS.tasksDeleteButton,
  SHELL_A11Y_IDS.talkTaskLink,
  SHELL_A11Y_IDS.tasksRenameInput,
] as const

/** Both halves, for anything that means "every control a finger can hit". */
export const ALL_INTERACTIVE_IDS = [...INTERACTIVE_IDS, ...SHELL_INTERACTIVE_IDS] as const

export type InteractiveId =
  | (typeof INTERACTIVE_IDS)[number]
  | (typeof SHELL_INTERACTIVE_IDS)[number]

export function isInteractive(id: A11yId): id is InteractiveId {
  return (ALL_INTERACTIVE_IDS as readonly A11yId[]).includes(id)
}

/** Symmetric slop that lifts a painted size to the platform minimum. Zero on
 * an axis that is already large enough — slop is never negative, so a big
 * control is never shrunk. */
export function hitSlopFor(painted: Size, platform: MobilePlatform): HitSlop {
  const min = MIN_TOUCH_TARGET[platform]
  const vertical = Math.max(0, (min - painted.height) / 2)
  const horizontal = Math.max(0, (min - painted.width) / 2)
  return { top: vertical, bottom: vertical, left: horizontal, right: horizontal }
}

/** Painted box + slop → the region a finger can actually land on. */
export function areaOf(painted: Size, slop: HitSlop): Size {
  return {
    width: painted.width + slop.left + slop.right,
    height: painted.height + slop.top + slop.bottom,
  }
}

/** The touchable region of one catalogue element on one platform — the number
 * AC-9 is actually about. */
export function hitArea(id: InteractiveId, platform: MobilePlatform): Size {
  const painted = PAINTED[id]
  return areaOf(painted, hitSlopFor(painted, platform))
}

export function areaMeetsMinimum(area: Size, platform: MobilePlatform): boolean {
  const min = MIN_TOUCH_TARGET[platform]
  return area.width >= min && area.height >= min
}

/** Does this element clear the platform minimum as HIT AREA? */
export function meetsMinimum(id: InteractiveId, platform: MobilePlatform): boolean {
  return areaMeetsMinimum(hitArea(id, platform), platform)
}

/**
 * The painted box as a style fragment, for `components/styles.ts` to spread
 * into its `StyleSheet` instead of restating the numbers.
 *
 * This exists so AC-9's dimensions have ONE declaration. They used to have
 * three — the mockup CSS, `PAINTED`, and the RN StyleSheet — and all three
 * agreed, which is the failure mode worth naming: three copies that match are
 * indistinguishable from one source right up until someone edits one of them.
 * QA closed mockup↔PAINTED by parsing the CSS at test time; this closes
 * PAINTED↔StyleSheet by making the second one stop being a declaration at all.
 *
 * A fresh object each call: `StyleSheet.create` may freeze what it is given,
 * and `PAINTED` is shared with the hit-area maths.
 */
export function paintedBox(id: InteractiveId): Size {
  return { ...PAINTED[id] }
}

/** What a component spreads onto a Pressable: the painted box stays exactly as
 * designed, the touch area reaches the platform minimum. */
export function touchProps(
  id: InteractiveId,
  platform: MobilePlatform,
): { hitSlop: HitSlop; painted: Size } {
  const painted = PAINTED[id]
  return { hitSlop: hitSlopFor(painted, platform), painted }
}
