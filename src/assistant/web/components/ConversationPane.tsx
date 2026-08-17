// The conversation surface. Everything that is not one of the four states is
// a MESSAGE (spec Conversation model) — this component is the complete list of
// message renderings, and it is a thin renderer: it decides nothing, it draws
// what `model/messages.ts` already built.
//
// Testids come from the design mockup catalogue only (never invented). The
// mockup carries each testid once on an exemplar; the app applies the same id
// to every instance — `assistant-message-bubble` on every assistant bubble,
// `assistant-option-chip` on every clarify candidate.
//
// WCAG 4.1.3 (Status Messages): the message list is the feature's primary
// output surface, so it IS the live region — `role="log"`, always mounted so a
// screen reader has it registered before the first outcome lands. Announced
// text is the visible text, never a parallel string that could drift. Error
// bubbles carry `role="alert"`: for an added node the nearest live ancestor
// wins, so an error announces once (assertively) and never twice.
//
// Copy is Vietnamese per design/_shared/components.md.

import type { ReactNode } from 'react'
import type { AssistantController } from '../../_shared/controller.ts'
import type { AppState } from '../../_shared/model/reducer.ts'
import type { DiffLine, Message } from '../../_shared/types.ts'
import { formatClock } from '../../_shared/model/format.ts'
import { UndoIcon } from './icons.tsx'

/** Assistant-side bubble wrapper — carries the catalogue testid every time. */
function AiMsg({
  children,
  meta,
  className,
}: {
  children: ReactNode
  meta: string
  className?: string
}) {
  return (
    <div className="msg ai">
      <div className={`bubble${className === undefined ? '' : ` ${className}`}`} data-testid="assistant-message-bubble">
        {children}
      </div>
      <span className="msg-meta">{meta}</span>
    </div>
  )
}

function DiffRow({ line }: { line: DiffLine }) {
  return (
    <div className="diff-row">
      <span className="diff-task">{line.title}</span>
      {line.chips.map((c, i) => (
        <span className="row-diff-pair" key={`${c.field}-${i}`}>
          {c.old !== null && (
            <span className="chip-old" data-testid="assistant-diff-old">
              {c.old}
            </span>
          )}
          {c.old !== null && c.new !== null && <span className="diff-arrow">→</span>}
          {c.new !== null && (
            <span className="chip-new" data-testid="assistant-diff-new">
              {c.new}
            </span>
          )}
        </span>
      ))}
      <span className={`mini-label ${line.label === 'new' ? 'add' : 'edit'}`}>
        {line.label === 'new' ? 'Mới' : 'Đã sửa'}
      </span>
    </div>
  )
}

function AppliedBubble({
  m,
  undoableTurnId,
  controller,
}: {
  m: Extract<Message, { kind: 'applied' }>
  undoableTurnId: string | null
  controller: AssistantController
}) {
  // AC-5/AC-8: exactly one Undo affordance — on the newest applied-and-still-
  // undoable turn. A newer applied turn or session close removes it visibly;
  // the bubble keeps an honest note so history does not silently change.
  const showUndo = !m.undone && undoableTurnId === m.turnId
  return (
    <AiMsg meta={formatClock(m.at)} className={m.undone ? 'undone' : undefined}>
      <div className="bubble-head">{m.head}</div>
      {m.lines.map((l, i) => (
        <DiffRow key={`${l.taskId}-${i}`} line={l} />
      ))}
      {m.deletedTitles.length > 0 && (
        <div className="diff-row">
          <span className="diff-task">{m.deletedTitles.join(', ')}</span>
          <span className="mini-label edit">Đã xóa</span>
        </div>
      )}
      {showUndo && (
        <button
          className="undo-btn"
          data-testid="assistant-undo-button"
          onClick={() => void controller.undoTap(m.turnId)}
        >
          <UndoIcon />
          Hoàn tác
        </button>
      )}
      {m.undone && <span className="undone-tag">Đã hoàn tác</span>}
      {!m.undone && !showUndo && m.mutated && (
        <span className="past-tag">Đã qua — không hoàn tác được nữa.</span>
      )}
    </AiMsg>
  )
}

