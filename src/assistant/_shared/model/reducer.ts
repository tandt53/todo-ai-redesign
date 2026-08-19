// The conversation view model (platform web.md): a reducer over the FOUR
// surface states — idle / listening / thinking / error (AC-29). Everything
// else is a message. The only transitions are the spec flowchart's edges;
// every action below implements exactly one (or none, when guarded off).

import type {
  Marks,
  Message,
  Notice,
  PassedReminder,
  Surface,
  TaskView,
  UndoOffer,
} from '../types.ts'
import type { NewMsg } from './messages.ts'
import type { SpeechCapability } from '../ports/transcript-source.ts'

/**
 * How a read of a server-owned collection last went.
 *
 * Deliberately NOT one of the four surface states (AC-29): those are the
 * conversation's states, and a task-list read that failed is not a conversation
 * state at all — it is a fact about a different collection, which is exactly
 * why `information-architecture.md §6` designs the two surfaces' failures
 * separately. `idle` = never attempted.
 */
export type LoadState = 'idle' | 'loading' | 'ok' | 'failed'

export interface AppState {
  surface: Surface
  capability: SpeechCapability
  composer: string
  sessionId: string | null
  messages: Message[]
  tasks: TaskView[]
  /** GET /assistant/session — drives the S1 skeletons and SE-SESSION
   * (IA §6 S1; the failure AC-24's reachability bound names by hand) */
  sessionLoad: LoadState
  /** GET /tasks — drives the S2 skeletons, the InlineRetryBanner and
   * SE-TASKS (IA §6 S2) */
  tasksLoad: LoadState
  /** AI-change attribution for the newest applied turn only (AC-4) */
  marks: Marks | null
  offline: boolean
  /** client_turn_id of the in-flight turn that owns the thinking state */
  activeTurnId: string | null
  /** client_turn_id of the offline-queued outgoing turn (AC-25) */
  queuedTurnId: string | null
  /** turn_id currently being undone — double-activation guard (AC-5) */
  undoInFlight: string | null

  // ── F-005 ────────────────────────────────────────────────────────────────
  // All four live here rather than in the web tree because their mechanisms
  // observe writes, and only the shared controller and `state.tasks` see every
  // write (F-005 AC-47, AC-38, AC-43). The RENDERING of each is per platform;
  // the STATE is one.

  /** AC-47 — failed and offline-refused values that outlived their surface.
   * **One per task, never one per field.** No timer touches this list: elapsing
   * is not a resolution (AC-33's 2.2.1 at AC-43's strength). */
  notices: Notice[]
  /** AC-43 — the hand-action undo. **Single slot: it does not stack**, and a
   * second undoable action replaces the first offer while the replaced action
   * stays done. It is NOT the turn undo (F-001 AC-5) and the two are never
   * substitutes. */
  undoOffer: UndoOffer | null
  /** ADR-010 — `account.timezone`, the ONE source every client date computation
   * reads. `null` means the account has no zone yet: writes that need a date
   * computation are refused server-side and reads carry `due_all_day: null`.
   * Never `Intl.DateTimeFormat().resolvedOptions().timeZone`. */
  accountTimezone: string | null
  /** AC-38 — passed, unacknowledged reminders surfaced **on open**. N of them
   * are ONE surfacing, oldest first, and only what the user acknowledges is
   * marked. Rendering is not resolution. */
  reminders: PassedReminder[]
  /** AC-33's 4.1.3 — every refusal and every status message this feature states
   * is announced. `seq` advances on every announcement so the same text twice
   * is two announcements rather than a no-op the live region ignores. */
  announce: { seq: number; text: string } | null

  nextId: number
}

export function initialState(capability: SpeechCapability): AppState {
  return {
    surface: 'idle',
    capability,
    composer: '',
    sessionId: null,
    messages: [],
    tasks: [],
    sessionLoad: 'idle',
    tasksLoad: 'idle',
    marks: null,
    offline: false,
    activeTurnId: null,
    queuedTurnId: null,
    undoInFlight: null,
    notices: [],
    undoOffer: null,
    accountTimezone: null,
    reminders: [],
    announce: null,
    nextId: 1,
  }
}

