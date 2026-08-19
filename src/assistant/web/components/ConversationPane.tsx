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
// Copy is English (ADR-008), transcribed from design/_shared/components.md and
// the mockup it points at — never composed here.

import type { ReactNode, RefObject } from 'react'
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

/**
 * AC-31 — a task named in a message is a **door to that task**.
 *
 * Two renderings, and the second is the load-bearing one:
 *
 * - the list holds it → a real `<button>` (a control under AC-19's 2.1.1, with
 *   name/role/value under 4.1.2), which calls the one scroll-and-flash routine.
 * - the list does not hold it — deleted by this or a later turn, or filtered
 *   out of the collection on screen → **plain text, not a disabled control.**
 *   "Rendered as an inert control it would be an affordance that does nothing,
 *   which is worse than none; rendered as plain text it is honest" (AC-31).
 *   Note what that rules out: `disabled` is not the inert case, because a
 *   disabled button still announces itself as a button that is temporarily off.
 */
function MessageTaskLink({
  taskId,
  title,
  reveal,
}: {
  taskId: string
  title: string
  reveal: RevealHandle
}) {
  if (!reveal.canReveal(taskId)) return <span className="diff-task">{title}</span>
  return (
    <button
      className="diff-task tasklink"
      data-testid="talk-task-link"
      // § MessageTaskLink — **the visible text is a PREFIX of the accessible name,
      // never a replacement** (2.5.3), the same rule § NewMessageAffordance states.
      // `{title}` is a `verbatim` slot: the task's own title, never re-worded.
      aria-label={`${title}, see this task`}
      onClick={() => reveal.revealTask(taskId)}
    >
      {title}
    </button>
  )
}

/** The half of the shell an applied message needs: can this task be opened,
 * and the routine that opens it. */
export interface RevealHandle {
  canReveal: (taskId: string) => boolean
  revealTask: (taskId: string) => void
}

function DiffRow({ line, reveal }: { line: DiffLine; reveal: RevealHandle }) {
  return (
    <div className="diff-row">
      <MessageTaskLink taskId={line.taskId} title={line.title} reveal={reveal} />
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
        {line.label === 'new' ? 'NEW' : 'EDITED'}
      </span>
    </div>
  )
}

