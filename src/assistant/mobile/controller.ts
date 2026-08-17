// MobileAssistantController — the shared conversation controller plus exactly
// what the operating system owns.
//
// It EXTENDS `src/assistant/_shared/controller.ts` rather than reimplementing
// it, and that is the whole parity contract (F-003 AC-1): one reducer, one
// outcome→message mapping, one undo window, one dedupe rule across web and
// mobile. Every F-001 AC listed as "hold identically" in the spec's Parity
// table holds here because it is literally the same code path — the mobile
// tier's job is to prove that observably, not to re-derive it.
//
// What this subclass adds, and nothing else:
//   AC-2 / AC-3  the two permission models (iOS dual grant, Android single
//                grant with a permanently-denied branch that must not
//                re-request)
//   AC-4         offline does not dim the mic; recognized text still lands in
//                the composer and takes F-001 AC-25's local no-AI path
//   AC-5 / AC-6  process kill: pending input and the unacked outgoing turn
//                survive, and the turn replays under the SAME client_turn_id
//   AC-7         audio interruption == cancel-while-listening, audio session
//                released so the interrupting app is not blocked
//   AC-8         every foreground transition re-reads the session BEFORE
//                accepting new input; local stores reconcile, never override
//   AC-10 / AC-11 keyboard and system back are non-destructive
//   AC-12        native screen-reader announcements of every message

import { AssistantController } from '../_shared/controller.ts'
import type { ControllerDeps } from '../_shared/controller.ts'
import type { PermissionState } from '../_shared/model/client-stores.ts'
import type { Action } from '../_shared/model/reducer.ts'
import type { TurnSource } from '../_shared/types.ts'
import { initialShellState, shellBack, shellReducer } from './model/shell.ts'
import type { SessionLoad, ShellAction, ShellState } from './model/shell.ts'
import type { TasksLoad } from './model/tasks-view.ts'

import { affordanceAnnouncement, announcementsFor } from './model/announce.ts'
import type { AffordanceView } from './model/follow.ts'
import { backAction } from './model/lifecycle.ts'
import type { AudioInterruptionReason } from './model/lifecycle.ts'
import {
  allGranted,
  ctaTarget,
  deniedGrants,
  languagePackMessage,
  permissionCtaLabel,
  permissionDeniedMessageFor,
  permissionExplanationMessage,
  requiredGrants,
  statusOf,
} from './model/permissions.ts'
import type { MobilePlatform } from './model/permissions.ts'
import { FakeReduceMotion } from './ports/app-lifecycle.ts'
import type { Announcer, AppLifecycle, Connectivity, ReduceMotion } from './ports/app-lifecycle.ts'
import type { MobileTranscriptSource } from './ports/transcript-source.ts'

/** What the shell subscribes to: navigation plus the two read statuses, as one
 * identity-stable object. */
export interface ShellSnapshot {
  shell: ShellState
  load: { session: SessionLoad; tasks: TasksLoad }
}

export interface MobileControllerDeps extends ControllerDeps {
  speech: MobileTranscriptSource
  lifecycle: AppLifecycle
  connectivity: Connectivity
  announcer: Announcer
  /** F-001 AC-30(g). Optional only so a caller that never scrolls (a headless
   * assertion over the conversation model) need not construct one; the default
   * reports the OS default, and `boot.ts` always passes the real port. */
  reduceMotion?: ReduceMotion
}

/** Prototype-grade observability (spec ## Ops, ADR-001): in-process counters,
 * no exporter. */
export interface MobileCounters {
  permissionDenied: { microphone: number; speech_recognition: number }
  audioInterruptions: number
  /** outgoing turns that survived a kill / background and were reconciled on
   * the next foreground (AC-6) */
  killSurvivingReplays: number
}

export class MobileAssistantController extends AssistantController {
  private readonly mobile: MobileTranscriptSource
  private readonly lifecycle: AppLifecycle
  private readonly connectivity: Connectivity
  private readonly announcer: Announcer
  private readonly reduceMotionPort: ReduceMotion
  private readonly unsubscribes: (() => void)[] = []

  private keyboardVisible = false
  private foregroundSync: Promise<void> | null = null
  private suppressAnnouncements = false
  private readonly announced = new Set<string>()
  /** AC-30: the last accessible name the affordance announced, so a change of
   * row (NMA-NEW → NMA-WAITING) is news and a re-render of the same state is
   * not. React Native has no live region, so "the dock is a polite live region"
   * (components.md) is this imperative announcement — same port, same rule as
   * every other announcement (platform mobile.md). */
  private lastAffordanceAnnouncement: string | null = null

