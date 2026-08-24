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
import type {
  ApiResult,
  RepeatPreviewWire,
  TaskCreateBody,
  TaskPatchBody,
  TaskWriteResult,
} from './api/client.ts'
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
import {
  dismiss as dismissNoticeIn,
  endForDeletedTask,
  noticeFor,
  recordFailure,
  renameIn,
  resolveField,
  supersede,
} from './model/notices.ts'
import {
  emptyF005Fields,
  mergePatch,
  normalizeTitle,
  reminderPassedUnacknowledged,
} from './model/task-fields.ts'
import type { ClockProvider } from './model/clock.ts'
import type {
  DiffLine,
  Notice,
  NoticeReason,
  PassedReminder,
  QuestionKind,
  Surface,
  TaskView,
  TurnRequestBody,
  TurnResponseWire,
  TurnSource,
  UndoAction,
} from './types.ts'

export interface ControllerDeps {
  api: AssistantApi
  speech: TranscriptSource
  stores: ClientStores
  uuid?: () => string
  /**
   * **The one client clock seam** (F-005 AC-44). It is injectable, stored and
   * defaulted, and it already feeds `dueAtForCollection` on both clients — so it
   * is *widened* where the view layer needs a `Date` rather than the ISO string
   * it returns, and it is never duplicated. Told the client has no seam, an
   * implementer builds a second one: two clocks on one client, which is what
   * AC-44 exists to forbid (L-004).
   *
   * `web/seams.ts setClock({at, zone})` drives this and nothing else.
   */
  now?: () => string
  /**
   * What this client **reports** (ADR-010) — it rides `POST /assistant/turn` and
   * is recorded server-side by one installer. It is emphatically **not** what
   * the client **computes with**: that is `account.timezone` from `GET /account`
   * (`state.accountTimezone`, `this.zone()`), because a per-device zone is the
   * *one row, three answers* source ADR-010 rejects by name.
   */
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

/**
 * `pushLocalTasks`'s replay projection — **`## Impact §1`'s fifteenth closed
 * field list**, extracted from the loop it was inline in so it can be read as a
 * list rather than found as a literal.
 *
 * It read `{id, title, due_at, priority, status}`. Three facts made that a silent
 * defect rather than a visible one:
 *
 * - it is **not a constructor**, so "a missed field is `undefined` rather than its
 *   declared empty value" does not reach it;
 * - **every field on `TaskCreateBody` is optional**, so widening the type produces
 *   **no compile error** here;
 * - it is **shared code**, so the phone has it too.
 *
 * The consequences AC-14 and AC-13 name: an offline-created **step** replayed with
 * `parent_id` dropped **returns as an ordinary top-level task, in every collection
 * and every count** — which is what AC-35 exists to prevent — and a task created
 * offline while viewing Today replays as a bare local midnight with no
 * `due_all_day`, the defect AC-13 forbids.
 *
 * **This widening is required, and it is not the thing OQ6 declined.** What the
 * owner declined is queue-and-replay for offline **edits**; this is the
 * **create** path's field set, and `## Out of Scope` now carries the
 * qualification. The two sentences are one instruction read from two sides.
 *
 * `step_order` is carried because **the server preserves a position the replay
 * supplies rather than reassigning it** (ADR-015, AC-14): a server that assigned
 * on replay would overwrite a position the user has already seen and possibly
 * reordered.
 */
function replayBody(t: TaskView): TaskCreateBody {
  return {
    id: t.id,
    title: t.title,
    note: t.note ?? null,
    due_at: t.due_at,
    due_all_day: t.due_all_day ?? null,
    reminder_at: t.reminder_at,
    priority: t.priority as TaskCreateBody['priority'],
    status: t.status,
    parent_id: t.parent_id ?? null,
    step_order: t.step_order ?? null,
    repeat_frequency: t.repeat_frequency ?? null,
    repeat_interval: t.repeat_interval ?? null,
    repeat_weekdays: t.repeat_weekdays ?? null,
    repeat_month_days: t.repeat_month_days ?? null,
    repeat_until: t.repeat_until ?? null,
    repeat_count: t.repeat_count ?? null,
  }
}

/**
 * Has the store's value for a field moved since a failure was recorded?
 *
 * `undefined` and `null` are the same answer here on purpose: a row read before
 * the wire carried a field has `undefined` where a row read after it has `null`,
 * and treating that as a change would report **every** outstanding notice
 * superseded the first time the wire widened — the same shape AC-34 names on the
 * server side (`undefined` stored versus `null` live reporting every task as
 * modified).
 */
function sameStored(a: unknown, b: unknown): boolean {
  const norm = (v: unknown): unknown => (v === undefined ? null : v)
  return norm(a) === norm(b)
}

// ── Copy (F-005) ──────────────────────────────────────────────────────────────
//
// **These are literals, not templates, and that is the rule rather than a style**
// (L-008): a template that interpolates the varying part is how an unenumerated
// combination ships fluent text nobody reviewed. Each carries a stable id so it
// can be cited when design adopts it.
//
// **They are placeholders and they are reported as such.** F-005 has no design
// screens and `docs/design/_shared/components.md` carries no F-005 rows, so there is no
// owning catalogue to parse — which means the L-008 discipline (the test reads the
// owning artifact, never a retyped copy) is not yet available for this feature.
// The strings live in ONE place so that adopting design's wording is one edit and
// a grep for the id returns every use.

/** F5-REFUSE-TITLE — AC-37. */
const EMPTY_TITLE_REFUSED = "A task needs a name — this one kept the name it had."
/** F5-UNDO-FAILED — AC-41's restore did not reach the server. */
const UNDO_FAILED = "That couldn't be undone — nothing changed. Check your connection and try again."
/** F5-UNDO-ALREADY — AC-41's stated no-op. Not a 404 and not a 409. */
const UNDO_ALREADY = 'That was already back.'
/** F5-REMINDER-ACK-OFFLINE — AC-38's offline half, stated rather than implied. */
const REMINDER_ACK_OFFLINE =
  "You're offline, so this reminder wasn't marked as seen — it will come back next time you open the app."
/** F5-REMINDER-ACK-FAILED — the 409 REMINDER_MOVED case included. */
const REMINDER_ACK_FAILED = "That reminder wasn't marked as seen — it's still here."

/** F5-OFFLINE-REFUSED — AC-2's third state. Honest about there being no queue:
 * *"try again when you are back online"*, never a spinner or a pending badge. */
function offlineRefusalText(field: string): string {
  if (field === 'delete') {
    return "You're offline, so this wasn't deleted — it's still on your list. Try again when you're back online."
  }
  return `You're offline, so this change wasn't saved — ${fieldWord(field)} is unchanged. Try again when you're back online.`
}

/** F5-WRITE-FAILED — AC-2's second state.
 *
 * The delete gets its own literal rather than sharing one: *"your text is kept"* is
 * true of a field and meaningless of a delete, and the honest news there is that
 * the row is still on the list — which is AC-42's own statement of the case (*"the
 * row comes back, the failure is stated"*). Two literals rather than a template
 * over the field name, for L-008's reason. */
function failureText(field: string): string {
  if (field === 'delete') return "That wasn't deleted — it's still on your list. Try again."
  return `${fieldWord(field)} didn't save. Your text is kept — try again.`
}

/** F5-TASK-GONE — AC-4. No retry is mentioned, because none is offered. */
function goneText(title: string): string {
  return `“${title}” is gone, so nothing was saved.`
}

/** F5-REMINDERS-PASSED — AC-38's surfacing. N reminders are ONE surfacing. */
function remindersText(n: number): string {
  return n === 1 ? '1 reminder has passed.' : `${n} reminders have passed.`
}

/** F5-UNDO-OFFER / F5-UNDO-DONE — AC-43, announced under AC-33's 4.1.3.
 *
 * The **word** for this mechanism is design's and is deliberately not chosen
 * here: `§ Buttons`' one-word-per-concept table binds *undo* to reversing the last
 * applied **turn** and forbids *revert*, *roll back*, *take back* and *restore* as
 * synonyms, and `§ SaveNotice` already declined to carry an undo action for
 * exactly this reason, in writing. So these strings describe the action and its
 * result without naming the mechanism, and the control's label is reported as
 * owed to that table. */
function undoOfferText(a: UndoAction): string {
  switch (a.kind) {
    case 'delete-task':
      return `Deleted “${a.title}”. You can put it back.`
    case 'delete-series':
      return `Deleted every unfinished repeat of “${a.title}”. You can put them back.`
    case 'delete-step':
      return `Deleted the step “${a.title}”. You can put it back.`
    case 'move-step':
      return `Moved the step “${a.title}”. You can put it where it was.`
  }
}

function undoDoneText(a: UndoAction): string {
  switch (a.kind) {
    case 'delete-task':
      return `“${a.title}” is back.`
    case 'delete-series':
      return `The repeats of “${a.title}” are back.`
    case 'delete-step':
      return `The step “${a.title}” is back.`
    case 'move-step':
      return `The step “${a.title}” is where it was.`
  }
}

/**
 * The user-facing name of a field. **A closed switch, not a prettifier**: a
 * `field.replace('_', ' ')` would produce fluent text for a field nobody
 * enumerated, which is L-008's defect exactly. An unknown key falls back to a
 * sentence that names no field rather than inventing one.
 */
function fieldWord(field: string): string {
  switch (field) {
    case 'title':
      return 'The name'
    case 'note':
      return 'The note'
    case 'due_at':
    case 'due_all_day':
      return 'The due date'
    case 'reminder_at':
      return 'The reminder'
    case 'priority':
      return 'The priority'
    case 'status':
      return 'The tick'
    case 'step':
      return 'The step'
    case 'step_order':
      return 'The step order'
    case 'delete':
      return 'The delete'
    default:
      return 'That change'
  }
}

export class AssistantController {
  protected readonly api: AssistantApi
  readonly speech: TranscriptSource
  protected readonly stores: ClientStores
  protected readonly uuid: () => string
  /** The seam, read through a call so `setClock` can hold it (F-005 AC-44). */
  protected readonly now: () => string
  /** What `ControllerDeps.now` gave us, before any harness hold. */
  private readonly injectedNow: () => string
  /** `setClock`'s held instant — null when the seam runs free. Held means HELD:
   * it does not advance on its own (api-contracts § Harness doors). */
  private clockAt: string | null = null
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
    this.injectedNow = deps.now ?? (() => new Date().toISOString())
    // One seam, read through one indirection. `setClock` writes `clockAt`; every
    // reader in this class and (through `clockProvider()`) every defaulted `now`
    // parameter in `_shared/model/` resolves here. There is no second clock.
    this.now = () => this.clockAt ?? this.injectedNow()
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
  // The clock and the zone (F-005 AC-44, ADR-010)
  // -------------------------------------------------------------------------