function AppliedBubble({
  m,
  undoableTurnId,
  controller,
  reveal,
  isNewestDoor,
}: {
  m: Extract<Message, { kind: 'applied' }>
  undoableTurnId: string | null
  controller: AssistantController
  reveal: RevealHandle
  /** § MessageTaskLink — this is the newest message that carries a live door, so
   * it is the one that renders the note. */
  isNewestDoor: boolean
}) {
  // AC-5/AC-8: exactly one Undo affordance — on the newest applied-and-still-
  // undoable turn. A newer applied turn or session close removes it visibly;
  // the bubble keeps an honest note so history does not silently change.
  const showUndo = !m.undone && undoableTurnId === m.turnId
  const anyDoor = m.lines.some((l) => reveal.canReveal(l.taskId))
  // ── § MessageTaskLink — the note, replaced (F-001 AC-31 rev 6 and rev 7) ────
  //
  // The shipped string was `tap a task to find it in the list`, chosen
  // width-independent on purpose because *"open it in Tasks"* was true only below
  // the split. **Two later decisions falsified the replacement too:** with a detail
  // in the centre column the door produces a **detail**, not a row in a list — and
  // the list is on screen at **no** width while the detail is open (F-005 AC-45) —
  // and rev 7 widens the gate so that nearly every applied message now carries at
  // least one door, which turns that state from rare into ordinary.
  //
  // Design's replacement, checked against all five states the door can be activated
  // from rather than by reading well in one: **`tap a task to see it`**. It names
  // the outcome the door actually guarantees (*that task is now what you are looking
  // at*) and promises no mechanism, which is what makes one string true at every
  // width. *Rejected, kept so it is not re-proposed:* **"go to it"** implies travel
  // and is false where nothing navigates; **"open it"** is false where the row is
  // scrolled into view rather than opened; **naming the mechanism per state** is two
  // strings selected by viewport, which AC-31's own constraint forbids.
  //
  // **And it renders on the newest door-carrying message only** (§ MessageTaskLink,
  // second half of the same call). With the gate widened, repeating one instruction
  // under every bubble in the thread is the filler this catalogue refuses elsewhere:
  // after the first reading it removes no information, and **the underline is the
  // persistent cue** — the note is the one-time teaching. It is derivable from the
  // thread, so there is no new stored fact and no "has the user learned this yet"
  // flag.
  const meta =
    anyDoor && isNewestDoor
      ? `${formatClock(m.at)} · tap a task to see it`
      : formatClock(m.at)
  return (
    <AiMsg meta={meta} className={m.undone ? 'undone' : undefined}>
      <div className="bubble-head">{m.head}</div>
      {m.lines.map((l, i) => (
        <DiffRow key={`${l.taskId}-${i}`} line={l} reveal={reveal} />
      ))}
      {/* Deleted tasks are named by title and are NEVER links: no row remains
          anywhere to open, which is the delete case AC-31 decides explicitly
          and design §5 had no answer for. */}
      {m.deletedTitles.length > 0 && (
        <div className="diff-row">
          <span className="diff-task">{m.deletedTitles.join(', ')}</span>
          <span className="mini-label edit">DELETED</span>
        </div>
      )}
      {showUndo && (
        <button
          className="undo-btn"
          data-testid="assistant-undo-button"
          onClick={() => void controller.undoTap(m.turnId)}
        >
          <UndoIcon />
          Undo
        </button>
      )}
      {m.undone && <span className="undone-tag">Undone</span>}
      {!m.undone && !showUndo && m.mutated && (
        <span className="past-tag">Undo window passed</span>
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
          : ' · answer by tapping, speaking or typing — the list still works'}
      </span>
    </div>
  )
}

function MessageView({
  m,
  undoableTurnId,
  controller,
  reveal,
  isNewestDoor,
}: {
  m: Message
  undoableTurnId: string | null
  controller: AssistantController
  reveal: RevealHandle
  isNewestDoor: boolean
}) {
  switch (m.kind) {
    case 'user':
      return (
        <div className="msg user">
          <div className="bubble">{m.text}</div>
          {m.queued && (
            <span className="queued-note" data-testid="assistant-queued-notice">
              <span className="dot-pulse" />
              Waiting for the network — will send again
            </span>
          )}
          <span className="msg-meta">
            You · {formatClock(m.at)}
            {m.via === 'voice' ? ' · voice' : ''}
          </span>
        </div>
      )

    case 'applied':
      return (
        <AppliedBubble
          m={m}
          undoableTurnId={undoableTurnId}
          controller={controller}
          reveal={reveal}
          isNewestDoor={isNewestDoor}
        />
      )

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
            I heard <span className="quote">“{m.heard}”</span> — nothing in your list matches.
          </p>
          <p>Nothing changed. If I misheard, say it again or type it.</p>
        </AiMsg>
      )

    case 'unsupported':
      // AC-15: honest "can't do that yet" naming the working alternative.
      return (
        <AiMsg meta={formatClock(m.at)}>
          <p>I can't answer questions about the list yet — nothing changed.</p>
          <p>Use {m.alternative} instead.</p>
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
                Retry
              </button>
            )}
          </div>
          <span className="msg-meta">{formatClock(m.at)} · the list still works by hand</span>
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
              Show me where
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
  reveal,
  scrollerRef,
  onScroll,
}: {
  state: AppState
  controller: AssistantController
  undoableTurnId: string | null
  reveal: RevealHandle
  /** AC-30: the scroll viewport every clause of that AC measures. Owned by
   * `useFollowNewMessages` in App, because the affordance it drives docks
   * outside this pane, just above the Composer. */
  scrollerRef?: RefObject<HTMLDivElement | null>
  onScroll?: () => void
}) {
  const loading = state.sessionLoad === 'loading'
  const failed = state.sessionLoad === 'failed'
  const empty = state.messages.length === 0 && !loading && !failed
  // § MessageTaskLink — the note renders on the **newest door-carrying message
  // only**, and **only while at least one door in that message is live**: a message
  // all of whose named tasks are inert (deleted — plain text, not a control, per
  // F-001 AC-31) carries no note, because an instruction to tap something untappable
  // is worse than silence. Derived from the thread; nothing new is stored.
  let newestDoorId: string | null = null
  for (const m of state.messages) {
    if (m.kind === 'applied' && m.lines.some((l) => reveal.canReveal(l.taskId))) newestDoorId = m.id
  }
  return (
    <div className="conv-scroll" ref={scrollerRef} onScroll={onScroll}>
      {/* SK-BUBBLE. **A loading surface never renders its empty state**: a
          returning user who sees "Say it. I'll write it down." while their
          conversation is still loading reads it as history lost
          (components.md § Skeletons). That is what `empty` above excludes. */}
      {loading && (
        <div className="sk-thread" aria-busy="true">
          <div className="sk sk-bubble a" />
          <div className="sk sk-bubble b" />
          <div className="sk sk-bubble c" />
        </div>
      )}
      {/* SE-SESSION. The thread cannot render at all, so an error BUBBLE is the
          wrong shape — there is no thread to put it in. This is the exact
          moment ADR-11's second path is supposed to exist, and AC-24's
          reachability bound names it: the PathSwitch in the bar above stays
          visible and enabled through this failure, and at or above the split
          the whole todo is untouched in the centre beside it. */}
      {failed && (
        <div className="surface-error">
          <h2>Couldn't load your conversation</h2>
          <p>Your tasks are unaffected. Try again, or carry on by hand.</p>
          <button
            className="btn-primary"
            data-testid="talk-session-retry-button"
            onClick={() => void controller.syncSession()}
          >
            Retry
          </button>
        </div>
      )}
      {empty && (
        <div className="invite">
          <h3>
            Say it.
            <br />
            I'll write it down.
          </h3>
          <p>Tap the mic and try saying “team meeting tomorrow at 2”. Typing does exactly the same.</p>
          {/* The second door. A first-time user whose mic is denied or absent
              (AC-20 hides it entirely) otherwise sees a screen with one control
              they cannot use and no evidence the rest of the app exists. */}
          <p className="second-door">No mic? Everything works by hand in Tasks.</p>
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
        aria-label="Conversation with the assistant"
      >
        {state.messages.map((m) => (
          <MessageView
            key={m.id}
            m={m}
            undoableTurnId={undoableTurnId}
            controller={controller}
            reveal={reveal}
            isNewestDoor={m.id === newestDoorId}
          />
        ))}
        {state.surface === 'thinking' && (
          <div className="msg ai">
            <div className="bubble thinking-msg">
              {/* decorative: the state indicator already announces "Thinking…" */}
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