  // ── The two READ STATUSES the app shell renders from ──────────────────────
  //
  // `information-architecture.md § 6` gives S1 and S2 a loading state and two
  // different failure states, and none of them is expressible from `AppState`:
  // a failed `GET /assistant/session` and a session that is genuinely empty
  // both leave `messages: []`, and the surface stays `idle` throughout (F-001
  // AC-29 is untouched — these are not conversation states).
  //
  // They are tracked HERE rather than in the shared reducer because the shared
  // reducer is web's and mobile's one contract (F-003 AC-1) and this is a
  // mobile-shell rendering fact. The observable is the base controller's own
  // behaviour: `syncSession` dispatches `session-synced` iff the read landed
  // and `refreshTasks` dispatches `tasks` iff the read landed — both return
  // silently on failure. Counting those dispatches ACROSS one awaited call is
  // therefore exactly "did the read succeed", with no second request and no
  // copy of the mapping logic (L-004).
  private sessionSyncs = 0
  private taskDispatches = 0
  private sessionLoadState: SessionLoad = 'loading'
  private tasksLoadState: TasksLoad = 'loading'
  private loadSnapshotCache: { session: SessionLoad; tasks: TasksLoad } = {
    session: 'loading',
    tasks: 'loading',
  }
  private readonly shellListeners = new Set<() => void>()

  // ── Shell navigation (IA §1/§4) ──────────────────────────────────────────
  //
  // The shell state lives on the CONTROLLER rather than in the screen's own
  // `useReducer` for one reason, and it is L-005's: system back is a second
  // door into the same room. Android's hardware back and the on-screen back
  // control must produce the same transition, and they cannot if one of them
  // is a React state setter the controller has no reach into. One state, one
  // reducer, two callers.
  private shell: ShellState = initialShellState()
  private shellSnapshotCache: ShellSnapshot = {
    shell: initialShellState(),
    load: { session: 'loading', tasks: 'loading' },
  }

  readonly counters: MobileCounters = {
    permissionDenied: { microphone: 0, speech_recognition: 0 },
    audioInterruptions: 0,
    killSurvivingReplays: 0,
  }

  constructor(deps: MobileControllerDeps) {
    super({
      ...deps,
      onlineNow: deps.onlineNow ?? (() => deps.connectivity.isOnline()),
    })
    this.mobile = deps.speech
    this.lifecycle = deps.lifecycle
    this.connectivity = deps.connectivity
    this.announcer = deps.announcer
    this.reduceMotionPort = deps.reduceMotion ?? new FakeReduceMotion(false)

    // AC-12 — every message the conversation adds is announced.
    this.unsubscribes.push(this.subscribe(() => this.drainAnnouncements()))

    this.unsubscribes.push(
      this.lifecycle.onVisibilityChange((v) => {
        if (v === 'active') void this.onForeground()
        else if (v === 'background') this.onBackground()
      }),
      this.lifecycle.onAudioInterruption((e) => {
        if (e.phase === 'began') this.onAudioInterruption(e.reason)
      }),
      this.lifecycle.onNavigateBack(() => this.handleBack()),
      this.lifecycle.onKeyboardChange((visible) => this.keyboardChanged(visible)),
      this.connectivity.onChange((online) => this.setOnline(online)),
    )
  }

  get platform(): MobilePlatform {
    return this.mobile.platform
  }

  /**
   * AC-30(g). Read on every scroll rather than cached in the view, so flipping
   * the OS switch while the app is open takes effect on the next scroll — the
   * clause is a quantifier over scrolls, not a decision taken once at mount.
   */
  reduceMotionEnabled(): boolean {
    return this.reduceMotionPort.isEnabled()
  }

  onReduceMotionChange(cb: (enabled: boolean) => void): () => void {
    return this.reduceMotionPort.onChange(cb)
  }

  /**
   * AC-30(e) on the announcement path AC-19 already establishes: the affordance
   * has to tell a screen-reader user that an answer is *waiting*, not merely
   * that something arrived, and it has to say so again when it changes from a
   * count to a question. Called by the view with the affordance it is currently
   * rendering (`null` = NMA-HIDDEN); repeated calls with the same name say
   * nothing, so a re-render is not an announcement.
   */
  announceAffordance(view: AffordanceView | null): void {
    const a = affordanceAnnouncement(view)
    if (a === null) {
      this.lastAffordanceAnnouncement = null
      return
    }
    if (a.text === this.lastAffordanceAnnouncement) return
    this.lastAffordanceAnnouncement = a.text
    this.announcer.announce(a.text, { assertive: a.assertive })
  }

