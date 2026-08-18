// AssistantController — wires the ports (speech, durable store), the typed
// API client and the reducer together. Plain TS, node-testable: components
// are thin renderers over this (platform web.md / mobile.md).
//
// PLATFORM-NEUTRAL. This is the one conversation controller: the web client
// uses it directly, the React Native client extends it
// (src/assistant/mobile/controller.ts) with what the OS owns — two permission
// models, process kill, audio interruption, foreground transitions. Members
// the subclass needs are `protected`; everything else stays private. A second
// copy of any of this would be a second place for the undo-window rule to
// drift (F-003 AC-1 is the parity contract that forbids exactly that).
//
// Contract notes threaded through the flows:
// - Cancel is CLIENT-LOCAL (AC-3): no cancel endpoint; a sent turn always
//   completes server-side and its late outcome renders from the response.
// - Retry re-sends the SAME client_turn_id (AC-16) from client.outgoing_turn.
// - The manual path calls /tasks* only — never /assistant/* (AC-18).
// - Offline: no half-running conversation; input goes through the local
//   no-AI path; a turn in flight when the connection drops queues and
//   replays visibly (AC-25, ADR-7). The local no-AI CREATE is not device-only
//   either: the contract has the client replay it on reconnect under the same
//   client-generated id (`syncLocalTasks`), so an offline task reaches the
//   server exactly once. Both clients inherit that from here — BUG-001 was
//   the case where only the queued *turn* replayed and the create never did.

import { AssistantApi } from './api/client.ts'
import type { ApiResult } from './api/client.ts'
import type { TranscriptSource } from './ports/transcript-source.ts'
import { ClientStores } from './model/client-stores.ts'
import {
  aiErrorMessage,
  boundaryMessage,
  keptMessage,
  permissionDeniedMessage,
  revertedMessage,
  sessionMessages,
  transientFailureMessage,
  turnOutcomeMessages,
  undoRefusedMessage,
} from './model/messages.ts'
import type { MessageContext, NewMsg } from './model/messages.ts'
import { initialState, reducer, undoableTurnId } from './model/reducer.ts'
import type { Action, AppState } from './model/reducer.ts'
import { dueAtForCollection } from './model/tasks.ts'
import type { Collection } from './model/tasks.ts'
import type {
  DiffLine,
  QuestionKind,
  Surface,
  TaskView,
  TurnRequestBody,
  TurnResponseWire,
  TurnSource,
} from './types.ts'

export interface ControllerDeps {
  api: AssistantApi
  speech: TranscriptSource
  stores: ClientStores
  uuid?: () => string
  now?: () => string
  timezone?: string | null
  /** current connectivity — defaults to navigator.onLine when available */
  onlineNow?: () => boolean
}

const IN_FLIGHT_RETRY_MS = 400
const IN_FLIGHT_MAX_ATTEMPTS = 5

/** Random lowercase hex, `n` nibbles wide, zero-padded. */
function hex(n: number): string {
  return Math.floor(Math.random() * 16 ** n)
    .toString(16)
    .padStart(n, '0')
}

/**
 * The id generator used when the host injects none (`ControllerDeps.uuid`).
 *
 * `crypto` is a Web/Node global. It does **not** exist in Hermes, the engine
 * React Native runs on device, so the previous one-liner
 * (`() => crypto.randomUUID()`) threw `ReferenceError: Property 'crypto'
 * doesn't exist` on the first turn of every handset session — before the turn
 * was composed, so the user got a dead screen with no error bubble and no
 * retry (BUG-003). Feature-detect the platform generator, then compose the
 * same shape by hand.
 *
 * The fallback uses `Math.random()` **deliberately**. This value is a
 * per-client correlation handle: it labels a turn so a retry re-sends the same
 * one (AC-16) and so an offline create replays exactly once. It is not a
 * secret, a token or a capability — the server authorises on `X-User-Id` and
 * treats this as an opaque key it only has to parse. Do not "harden" it by
 * adding a crypto dependency: `_shared/` is imported by web, mobile and every
 * test, and staying dependency-free is what lets all three run it.
 *
 * Output is RFC-4122 v4 shaped (8-4-4-4-12, version nibble `4`, variant nibble
 * `8`–`b`), which is what `api/app.ts`'s `UUID_RE` accepts.
 */
