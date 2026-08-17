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
          ? `Thêm việc ${line.title}.`
          : `Thêm việc ${line.title}, ${chips.join(', ')}.`,
      )
      continue
    }
    const changes = line.chips
      .map((c) => {
        if (c.old !== null && c.new !== null) return `${c.field} từ ${c.old} thành ${c.new}`
        if (c.new !== null) return `${c.field} thành ${c.new}`
        return `bỏ ${c.field}`
      })
      .join('; ')
    parts.push(changes === '' ? `Sửa việc ${line.title}.` : `Sửa việc ${line.title}: ${changes}.`)
  }
  if (m.deletedTitles.length > 0) {
    parts.push(`Xóa ${m.deletedTitles.length} việc: ${m.deletedTitles.join(', ')}.`)
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
        ? { text: `Đang chờ mạng — câu “${m.text}” sẽ được gửi lại khi có mạng.`, assertive: false }
        : null

    case 'applied': {
      const parts = [m.head + '.', ...diffSentence(m)]
      if (m.undone) parts.push('Thay đổi này đã được hoàn tác.')
      else if (ctx.undoAvailable) parts.push('Có nút Hoàn tác cho thay đổi này.')
      else parts.push('Thay đổi này đã qua, không hoàn tác được nữa.')
      return { text: parts.join(' '), assertive: false }
    }

    case 'question': {
      const parts = [m.head]
      if (m.body !== null) parts.push(m.body)
      if (m.taskTitles.length > 0) {
        parts.push(`${m.taskTitles.length} việc liên quan: ${m.taskTitles.join(', ')}.`)
      }
      if (m.options.length > 0) parts.push(`Lựa chọn: ${m.options.join('; ')}.`)
      parts.push(
        m.resolved
          ? 'Câu hỏi này đã xử lý xong.'
          : 'Trả lời bằng cách chạm, nói hoặc gõ — danh sách vẫn dùng được.',
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

    case 'no-match':
      return {
        text: `Tôi nghe được “${m.heard}” — không có việc nào trong danh sách khớp với câu đó. Chưa có gì thay đổi.`,
        assertive: false,
      }

    case 'unsupported':
      return {
        text: `Tôi chưa trả lời được câu hỏi về danh sách — chưa có gì thay đổi. Bạn dùng ${m.alternative} thay cho việc hỏi nhé.`,
        assertive: false,
      }

    case 'error':
      // The one interrupting announcement (AC-12: "an error message is
      // announced immediately rather than queued").
      return {
        text: [m.head, ...m.body, m.retryTurnId !== null ? 'Có nút Thử lại.' : '']
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