  dispose(): void {
    for (const un of this.unsubscribes) un()
    this.unsubscribes.length = 0
    this.shellListeners.clear()
  }

  // -------------------------------------------------------------------------
  // Read status (app shell — IA §6)
  // -------------------------------------------------------------------------

  protected override dispatch(action: Action): void {
    if (action.type === 'session-synced') this.sessionSyncs += 1
    if (action.type === 'tasks') this.taskDispatches += 1
    super.dispatch(action)
  }

  /**
   * A second subscription, alongside `subscribe`. Neither the read statuses nor
   * the shell's navigation are in `AppState`, so a failed read changes no state
   * object and would notify nobody — which is precisely the case (SE-SESSION)
   * that most needs to render. `shellSnapshot` returns a cached object so
   * `useSyncExternalStore` sees a stable identity between changes.
   */
  subscribeShell(cb: () => void): () => void {
    this.shellListeners.add(cb)
    return () => {
      this.shellListeners.delete(cb)
    }
  }

  shellSnapshot(): ShellSnapshot {
    return this.shellSnapshotCache
  }

  shellState(): ShellState {
    return this.shell
  }

  /** The only writer of shell navigation. `handleBack` calls it too, which is
   * what makes the hardware and on-screen doors one transition. */
  shellDispatch(action: ShellAction): void {
    const next = shellReducer(this.shell, action)
    if (next === this.shell) return
    this.shell = next
    this.publishShell()
  }

  loadSnapshot(): { session: SessionLoad; tasks: TasksLoad } {
    return this.loadSnapshotCache
  }

  sessionLoad(): SessionLoad {
    return this.sessionLoadState
  }

  tasksLoad(): TasksLoad {
    return this.tasksLoadState
  }

  private setLoad(over: Partial<{ session: SessionLoad; tasks: TasksLoad }>): void {
    const session = over.session ?? this.sessionLoadState
    const tasks = over.tasks ?? this.tasksLoadState
    if (session === this.sessionLoadState && tasks === this.tasksLoadState) return
    this.sessionLoadState = session
    this.tasksLoadState = tasks
    this.loadSnapshotCache = { session, tasks }
    this.publishShell()
  }

  private publishShell(): void {
    this.shellSnapshotCache = { shell: this.shell, load: this.loadSnapshotCache }
    for (const cb of this.shellListeners) cb()
  }

  override async refreshTasks(): Promise<void> {
    // Offline is not a failed read — no read is attempted at all, the list
    // works untouched and the offline banner carries the news
    // (`information-architecture.md § 6`, S2 Offline). Reporting `failed` here
    // would put SE-TASKS on a surface whose whole job is to keep working.
    const offline = this.state.offline || !this.onlineNow()
    const before = this.taskDispatches
    if (!offline) this.setLoad({ tasks: 'loading' })
    await super.refreshTasks()
    if (offline) {
      this.setLoad({ tasks: 'ready' })
      return
    }
    this.setLoad({ tasks: this.taskDispatches > before ? 'ready' : 'failed' })
  }

  /** SE-SESSION's Retry (`talk-session-retry-button`). */
  retrySessionRead(): Promise<void> {
    return this.syncSession()
  }

  /** InlineRetryBanner's and SE-TASKS' Retry (`tasks-list-retry-button`). */
  retryTasks(): Promise<void> {
    return this.refreshTasks()
  }

  // -------------------------------------------------------------------------
  // Startup / foreground (AC-8)
  // -------------------------------------------------------------------------

  /**
   * Cold open. AC-8 names it in the same breath as resume — "every foreground
   * transition (resume **or cold open**)" — so it runs behind the SAME gate.
   *
   * That gate is the whole point of this override (BUG-002): the reconciliation
   * here was already correct, but without `foregroundSync` installed
   * `acceptingInput()` returned true and `send()` found a null gate, so a turn
   * typed while the app was still starting went out ahead of
   * `GET /assistant/session`. That turn carries `session_id: null`, which opens
   * a *new* session — and a previously closed session's boundary message (the
   * close marker, the questions declined by name, the late outcomes of F-001
   * AC-28) is then never rendered.
   */
  override init(): Promise<void> {
    // A cold open after a kill is the same reconciliation as a resume: read
    // the OS permission surface (no prompt — AC-2 forbids asking at app open),
    // then let the shared init read the server and restore the local stores.
    return this.gateForeground(async () => {
      await this.readPermissions()
      if (this.stores.outgoingTurn() !== null) this.counters.killSurvivingReplays += 1
      await super.init()
    })
  }