export function defaultUuid(): string {
  const native = globalThis.crypto?.randomUUID?.()
  if (typeof native === 'string') return native
  const variant = '89ab'.charAt(Math.floor(Math.random() * 4))
  return `${hex(8)}-${hex(4)}-4${hex(3)}-${variant}${hex(3)}-${hex(12)}`
}

/** Drop the device-only marker — the field is removed, not set false, so a
 * synced task is indistinguishable from one that was never local. */
function unmarkLocal(t: TaskView): TaskView {
  if (t.local === undefined) return t
  const { local: _local, ...rest } = t
  return rest
}

export class AssistantController {
  protected readonly api: AssistantApi
  readonly speech: TranscriptSource
  protected readonly stores: ClientStores
  protected readonly uuid: () => string
  protected readonly now: () => string
  private readonly timezone: string | null
  protected readonly onlineNow: () => boolean
  private readonly listeners = new Set<() => void>()
  /** In-flight offline-create replay. Reconnect can fire twice (a flapping
   * connection, a foreground transition racing an `online` event); callers
   * join this promise instead of starting a second pass, so no create is
   * POSTed twice. */
  private localSync: Promise<void> | null = null

  state: AppState

  constructor(deps: ControllerDeps) {
    this.api = deps.api
    this.speech = deps.speech
    this.stores = deps.stores
    // Injection seam unchanged — every harness relies on it for determinism.
    // The default is `defaultUuid`, not `crypto.randomUUID`: see BUG-003.
    this.uuid = deps.uuid ?? defaultUuid
    this.now = deps.now ?? (() => new Date().toISOString())
    this.timezone =
      deps.timezone !== undefined
        ? deps.timezone
        : (Intl.DateTimeFormat().resolvedOptions().timeZone ?? null)
    this.onlineNow =
      deps.onlineNow ??
      (() => (typeof navigator === 'undefined' ? true : navigator.onLine !== false))
    this.state = initialState(this.speech.capability())
    this.speech.onCapabilityChange((capability) => {
      const message: NewMsg | null =
        capability === 'permission-denied'
          ? permissionDeniedMessage(this.now())
          : capability === 'transient-failure'
            ? transientFailureMessage(this.now())
            : null
      this.dispatch({ type: 'capability', capability, message })
    })
  }

  subscribe(cb: () => void): () => void {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }

  protected dispatch(action: Action): void {
    this.state = reducer(this.state, action)
    for (const cb of this.listeners) cb()
  }

  // -------------------------------------------------------------------------
  // Startup
  // -------------------------------------------------------------------------

  async init(): Promise<void> {
    if (!this.onlineNow()) this.dispatch({ type: 'offline', offline: true })
    await this.refreshTasks()
    // A create made offline in an earlier run is still unsynced on this one:
    // starting up online IS a reconnect (AC-25). No-op when nothing is local.
    await this.syncLocalTasks()
    await this.syncSession()
    // client.pending_input reopens into the composer (web floor of AC-26)
    const pending = this.stores.pendingInput()
    if (pending !== '') this.dispatch({ type: 'composer', text: pending })
    await this.replayLeftoverOutgoing()
  }