  /**
   * The instant, as a `Date`. **This is the widening AC-44 asks for**: the seam
   * returns an ISO string and every view consumer needs a `Date`, and the gap
   * between those two is where an implementer told "the client has no seam"
   * builds a second one.
   *
   * Every date computation on this client resolves here — the picker's shortcuts
   * (AC-12), the reminder-passed read (AC-38), the collection predicates, the
   * row meta. There is no inline `new Date()` left in the web tree.
   */
  nowDate(): Date {
    return new Date(this.now())
  }

  /**
   * The zone every client-side date computation resolves in — `account.timezone`
   * (ADR-010), **not** `ControllerDeps.timezone` and never
   * `Intl.DateTimeFormat().resolvedOptions().timeZone`.
   *
   * `null` is a real answer and not a hole to plug: the account has no zone yet,
   * so the server refuses computations that need one and reads carry
   * `due_all_day: null`. A silent fallback to the device zone is a date that is a
   * day out for exactly the users it is invisible to.
   */
  zone(): string | null {
    return this.state.accountTimezone
  }

  /**
   * The provider `_shared/model/clock.ts` installs, so the eight defaulted
   * `now: Date = nowDate()` parameters in `_shared/model/{format,tasks}.ts`
   * resolve against **this** seam rather than the wall clock.
   *
   * It exposes no clock of its own — both members delegate — which is what makes
   * this a widening of one seam rather than a second one (L-004).
   */
  clockProvider(): ClockProvider {
    return { nowDate: () => this.nowDate(), zoneName: () => this.zone() }
  }

