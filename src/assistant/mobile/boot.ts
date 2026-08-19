// Device wiring — the only file in this module that touches React Native
// directly (besides `components/`). Tests never import it: `index.ts` is the
// node-safe entry point, and keeping the two apart is what lets the whole
// conversation run under vitest with no simulator (platform mobile.md).
//
// Open Question 3 (spec): a handset cannot reach `localhost:4460`, so the base
// URL is a build-time input rather than a constant. It is a required argument
// here on purpose — a default would be a guess that only works on a simulator.

import { AssistantApi } from '../_shared/api/client.ts'
import { installClock } from '../_shared/model/clock.ts'
import { ClientStores } from '../_shared/model/client-stores.ts'
import { MobileAssistantController } from './controller.ts'
import type { AsyncKeyValueBackend } from './ports/durable-store.ts'
import { HydratedDurableStore } from './ports/durable-store.ts'
import {
  RNAnnouncer,
  RNAppLifecycle,
  RNConnectivity,
  RNReduceMotion,
} from './ports/native/rn-platform.ts'
import type { NativeAudioEvents, NetInfoLike } from './ports/native/rn-platform.ts'
import { RNTranscriptSource } from './ports/native/rn-transcript-source.ts'
import type { NativeSpeechModule } from './ports/native/rn-transcript-source.ts'

export interface BootOptions {
  /** LAN host or emulator alias — see spec Open Question 3. */
  baseUrl: string
  /** Prototype auth is `X-User-Id` only (api-contracts.md). */
  userId: string
  /** AsyncStorage / MMKV — Open Question 1 leaves the library to the shell;
   * the port is the whole contract either has to satisfy. */
  storage: AsyncKeyValueBackend
  /** Recognition + iOS authorisations. Absent = no recognizer, which F-001
   * AC-20 renders as a hidden mic with no error; typing is unaffected. */
  speech?: NativeSpeechModule | null
  /** Audio-session interruption events (AC-7). */
  audio?: NativeAudioEvents | null
  /** NetInfo-shaped reachability (AC-4). Absent = assume online and discover
   * the truth through a failed request, which is F-001 AC-25's path anyway. */
  netInfo?: NetInfoLike | null
  // No `locale` here on purpose (F-002 AC-23): the interface language has
  // exactly one declared source, `client.interface_language`, which the
  // transcript source reads directly. A shell-supplied locale would be the
  // second source the AC exists to stop — the same defect as the per-port
  // literal it replaced, just moved one layer out.
}

export interface BootResult {
  controller: MobileAssistantController
  dispose(): void
}

/**
 * Build the running client. The order matters: the device is probed first
 * (permissions are READ, never requested — AC-2 forbids asking at app open),
 * the durable store is hydrated before the first render so AC-5/AC-6's
 * survivors are already in hand, and only then does the controller start,
 * which performs AC-8's session read.
 */
export async function boot(opts: BootOptions): Promise<BootResult> {
  const speech = new RNTranscriptSource({ native: opts.speech ?? null })
  await speech.prime()

  const connectivity = new RNConnectivity(opts.netInfo ?? null)
  await connectivity.prime()

  const store = await HydratedDurableStore.open(opts.storage)
  const lifecycle = new RNAppLifecycle({ audio: opts.audio ?? null })

  // F-001 AC-30(g): read before the first render, so the very first scroll the
  // app performs already honours the setting rather than animating once and
  // then behaving.
  const reduceMotion = new RNReduceMotion()
  await reduceMotion.prime()

  const controller = new MobileAssistantController({
    api: new AssistantApi({ baseUrl: opts.baseUrl, userId: opts.userId }),
    speech,
    stores: new ClientStores(store, opts.userId),
    lifecycle,
    connectivity,
    announcer: new RNAnnouncer(),
    reduceMotion,
  })

  // ── F-005 AC-44 — ONE clock per side, and this is the phone's install ──────
  // `ControllerDeps.now` is the seam, but it could never reach the **defaulted**
  // `now: Date = nowDate()` parameters in `_shared/model/{format,tasks}.ts` and
  // `mobile/model/tasks-view.ts` — a default is what makes a missed injection
  // silently read the wall clock instead of raising a type error, which is the
  // class AC-44 singles out by name. `installClock` points those defaults at the
  // controller's already-injected clock and account zone.
  //
  // **Without this call the phone's defaulted `now` parameters read the wall clock
  // while the controller holds a seam** — two clocks on one client, which is
  // exactly what AC-44 forbids and exactly the defect L-023 records in the web
  // harness: green only while the view reads the wrong one. `web/main.tsx:79`
  // makes the same call, and `_shared/model/clock.ts` says in writing that
  // `mobile/boot.ts` owes it.
  //
  // It is installed BEFORE `init()`: the cold open computes dates (the zone read,
  // the collection predicates, AC-38's reminder read) and an install afterwards
  // would leave the first render on the wall clock.
  installClock(controller.clockProvider())

  await controller.init()

  return {
    controller,
    dispose: () => {
      controller.dispose()
      connectivity.dispose()
      reduceMotion.dispose()
      speech.dispose()
    },
  }
}