  /** Re-read GET /assistant/session and re-render from it — resume, or the
   * clean-start boundary (AC-28). Also the seam hook a harness idle-close
   * uses to make the ended undo window visibly disappear (AC-8). */
  async syncSession(): Promise<void> {
    this.dispatch({ type: 'session-load', load: 'loading' })
    const res = await this.api.getSession()
    if (res.kind !== 'ok') {
      // The thread cannot render at all, so an error BUBBLE is the wrong shape
      // — there is no thread to put it in. The surface says so instead
      // (IA §6 S1, SE-SESSION), and the route to the by-hand list stays live:
      // AC-24's reachability bound names this exact failure.
      this.dispatch({ type: 'session-load', load: 'failed' })
      return
    }
    this.dispatch({ type: 'session-load', load: 'ok' })
    const ctx = this.msgContext()
    if (res.value.session !== null) {
      const { messages, marks } = sessionMessages(res.value.session, ctx)
      this.dispatch({
        type: 'session-synced',
        sessionId: res.value.session.id,
        messages,
        marks,
      })
      return
    }
    const msgs: NewMsg[] = res.value.boundary !== null ? [boundaryMessage(res.value.boundary, ctx)] : []
    this.dispatch({ type: 'session-synced', sessionId: null, messages: msgs, marks: null })
  }

  /** client.outgoing_turn survived a reload unacked → replay under the same
   * client_turn_id (AC-16; web floor of AC-27). */
  protected async replayLeftoverOutgoing(): Promise<void> {
    const rec = this.stores.outgoingTurn()
    if (rec === null) return
    const inSession = this.state.messages.some(
      (m) => m.kind === 'user' && m.clientTurnId === rec.body.client_turn_id,
    )
    if (inSession) {
      // the server already has this turn — the session read is the ack
      this.stores.clearOutgoingTurn()
      return
    }
    this.dispatch({
      type: 'append',
      messages: [
        {
          kind: 'user',
          text: rec.body.transcript,
          via: rec.body.source,
          at: rec.sent_at,
          queued: true,
          clientTurnId: rec.body.client_turn_id,
        },
      ],
    })
    await this.replayQueued()
  }

  // -------------------------------------------------------------------------
  // Composer + speech capture
  // -------------------------------------------------------------------------

  composerChange(text: string): void {
    this.dispatch({ type: 'composer', text })
    this.stores.savePendingInput(text, this.now)
  }

  tapMic(): void {
    const cap = this.state.capability
    if (cap === 'none') return
    if (cap === 'permission-denied') {
      this.dispatch({ type: 'append', messages: [permissionDeniedMessage(this.now())] })
      return
    }
    if (cap === 'transient-failure') {
      this.dispatch({ type: 'append', messages: [transientFailureMessage(this.now())] })
      return
    }
    // Read through a call rather than a field so control-flow narrowing does
    // not survive `dispatch` — dispatch replaces the state object, so a
    // narrowing taken before it no longer describes what comes after.
    const surfaceNow = (): Surface => this.state.surface
    if (surfaceNow() === 'listening') {
      // mic tap while listening = cancel-while-listening: capture stops, the
      // recognized-so-far text stays in the composer, nothing is sent (AC-3)
      this.speech.stop()
      return
    }
    if (surfaceNow() !== 'idle' && surfaceNow() !== 'error') return
    this.dispatch({ type: 'listen-start' })
    if (surfaceNow() !== 'listening') return
    this.speech.start({
      onTranscript: (text) => {
        this.dispatch({ type: 'transcript', text })
        // recognized-so-far text persists — reload loses no words (AC-26 floor)
        this.stores.savePendingInput(text, this.now)
      },
      onEnd: (mode, text) => {
        this.dispatch({ type: 'listen-end', mode, text })
        this.stores.savePendingInput(this.state.composer, this.now)
        if (mode === 'speech-end' && text.trim() !== '') {
          void this.send('voice', text)
        }
      },
    })
  }

  // -------------------------------------------------------------------------
  // Turns
  // -------------------------------------------------------------------------

