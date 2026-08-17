// Web-tier test harness.
//
// The wire fixtures and the fake server are platform-neutral and live in
// src/assistant/_shared/testing/fixtures.ts (the mobile tier asserts the same
// contract); they are re-exported here so this file stays the one import the
// web suites need.

import { AssistantApi } from '../../_shared/api/client.ts'
import { AssistantController } from '../../_shared/controller.ts'
import { ClientStores } from '../../_shared/model/client-stores.ts'
import { MemoryDurableStore } from '../../_shared/ports/durable-store.ts'
import { ScriptedTranscriptSource } from '../../_shared/ports/transcript-source.ts'
import type { SpeechCapability } from '../../_shared/ports/transcript-source.ts'
import { FakeServer, T0 } from '../../_shared/testing/fixtures.ts'
import type { TaskWire } from '../../_shared/types.ts'

export {
  T0,
  task,
  turn,
  applied,
  appliedTurn,
  askedTurn,
  session,
  boundary,
  turnResponse,
  undoOutcome,
  FakeServer,
} from '../../_shared/testing/fixtures.ts'
export type { Call } from '../../_shared/testing/fixtures.ts'

/** A real `GET /tasks` through the same fetch seam the app uses — the
 * user-visible "is it actually on the server" read, not an inspection of the
 * fake's internals. */
export async function serverTasks(server: FakeServer): Promise<TaskWire[]> {
  const res = await new AssistantApi({ userId: 'user-1', fetchFn: server.fetchFn }).listTasks()
  if (res.kind !== 'ok') throw new Error(`GET /tasks failed: ${res.kind}`)
  return res.value.tasks
}

export interface Harness {
  controller: AssistantController
  server: FakeServer
  speech: ScriptedTranscriptSource
  stores: ClientStores
  store: MemoryDurableStore
  ids: string[]
}

let uuidSeq = 0

/** A controller wired to fakes: no network, no browser, deterministic ids. */
export function harness(
  opts: {
    capability?: SpeechCapability
    online?: boolean
    store?: MemoryDurableStore
    server?: FakeServer
  } = {},
): Harness {
  const server = opts.server ?? new FakeServer()
  const speech = new ScriptedTranscriptSource(opts.capability ?? 'available')
  const store = opts.store ?? new MemoryDurableStore()
  const stores = new ClientStores(store, 'user-1')
  const ids: string[] = []
  let online = opts.online ?? true
  const controller = new AssistantController({
    api: new AssistantApi({ userId: 'user-1', fetchFn: server.fetchFn }),
    speech,
    stores,
    uuid: () => {
      uuidSeq += 1
      const id = `cid-${uuidSeq}`
      ids.push(id)
      return id
    },
    now: () => T0,
    timezone: 'Asia/Ho_Chi_Minh',
    onlineNow: () => online,
  })
  const original = controller.setOnline.bind(controller)
  controller.setOnline = (next: boolean) => {
    online = next
    original(next)
  }
  return { controller, server, speech, stores, store, ids }
}
