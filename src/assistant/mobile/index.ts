// The mobile module's public entry point — and, deliberately, a NODE-SAFE one:
// nothing reachable from this file imports `react-native`. That is what lets
// the unit tier and QA's automation (`qa/assistant/automation/mobile/`) drive
// the real client under plain node with no simulator, no emulator and no Metro
// (platform mobile.md ## Test Harness). The device wiring lives in `boot.ts`,
// which the app shell imports and tests never do.
//
// `createSurface` is the seam QA asked for in
// `qa/assistant/automation/mobile/F-003-mobile-surface.spec.ts`: QA cannot read
// `src/` to discover the model's API (_qa-foundations §1/§2), so the facade is
// named and shaped here, once, instead of being guessed twice. It adds no
// behaviour — every method delegates to the same controller the app runs.

export { MobileAssistantController } from './controller.ts'
export type { MobileControllerDeps, MobileCounters } from './controller.ts'
export * from './model/a11y.ts'
export * from './model/announce.ts'
export * from './model/follow.ts'
export * from './model/lifecycle.ts'
export * from './model/permissions.ts'
export * from './model/shell.ts'
export * from './model/surface.ts'
export * from './model/task-link.ts'
export * from './model/tasks-view.ts'
export * from './model/touch.ts'
export * from './ports/app-lifecycle.ts'
export * from './ports/durable-store.ts'
export * from './ports/transcript-source.ts'

import { AssistantApi } from '../_shared/api/client.ts'
import type { FetchLike } from '../_shared/api/client.ts'
import { ClientStores } from '../_shared/model/client-stores.ts'
import type { PermissionState } from '../_shared/model/client-stores.ts'
import { micMode as sharedMicMode, undoableTurnId } from '../_shared/model/reducer.ts'
import type { AppState } from '../_shared/model/reducer.ts'
import { MemoryDurableStore } from '../_shared/ports/durable-store.ts'
import type { DurableStore } from '../_shared/ports/durable-store.ts'
import type { Message, TaskView, TurnSource } from '../_shared/types.ts'
import { MobileAssistantController } from './controller.ts'
import { expectedIds } from './model/a11y.ts'
import type { A11yId } from './model/a11y.ts'
import { tasksSurfaceView } from './model/tasks-view.ts'
import type { MobilePlatform } from './model/permissions.ts'
import {
  FakeAppLifecycle,
  FakeConnectivity,
  FakeReduceMotion,
  RecordingAnnouncer,
} from './ports/app-lifecycle.ts'
import type {
  Announcer,
  AppLifecycle,
  Connectivity,
  ReduceMotion,
} from './ports/app-lifecycle.ts'
import { FakeMobileTranscriptSource } from './ports/transcript-source.ts'
import type { MobileTranscriptSource } from './ports/transcript-source.ts'

// ---------------------------------------------------------------------------
// Port factories — the doubles, ready to drive
// ---------------------------------------------------------------------------

export function makeTranscriptSource(
  opts: {
    platform?: MobilePlatform
    permissions?: PermissionState
    recognizerAvailable?: boolean
    languagePackAvailable?: boolean
    grantOn?: (current: PermissionState) => PermissionState
  } = {},
): FakeMobileTranscriptSource {
  const platform = opts.platform ?? 'ios'
  return new FakeMobileTranscriptSource({
    platform,
    ...(opts.permissions === undefined ? {} : { permissions: opts.permissions }),
    ...(opts.recognizerAvailable === undefined
      ? {}
      : { recognizerAvailable: opts.recognizerAvailable }),
    ...(opts.languagePackAvailable === undefined
      ? {}
      : { languagePackAvailable: opts.languagePackAvailable }),
    ...(opts.grantOn === undefined ? {} : { grantOn: opts.grantOn }),
  })
}

/** A store whose contents outlive any model built over it — hand the SAME
 * instance to a second `createSurface` and that is a process kill (AC-5/AC-6).
 * The device-backed equivalent is `HydratedDurableStore` over AsyncStorage. */
export function makeDurableStore(): MemoryDurableStore {
  return new MemoryDurableStore()
}

export function makeAppLifecycle(): FakeAppLifecycle {
  return new FakeAppLifecycle()
}

export function makeConnectivity(online = true): FakeConnectivity {
  return new FakeConnectivity(online)
}

/** AC-12's payload is only assertable if the announcement leaves through a
 * port — this is that port's double, and it records what was said and how. */
export function makeAnnouncer(): RecordingAnnouncer {
  return new RecordingAnnouncer()
}

