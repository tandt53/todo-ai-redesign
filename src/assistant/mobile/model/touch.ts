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
import { A11Y_IDS, type A11yId } from './a11y.ts'
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
 */
export const PAINTED: Record<InteractiveId, Size> = {
  // .icon-btn { width: 40px; height: 40px }
  [A11Y_IDS.drawerButton]: { width: 40, height: 40 },
  // .add-btn { padding: xs sm } around meta-size text
  [A11Y_IDS.addTaskButton]: {
    width: 96,
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
  // .undo-btn { padding: xs md }
  [A11Y_IDS.undoButton]: {
    width: 108,
    height: textControlHeight(font.size.body, spacing.xs),
  },
  // .retry-btn { padding: sm lg }
  [A11Y_IDS.retryButton]: {
    width: 96,
    height: textControlHeight(font.size.body, spacing.sm),
  },
  // .retry-btn shape, permission CTA copy
  [A11Y_IDS.permissionCta]: {
    width: 140,
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
}

/** The catalogue ids a finger can activate. The rest of the 22 are structural
 * or purely informative (a bubble, a badge, the boundary marker, the offline
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
] as const

export type InteractiveId = (typeof INTERACTIVE_IDS)[number]

export function isInteractive(id: A11yId): id is InteractiveId {
  return (INTERACTIVE_IDS as readonly A11yId[]).includes(id)
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

/** What a component spreads onto a Pressable: the painted box stays exactly as
 * designed, the touch area reaches the platform minimum. */
export function touchProps(
  id: InteractiveId,
  platform: MobilePlatform,
): { hitSlop: HitSlop; painted: Size } {
  const painted = PAINTED[id]
  return { hitSlop: hitSlopFor(painted, platform), painted }
}
