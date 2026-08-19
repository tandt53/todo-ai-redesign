// Screen-reader announcements — F-003 AC-12, which is F-001 AC-19's live
// region re-expressed for VoiceOver / TalkBack.
//
// Web gets this for free: the conversation list IS an ARIA live region, so the
// visible text is the announced text and the two cannot drift. React Native
// has no live region — announcements go through an imperative call
// (`AccessibilityInfo.announceForAccessibility`), which means the announced
// string is authored, and an authored string CAN drift from what is on screen.
// This module is the defence: it builds every announcement from the SAME
// `Message` record the conversation renders, so there is one source of content
// and the drift has nowhere to live.
//
// AC-12's bar, verbatim: announcing the state word alone does not satisfy it.
// A screen-reader user must receive what changed, how many, which tasks by
// title, and that undo is available. Every builder below is written against
// that sentence.
//
// Announcements never move focus (the API is fire-and-forget), and an error is
// announced immediately rather than queued — that is the `assertive` flag.

import type { Message } from '../../_shared/types.ts'

export interface Announcement {
  text: string
  /** true = interrupt whatever is being read (errors only, AC-12). */
  assertive: boolean
}

export interface AnnounceContext {
  /** Does this message currently carry the Undo affordance? (F-001 AC-5/AC-8 —
   * "and that undo is available" is part of AC-12's required content.) */
  undoAvailable: boolean
}

function diffSentence(m: Extract<Message, { kind: 'applied' }>): string[] {
  const parts: string[] = []
  for (const line of m.lines) {
    if (line.label === 'new') {
      const chips = line.chips
        .map((c) => (c.new === null ? null : c.new))
        .filter((v): v is string => v !== null)
      parts.push(
        chips.length === 0
          ? `Added task ${line.title}.`
          : `Added task ${line.title}, ${chips.join(', ')}.`,
      )
      continue
    }
    const changes = line.chips
      .map((c) => {
        if (c.old !== null && c.new !== null) return `${c.field} from ${c.old} to ${c.new}`
        if (c.new !== null) return `${c.field} to ${c.new}`
        // The resulting state, not a verb: "clear"/"remove" are both on the
        // catalogue's never-list (§ Buttons, one word per concept), and this
        // phrasing sidesteps them without reaching for "delete", which is
        // reserved for deleting a task.
        return `no ${c.field}`
      })
      .join('; ')
    parts.push(changes === '' ? `Edited task ${line.title}.` : `Edited task ${line.title}: ${changes}.`)
  }
  if (m.deletedTitles.length > 0) {
    const n = m.deletedTitles.length
    parts.push(`Deleted ${n} ${n === 1 ? 'task' : 'tasks'}: ${m.deletedTitles.join(', ')}.`)
  }
  return parts
}

/**
 * The announcement for one conversation message, or `null` when the message
 * carries nothing new to hear.
 *
 * The only `null` case is the user's own un-queued turn: the user just spoke
 * or typed it, so reading it back is an echo, and F-001 AC-19's enumeration of
 * "every message the conversation adds" does not list it. A user turn that has
 * gone into the offline queue DOES announce — the queued notice is on that
 * list, and it is news.
 */