export type Action =
  | { type: 'capability'; capability: SpeechCapability; message: NewMsg | null }
  | { type: 'listen-start' }
  | { type: 'transcript'; text: string }
  | { type: 'listen-end'; mode: 'speech-end' | 'speech-end-empty' | 'cancelled'; text: string }
  | { type: 'composer'; text: string }
  | { type: 'send'; message: NewMsg; clientTurnId: string }
  | {
      type: 'turn-ok'
      clientTurnId: string
      /** null = this outcome carried no session id (the voice-undo guard
       * refusal creates no turn row); keep the one already held. */
      sessionId: string | null
      appendMessages: NewMsg[]
      resolvedQuestionIds: string[]
      marks: Marks | null
      /** server turn id to mark undone (voice-undo path) */
      undoneTurnId: string | null
    }
  | { type: 'turn-failed'; clientTurnId: string; appendMessages: NewMsg[]; restoreComposer: string | null }
  | { type: 'turn-queued'; clientTurnId: string }
  | { type: 'replay-start'; clientTurnId: string }
  | { type: 'retry'; clientTurnId: string }
  | { type: 'cancel-thinking'; restoreComposer: string }
  | { type: 'undo-start'; turnId: string }
  | { type: 'undo-done'; turnId: string; appendMessages: NewMsg[] }
  | { type: 'undo-refused'; appendMessages: NewMsg[] }
  | { type: 'append'; messages: NewMsg[] }
  | { type: 'session-synced'; sessionId: string | null; messages: NewMsg[]; marks: Marks | null }
  | { type: 'tasks'; tasks: TaskView[] }
  | { type: 'unmark-task'; taskId: string }
  | { type: 'offline'; offline: boolean }
  | { type: 'session-load'; load: LoadState }
  | { type: 'tasks-load'; load: LoadState }
  // ── F-005 ──
  | { type: 'notices'; notices: Notice[] }
  | { type: 'undo-offer'; offer: UndoOffer | null }
  | { type: 'account-timezone'; timezone: string | null }
  | { type: 'reminders'; reminders: PassedReminder[] }
  | { type: 'announce'; text: string }

function withIds(state: AppState, msgs: NewMsg[]): { messages: Message[]; nextId: number } {
  let nextId = state.nextId
  const messages = msgs.map((m) => {
    const id = `m${nextId}`
    nextId += 1
    return { ...m, id } as Message
  })
  return { messages, nextId }
}

function append(state: AppState, msgs: NewMsg[]): AppState {
  if (msgs.length === 0) return state
  const { messages, nextId } = withIds(state, msgs)
  return { ...state, messages: [...state.messages, ...messages], nextId }
}

function resolveQuestions(messages: Message[], ids: string[]): Message[] {
  if (ids.length === 0) return messages
  const set = new Set(ids)
  return messages.map((m) => (m.kind === 'question' && set.has(m.turnId) ? { ...m, resolved: true } : m))
}

function markUndone(messages: Message[], turnId: string): Message[] {
  return messages.map((m) => (m.kind === 'applied' && m.turnId === turnId ? { ...m, undone: true } : m))
}

/** Only the newest error message keeps its Retry affordance — an older retry
 * button would put two state cues on screen at once (AC-29 exclusivity). */