  /**
   * The harness door behind `window.__assistantSeams.setClock` (api-contracts
   * § Harness doors → the client seam).
   *
   * Paired with the server's `POST /__qa__/set-clock`, an e2e run holds **both**
   * sides at one instant and one zone — the half that does not exist today, and
   * the reason AC-44's own failure mode survived AC-44's own remedy (L-014):
   * the web harness drove only the server-side `FakeClock` while the browser
   * under test ran on the real wall clock, so the two sides were at different
   * instants.
   *
   * Held: it does not advance on its own.
   */
  setClock(opts: { at: string; zone?: string | null }): void {
    this.clockAt = opts.at
    if (opts.zone !== undefined) {
      this.dispatch({ type: 'account-timezone', timezone: opts.zone })
      return
    }
    // Re-render even when only the instant moved. `useSyncExternalStore` compares
    // the snapshot by identity, so notifying subscribers without a new state
    // object renders nothing — and every date on screen is derived from the rows
    // this re-publishes, which is why re-publishing them is the honest way to say
    // "the clock moved" rather than a poke at the render.
    this.dispatch({ type: 'tasks', tasks: [...this.state.tasks] })
  }

  // -------------------------------------------------------------------------
  // Startup
  // -------------------------------------------------------------------------

  async init(): Promise<void> {
    if (!this.onlineNow()) this.dispatch({ type: 'offline', offline: true })
    // The zone before the rows: every date the list draws resolves in it
    // (ADR-010), and the cached value is what makes an offline cold open render
    // dates at all.
    await this.loadAccount()
    await this.refreshTasks()
    // A create made offline in an earlier run is still unsynced on this one:
    // starting up online IS a reconnect (AC-25). No-op when nothing is local.
    await this.syncLocalTasks()
    // F-005 AC-38 — "when the app opens" is TWO doors and this is the installer
    // both of them call. `init()` is the cold open; `onForeground()` (mobile) is
    // the resume, and a phone user's ordinary open is a resume. The obligation
    // attaches to the **transition**, through one installer, not to one caller —
    // which is L-005's own remedy on the very file L-005 names in its scope line
    // (BUG-002 was one obligation installed at one door).
    this.openingSync()
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
      due_at: dueAtForCollection(collection, this.nowDate()),
    })
    if (res.kind === 'ok') await this.refreshTasks()
    else this.createLocalTask(t, collection)
  }

  // -------------------------------------------------------------------------
  // F-005 AC-2 / AC-26 — the RECEIVER half of the multi-row response rule
  //
  // The sender obligation is the server's: *any write that changes more than one
  // row returns every row it changed*. Without the receiver it buys nothing —
  // the three write methods below used to `await` their result and **discard it
  // entirely** (no read, no error branch, no refresh), so a successor generated
  // by a hand tick appeared **nowhere** until some unrelated event refreshed, at
  // which point a row the user never created materialised with no gesture
  // attached. AC-39 was **vacuously true on the platform it was created for**:
  // the successor is never drawn on the phone, so no mutation of the repeat
  // indicator can turn the mobile case red.
  //
  // It lives here, in the shared controller, because both clients' only write
  // path is this class — so implementing it once is what gives the phone the
  // behaviour without a second write path (which is the duplication the spec
  // objects to elsewhere).
  // -------------------------------------------------------------------------

  /**
   * Apply `task`, every member of `changed`, and drop every id in `removed`.
   *
   * A blind `GET /tasks` is not the mechanism — the rows are already in hand.
   * (The blind refresh is not *forbidden*: `applyTurnResponse` performs exactly
   * one after every mutating turn, and AC-3's "no manual refresh" means no user
   * gesture. It is rejected here because a returned row is already in hand.)
   */
  protected applyWrite(result: TaskWriteResult): void {
    // A 2xx that carries no `task` violates the contract — every write response
    // has one (api-contracts § The multi-row response rule). **Tolerating it is
    // not the same as trusting it**: a client that throws here turns a
    // contract-shaped server bug into a dead surface, and the receiver clause's
    // whole point is that the client is no longer indifferent to what a write
    // returns. Returning early leaves the optimistic state standing, which is what
    // the code did before the receiver clause existed, so a stub server that
    // answers `{}` behaves exactly as it used to.
    if (result === null || typeof result !== 'object' || result.task === undefined) return
    const removed = new Set(result.removed ?? [])
    const incoming = new Map<string, TaskView>()
    incoming.set(result.task.id, result.task)
    for (const t of result.changed ?? []) incoming.set(t.id, t)

    const next: TaskView[] = []
    for (const existing of this.state.tasks) {
      if (removed.has(existing.id)) continue
      const arrived = incoming.get(existing.id)
      if (arrived === undefined) {
        next.push(existing)
        continue
      }
      incoming.delete(existing.id)
      // A row still awaiting its replay keeps its marker: the server answering
      // about it does not make the local create synced.
      next.push(existing.local === true ? { ...arrived, local: true } : arrived)
    }
    // Rows the write CREATED — the generated successor (AC-26), a restored
    // cluster (AC-41) — are new to this client and belong on the end.
    for (const arrived of incoming.values()) {
      if (arrived.deleted_at === null) next.push(arrived)
    }
    // A soft-deleted row the write returned leaves the list; `GET /tasks`
    // filters them and the client must agree, or a deleted row survives until
    // the next read.
    const visible = next.filter((t) => t.deleted_at === null)
    this.dispatch({ type: 'tasks', tasks: visible })
    this.reconcileNotices(visible, next)
  }

  // -------------------------------------------------------------------------
  // F-005 AC-47 — the notice mechanism
  //
  // It has to observe EVERY write to the task's field: the retry, an assistant
  // turn, an undo, and a background refresh. Only this class and `state.tasks`
  // see all four, which is why the mechanism is here and not in the detail's
  // React state (`platform/web.md § F-005`).
  // -------------------------------------------------------------------------

  /**
   * Called on every arrival of server rows, from every door: `applyWrite`,
   * `refreshTasks`, and the post-turn / post-undo refresh. One function, so a
   * door added later inherits it rather than needing its own copy (L-005).
   *
   * Three things happen, and each is one of AC-47's rules:
   * - a **later successful write** to a field a notice carries **supersedes** it
   *   — whoever made it — detected against the value the store held when the
   *   failure was recorded;
   * - a task that is **gone** ends its notice (AC-4): reported once, value still
   *   legible, no retry;
   * - a **rename** reaches the notice, because after the row is gone the notice
   *   holds the only copy of the task's name.
   */
  private reconcileNotices(visible: readonly TaskView[], all: readonly TaskView[]): void {
    if (this.state.notices.length === 0) return
    let notices: Notice[] = this.state.notices
    for (const n of this.state.notices) {
      const row = visible.find((t) => t.id === n.taskId)
      if (row === undefined) {
        // Absent from the visible set. Only *known* absence ends the notice: a
        // row this write returned soft-deleted, or one a refresh no longer
        // holds. `all` carries the soft-deleted arrivals, which is the
        // difference between "deleted" and "this response said nothing about
        // it" — and ending a notice on silence would end every notice on every
        // single-row write.
        const deleted = all.find((t) => t.id === n.taskId)
        if (deleted !== undefined && deleted.deleted_at !== null) {
          notices = endForDeletedTask(notices, n.taskId)
        }
        continue
      }
      notices = renameIn(notices, n.taskId, row.title)
      for (const f of n.fields) {
        if (f.superseded) continue
        const stored = (row as unknown as Record<string, unknown>)[f.field]
        // "Something newer has been stored" is measured against the value the
        // store held at the moment of the failure, not against what the user
        // typed: comparing to the typed value would report a supersede the
        // instant a retry succeeded, and comparing to nothing at all is how a
        // stale failed value gets shown over a newer stored one (AC-3's
        // live-update guarantee for that field).
        if (!sameStored(stored, f.baseline)) {
          notices = supersede(notices, n.taskId, f.field, stored)
        }
      }
    }
    if (notices !== this.state.notices) this.dispatch({ type: 'notices', notices })
  }

  /**
   * Record a failed or offline-refused write. **One notice per task**, and the
   * task's title is captured now because after AC-4's deletion this is the only
   * copy of it left.
   */
  private noteFailure(
    task: TaskView,
    field: string,
    value: unknown,
    reason: NoticeReason,
    opts: { taskGone?: boolean } = {},
  ): void {
    const notices = recordFailure(this.state.notices, {
      taskId: task.id,
      taskTitle: task.title,
      field,
      value,
      baseline: (task as unknown as Record<string, unknown>)[field],
      reason,
      at: this.now(),
      taskGone: opts.taskGone,
    })
    this.dispatch({ type: 'notices', notices })
  }

  /** AC-33's 4.1.3 — every refusal and every status message this feature states
   * is announced. A rule, not an enumeration: a closed list is how four
   * announcements ended up asserted by nobody. */
  announce(text: string): void {
    if (text === '') return
    this.dispatch({ type: 'announce', text })
  }

  /** The user dismissed a notice — the only user ender, and the only one that
   * may discard a value the user can still see, because they are the one seeing
   * it. */
  dismissNotice(taskId: string): void {
    this.dispatch({ type: 'notices', notices: dismissNoticeIn(this.state.notices, taskId) })
  }

  /**
   * **Retrying from the notice and retrying from the field are ONE write path
   * called from two places** (AC-47). This is that path. Two implementations of
   * one postcondition drift, and that is L-005's shape applied to a recovery
   * path — which is why the detail's field-level retry calls this too rather
   * than re-issuing the write itself.
   */
  async retryNotice(taskId: string, field: string): Promise<void> {
    const notice = noticeFor(this.state.notices, taskId)
    if (notice === null || notice.ended !== null) return
    const entry = notice.fields.find((f) => f.field === field)
    // A superseded field carries no retry: it would overwrite the newer stored
    // value with the stale failed one — the resurrection door AC-4 and AC-47
    // close everywhere else.
    if (entry === undefined || entry.superseded) return
    const ok = await this.writeField(taskId, { [field]: entry.value } as TaskPatchBody, {
      from: 'retry',
    })
    if (ok) {
      this.dispatch({ type: 'notices', notices: resolveField(this.state.notices, taskId, field) })
    }
  }

  /**
   * **The one write path for a field on this surface** (AC-2's field-level
   * write): the request body carries exactly the fields the user changed and no
   * others. A whole-object write that happens to look correct fails the AC.
   *
   * Returns `true` when the store accepted it — which is what the three states
   * of AC-2 are told apart by:
   *
   * - **in flight → accepted.** The result is applied (`applyWrite`), including
   *   every other row it changed.
   * - **failed or refused by the server.** The user's value stays in the field,
   *   the failure is stated, and a retry is offered — through the notice, so the
   *   guarantee survives the surface it was typed into (AC-47).
   * - **never attempted, because the app is offline and the row is
   *   SERVER-OWNED.** Refused. See `refusesOffline` for why the scope is row
   *   provenance and not connectivity alone.
   */
  async writeField(
    taskId: string,
    patch: TaskPatchBody,
    opts: { from?: 'field' | 'retry' } = {},
  ): Promise<boolean> {
    const before = this.state.tasks.find((t) => t.id === taskId)
    if (before === undefined) return false
    const task = before
    const field = Object.keys(patch)[0] ?? ''
    const value = (patch as Record<string, unknown>)[field]

    if (task.local === true) {
      // A locally-created row: `persistLocal()` genuinely saves the edit and
      // `pushLocalTasks` genuinely replays it, and `pendingLocalTasks()` prefers
      // state *because it carries edits made since*. That store and that replay
      // ship today and this AC neither builds nor widens them for edits — which
      // is why AC-2's *"no queue, no durable store, no replay"* is stated as no
      // **new** ones. Written unscoped, the refusal removed this working path.
      this.dispatch({ type: 'unmark-task', taskId })
      this.dispatch({
        type: 'tasks',
        tasks: this.state.tasks.map((t) => (t.id === taskId ? mergePatch(t, patch) : t)),
      })
      this.persistLocal()
      return true
    }

    if (this.refusesOffline(task)) {
      this.noteFailure(task, field, value, 'offline-refused')
      this.announceFailures(taskId)
      return false
    }

    // a hand-changed row is never attributed to a turn (AC-4)
    this.dispatch({ type: 'unmark-task', taskId })
    // Optimistic, and reverted on failure rather than left standing: AC-2's
    // mobile-tier outcome is *the row shows the value the server holds and the
    // failure is stated* — **never a row that vanishes and returns at the next
    // refresh**, which is what leaving the optimistic value in place produces one
    // read later. The user's typed value is not lost by the revert: it is in the
    // notice, and on the detail it is in the field.
    this.dispatch({
      type: 'tasks',
      tasks: this.state.tasks.map((t) => (t.id === taskId ? mergePatch(t, patch) : t)),
    })
    const res = await this.api.patchTask(taskId, patch)
    if (res.kind === 'ok') {
      this.applyWrite(res.value)
      if (opts.from !== 'retry') {
        this.dispatch({ type: 'notices', notices: resolveField(this.state.notices, taskId, field) })
      }
      return true
    }
    this.dispatch({
      type: 'tasks',
      tasks: this.state.tasks.map((t) => (t.id === taskId ? before : t)),
    })
    // AC-4 — a write that failed **because the task is gone** produces no
    // notice: there is nothing to retry and nothing to write into, and a notice
    // offering retry on a deleted task is either dead or a resurrection.
    const gone = res.kind === 'http-error' && res.status === 404
    this.noteFailure(task, field, value, 'failed', { taskGone: gone })
    if (gone) this.announce(goneText(task.title))
    else this.announceFailures(taskId)
    return false
  }

  /**
   * **Concurrent failures report ONCE, not N times** (AC-2, design D4).
   *
   * *"Several fields can be in flight together; each keeps its own value and its
   * own retry, and the failures aggregate into ONE status message naming the
   * fields that failed. One polite announcement per failure technically satisfies
   * 4.1.3 while making the surface unusable for exactly the users AC-16 and AC-33
   * exist for."*
   *
   * So the announcement is derived from the task's whole notice rather than from
   * the write that just failed: two fields failing in the same moment produce two
   * `noteFailure` calls, one notice, and one sentence naming both.
   */
  private announceFailures(taskId: string): void {
    const notice = noticeFor(this.state.notices, taskId)
    if (notice === null) return
    const live = notice.fields.filter((f) => !f.superseded)
    if (live.length === 0) return
    const offline = live.every((f) => f.reason === 'offline-refused')
    const names = live.map((f) => fieldWord(f.field).replace(/^The /, '')).join(', ')
    this.announce(
      offline
        ? `You're offline, so ${names} on “${notice.taskTitle}” ${live.length === 1 ? 'was' : 'were'} not saved. Try again when you're back online.`
        : `${names} on “${notice.taskTitle}” ${live.length === 1 ? 'did' : 'did'} not save. Your text is kept — try again.`,
    )
  }

  /**
   * **AC-2's third state, scoped by row provenance — the clause most likely to
   * be got wrong, and the one four lenses caught.**
   *
   * The shipped guard is `task.local === true || this.state.offline ||
   * !this.onlineNow()` — **three disjuncts**, and the unscoped rule inverted the
   * behaviour on the first of them. The owner's decision says *"an edit to a
   * **server-owned** task is never sent"*; revision 3 wrote the rule without
   * *server-owned*, which removed working behaviour: create a task offline under
   * F-001 AC-25, then be unable to fix a typo in it. QA writes from the spec, so
   * the test would have asserted the refusal and the regression would have
   * shipped green.
   *
   * So the refusal covers a row **the server already holds** (`local !== true`)
   * and nothing else. Two consequences:
   *
   * - the first disjunct fires **while online** — an unsynced local row whose
   *   replay failed stays `local: true` with connectivity restored — and
   *   *"you are offline"* is not a true thing to say there. Scoping by provenance
   *   removes that case entirely: **the offline refusal is stated only when the
   *   app is actually offline**, so the reason given is never one the user can
   *   disprove by looking at their connection.
   * - there is **no new queue, no new durable store and no replay of edits**.
   *   The refused edit is not kept for later, and nothing on the surface may
   *   imply that it is: *"try again when you are back online"* is honest; a
   *   spinner, a pending badge or a silent acceptance is not.
   */
  protected refusesOffline(task: TaskView): boolean {
    if (task.local === true) return false
    return this.state.offline || !this.onlineNow()
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
    // Un-completing writes `inbox` and **does not touch `due_at`** (ADR-009 §3),
    // and a `status` write is now an ordinary field write: it goes through the one
    // path, so it gets AC-2's three states, AC-26's receiver clause (a completed
    // repeating task's successor is drawn without waiting for a refresh) and
    // AC-19's cascade (the parent's steps arrive in `changed`).
    await this.writeField(taskId, { status: nextStatus })
  }

  /**
   * F-001 AC-18's inline rename, and F-005 AC-37's guard.
   *
   * **An empty title is refused — the task keeps the name it had**, and blank,
   * whitespace-only and newline-only are all empty. The original product enforced
   * exactly this in its update path rather than in its UI, which is the right
   * place for it: a rename by voice, by inline edit on a row, or from the detail
   * all reach the same rule. This is the surface's copy; `AC-40` is where it binds
   * on the write, and the two must agree (L-005).
   *
   * The refusal is **stated**, not silent: before F-005 this returned early and
   * an anonymous rename simply did nothing, which is indistinguishable from a
   * save that worked.
   */
  async editTask(taskId: string, title: string): Promise<void> {
    const task = this.state.tasks.find((x) => x.id === taskId)
    if (task === undefined) return
    const t = normalizeTitle(title)
    if (t === null) {
      this.announce(EMPTY_TITLE_REFUSED)
      return
    }
    if (t === task.title) return
    await this.writeField(taskId, { title: t })
  }

  /**
   * Delete from a list row (AC-42) or from the detail (AC-31) — **one path**, so
   * two doors to one destructive action cannot have different safety. Users do not
   * model *"which control did I use"*; they model *"delete is undoable here"*.
   */
  async removeTask(taskId: string): Promise<void> {
    await this.performDelete(taskId, 'occurrence')
  }

  /** AC-30 — deleting the whole series: every unfinished occurrence and their
   * steps to the trash, every completed one left standing. Present only on a task
   * in a live series. */
  async removeSeries(taskId: string): Promise<void> {
    await this.performDelete(taskId, 'series')
  }

  /**
   * The delete, both scopes.
   *
   * **The undo is offered for a delete that HAPPENED, not for one that was
   * dispatched** (AC-42, dev-backend F7). The old code never inspected its
   * result, so on a failed `DELETE` the row was already gone locally with nothing
   * on the server to reverse — an undo would call AC-41's restore on a live row
   * and tell the user something was restored that was never deleted. So the offer
   * follows the write's result, and a row delete that fails is AC-2's failed-write
   * case: the row comes back and the failure is stated.
   */
  protected async performDelete(taskId: string, scope: 'occurrence' | 'series'): Promise<boolean> {
    const before = this.state.tasks.find((x) => x.id === taskId)
    if (before === undefined) return false
    const task = before

    if (task.local === true) {
      // ── OPEN QUESTION 16, and this branch deliberately does not answer it ──
      // `removeTask` short-circuits on `local === true` **regardless of
      // connectivity**: the row is deleted locally, no `DELETE` is sent, and the
      // delete **genuinely happened** — reachable while online, and named by
      // neither AC-42 nor AC-43. Both branches are wrong as written: offer the
      // undo and AC-41's restore is aimed at a row the server never held;
      // withhold it and the one task the user created offline becomes the
      // irreversible destruction AC-43's coverage list exists to prevent. The
      // spec records it as OQ16 rather than choosing, so this keeps today's
      // behaviour and makes **no offer** — the choice that invents nothing.
      this.dispatch({ type: 'unmark-task', taskId })
      this.dispatch({ type: 'tasks', tasks: this.state.tasks.filter((x) => x.id !== taskId) })
      this.persistLocal()
      return true
    }

    if (this.refusesOffline(task)) {
      // AC-43's mobile bullet: offline the undo cannot run at all — `removeTask`
      // never reaches the server and AC-41's restore is a server call. So the
      // delete is AC-2's offline refusal and **no offer is made**. The row stays.
      //
      // **No notice row either**, and that is design's closed set rather than an
      // omission: `§ CarriedNotice`'s literal-message table is keyed by the SEVEN
      // user-settable fields AC-1 names, and a delete is not one of them. What
      // AC-2 requires here — the row kept, the reason stated, a retry available —
      // is met without one: the row's own delete control IS the retry, and AC-42
      // states the failed case as *the row comes back, the failure is stated* and
      // pointedly does not name a notice.
      this.announce(offlineRefusalText('delete'))
      return false
    }

    this.dispatch({ type: 'unmark-task', taskId })
    this.dispatch({ type: 'tasks', tasks: this.state.tasks.filter((x) => x.id !== taskId) })
    const res = await this.api.deleteTask(taskId, scope)
    if (res.kind !== 'ok') {
      // **The row comes back and the failure is stated** (AC-2, AC-42) — and this
      // is emphatically NOT an undo case: `removeTask` never used to inspect its
      // result, so on a failed `DELETE` the row was already gone locally with
      // nothing on the server to reverse, and an undo would have called AC-41's
      // restore on a live row and told the user something was restored that was
      // never deleted.
      this.dispatch({ type: 'tasks', tasks: [...this.state.tasks, before] })
      this.announce(failureText('delete'))
      return false
    }
    this.applyWrite(res.value)
    // AC-4 / AC-47 — a notice outstanding for this task ends here: reported once,
    // with the value it was carrying still legible, and with NO retry, because a
    // retry pointed at a soft-deleted row is either dead or a resurrection door.
    this.dispatch({ type: 'notices', notices: endForDeletedTask(this.state.notices, taskId) })
    this.offerUndo(
      scope === 'series'
        ? { kind: 'delete-series', taskId, title: task.title }
        : (task.parent_id ?? null) !== null
          ? { kind: 'delete-step', taskId, title: task.title, parentId: task.parent_id as string }
          : { kind: 'delete-task', taskId, title: task.title },
    )
    return true
  }

  // -------------------------------------------------------------------------
  // F-005 AC-43 — the hand-action undo
  //
  // It is NOT F-001 AC-5's turn undo: that one reverts an assistant turn, is
  // reachable by voice, and a hand action creates no turn for it to revert. The
  // two are never substitutes, and two mechanisms answering one gesture is
  // L-005's shape.
  // -------------------------------------------------------------------------

  /**
   * Offer the undo. **Single slot — it does not stack**: a second undoable action
   * replaces the first offer, and the replaced action stays done.
   *
   * It renders where AC-47's notice renders — visible wherever the user is, never
   * on the row the action happened on (owner, 2026-08-19). A row-local offer loses
   * the reversal exactly when the user navigates away, which on the phone is one
   * tap and is primary navigation.
   *
   * **Its lifetime has four enders and no timer**: used, dismissed, replaced by
   * the next undoable action, or the app reloaded — and by nothing else. A surface
   * teardown is not one of them: deleting a step and then closing the detail, or
   * swapping its subject (AC-48), does not withdraw the offer, because it is a
   * task-level obligation rather than a surface-level one.
   */
  protected offerUndo(action: UndoAction): void {
    this.dispatch({ type: 'undo-offer', offer: { action, at: this.now(), used: false } })
    this.announce(undoOfferText(action))
  }

  dismissUndoOffer(): void {
    this.dispatch({ type: 'undo-offer', offer: null })
  }

  /**
   * Use the offer — **a single action to reverse, and it reverses exactly the
   * action it was offered for and nothing else.**
   *
   * A delete (of a task, a step, or a whole series) is reversed by AC-41's
   * restore, whose unit follows the gesture: the delete recorded its own
   * membership (`delete_gesture_id`) and the restore replays exactly that set. A
   * reorder is reversed by writing back `prior.step_order` **through the same
   * `PATCH` the move used** — no new record, one source, and the undo's write path
   * is the move's write path (ADR-015), which is L-005's remedy rather than a
   * second door onto ordering.
   */
  async undoLastAction(): Promise<void> {
    const offer = this.state.undoOffer
    if (offer === null || offer.used) return
    // Marked used first: the offer does not stack and must not be usable twice
    // while the request is in flight, which is the same double-activation hazard
    // `undoInFlight` guards for the turn undo. It is MARKED rather than cleared,
    // because § CarriedNotice's CN-UNDONE row is what reports that the reversal
    // happened, and a row that vanished would report nothing.
    this.dispatch({ type: 'undo-offer', offer: { ...offer, used: true } })
    const a = offer.action
    if (a.kind === 'move-step') {
      const moved = await this.writeField(a.taskId, { step_order: a.priorStepOrder })
      if (!moved) {
        // Nothing was put back, so the offer is still valid — restoring it is the
        // honest state, and it is not one of AC-43's four enders. Design's
        // lifetime table has no row for a `Put back` that never reached the
        // server; this is the reading that loses nothing.
        this.dispatch({ type: 'undo-offer', offer: { ...offer, used: false } })
        return
      }
      this.announce(undoDoneText(a))
      return
    }
    const res = await this.api.restoreTask(a.taskId)
    if (res.kind !== 'ok') {
      this.dispatch({ type: 'undo-offer', offer: { ...offer, used: false } })
      this.announce(UNDO_FAILED)
      return
    }
    this.applyWrite(res.value)
    // AC-41 — restoring a row that is not deleted is a **stated no-op**, not a
    // 404 and not a 409. A double-tap is ordinary on an undo that is one action
    // away wherever the user is, and a silent no-op is indistinguishable from a
    // refusal unless one of them is stated.
    this.announce(res.value.restored === false ? UNDO_ALREADY : undoDoneText(a))
  }

  // -------------------------------------------------------------------------
  // F-005 AC-14, AC-15, AC-16 — steps
  // -------------------------------------------------------------------------

  /**
   * AC-14 — **a step is created in ONE call.** `POST /tasks` accepts `parent_id`
   * and the rest of the field set, and a step created without a position is
   * appended last, **positioned by the server**.
   *
   * Not POST-then-PATCH: between the two calls the step exists at an undefined
   * position and AC-3's live-update guarantee renders that state to every other
   * client watching.
   */
  async addStep(parentId: string, title: string): Promise<boolean> {
    const t = normalizeTitle(title)
    if (t === null) {
      this.announce(EMPTY_TITLE_REFUSED)
      return false
    }
    const parent = this.state.tasks.find((x) => x.id === parentId)
    if (parent === undefined) return false
    if (this.refusesOffline(parent)) {
      this.noteFailure(parent, 'step', t, 'offline-refused')
      this.announce(offlineRefusalText('step'))
      return false
    }
    // `step_order` is deliberately absent: the server appends last. Supplying a
    // client guess is what AC-14's offline-replay clause is *for*, and it is not
    // this door.
    const res = await this.api.createTask({ title: t, parent_id: parentId })
    if (res.kind !== 'ok') {
      this.noteFailure(parent, 'step', t, 'failed')
      this.announce(failureText('step'))
      return false
    }
    this.applyWrite(res.value)
    return true
  }

  /**
   * AC-15 / ADR-015 — **a move is ONE write.** The server sets the moved step's
   * `step_order` to the midpoint of its two new neighbours and returns every row
   * it changed if a renumber was needed; the response's `prior.step_order` is the
   * single source for the reorder undo.
   *
   * **A drop where the step already was writes nothing and creates no undo
   * entry** — the server answers `200` with an empty `prior`, which is the
   * observable AC-43's *no undo entry* and AC-16's *announces nothing* are both
   * asserted against, rather than depending on the client noticing.
   */
  async moveStep(taskId: string, toStepOrder: number): Promise<boolean> {
    const step = this.state.tasks.find((x) => x.id === taskId)
    if (step === undefined) return false
    if (this.refusesOffline(step)) {
      this.noteFailure(step, 'step_order', toStepOrder, 'offline-refused')
      this.announce(offlineRefusalText('step_order'))
      return false
    }
    const res = await this.api.patchTask(taskId, { step_order: toStepOrder })
    if (res.kind !== 'ok') {
      this.noteFailure(step, 'step_order', toStepOrder, 'failed')
      this.announce(failureText('step_order'))
      return false
    }
    this.applyWrite(res.value)
    const prior = res.value.prior ?? {}
    if (!('step_order' in prior)) return true // the no-op drop: no entry, no word
    this.offerUndo({
      kind: 'move-step',
      taskId,
      title: step.title,
      priorStepOrder: Number(prior['step_order']),
    })
    return true
  }

  // -------------------------------------------------------------------------
  // F-005 AC-20/22/23/25 — the repeat picker's preview
  // -------------------------------------------------------------------------

  /**
   * AC-22 / AC-23 — the created-or-moved date is shown **before the repeat is
   * committed**, and this is the dry run that discloses it.
   *
   * It is a **server** call on purpose: a client-side preview would be a second
   * implementation of the alignment, the month-day clamp and the exclusivity
   * rules — L-004's shape on arithmetic the spec spends four ACs on. Because it
   * runs the same code the commit runs, the disclosed date is by construction the
   * date that will be written. Zero AI calls (AC-20, AC-32).
   */
  async repeatPreview(taskId: string, repeat: TaskPatchBody): Promise<RepeatPreviewWire | null> {
    const res = await this.api.repeatPreview(taskId, repeat)
    return res.kind === 'ok' ? res.value : null
  }

  // -------------------------------------------------------------------------
  // F-005 AC-38 — a passed reminder is shown when the app opens
  // -------------------------------------------------------------------------

  /**
   * **The installer both opening doors call** (AC-38, L-005). `init()` is the cold
   * open; the mobile client's `onForeground()` is the resume, and a phone user's
   * ordinary open is a resume — a foreground happens dozens of times a day.
   * `F-003 AC-8` names both in one breath *because BUG-002 was one obligation
   * installed at one door*, on this very file.
   *
   * The obligation attaches to the **transition**, through this one function, and
   * a grep for its name returns every door.
   *
   * It reads only; the marker is the **server's** to write, on an acknowledgement
   * the client sends (AC-38's single server-persistence observable). **An offline
   * open surfaces what the client already holds and writes nothing.**
   */
  openingSync(): void {
    const now = this.nowDate()
    const passed: PassedReminder[] = this.state.tasks
      .filter((t) => reminderPassedUnacknowledged(t, now))
      .map((t) => ({ taskId: t.id, title: t.title, reminderAt: t.reminder_at as string }))
      // N passed reminders are ONE surfacing, not N (AC-38, tester W7, product
      // P3): a user returning after two weeks meets the whole set at once.
      // Ordered by reminder instant, oldest first.
      .sort((a, b) => (a.reminderAt < b.reminderAt ? -1 : a.reminderAt > b.reminderAt ? 1 : 0))
    this.dispatch({ type: 'reminders', reminders: passed })
    if (passed.length > 0) this.announce(remindersText(passed.length))
  }

  /**
   * AC-38 — **acknowledging is a deliberate action on the surfacing, one per
   * reminder.** Opening the task does not count, scrolling past does not count,
   * and **rendering does not count**: under any looser reading a user who taps to
   * look, is interrupted and closes the app has spent their only delivery
   * permanently, on every device, while the task is still undone.
   *
   * **There is no bulk dismissal.** Ten passed reminders take ten gestures, and
   * the cost is accepted knowingly: a single gesture that retires reminders the
   * user has not read is the looser reading wearing a convenience label.
   *
   * **Offline, nothing is recorded** — the reminder re-surfaces at the next open.
   * There is no replay on reconnection: queue-and-replay for one field is
   * queue-and-replay, arriving through a side door, and it was declined at OQ6.
   */
  async acknowledgeReminder(taskId: string): Promise<void> {
    const entry = this.state.reminders.find((r) => r.taskId === taskId)
    if (entry === undefined) return
    // Only what the user acknowledges leaves the surfacing: ten surfaced together
    // of which three were acted on do not silently retire the other seven.
    const rest = this.state.reminders.filter((r) => r.taskId !== taskId)
    this.dispatch({ type: 'reminders', reminders: rest })
    if (this.state.offline || !this.onlineNow()) {
      this.announce(REMINDER_ACK_OFFLINE)
      return
    }
    const res = await this.api.ackReminder(taskId, entry.reminderAt)
    if (res.kind === 'ok') {
      this.applyWrite(res.value)
      return
    }
    // The reminder moved underneath (409 REMINDER_MOVED) or the write failed:
    // put it back rather than retiring one the server did not mark, because a
    // reminder wrongly retired is not recoverable.
    this.dispatch({ type: 'reminders', reminders: [entry, ...rest] })
    this.announce(REMINDER_ACK_FAILED)
  }

  // -------------------------------------------------------------------------
  // ADR-010 — the account, and the zone every date computation reads
  // -------------------------------------------------------------------------

  /**
   * `GET /account`, cached durably.
   *
   * The cache is what makes an offline cold open able to render dates at all —
   * without it the client has no zone, and `null` would be indistinguishable from
   * *this account has never reported one*. It is read at boot and on foreground.
   */
  async loadAccount(): Promise<void> {
    const cached = this.stores.accountTimezone()
    if (cached !== null) this.dispatch({ type: 'account-timezone', timezone: cached })
    if (this.state.offline || !this.onlineNow()) return
    const res = await this.api.getAccount()
    if (res.kind !== 'ok') return
    const tz = res.value.timezone
    this.stores.saveAccountTimezone(tz)
    this.dispatch({ type: 'account-timezone', timezone: tz })
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
    // A `200` whose body carries no `tasks` array violates the contract
    // (`GET /tasks` is `200 {tasks: [Task]}`). **Treat it as a failed read rather
    // than crashing**, for the same reason `applyWrite` tolerates a `task`-less
    // write response: the client is no longer indifferent to what a read returns,
    // and turning a contract-shaped server bug into an unhandled rejection is worse
    // than reporting the read as failed — the list stays editable behind the
    // InlineRetryBanner, which is the one job it has (IA §6 S2).
    if (!Array.isArray(res.value?.tasks)) {
      this.dispatch({ type: 'tasks-load', load: 'failed' })
      return
    }
    const server = res.value.tasks.filter((t) => t.deleted_at === null)
    const next = [...server, ...this.stores.localTasks()]
    this.dispatch({ type: 'tasks', tasks: next })
    this.dispatch({ type: 'tasks-load', load: 'ok' })
    // A background refresh is the fourth writer AC-47's mechanism has to observe
    // — the retry, an assistant turn, an undo, and this. Routing it through the
    // same function as the write path is what stops one of the four going
    // unguarded (L-005).
    this.reconcileNotices(next, res.value.tasks)
  }

  private createLocalTask(title: string, collection: Collection = 'inbox'): void {
    const at = this.now()
    const due = dueAtForCollection(collection, this.nowDate())
    const task: TaskView = {
      // Every F-005 field, from ONE enumeration. A row constructor that misses a
      // field leaves `undefined` where its declared empty value belongs, and
      // `undefined` versus "no value" is exactly the distinction AC-6 makes
      // observable on read-back (`## Impact §1`, the four row constructors).
      ...emptyF005Fields(),
      id: this.uuid(),
      title,
      // Same rule as the online path, and it has to be: the offline row is
      // replayed verbatim on reconnect (`pushLocalTasks`), so a date decided
      // only in `addTask` would be lost for exactly the users who cannot see
      // the server correct it.
      due_at: due,
      // F-005 AC-13 / ADR-010 — **the offline create computes in the device zone
      // and stores the answer rather than deferring it.** `dueAtForCollection`
      // writes the local start of the day for Today, so the row IS all-day; a
      // stored flag is authoritative wherever present, so the row never needs
      // re-deriving and the *one row, three answers* case cannot arise for it.
      // The device zone decides only which **day** the user meant, which is the
      // one question no server can answer better.
      //
      // Without this the row replays as a bare local midnight with no flag and
      // renders as **"12:00 AM"** — the behaviour AC-13 forbids, on the default
      // landing collection, through the path that produces it invisibly.
      due_all_day: due === null ? null : true,
      status: 'inbox',
      list_id: null,
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
      const res = await this.api.createTask(replayBody(t))
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