function QuestionBubble({
  m,
  controller,
}: {
  m: Extract<Message, { kind: 'question' }>
  controller: AssistantController
}) {
  // A pending question blocks nothing (AC-11) — it is a bubble, not a modal.
  // Chips send the option's LITERAL text with an explicit binding (AC-10, AC-13).
  const bulk = m.qkind === 'bulk_delete'
  return (
    <div className="msg ai">
      <div
        className={`bubble q${m.resolved ? ' resolved' : ''}`}
        data-testid="assistant-message-bubble"
      >
        <div className="bubble-head">{m.head}</div>
        {m.body !== null && <p>{m.body}</p>}
        <div className="chips">
          {m.options.map((opt, i) => (
            <button
              key={`${opt}-${i}`}
              className={`chip${bulk && i === 0 ? ' chip-danger' : ''}`}
              data-testid={
                bulk
                  ? i === 0
                    ? 'assistant-chip-affirm'
                    : 'assistant-chip-negative'
                  : 'assistant-option-chip'
              }
              disabled={m.resolved}
              onClick={() => void controller.chipTap(m.turnId, opt)}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>
      <span className="msg-meta">
        {formatClock(m.at)}
        {m.resolved
          ? ''
          : ' · trả lời bằng cách chạm, nói hoặc gõ — danh sách vẫn dùng được như thường'}
      </span>
    </div>
  )
}

function MessageView({
  m,
  undoableTurnId,
  controller,
}: {
  m: Message
  undoableTurnId: string | null
  controller: AssistantController
}) {
  switch (m.kind) {
    case 'user':
      return (
        <div className="msg user">
          <div className="bubble">{m.text}</div>
          {m.queued && (
            <span className="queued-note" data-testid="assistant-queued-notice">
              <span className="dot-pulse" />
              Đang chờ mạng — sẽ gửi lại
            </span>
          )}
          <span className="msg-meta">
            Bạn · {formatClock(m.at)}
            {m.via === 'voice' ? ' · giọng nói' : ''}
          </span>
        </div>
      )

    case 'applied':
      return <AppliedBubble m={m} undoableTurnId={undoableTurnId} controller={controller} />

    case 'question':
      return <QuestionBubble m={m} controller={controller} />

    case 'outcome':
      return (
        <AiMsg meta={formatClock(m.at)}>
          {m.head !== null && <div className="bubble-head">{m.head}</div>}
          {m.body.map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </AiMsg>
      )

    case 'reverted':
      return (
        <AiMsg meta={formatClock(m.at)}>
          <div className="bubble-head">{m.head}</div>
          {m.body.map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </AiMsg>
      )

    case 'no-match':
      // AC-14: quote the heard transcript so a mishearing is distinguishable
      // from an absent task.
      return (
        <AiMsg meta={formatClock(m.at)}>
          <p>
            Tôi nghe được <span className="quote">“{m.heard}”</span> — không có việc nào trong danh
            sách khớp với câu đó.
          </p>
          <p>Chưa có gì thay đổi. Nếu tôi nghe nhầm, bạn nói lại hoặc gõ vào giúp tôi nhé.</p>
        </AiMsg>
      )

    case 'unsupported':
      // AC-15: honest "can't do that yet" naming the working alternative.
      return (
        <AiMsg meta={formatClock(m.at)}>
          <p>Tôi chưa trả lời được câu hỏi về danh sách — chưa có gì thay đổi.</p>
          <p>Bạn dùng {m.alternative} thay cho việc hỏi nhé.</p>
        </AiMsg>
      )

    case 'error': {
      // Retry re-sends the SAME client_turn_id (AC-16, AC-24); only the newest
      // error still carries one, so two retry buttons can never be on screen.
      const retryId = m.retryTurnId
      return (
        <div className="msg ai">
          {/* 4.1.3: an error is the one outcome that should interrupt. The
              nearest live ancestor of the added node wins, so this alert
              replaces the surrounding log's polite announcement — it does not
              add a second one. */}
          <div className="bubble err" data-testid="assistant-message-bubble" role="alert">
            <div className="bubble-head">{m.head}</div>
            {m.body.map((line, i) => (
              <p key={i}>{line}</p>
            ))}
            {retryId !== null && (
              <button
                className="retry-btn"
                data-testid="assistant-retry-button"
                onClick={() => void controller.retry(retryId)}
              >
                Thử lại
              </button>
            )}
          </div>
          <span className="msg-meta">
            {formatClock(m.at)} · danh sách vẫn dùng được bằng tay
          </span>
        </div>
      )
    }

    case 'boundary':
      // AC-28: exactly one marker per clean start, carrying the closed
      // session's terminal outcomes.
      return (
        <div className="boundary" data-testid="assistant-boundary-marker">
          <div className="boundary-body">
            <strong>{m.head}</strong>
            {m.lines.map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>
        </div>
      )

    case 'info':
      // Mic-mode guidance (AC-21 / AC-22) — the message states which cause.
      return (
        <AiMsg meta={formatClock(m.at)}>
          <div className="bubble-head">{m.head}</div>
          {m.body.map((line, i) => (
            <p key={i}>{line}</p>
          ))}
          {m.cta === 'permission' && (
            <button
              className="retry-btn"
              data-testid="assistant-permission-cta"
              onClick={() => controller.permissionCta()}
            >
              Chỉ tôi chỗ bật
            </button>
          )}
        </AiMsg>
      )
  }
}

export function ConversationPane({
  state,
  controller,
  undoableTurnId,
}: {
  state: AppState
  controller: AssistantController
  undoableTurnId: string | null
}) {
  const empty = state.messages.length === 0
  return (
    <div className="conv-scroll">
      {empty && (
        <div className="invite">
          <h3>
            Nói đi,
            <br />
            tôi ghi.
          </h3>
          <p>Chạm vào micro và thử nói “họp nhóm ngày mai lúc 2 giờ”.</p>
          <p>Gõ chữ cũng dùng được y như vậy.</p>
        </div>
      )}
      {/* Always mounted, even while empty: a live region only announces what
          changes AFTER it exists, so creating it together with the first
          message would lose that message's announcement (WCAG 4.1.3). */}
      <div
        className="conv"
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        aria-label="Cuộc trò chuyện với trợ lý"
      >
        {state.messages.map((m) => (
          <MessageView key={m.id} m={m} undoableTurnId={undoableTurnId} controller={controller} />
        ))}
        {state.surface === 'thinking' && (
          <div className="msg ai">
            <div className="bubble thinking-msg">
              {/* decorative: the state indicator already announces "Đang xử lý…" */}
              <span className="tdots" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