  /**
   * AC-8: every foreground transition re-reads `GET /assistant/session` before
   * accepting new input, and renders whatever the server reports. The local
   * stores reconcile against that read — `client.pending_input` and
   * `client.outgoing_turn` are the only local survivors.
   *
   * `foregroundSync` is the gate: `send` and `tapMic` wait on it, so "before
   * accepting new input" is enforced rather than merely intended.
   */
  async onForeground(): Promise<void> {
    await this.gateForeground(async () => {
      await this.readPermissions()
      // Connectivity is applied WITHOUT triggering a replay: a replay before
      // the session read would be new input ahead of the read AC-8 requires.
      this.dispatch({ type: 'offline', offline: !this.connectivity.isOnline() })
      // The session read is FIRST — the server is the source of truth for
      // conversation history, and everything below reconciles against it.
      await this.syncSession()
      await this.refreshTasks()
      const pending = this.stores.pendingInput()
      if (pending !== '' && this.state.composer === '') {
        this.dispatch({ type: 'composer', text: pending })
      }
      if (this.stores.outgoingTurn() !== null) this.counters.killSurvivingReplays += 1
      // A foreground can BE the reconnect (AC-25, BUG-001): the user loses
      // signal, backgrounds the app, and comes back on wifi. `onForeground()`
      // reconciles without `super.init()`, so nothing here would replay the
      // offline creates — and `connectivity.onChange` only fires if the OS
      // happened to report the transition while we were foregrounded. Owing the
      // replay to that coincidence is what left offline-created tasks
      // device-local on the commonest path there is.
      //
      // Creates go BEFORE the queued turn, the order `reconnect()` documents: a
      // replayed turn must be interpreted against a task list that already
      // contains them. `syncLocalTasks()` is a no-op with nothing local and
      // joins an in-flight pass rather than duplicating it, so a foreground
      // that races the connectivity callback replays each create exactly once.
      await this.syncLocalTasks()
      await this.replayLeftoverOutgoing()
    })
  }

  /**
   * The single installer of the AC-8 gate — both foreground entry points go
   * through it so neither can drift out of holding input (BUG-002 was exactly
   * that drift: one entry point gated, the other not).
   *
   * Two ordering rules are load-bearing:
   *  - `work()` is started and `foregroundSync` assigned in the SAME
   *    synchronous run, before `work` can suspend at its first `await`. A gate
   *    installed after an await leaves the caller a window in which
   *    `acceptingInput()` is still true.
   *  - the gate is cleared only by the run that installed it, so a short
   *    foreground finishing under a longer one does not reopen input while the
   *    longer read is still in flight.
   */
  private gateForeground(work: () => Promise<void>): Promise<void> {
    const run = work()
    this.foregroundSync = run
    return (async () => {
      try {
        await run
      } finally {
        if (this.foregroundSync === run) this.foregroundSync = null
      }
    })()
  }

  /** AC-5: backgrounding (including leaving the view) loses no words. */
  onBackground(): void {
    if (this.state.surface === 'listening') this.mobile.stop()
    this.mobile.releaseAudioSession()
    this.stores.savePendingInput(this.state.composer, this.now)
  }

  /** AC-7: an incoming call, the system assistant, audio-focus loss or an
   * output-route change while listening IS cancel-while-listening (F-001
   * AC-3): capture stops, the recognized-so-far text is preserved, no turn is
   * sent, and the surface returns to idle. The audio session is handed back so
   * the interrupting app is not blocked; the mic returns to available when
   * focus comes back, with no new permission prompt (permissions are
   * untouched here — that is what makes the no-re-prompt guarantee true). */
  onAudioInterruption(_reason: AudioInterruptionReason): void {
    this.counters.audioInterruptions += 1
    if (this.state.surface === 'listening') this.mobile.stop()
    this.mobile.releaseAudioSession()
  }

  /** True when input is accepted right now — false only while a foreground
   * session read is in flight (AC-8). */
  acceptingInput(): boolean {
    return this.foregroundSync === null
  }

  // -------------------------------------------------------------------------
  // Keyboard + system back (AC-10, AC-11)
  // -------------------------------------------------------------------------

