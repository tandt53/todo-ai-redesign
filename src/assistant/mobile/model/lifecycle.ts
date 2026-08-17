// Lifecycle rules — F-003 AC-8 (foreground read), AC-10 (keyboard), AC-11
// (system back). Pure decision functions: the controller performs the effects,
// this file decides what they are, so the rules are testable without an OS.
//
// The through-line of all three ACs is that **the OS never destroys state on
// the user's behalf**. Leaving the view, opening the keyboard, and being
// backgrounded are the same class of event: a visibility change. None of them
// cancels a turn, closes a session, or discards composer text — session close
// stays explicit or idle-driven only (F-001 AC-28, ADR-004).

export type AppVisibility = 'active' | 'inactive' | 'background'

/** Everything system back is allowed to do. There is deliberately no
 * 'cancel-turn' / 'close-session' / 'clear-composer' member: AC-11's content
 * is the shape of this union, so a future edit that wanted a destructive back
 * would have to add a member here and break every exhaustive switch. */
export type BackAction = 'dismiss-keyboard' | 'leave-view'

export interface BackContext {
  keyboardVisible: boolean
}

/**
 * AC-11: Android system back and iOS back-swipe are never destructive.
 * With the keyboard up, the first back dismisses the keyboard and leaves the
 * view standing; the second leaves the view, which is a background transition
 * governed by AC-5 / AC-6.
 */
export function backAction(ctx: BackContext): BackAction {
  return ctx.keyboardVisible ? 'dismiss-keyboard' : 'leave-view'
}

/** AC-11: leaving the view is a background transition, nothing more — so the
 * effects it triggers are exactly the backgrounding effects. Named as a
 * function rather than left implicit so the equivalence is assertable. */
export function backIsBackgroundTransition(): true {
  return true
}

/** AC-10: opening or dismissing the software keyboard changes no conversation
 * state and neither sends nor cancels a turn. The keyboard's visibility is a
 * layout fact; it is held outside the conversation state on purpose (it is not
 * in `AppState`), and this predicate exists so a component cannot quietly
 * decide otherwise. */
export function keyboardChangeAffectsConversation(): false {
  return false
}

/**
 * AC-8: what a foreground transition must do, in order, before the surface
 * accepts new input. The controller executes these; the list is here so the
 * ORDER is a tested fact rather than a reading of the controller body.
 *
 * `read-session` first: the server is the source of truth for conversation
 * history, and the local stores reconcile against that read rather than
 * overriding it. `restore-pending-input` and `replay-outgoing-turn` are the
 * only two local survivors (AC-5, AC-6).
 */
export const FOREGROUND_SEQUENCE = [
  'read-session',
  'restore-pending-input',
  'replay-outgoing-turn',
] as const

export type ForegroundStep = (typeof FOREGROUND_SEQUENCE)[number]

/** AC-7: which audio events are cancel-while-listening. All of them — the
 * union is the AC's enumeration, so an unlisted kind cannot silently take a
 * different path. */
export type AudioInterruptionReason = 'call' | 'system-assistant' | 'focus-loss' | 'route-change'

export const AUDIO_INTERRUPTION_REASONS: readonly AudioInterruptionReason[] = [
  'call',
  'system-assistant',
  'focus-loss',
  'route-change',
]