/** F-001 AC-30(g)'s OS switch, drivable: `set(true)` is the user turning
 * reduce-motion on mid-session. */
export function makeReduceMotion(enabled = false): FakeReduceMotion {
  return new FakeReduceMotion(enabled)
}

// ---------------------------------------------------------------------------
// The surface facade
// ---------------------------------------------------------------------------

export interface SurfaceDeps {
  transcript?: MobileTranscriptSource
  store?: DurableStore
  lifecycle?: AppLifecycle
  connectivity?: Connectivity
  announcer?: Announcer
  /** F-001 AC-30(g). */
  reduceMotion?: ReduceMotion
  /** A ready client, or the pieces to build one. `fetchFn` is the API seam —
   * no live server needed. */
  api?: AssistantApi | { fetchFn?: FetchLike; baseUrl?: string; userId?: string }
  platform?: MobilePlatform
  userId?: string
  uuid?: () => string
  now?: () => string
  timezone?: string | null
}

/** The mic mode in QA's three-value vocabulary. The client's own four-value
 * mode (which distinguishes the two dimmed causes) stays available as
 * `micModeDetailed` — F-001 AC-22 needs that distinction. */
export type CoarseMicMode = 'available' | 'dimmed' | 'hidden'

export class Surface {
  readonly controller: MobileAssistantController
  readonly transcript: MobileTranscriptSource
  readonly store: DurableStore
  readonly lifecycle: AppLifecycle
  readonly connectivity: Connectivity
  readonly announcer: Announcer
  readonly reduceMotion: ReduceMotion

  constructor(deps: SurfaceDeps = {}) {
    const platform = deps.platform ?? deps.transcript?.platform ?? 'ios'
    const userId = deps.userId ?? 'user-1'
    this.transcript = deps.transcript ?? makeTranscriptSource({ platform })
    this.store = deps.store ?? makeDurableStore()
    this.lifecycle = deps.lifecycle ?? makeAppLifecycle()
    this.connectivity = deps.connectivity ?? makeConnectivity()
    this.announcer = deps.announcer ?? makeAnnouncer()
    this.reduceMotion = deps.reduceMotion ?? makeReduceMotion()
    const api =
      deps.api instanceof AssistantApi
        ? deps.api
        : new AssistantApi({
            userId: deps.api?.userId ?? userId,
            ...(deps.api?.baseUrl === undefined ? {} : { baseUrl: deps.api.baseUrl }),
            ...(deps.api?.fetchFn === undefined ? {} : { fetchFn: deps.api.fetchFn }),
          })
    this.controller = new MobileAssistantController({
      api,
      speech: this.transcript,
      stores: new ClientStores(this.store, userId),
      lifecycle: this.lifecycle,
      connectivity: this.connectivity,
      announcer: this.announcer,
      reduceMotion: this.reduceMotion,
      ...(deps.uuid === undefined ? {} : { uuid: deps.uuid }),
      ...(deps.now === undefined ? {} : { now: deps.now }),
      ...(deps.timezone === undefined ? {} : { timezone: deps.timezone }),
    })
  }

  // ---- readable ----

  /** One of the four surface states (F-001 AC-29). */
  get state(): AppState['surface'] {
    return this.controller.state.surface
  }

  get appState(): AppState {
    return this.controller.state
  }

  get micMode(): CoarseMicMode {
    const mode = sharedMicMode(this.controller.state)
    if (mode === 'hidden') return 'hidden'
    return mode === 'available' ? 'available' : 'dimmed'
  }

  get micModeDetailed(): ReturnType<typeof sharedMicMode> {
    return sharedMicMode(this.controller.state)
  }

  get messages(): Message[] {
    return this.controller.state.messages
  }

  get composerText(): string {
    return this.controller.state.composer
  }

  get tasks(): TaskView[] {
    return this.controller.state.tasks
  }

  get offline(): boolean {
    return this.controller.state.offline
  }

  get platform(): MobilePlatform {
    return this.controller.platform
  }

  get permissions(): PermissionState {
    return this.controller.permissions()
  }

  get counters() {
    return this.controller.counters
  }

  /** The turn the single Undo affordance belongs to, or null. */
  get undoableTurnId(): string | null {
    return undoableTurnId(this.controller.state)
  }