  /** Send a turn. Typed and spoken input take the same path (AC-17); a chip
   * tap sends the option's literal text with an explicit binding (AC-10). */
  async send(source: TurnSource, textArg?: string, answerToTurnId?: string | null): Promise<void> {
    const text = (textArg ?? this.state.composer).trim()
    if (text === '' || this.state.surface === 'thinking') return
    if (this.state.offline || !this.onlineNow()) {
      // offline: no half-running conversation — the local no-AI path creates
      // the task on this device (AC-25); zero assistant calls
      this.createLocalTask(text)
      this.dispatch({ type: 'composer', text: '' })
      this.stores.savePendingInput('', this.now)
      return
    }
    const clientTurnId = this.uuid()
    const body: TurnRequestBody = {
      session_id: this.state.sessionId,
      client_turn_id: clientTurnId,
      transcript: text,
      source,
      answer_to_turn_id: answerToTurnId ?? null,
      timezone: this.timezone,
    }
    this.stores.saveOutgoingTurn({ body, sent_at: this.now(), attempts: 1 })
    this.dispatch({
      type: 'send',
      clientTurnId,
      message: { kind: 'user', text, via: source, at: this.now(), queued: false, clientTurnId },
    })
    this.stores.savePendingInput('', this.now)
    await this.deliver(body)
  }

  protected async deliver(body: TurnRequestBody, attempt = 1): Promise<void> {
    const res = await this.api.postTurn(body)
    if (res.kind === 'network') {
      // connection dropped with the turn in flight → queue + replay visibly
      this.dispatch({ type: 'turn-queued', clientTurnId: body.client_turn_id })
      return
    }
    if (res.kind === 'ok') {
      this.applyTurnResponse(body, res.value)
      return
    }
    const at = this.now()
    switch (res.code) {
      case 'SESSION_CLOSED': {
        // re-sync, then replay the SAME client_turn_id against the new
        // session (AC-16; api-contracts processing rule 1)
        await this.syncSession()
        const next: TurnRequestBody = { ...body, session_id: this.state.sessionId }
        this.stores.saveOutgoingTurn({ body: next, sent_at: at, attempts: attempt + 1 })
        if (attempt < 3) await this.deliver(next, attempt + 1)
        return
      }
      case 'IN_FLIGHT': {
        if (attempt < IN_FLIGHT_MAX_ATTEMPTS) {
          await new Promise((r) => setTimeout(r, IN_FLIGHT_RETRY_MS))
          await this.deliver(body, attempt + 1)
          return
        }
        this.ackOutgoing(body.client_turn_id)
        this.dispatch({
          type: 'turn-failed',
          clientTurnId: body.client_turn_id,
          appendMessages: [aiErrorMessage(null, at)],
          restoreComposer: body.transcript,
        })
        return
      }
      case 'UNDO_REFUSED': {
        // voice-undo guard refusal: no turn row, outcome recorded under this
        // id for dedupe (TC-24) — render the visible refusal (AC-6)
        this.ackOutgoing(body.client_turn_id)
        const reason = String(res.detail?.['reason'] ?? 'not_undoable')
        this.dispatch({
          type: 'turn-ok',
          clientTurnId: body.client_turn_id,
          sessionId: this.state.sessionId,
          appendMessages: [undoRefusedMessage(reason, at)],
          resolvedQuestionIds: [],
          marks: null,
          undoneTurnId: null,
        })
        return
      }
      case 'AI_ERROR':
      case 'APPLY_FAILED': {
        // turn persisted failed with its transcript (AC-23); retry re-sends
        // the same id (failed → pending, AC-16). Words back into the composer.
        this.dispatch({
          type: 'turn-failed',
          clientTurnId: body.client_turn_id,
          appendMessages: [aiErrorMessage(body.client_turn_id, at)],
          restoreComposer: body.transcript,
        })
        return
      }
      default: {
        // terminal 4xx — acked per the data-model ack rule; no same-id retry
        this.ackOutgoing(body.client_turn_id)
        this.dispatch({
          type: 'turn-failed',
          clientTurnId: body.client_turn_id,
          appendMessages: [aiErrorMessage(null, at)],
          restoreComposer: body.transcript,
        })
      }
    }
  }