  /** AC-10: the keyboard is a layout fact. It is deliberately NOT part of the
   * conversation state, and this method deliberately dispatches nothing —
   * opening or dismissing it changes no conversation state and neither sends
   * nor cancels a turn. Composer text lives in `AppState` + the durable
   * `client.pending_input`, so it survives show/hide and rotation. */
  keyboardChanged(visible: boolean): void {
    this.keyboardVisible = visible
  }

  keyboardIsVisible(): boolean {
    return this.keyboardVisible
  }

  /**
   * AC-11: system back is never destructive. With the keyboard open it
   * dismisses the keyboard and the view stays; otherwise leaving the view is a
   * background transition and AC-5 / AC-6 govern it. No branch cancels an
   * in-flight turn, closes the session, or discards composer text.
   *
   * Returns true when the press was consumed (Android's BackHandler contract).
   *
   * The shell adds one level between the keyboard and leaving: back means "up
   * one level" (`information-architecture.md § 4`), so a stacked surface (S4
   * Settings → S3 Lists menu → the peer beneath) unwinds first. **S1 ⇄ S2 is a
   * switch between peers and has no back**, so with nothing stacked the press
   * is not consumed and the OS leaves the app — which keeps back out of § 4's
   * navigation map as a fourth, undocumented edge.
   */
  handleBack(): boolean {
    if (backAction({ keyboardVisible: this.keyboardVisible }) === 'dismiss-keyboard') {
      this.keyboardVisible = false
      return true
    }
    const { state: next, consumed } = shellBack(this.shell)
    if (consumed) {
      this.shell = next
      this.publishShell()
      return true
    }
    this.onBackground()
    return false
  }

  // -------------------------------------------------------------------------
  // Permissions (AC-2, AC-3) + capture (AC-4)
  // -------------------------------------------------------------------------

  permissions(): PermissionState {
    return this.mobile.permissions()
  }

  /** The CTA's label follows its branch: "ask again" and "open settings" are
   * different promises, so they never share wording (AC-3). */
  permissionCtaLabel(): string {
    return permissionCtaLabel(this.platform, this.mobile.permissions())
  }

  /**
   * The talk attempt. Permission is requested HERE — at the first talk
   * attempt, never at app open (F-001 AC-21) — behind one short explanation
   * covering every grant the platform requires (AC-2).
   */
  override tapMic(): void {
    if (this.foregroundSync !== null) {
      // AC-8: no new input until the session read finishes.
      void this.foregroundSync.then(() => this.tapMic())
      return
    }
    const cap = this.mobile.capability()
    if (cap === 'none') return // mic is hidden; nothing to activate (F-001 AC-20)
    if (this.state.surface === 'listening') {
      // cancel-while-listening: words stay in the composer, nothing is sent
      this.mobile.stop()
      return
    }
    if (cap === 'permission-denied') {
      void this.onDeniedMicTap()
      return
    }
    if (cap === 'transient-failure') {
      // AC-4: a recognizer with no pack for the interface language is the
      // TRANSIENT case, and its message says so — it is not the
      // no-capability case, and it is not a permission problem.
      this.dispatch({ type: 'append', messages: [languagePackMessage(this.now())] })
      return
    }
    if (!allGranted(this.platform, this.mobile.permissions())) {
      void this.requestThenListen()
      return
    }
    this.beginCapture()
  }

  /** The CTA on the permission message (`assistant-permission-cta`). Its two
   * branches are the AC-2 / AC-3 split: ask again where the OS will still ask,
   * open Settings where it never will. */
  override permissionCta(): void {
    void this.runPermissionCta()
  }

  private async runPermissionCta(): Promise<void> {
    const perms = await this.readPermissions()
    if (deniedGrants(this.platform, perms).length === 0) return // already re-granted
    if (ctaTarget(this.platform, perms) === 'request') {
      const res = await this.mobile.requestPermissions()
      this.persistPermissions(res.state)
      if (allGranted(this.platform, res.state)) return
      this.countDenials(res.state)
      this.reportDenial(res.state)
      return
    }
    // AC-3: the OS will not show the prompt again — re-requesting here would
    // be a button that does nothing, so the user goes to the settings page
    // where the grant can actually be made.
    await this.mobile.openSettings()
  }