export function announcementFor(m: Message, ctx: AnnounceContext): Announcement | null {
  switch (m.kind) {
    case 'user':
      return m.queued
        ? {
            text: `Waiting for the network — “${m.text}” will be sent again when the network is back.`,
            assertive: false,
          }
        : null

    case 'applied': {
      const parts = [m.head + '.', ...diffSentence(m)]
      if (m.undone) parts.push('This change has been undone.')
      else if (ctx.undoAvailable) parts.push('There is an Undo button for this change.')
      else parts.push('The undo window for this change has passed.')
      return { text: parts.join(' '), assertive: false }
    }

    case 'question': {
      const parts = [m.head]
      if (m.body !== null) parts.push(m.body)
      if (m.taskTitles.length > 0) {
        const n = m.taskTitles.length
        parts.push(`${n} ${n === 1 ? 'task' : 'tasks'} involved: ${m.taskTitles.join(', ')}.`)
      }
      if (m.options.length > 0) parts.push(`Options: ${m.options.join('; ')}.`)
      parts.push(
        m.resolved
          ? 'This question is already resolved.'
          : 'Answer by tapping, speaking or typing — the list keeps working either way.',
      )
      return { text: parts.join(' '), assertive: false }
    }

    case 'outcome':
      return {
        text: [m.head, ...m.body].filter((s): s is string => s !== null && s !== '').join(' '),
        assertive: false,
      }

    case 'reverted':
      return { text: [m.head, ...m.body].join(' '), assertive: false }

    // These two mirror `components/ConversationList.tsx` sentence for sentence
    // — the announced text and the visible text are the same words, which is
    // the whole point of this module.
    case 'no-match':
      return {
        text: `I heard “${m.heard}” — no task on the list matches that. Nothing has changed.`,
        assertive: false,
      }

    case 'unsupported':
      return {
        text: `I cannot answer questions about the list yet — nothing has changed. Use ${m.alternative} instead.`,
        assertive: false,
      }

    case 'error':
      // The one interrupting announcement (AC-12: "an error message is
      // announced immediately rather than queued").
      return {
        text: [m.head, ...m.body, m.retryTurnId !== null ? 'There is a Retry button.' : '']
          .filter((s) => s !== '')
          .join(' '),
        assertive: true,
      }

    case 'boundary':
      return { text: [m.head, ...m.lines].join(' '), assertive: false }

    case 'info':
      return { text: [m.head, ...m.body].join(' '), assertive: false }
  }
}

/**
 * Announcements for messages that appeared since the last drain.
 *
 * Errors are hoisted to the front rather than merely flagged: announcing them
 * in arrival order behind three polite messages is exactly the queueing AC-12
 * forbids, and `assertive` only guarantees the interrupt for the call that
 * carries it.
 */
export function announcementsFor(
  messages: Message[],
  undoableTurnId: string | null,
): Announcement[] {
  const out: Announcement[] = []
  for (const m of messages) {
    const a = announcementFor(m, {
      undoAvailable: m.kind === 'applied' && !m.undone && m.turnId === undoableTurnId,
    })
    if (a !== null) out.push(a)
  }
  const errors = out.filter((a) => a.assertive)
  if (errors.length === 0) return out
  return [...errors, ...out.filter((a) => !a.assertive)]
}

/**
 * F-001 AC-30(e) — the NewMessageAffordance's announcement.
 *
 * `components.md` § NewMessageAffordance calls the dock "a `polite` live
 * region, so a screen-reader user hears the control arrive **and** hears it
 * change from NMA-NEW to NMA-WAITING". React Native has no live region (this
 * module's whole reason for existing), so that is an imperative announcement —
 * and, exactly per this file's contract, it is BUILT from the same value the
 * control renders rather than authored at the call site.
 *
 * The announced string is the control's accessible name, so what a screen
 * reader hears when it arrives is what a screen reader reads when focused on
 * it. `polite`, never assertive: this control reports that something is
 * waiting, and interrupting the message that is currently being read in order
 * to say so would bury the content the user is already receiving.
 */
export function affordanceAnnouncement(
  view: { accessibleName: string } | null,
): Announcement | null {
  if (view === null) return null
  return { text: view.accessibleName, assertive: false }
}

/**
 * `AppState.announce` → an announcement (F-005 AC-33's 4.1.3, `(mobile)` half).
 *
 * The **second constructor** in this module, and the reason it lives here rather
 * than at the call site is this file's own contract: *"every string is built from
 * a `Message` record"* was the rule while every announcement had a `Message`
 * behind it. F-005 adds several that do not — AC-2's offline refusal, AC-43's undo
 * offer and its outcome, AC-47's notice failures and supersessions, AC-38's
 * passed-reminder surfacing — and `platform/mobile.md` is explicit that the
 * announcement path is therefore **widened rather than bypassed**.
 *
 * So this is the widening: the status slot gets a constructor beside
 * `announcementFor` and `affordanceAnnouncement`, every announcement on this
 * client still resolves through one module, and the controller composes nothing.
 *
 * It authors no copy of its own — the text is the shared controller's, which took
 * it from `§ CarriedNotice`'s literal tables or from `messages.ts`. What this
 * function adds is the one decision that is the client's: **`polite`, never
 * assertive.** Nothing in this family is time-critical, its whole promise is that
 * it waits, and interrupting would claim an urgency it does not have.
 *
 * An empty slot announces nothing rather than announcing emptiness.
 */
export function statusAnnouncement(text: string): Announcement | null {
  if (text.trim() === '') return null
  return { text, assertive: false }
}