  /** Every accessibility id the surface renders right now (AC-12).
   *
   * `unseenBelowFold` is F-001 AC-30's viewport fact — how many messages
   * arrived while the user was away from the bottom. It defaults to 0
   * (NMA-HIDDEN), because a headless surface has no viewport and the AC's own
   * default is "the newest message is on screen". */
  a11yIds(
    ctx: { tasksVisible?: boolean; hasTasks?: boolean; unseenBelowFold?: number } = {},
  ): Set<A11yId> {
    return expectedIds(this.controller.state, {
      tasksVisible: ctx.tasksVisible ?? true,
      // ── F-005 AC-35 — this reader reads the DRAWN ROWS, not raw cardinality ──
      // One of the three mobile readers AC-35 names, and the three need
      // **opposite** inputs, which is why the AC states the outcome per reader
      // rather than one rule over the group:
      //
      //   - `tasks-view.ts`'s empty-state choice must read RAW cardinality
      //     (`state.tasks.length > 0`), so an account whose rows are all parents
      //     with steps gets the empty-COLLECTION state and not the first-run one;
      //   - **this one must read the drawn rows**, so `a11y.ts` requires no
      //     `taskRow` / `taskCheckbox` ids when the collection on screen draws
      //     nothing.
      //
      // It used to be `state.tasks.length > 0`. In the account AC-35 names — every
      // parent excluded from the collection on screen (all done, or all dated
      // outside it), so `collectionTasks` is empty while `state.tasks` is not —
      // that expected a row in a view that returns `tasks: []`. Revision 3 offered
      // deriving all three from `collectionTasks` as equally satisfying the AC and
      // withdrew it, because in that same account it makes `tasks-view.ts` return
      // the first-run state the AC forbids two lines earlier.
      //
      // A step reaches neither reader as a row: the single `inCollection` gate in
      // `_shared/` excludes it, and `tasks-view.ts` re-exports from there, so this
      // client gets that half for free (AC-35's own "good news, checked rather than
      // assumed").
      hasTasks:
        ctx.hasTasks ??
        tasksSurfaceView(
          this.controller.state,
          this.controller.shellState().collection,
          this.controller.nowDate(),
        ).tasks.length > 0,
      unseenBelowFold: ctx.unseenBelowFold ?? 0,
    })
  }

  // ---- drivable ----

  /** Cold open: read the OS, the server, and the surviving local stores. */
  start(): Promise<void> {
    return this.controller.init()
  }

  tapMic(): void {
    this.controller.tapMic()
  }

  /** Feed recognized text as the recognizer would (full text each time). */
  hearWords(...parts: string[]): void {
    const source = this.transcript
    if (source instanceof FakeMobileTranscriptSource) source.feed(parts)
  }

  endSpeech(mode: 'speech-end' | 'speech-end-empty' | 'cancelled' = 'speech-end'): void {
    const source = this.transcript
    if (source instanceof FakeMobileTranscriptSource) source.end(mode)
  }

  setComposerText(text: string): void {
    this.controller.composerChange(text)
  }

  submit(source: TurnSource = 'typed'): Promise<void> {
    return this.controller.send(source)
  }

  tapUndo(turnId?: string): Promise<void> {
    const target = turnId ?? this.undoableTurnId
    if (target === null || target === undefined) return Promise.resolve()
    return this.controller.undoTap(target)
  }

  /** Tap an option chip: by its literal text, or by index within the newest
   * unresolved question. Sends the option's literal text (F-001 AC-10/AC-13). */
  tapChip(option: string | number, questionTurnId?: string): Promise<void> {
    const questions = this.controller.state.messages.filter(
      (m): m is Extract<Message, { kind: 'question' }> => m.kind === 'question' && !m.resolved,
    )
    const q =
      questionTurnId === undefined
        ? questions[questions.length - 1]
        : questions.find((x) => x.turnId === questionTurnId)
    if (q === undefined) return Promise.resolve()
    const text = typeof option === 'number' ? q.options[option] : option
    if (text === undefined) return Promise.resolve()
    return this.controller.chipTap(q.turnId, text)
  }

  tapPermissionCta(): void {
    this.controller.permissionCta()
  }

  cancelThinking(): void {
    this.controller.cancelThinking()
  }

  background(): void {
    this.controller.onBackground()
  }

  foreground(): Promise<void> {
    return this.controller.onForeground()
  }

  interrupt(reason: 'call' | 'system-assistant' | 'focus-loss' | 'route-change' = 'call'): void {
    this.controller.onAudioInterruption(reason)
  }

  pressBack(): boolean {
    return this.controller.handleBack()
  }

  keyboard(visible: boolean): void {
    this.controller.keyboardChanged(visible)
  }
}

export function createSurface(deps: SurfaceDeps = {}): Surface {
  return new Surface(deps)
}