function stripRetries(messages: Message[]): Message[] {
  return messages.map((m) => (m.kind === 'error' && m.retryTurnId !== null ? { ...m, retryTurnId: null } : m))
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'capability': {
      let next: AppState = { ...state, capability: action.capability }
      // capability loss while listening = audio interruption → cancel
      // semantics; the source itself ends the capture (AC-3), the surface
      // guard here is belt-and-braces
      if (action.capability !== 'available' && next.surface === 'listening') {
        next = { ...next, surface: 'idle' }
      }
      if (action.message !== null) next = append(next, [action.message])
      return next
    }

    case 'listen-start': {
      // edges: idle → listening (tap mic), and error → idle → listening — the
      // flowchart's E→A edge fires here, which is why `error` is accepted:
      // the error message stays in the conversation as history, the surface
      // leaves the error state. Nothing else starts a capture.
      if ((state.surface !== 'idle' && state.surface !== 'error') || state.capability !== 'available') {
        return state
      }
      return { ...state, surface: 'listening' }
    }

    case 'transcript': {
      if (state.surface !== 'listening') return state
      // live transcript streams into the composer as words land (AC-2)
      return { ...state, composer: action.text }
    }

    case 'listen-end': {
      if (state.surface !== 'listening') return state
      // cancel / interruption keeps the words in the composer (AC-3);
      // nothing-recognized returns to idle visibly, no turn (AC-2).
      // speech-end with text is followed by a 'send' from the controller.
      const composer = action.mode === 'speech-end-empty' ? state.composer : action.text
      return { ...state, surface: 'idle', composer }
    }

    case 'composer':
      return { ...state, composer: action.text }

    case 'send': {
      // edges: idle → thinking (type+send / voice end-of-speech). One turn in
      // flight at a time — the composer is the queue of length one.
      if (state.surface === 'thinking') return state
      const appended = append(
        { ...state, messages: stripRetries(state.messages) },
        [action.message],
      )
      return {
        ...appended,
        surface: 'thinking',
        activeTurnId: action.clientTurnId,
        composer: '',
      }
    }

    case 'turn-ok': {
      const active = state.activeTurnId === action.clientTurnId
      let next: AppState = {
        ...state,
        sessionId: action.sessionId ?? state.sessionId,
        // late outcome after a client-local cancel renders as a message but
        // never re-enters thinking (AC-3): only the active turn owns the state
        surface: active ? 'idle' : state.surface,
        activeTurnId: active ? null : state.activeTurnId,
        queuedTurnId: state.queuedTurnId === action.clientTurnId ? null : state.queuedTurnId,
        marks: action.marks ?? state.marks,
      }
      // queued replay resolved — the notice disappears (AC-25)
      next = {
        ...next,
        messages: next.messages.map((m) =>
          m.kind === 'user' && m.clientTurnId === action.clientTurnId && m.queued
            ? { ...m, queued: false }
            : m,
        ),
      }
      next = { ...next, messages: resolveQuestions(next.messages, action.resolvedQuestionIds) }
      if (action.undoneTurnId !== null) {
        next = {
          ...next,
          messages: markUndone(next.messages, action.undoneTurnId),
          marks: next.marks !== null && next.marks.turnId === action.undoneTurnId ? null : next.marks,
        }
      }
      return append(next, action.appendMessages)
    }

    case 'turn-failed': {
      const active = state.activeTurnId === action.clientTurnId
      // edge: thinking → error (AI error). A late failure after cancel still
      // renders; it may surface the error state only from idle.
      const surface: Surface = active ? 'error' : state.surface === 'idle' ? 'error' : state.surface
      const next: AppState = {
        ...state,
        surface,
        activeTurnId: active ? null : state.activeTurnId,
        composer: active && action.restoreComposer !== null ? action.restoreComposer : state.composer,
        messages: stripRetries(state.messages),
      }
      return append(next, action.appendMessages)
    }

    case 'turn-queued': {
      // connection dropped with a turn in flight: no half-running
      // conversation — surface hands over, the turn queues visibly (AC-25)
      const active = state.activeTurnId === action.clientTurnId
      return {
        ...state,
        surface: active ? 'idle' : state.surface,
        activeTurnId: active ? null : state.activeTurnId,
        offline: true,
        queuedTurnId: action.clientTurnId,
        messages: state.messages.map((m) =>
          m.kind === 'user' && m.clientTurnId === action.clientTurnId ? { ...m, queued: true } : m,
        ),
      }
    }

    case 'replay-start': {
      if (state.surface === 'thinking') return state
      return { ...state, surface: 'thinking', activeTurnId: action.clientTurnId }
    }

    case 'retry': {
      // edge: error → thinking (retry, same client_turn_id — AC-16)
      if (state.surface === 'thinking') return state
      return {
        ...state,
        surface: 'thinking',
        activeTurnId: action.clientTurnId,
        messages: stripRetries(state.messages),
      }
    }

    case 'cancel-thinking': {
      // edge: thinking → idle. Client-local (AC-3): the sent turn still
      // completes server-side; its late outcome renders via turn-ok/failed.
      if (state.surface !== 'thinking') return state
      return {
        ...state,
        surface: 'idle',
        activeTurnId: null,
        composer: action.restoreComposer,
      }
    }

    case 'undo-start':
      if (state.undoInFlight !== null) return state
      return { ...state, undoInFlight: action.turnId }

    case 'undo-done': {
      let next: AppState = {
        ...state,
        undoInFlight: null,
        messages: markUndone(state.messages, action.turnId),
        marks: state.marks !== null && state.marks.turnId === action.turnId ? null : state.marks,
      }
      next = append(next, action.appendMessages)
      return next
    }

    case 'undo-refused':
      return append({ ...state, undoInFlight: null }, action.appendMessages)

    case 'append':
      return append(state, action.messages)

    case 'session-synced': {
      const base: AppState = {
        ...state,
        sessionId: action.sessionId,
        marks: action.marks,
        messages: [],
        activeTurnId: null,
        undoInFlight: null,
        surface: state.surface === 'thinking' || state.surface === 'listening' ? state.surface : 'idle',
      }
      return append(base, action.messages)
    }

    case 'tasks':
      return { ...state, tasks: action.tasks }

    case 'session-load':
      return state.sessionLoad === action.load ? state : { ...state, sessionLoad: action.load }

    case 'tasks-load':
      return state.tasksLoad === action.load ? state : { ...state, tasksLoad: action.load }

    case 'unmark-task': {
      // a hand-edited row is never attributed to the turn (AC-4)
      if (state.marks === null || !(action.taskId in state.marks.byTask)) return state
      const byTask = { ...state.marks.byTask }
      delete byTask[action.taskId]
      return {
        ...state,
        marks: Object.keys(byTask).length === 0 ? null : { ...state.marks, byTask },
      }
    }

    case 'offline': {
      if (action.offline === state.offline) return state
      return { ...state, offline: action.offline }
    }

    // ── F-005 ───────────────────────────────────────────────────────────────
    // Each of these is a whole-slice replacement computed by a pure function in
    // `notices.ts` / the controller, rather than per-case logic here. That is
    // deliberate: AC-47's rules (supersede-not-end, one-per-task, no timer) are
    // properties of the *set*, and a reducer case per rule is how one of them
    // ends up enforced at one door and merely intended at another (L-005).

    case 'notices':
      return { ...state, notices: action.notices }

    case 'undo-offer':
      // Assignment, never a push: AC-43's offer does not stack, and the
      // replaced action stays done.
      return { ...state, undoOffer: action.offer }

    case 'account-timezone':
      return state.accountTimezone === action.timezone
        ? state
        : { ...state, accountTimezone: action.timezone }

    case 'reminders':
      return { ...state, reminders: action.reminders }

    case 'announce':
      return { ...state, announce: { seq: (state.announce?.seq ?? 0) + 1, text: action.text } }
  }
}

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