  private applyTurnResponse(body: TurnRequestBody, r: TurnResponseWire): void {
    this.ackOutgoing(body.client_turn_id)
    const ctx = this.msgContext()
    const msgs: NewMsg[] = []
    const resolved: string[] = []
    const at = this.now()
    for (const rr of r.resolutions) {
      resolved.push(rr.question_turn_id)
      if (rr.result === 'declined_superseded') {
        msgs.push(keptMessage(ctx.questionInfo(rr.question_turn_id), true, at))
      }
    }
    let marks = null
    let undoneTurnId: string | null = null
    let mutated = false
    if (r.kind === 'undo' && r.undo !== null) {
      undoneTurnId = r.undo.turn_id
      msgs.push(revertedMessage(r.undo, (taskId) => this.lineFor(r.undo!.turn_id, taskId), at))
      mutated = !r.undo.nothing_reverted
    }
    if (r.kind === 'turn' && r.turn !== null) {
      const view = turnOutcomeMessages(r.turn, ctx, true)
      msgs.push(...view.messages)
      marks = view.marks
      mutated = mutated || r.turn.changed_task_ids.length > 0
    }
    this.dispatch({
      type: 'turn-ok',
      clientTurnId: body.client_turn_id,
      sessionId: r.session_id,
      appendMessages: msgs,
      resolvedQuestionIds: resolved,
      marks,
      undoneTurnId,
    })
    if (mutated) void this.refreshTasks()
  }

  /** Client-local cancel while thinking (AC-3): surface → idle, words kept;
   * the sent turn still completes and its late outcome renders honestly. */
  cancelThinking(): void {
    if (this.state.surface !== 'thinking') return
    const rec = this.stores.outgoingTurn()
    const restore = rec?.body.transcript ?? ''
    this.dispatch({ type: 'cancel-thinking', restoreComposer: restore })
    this.stores.savePendingInput(restore, this.now)
  }

  /** Retry a failed turn — the same client_turn_id, from client.outgoing_turn
   * (AC-16, AC-24). */
  async retry(clientTurnId: string): Promise<void> {
    const rec = this.stores.outgoingTurn()
    if (rec === null || rec.body.client_turn_id !== clientTurnId) return
    if (this.state.surface === 'thinking') return
    this.dispatch({ type: 'retry', clientTurnId })
    const body: TurnRequestBody = { ...rec.body, session_id: this.state.sessionId }
    this.stores.saveOutgoingTurn({ body, sent_at: this.now(), attempts: rec.attempts + 1 })
    await this.deliver(body)
  }

  /** Replay the offline-queued turn — same id, visibly (AC-25). */
  async replayQueued(): Promise<void> {
    const rec = this.stores.outgoingTurn()
    if (rec === null) return
    if (this.state.surface === 'thinking') return
    this.dispatch({ type: 'replay-start', clientTurnId: rec.body.client_turn_id })
    const body: TurnRequestBody = {
      ...rec.body,
      session_id: this.state.sessionId ?? rec.body.session_id,
    }
    await this.deliver(body)
  }

  setOnline(online: boolean): void {
    this.dispatch({ type: 'offline', offline: !online })
    if (online) void this.reconnect()
  }

  /** What reconnecting owes the server, in contract order: the offline creates
   * first, then the queued turn. Creates go first so the replayed turn is
   * interpreted against a task list that already contains them — a task made
   * offline that is missing from the server is also missing from the turn's
   * context (BUG-001's second consequence). */
  protected async reconnect(): Promise<void> {
    await this.syncLocalTasks()
    await this.replayQueued()
  }

  // -------------------------------------------------------------------------
  // Undo (AC-5..8)
  // -------------------------------------------------------------------------