  /** First talk attempt with nothing decided yet (AC-2). */
  private async requestThenListen(): Promise<void> {
    this.dispatch({
      type: 'append',
      messages: [permissionExplanationMessage(this.platform, this.now())],
    })
    const res = await this.mobile.requestPermissions()
    this.persistPermissions(res.state)
    if (allGranted(this.platform, res.state)) {
      this.beginCapture()
      return
    }
    this.countDenials(res.state)
    this.reportDenial(res.state)
  }

  /** Tapping the dimmed mic (AC-2 / AC-3). */
  private async onDeniedMicTap(): Promise<void> {
    // The user may have granted in Settings while we were backgrounded.
    const perms = await this.readPermissions()
    if (deniedGrants(this.platform, perms).length === 0) {
      this.beginCapture()
      return
    }
    if (ctaTarget(this.platform, perms) === 'request') {
      // Android, denied but not permanently: AC-3 allows re-requesting on the
      // next talk attempt.
      const res = await this.mobile.requestPermissions()
      this.persistPermissions(res.state)
      if (allGranted(this.platform, res.state)) {
        this.beginCapture()
        return
      }
      this.countDenials(res.state)
      this.reportDenial(res.state)
      return
    }
    // Permanently denied (Android) or already answered (iOS): NO request —
    // the message names the missing capability and its CTA opens settings.
    this.countDenials(perms)
    this.reportDenial(perms)
  }

  private beginCapture(): void {
    super.tapMic()
  }

  private async readPermissions(): Promise<PermissionState> {
    const perms = await this.mobile.refreshPermissions()
    this.persistPermissions(perms)
    return perms
  }

  /** `client.permission_state` (spec ## Data): each grant tracked separately,
   * so the mic mode is known before the first tap of the next cold open. */
  private persistPermissions(perms: PermissionState): void {
    this.stores.savePermissionState(perms)
  }

  /**
   * Render the denial row this permission tuple selects — and render NOTHING
   * when the tuple has no denial in it.
   *
   * That second half is the part worth naming: a request can return with one
   * grant given and the other still `undetermined` (iOS asks sequentially, so
   * mic `granted` · speech `undetermined` is the ordinary state between the two
   * dialogs). `allGranted` is false there, but nothing was refused, and showing
   * a denial message would tell the user they turned something off when they
   * had merely not been asked yet. The mic stays available and the next talk
   * attempt asks the remaining grant.
   */
  private reportDenial(perms: PermissionState): void {
    const msg = permissionDeniedMessageFor(this.platform, perms, this.now())
    if (msg === null) return
    this.dispatch({ type: 'append', messages: [msg] })
  }

  private countDenials(perms: PermissionState): void {
    for (const grant of requiredGrants(this.platform)) {
      const s = statusOf(perms, grant)
      if (s === 'denied' || s === 'permanently_denied') this.counters.permissionDenied[grant] += 1
    }
  }

  // -------------------------------------------------------------------------
  // Turns (AC-8 gate) + announcements (AC-12)
  // -------------------------------------------------------------------------

  override async send(
    source: TurnSource,
    textArg?: string,
    answerToTurnId?: string | null,
  ): Promise<void> {
    if (this.foregroundSync !== null) await this.foregroundSync
    await super.send(source, textArg, answerToTurnId)
  }

  /** Resuming a session re-renders history the user has already seen; reading
   * all of it aloud on every foreground would bury the one message that IS
   * news. Restored messages are marked as announced without being spoken —
   * anything that arrives afterwards (including a replayed turn's outcome)
   * announces normally. */
  override async syncSession(): Promise<void> {
    // ONE override, two obligations — announcements and the shell's read
    // status. Two overrides of the same method cannot both exist, and two
    // methods that each wrap `super.syncSession()` would be two reads.
    const before = this.sessionSyncs
    this.setLoad({ session: 'loading' })
    this.suppressAnnouncements = true
    try {
      await super.syncSession()
    } finally {
      this.suppressAnnouncements = false
      // The base dispatches `session-synced` iff the read landed and returns
      // silently if it did not, so this comparison IS "did the read succeed" —
      // no second request, no copy of the mapping (L-004).
      this.setLoad({ session: this.sessionSyncs > before ? 'ready' : 'failed' })
    }
  }

  private drainAnnouncements(): void {
    const fresh = this.state.messages.filter((m) => !this.announced.has(m.id))
    for (const m of this.state.messages) this.announced.add(m.id)
    if (this.suppressAnnouncements || fresh.length === 0) return
    for (const a of announcementsFor(fresh, this.undoable())) {
      this.announcer.announce(a.text, { assertive: a.assertive })
    }
  }
}