/** Mic mode is derived from capability — orthogonal to the four states. */
export function micMode(state: AppState): 'available' | 'dimmed-permission' | 'dimmed-transient' | 'hidden' {
  switch (state.capability) {
    case 'none':
      return 'hidden'
    case 'permission-denied':
      return 'dimmed-permission'
    case 'transient-failure':
      return 'dimmed-transient'
    case 'available':
      return 'available'
  }
}

/** The undo window (AC-8, client face): the newest applied turn **that
 * mutated tasks** and has not been undone carries the one Undo affordance. A
 * newer mutating applied turn, an undo, or session close (messages replaced
 * by the boundary) ends it — the affordance visibly disappears.
 *
 * Non-mutating turns are transparent to the window, exactly as the server's
 * refusal rule is (api-contracts, undo section): a no-match, an unsupported
 * query, an unclassifiable answer, or a declined resolution renders its own
 * message and leaves the previous turn's Undo standing. A misheard utterance
 * never spends the undo.
 *
 * An **undone** turn is skipped rather than terminating the search: the server
 * states the rule mechanically — "after an undo, the previous mutating applied
 * turn (if any) becomes the newest again" — so the affordance reappears on it
 * instead of the client hiding a button the server would honour. */
export function undoableTurnId(state: AppState): string | null {
  if (state.sessionId === null) return null
  for (let i = state.messages.length - 1; i >= 0; i--) {
    const m = state.messages[i]
    if (m === undefined || m.kind !== 'applied' || !m.mutated || m.undone) continue
    return m.turnId
  }
  return null
}