  async undoTap(turnId: string): Promise<void> {
    if (this.state.undoInFlight !== null) return // double-activation guard
    this.dispatch({ type: 'undo-start', turnId })
    const res = await this.api.undoTurn(turnId, 'tap')
    const at = this.now()
    if (res.kind === 'ok') {
      this.dispatch({
        type: 'undo-done',
        turnId,
        appendMessages: [revertedMessage(res.value, (taskId) => this.lineFor(turnId, taskId), at)],
      })
      if (!res.value.nothing_reverted) void this.refreshTasks()
      return
    }
    if (res.kind === 'http-error' && res.code === 'UNDO_REFUSED') {
      const reason = String(res.detail?.['reason'] ?? 'not_undoable')
      this.dispatch({ type: 'undo-refused', appendMessages: [undoRefusedMessage(reason, at)] })
      return
    }
    this.dispatch({
      type: 'undo-refused',
      appendMessages: [
        {
          kind: 'outcome',
          head: null,
          body: [
            "The undo request didn't reach the server — nothing changed. Check your connection and try again.",
          ],
          at,
        },
      ],
    })
  }

  /** A chip tap sends the option's literal text as a normal turn, bound to
   * its question's turn (AC-10, AC-13; api-contracts). */
  async chipTap(questionTurnId: string, optionText: string): Promise<void> {
    const q = this.state.messages.find((m) => m.kind === 'question' && m.turnId === questionTurnId)
    if (q !== undefined && q.kind === 'question' && q.resolved) return
    await this.send('tap', optionText, questionTurnId)
  }

  permissionCta(): void {
    this.dispatch({
      type: 'append',
      messages: [
        {
          kind: 'outcome',
          head: 'How to turn the microphone back on',
          body: [
            "Open your browser's site settings for this page (the icon next to the address bar), set Microphone to Allow, then tap the mic again.",
          ],
          at: this.now(),
        },
      ],
    })
  }

  // -------------------------------------------------------------------------
  // Manual path (AC-18) — /tasks only, zero AI involvement
  // -------------------------------------------------------------------------

  /**
   * Add by hand. **`collection` is where the user is looking**, and it sets the
   * task's DATE, not its status (ADR-009 §4): on Today the row is dated the
   * local start of today, so it lands in the list the user is standing in;
   * everywhere else it is dateless and lands in Inbox.
   *
   * The default is `'inbox'` because the other caller is the conversation —
   * `send()`'s offline local path (AC-25) — which is not a collection at all
   * and has no day to commit the user to.
   */
  async addTask(title: string, collection: Collection = 'inbox'): Promise<void> {
    const t = title.trim()
    if (t === '') return
    if (this.state.offline || !this.onlineNow()) {
      this.createLocalTask(t, collection)
      return
    }
    const res = await this.api.createTask({
      title: t,
      due_at: dueAtForCollection(collection, new Date(this.now())),
    })
    if (res.kind === 'ok') await this.refreshTasks()
    else this.createLocalTask(t, collection)
  }

  async toggleTask(taskId: string): Promise<void> {
    const task = this.state.tasks.find((t) => t.id === taskId)
    if (task === undefined) return
    // Un-completing writes `inbox` and **does not touch `due_at`** (ADR-009 §3).
    // This line read `? 'today'` and was wrong twice over: it wrote a status
    // that means nothing, AND it failed to put the row in Today, because a
    // dateless row is not in Today. Leaving the date alone is what makes the
    // round trip lossless — a row dated today returns to Today, a dateless one
    // returns to Inbox, which is where each came from (UC-45 AC-45.2, with no
    // `doneFrom` field).
    const nextStatus = task.status === 'done' ? 'inbox' : 'done'
    // a hand-changed row is never attributed to a turn (AC-4)
    this.dispatch({ type: 'unmark-task', taskId })
    this.dispatch({
      type: 'tasks',
      tasks: this.state.tasks.map((t) => (t.id === taskId ? { ...t, status: nextStatus } : t)),
    })
    if (task.local === true || this.state.offline || !this.onlineNow()) {
      this.persistLocal()
      return
    }
    await this.api.patchTask(taskId, { status: nextStatus })
  }

