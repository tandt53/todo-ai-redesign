// Mobile-tier test harness. Node only — no simulator, no emulator, no Metro
// (platform mobile.md ## Test Harness). React Native is never imported by
// anything this file reaches.
//
// The wire fixtures and the fake server come from
// `src/assistant/_shared/testing/fixtures.ts` — the same ones the web tier
// asserts against, because F-003 AC-1's parity claim is only checkable if both
// clients are held to one server contract.
//
// PROCESS KILL is the interesting part. A real kill cannot happen in node, and
// the ACs do not actually require one: AC-5/AC-6's observable is that the
// store's contents outlive the model. `relaunch()` below reproduces exactly
// that — the device backend survives, everything else is constructed fresh.

import { AssistantApi } from '../../_shared/api/client.ts'
import { ClientStores } from '../../_shared/model/client-stores.ts'
import type { PermissionState } from '../../_shared/model/client-stores.ts'
import { FakeServer, T0 } from '../../_shared/testing/fixtures.ts'
import { MobileAssistantController } from '../controller.ts'
import type { MobilePlatform } from '../model/permissions.ts'
import {
  FakeAppLifecycle,
  FakeConnectivity,
  FakeReduceMotion,
  RecordingAnnouncer,
} from '../ports/app-lifecycle.ts'
import { HydratedDurableStore, MemoryAsyncBackend } from '../ports/durable-store.ts'
import { FakeMobileTranscriptSource } from '../ports/transcript-source.ts'

export { T0 }
export {
  appliedTurn,
  askedTurn,
  boundary,
  session,
  task,
  todayTask,
  upcomingTask,
  filedTask,
  turn,
  turnResponse,
  undoOutcome,
  FakeServer,
} from '../../_shared/testing/fixtures.ts'

export interface MobileHarness {
  controller: MobileAssistantController
  server: FakeServer
  speech: FakeMobileTranscriptSource
  lifecycle: FakeAppLifecycle
  connectivity: FakeConnectivity
  announcer: RecordingAnnouncer
  /** F-001 AC-30(g)'s OS switch — `reduceMotion.set(true)` is the user turning
   * it on. */
  reduceMotion: FakeReduceMotion
  backend: MemoryAsyncBackend
  store: HydratedDurableStore
  stores: ClientStores
  ids: string[]
  /** Kill the app and open it again on the same device: a brand-new
   * controller, ports and in-memory store over the SAME storage backend. */
  relaunch(over?: Partial<HarnessOptions>): Promise<MobileHarness>
}

export interface HarnessOptions {
  platform: MobilePlatform
  permissions: PermissionState
  recognizerAvailable: boolean
  languagePackAvailable: boolean
  grantOn: (current: PermissionState) => PermissionState
  online: boolean
  server: FakeServer
  backend: MemoryAsyncBackend
  userId: string
  /** Inject a subclass to model a transition the OS never reported — see
   * `BackgroundedConnectivity` in lifecycle.test.ts. Defaults to a plain
   * `FakeConnectivity(online)`. */
  connectivity: FakeConnectivity
  /** F-001 AC-30(g). Defaults to off, the OS default. */
  reduceMotion: boolean
}

let uuidSeq = 0

export function grantedFor(platform: MobilePlatform): PermissionState {
  return platform === 'ios'
    ? { microphone: 'granted', speech_recognition: 'granted' }
    : { microphone: 'granted' }
}

/** Build a mobile controller wired entirely to doubles. Nothing here reaches
 * the network, the OS, or a device. */
export async function mobileHarness(opts: Partial<HarnessOptions> = {}): Promise<MobileHarness> {
  const platform = opts.platform ?? 'ios'
  const server = opts.server ?? new FakeServer()
  // Quiet defaults: an empty list and no open session. Every test that cares
  // overrides them; without them a harness would fail on the shape of `{}`
  // rather than on the behaviour under test.
  server.always('GET /tasks', 200, { tasks: [] })
  server.always('GET /assistant/session', 200, { session: null, boundary: null })
  const backend = opts.backend ?? new MemoryAsyncBackend()
  const userId = opts.userId ?? 'user-1'

  const speechOpts = {
    platform,
    permissions: opts.permissions ?? grantedFor(platform),
    recognizerAvailable: opts.recognizerAvailable ?? true,
    languagePackAvailable: opts.languagePackAvailable ?? true,
    ...(opts.grantOn === undefined ? {} : { grantOn: opts.grantOn }),
  }
  const speech = new FakeMobileTranscriptSource(speechOpts)
  const lifecycle = new FakeAppLifecycle()
  const connectivity = opts.connectivity ?? new FakeConnectivity(opts.online ?? true)
  const announcer = new RecordingAnnouncer()
  const reduceMotion = new FakeReduceMotion(opts.reduceMotion ?? false)
  const store = await HydratedDurableStore.open(backend)
  const stores = new ClientStores(store, userId)
  const ids: string[] = []

  const controller = new MobileAssistantController({
    api: new AssistantApi({ userId, fetchFn: server.fetchFn }),
    speech,
    stores,
    lifecycle,
    connectivity,
    announcer,
    reduceMotion,
    uuid: () => {
      uuidSeq += 1
      const id = `cid-${uuidSeq}`
      ids.push(id)
      return id
    },
    now: () => T0,
    timezone: 'Asia/Ho_Chi_Minh',
  })

  const harness: MobileHarness = {
    controller,
    server,
    speech,
    lifecycle,
    connectivity,
    announcer,
    reduceMotion,
    backend,
    store,
    stores,
    ids,
    relaunch: (over = {}) =>
      mobileHarness({
        platform,
        permissions: speech.permissions(),
        recognizerAvailable: speech.recognizerAvailable(),
        languagePackAvailable: speech.languagePackAvailable(),
        online: connectivity.isOnline(),
        reduceMotion: reduceMotion.isEnabled(),
        server,
        backend,
        userId,
        ...over,
      }),
  }
  return harness
}

/** Speak an utterance end to end: tap the mic, stream the words, end speech. */
export async function speak(h: MobileHarness, text: string): Promise<void> {
  h.controller.tapMic()
  await settle()
  h.speech.feed([text])
  h.speech.end('speech-end')
  await settle()
}

/** Let queued microtasks (and the store's write queue) drain. */
export async function settle(store?: HydratedDurableStore): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
  await new Promise((r) => setTimeout(r, 0))
  if (store !== undefined) await store.flush()
}

export function messagesOfKind<K extends string>(
  h: MobileHarness,
  kind: K,
): { kind: K; [key: string]: unknown }[] {
  return h.controller.state.messages.filter((m) => m.kind === kind) as never
}

/** Every request the client made, in order — used to assert "the session read
 * comes first" (AC-8) and "zero assistant calls" (F-001 AC-18). */
export function requestLog(h: MobileHarness): string[] {
  return h.server.calls.map((c) => `${c.method} ${c.path}`)
}
