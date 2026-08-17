// Surface predicates — the small set of "is this element on screen right now?"
// decisions the mobile client makes.
//
// They live here, outside the components, for one reason: the components are
// React Native and therefore cannot run in this project's node-only unit tier
// (platform mobile.md: "Unit tier = model + ports"). A predicate that lives
// inside a component is a decision nothing can test until a device shows up.
// Pulled out here, the same functions are called by the components AND by
// `a11y.ts`'s `expectedIds`, so the accessibility-id contract and the rendering
// are bound to one source instead of agreeing by coincidence.
//
// Every rule below is F-001's, unchanged — this file adds no mobile behaviour.
// It is the shared reducer's selectors, spelled out per element.

import type { AppState } from '../../_shared/model/reducer.ts'
import { micMode } from '../../_shared/model/reducer.ts'
import type { Message } from '../../_shared/types.ts'

/** The mic is hidden — never disabled-with-an-error — when the device has no
 * capability at all (F-001 AC-20). Every other mode still renders it. */
export function showMic(state: AppState): boolean {
  return micMode(state) !== 'hidden'
}

/** The voice surface exists only while listening or thinking, which is what
 * makes F-001 AC-29's exclusivity observable rather than merely styled. */
export function showStateIndicator(state: AppState): boolean {
  return state.surface === 'listening' || state.surface === 'thinking'
}

/** Cancel is the thinking-state affordance and is client-local (F-001 AC-3). */
export function showCancel(state: AppState): boolean {
  return state.surface === 'thinking'
}

/** No half-running conversation: the surface says it is offline (F-001 AC-25,
 * F-003 AC-4). */
export function showOfflineBanner(state: AppState): boolean {
  return state.offline
}

/** A turn that was in flight when the connection dropped shows its queued
 * notice on the user's own bubble (F-001 AC-25). */
export function showQueuedNotice(m: Message): boolean {
  return m.kind === 'user' && m.queued
}

/** Exactly one Undo affordance: on the newest applied-and-still-undoable turn
 * (F-001 AC-5 / AC-8). `undoableTurnId` comes from the shared selector. */
export function showUndo(m: Message, undoableTurnId: string | null): boolean {
  return m.kind === 'applied' && !m.undone && m.turnId === undoableTurnId
}

/** Only the newest error keeps its Retry, so two can never be on screen
 * (F-001 AC-16 / AC-24). */
export function showRetry(m: Message): boolean {
  return m.kind === 'error' && m.retryTurnId !== null
}

/** The mic-permission guidance message carries the CTA (F-001 AC-21,
 * F-003 AC-2 / AC-3). */
export function showPermissionCta(m: Message): boolean {
  return m.kind === 'info' && m.cta === 'permission'
}

/** An AI-attributed row shows its NEW / EDITED badge (F-001 AC-4). */
export function showRowBadge(state: AppState, taskId: string): boolean {
  return state.marks !== null && taskId in state.marks.byTask
}

/** Which chip id an option carries: a bulk-delete confirmation's two options
 * are affirm/negative, a clarify question's candidates are option chips
 * (design mockup catalogue). */
export function chipRole(
  qkind: string,
  index: number,
): 'affirm' | 'negative' | 'option' {
  if (qkind !== 'bulk_delete') return 'option'
  return index === 0 ? 'affirm' : 'negative'
}