  async editTask(taskId: string, title: string): Promise<void> {
    const t = title.trim()
    const task = this.state.tasks.find((x) => x.id === taskId)
    if (task === undefined || t === '' || t === task.title) return
    this.dispatch({ type: 'unmark-task', taskId })
    this.dispatch({
      type: 'tasks',
      tasks: this.state.tasks.map((x) => (x.id === taskId ? { ...x, title: t } : x)),
    })
    if (task.local === true || this.state.offline || !this.onlineNow()) {
      this.persistLocal()
      return
    }
    await this.api.patchTask(taskId, { title: t })
  }

  async removeTask(taskId: string): Promise<void> {
    const task = this.state.tasks.find((x) => x.id === taskId)
    if (task === undefined) return
    this.dispatch({ type: 'unmark-task', taskId })
    this.dispatch({ type: 'tasks', tasks: this.state.tasks.filter((x) => x.id !== taskId) })
    if (task.local === true || this.state.offline || !this.onlineNow()) {
      this.persistLocal()
      return
    }
    await this.api.deleteTask(taskId)
  }

  async refreshTasks(): Promise<void> {
    if (this.state.offline || !this.onlineNow()) {
      // No server read offline — but the device-local tasks are still ours to
      // show, and they have to be IN state or the next local write (which
      // persists `state.tasks.filter(local)`) would drop the ones a cold
      // offline open never loaded, and the reconnect replay would never see
      // them. No-op once state already holds them.
      const local = this.stores.localTasks()
      if (local.length > 0) {
        this.dispatch({
          type: 'tasks',
          tasks: [...this.state.tasks.filter((t) => t.local !== true), ...local],
        })
      }
      // Offline is not a failed read: the list works untouched and the banner
      // carries the news (components.md § TaskList / § OfflineBanner). Marking
      // it `failed` here would stack an error on top of a surface that is
      // working, which is the "fallback that blanks itself" failure S2 exists
      // not to have.
      this.dispatch({ type: 'tasks-load', load: 'ok' })
      return
    }
    this.dispatch({ type: 'tasks-load', load: 'loading' })
    const res = await this.api.listTasks()
    if (res.kind !== 'ok') {
      this.dispatch({ type: 'tasks-load', load: 'failed' })
      return
    }
    const server = res.value.tasks.filter((t) => t.deleted_at === null)
    this.dispatch({ type: 'tasks', tasks: [...server, ...this.stores.localTasks()] })
    this.dispatch({ type: 'tasks-load', load: 'ok' })
  }

  private createLocalTask(title: string, collection: Collection = 'inbox'): void {
    const at = this.now()
    const task: TaskView = {
      id: this.uuid(),
      title,
      // Same rule as the online path, and it has to be: the offline row is
      // replayed verbatim on reconnect (`pushLocalTasks`), so a date decided
      // only in `addTask` would be lost for exactly the users who cannot see
      // the server correct it.
      due_at: dueAtForCollection(collection, new Date(at)),
      reminder_at: null,
      priority: null,
      status: 'inbox',
      created_at: at,
      updated_at: at,
      deleted_at: null,
      local: true,
    }
    this.dispatch({ type: 'tasks', tasks: [...this.state.tasks, task] })
    this.persistLocal()
  }

  private persistLocal(): void {
    this.stores.saveLocalTasks(this.state.tasks.filter((t) => t.local === true))
  }

  /**
   * Replay every offline-created task to the server (AC-25; api-contracts
   * "the offline local path … replays the create on reconnect"). Each create
   * is re-POSTed under the id the client already assigned it — no temporary-id
   * mapping — so the two documented answers are both acks:
   *
   * - `201` — the server took it now.
   * - `409 TASK_ID_EXISTS` — the server already had it (an earlier replay whose
   *   response this client never saw). Same meaning for the user: it is synced.
   *
   * Either way the `local` marker clears, which is what stops a create being
   * replayed forever. Anything else (network drop, 5xx) leaves the task local
   * and unchanged, so the next reconnect tries again.
   *
   * Safe to call concurrently: a second caller joins the first pass.
   */
  async syncLocalTasks(): Promise<void> {
    if (this.localSync !== null) {
      await this.localSync
      return
    }
    const run = this.pushLocalTasks()
    this.localSync = run
    try {
      await run
    } finally {
      this.localSync = null
    }
  }

  private async pushLocalTasks(): Promise<void> {
    if (this.state.offline || !this.onlineNow()) return
    const pending = this.pendingLocalTasks()
    if (pending.length === 0) return
    const synced = new Set<string>()
    for (const t of pending) {
      const res = await this.api.createTask({
        id: t.id,
        title: t.title,
        due_at: t.due_at,
        priority: t.priority,
        status: t.status,
      })
      if (res.kind === 'ok') {
        synced.add(t.id)
        continue
      }
      if (res.kind === 'http-error' && res.code === 'TASK_ID_EXISTS') {
        synced.add(t.id)
        continue
      }
      // The connection went again mid-replay — stop rather than burn the rest
      // of the queue against a server that is not answering.
      if (res.kind === 'network') break
      // A rejected create (4xx that is not the collision ack, 5xx) keeps the
      // task local: it is still only on this device, and saying otherwise
      // would be the same silent loss this replay exists to end.
    }
    if (synced.size === 0) return
    // Write the store from `pending`, not from state: a cold offline open can
    // hold tasks the current state never loaded, and filtering state would
    // silently drop them.
    this.stores.saveLocalTasks(pending.filter((t) => !synced.has(t.id)))
    this.dispatch({
      type: 'tasks',
      tasks: this.state.tasks.map((t) => (synced.has(t.id) ? unmarkLocal(t) : t)),
    })
    // The server is the authority now — read back so the replayed tasks are
    // the server's rows, not this device's copies.
    await this.refreshTasks()
  }

  /** Offline creates still owed to the server. The durable store is the source
   * of truth (a cold open while offline may not have reached state yet); where
   * state also holds the task, state wins — it carries edits made since. */
  private pendingLocalTasks(): TaskView[] {
    const inState = new Map(
      this.state.tasks.filter((t) => t.local === true).map((t) => [t.id, t] as const),
    )
    const out: TaskView[] = []
    for (const stored of this.stores.localTasks()) {
      out.push(inState.get(stored.id) ?? stored)
      inState.delete(stored.id)
    }
    for (const only of inState.values()) out.push(only)
    return out
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  protected ackOutgoing(clientTurnId: string): void {
    if (this.stores.outgoingTurn()?.body.client_turn_id === clientTurnId) {
      this.stores.clearOutgoingTurn()
    }
  }

  protected msgContext(): MessageContext {
    return {
      titleFor: (taskId) => this.state.tasks.find((t) => t.id === taskId)?.title ?? null,
      questionInfo: (questionTurnId): { qkind: QuestionKind; titles: string[] } | null => {
        for (const m of this.state.messages) {
          if (m.kind === 'question' && m.turnId === questionTurnId) {
            return { qkind: m.qkind, titles: m.taskTitles }
          }
        }
        return null
      },
      now: new Date(this.now()),
    }
  }

  private lineFor(turnId: string, taskId: string): DiffLine | null {
    for (const m of this.state.messages) {
      if (m.kind === 'applied' && m.turnId === turnId) {
        return m.lines.find((l) => l.taskId === taskId) ?? null
      }
    }
    return null
  }

  undoable(): string | null {
    return undoableTurnId(this.state)
  }
}

// Re-export for consumers that only import the controller module.
export { AssistantApi }
export type { ApiResult }
