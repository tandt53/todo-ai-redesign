// Browser bootstrap. Builds the real ports, wires the controller, mounts the
// app, and — only in test mode — installs the harness seams.
//
// Test mode is a GUARD, not a feature (seams.ts): the scripted transcript
// source and `window.__assistantSeams` exist only when the URL carries
// `?qaUser=` / `?testMode=1` or localStorage says so. A production load gets
// the real Web Speech source and exposes nothing.

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App.tsx'
import { AssistantApi } from '../_shared/api/client.ts'
import { AssistantController } from '../_shared/controller.ts'
import { ClientStores } from '../_shared/model/client-stores.ts'
import { LocalStorageDurableStore } from './ports/durable-store.ts'
import { ScriptedTranscriptSource } from '../_shared/ports/transcript-source.ts'
import type { TranscriptSource } from '../_shared/ports/transcript-source.ts'
import { WebSpeechTranscriptSource } from './ports/web-speech-source.ts'
import { installSeams, storedSeamCapability, testModeEnabled } from './seams.ts'
import './styles.css'

const USER_KEY = 'assistant.user_id'

/** The account this tab acts as. QA drives per-TC users through `?qaUser=`
 * (test-data namespacing, _qa-foundations §10); an ordinary load reuses — or
 * mints — a stable local id, since the prototype auth is `X-User-Id` only. */
function resolveUserId(search: string, store: Storage | null): string {
  const qaUser = new URLSearchParams(search).get('qaUser')
  if (qaUser !== null && qaUser !== '') return qaUser
  try {
    const existing = store?.getItem(USER_KEY)
    if (existing !== null && existing !== undefined && existing !== '') return existing
    const minted = crypto.randomUUID()
    store?.setItem(USER_KEY, minted)
    return minted
  } catch {
    return crypto.randomUUID()
  }
}

function storageOrNull(): Storage | null {
  try {
    return globalThis.localStorage
  } catch {
    return null
  }
}

export function bootstrap(container: HTMLElement): AssistantController {
  const store = storageOrNull()
  const search = globalThis.location?.search ?? ''
  const userId = resolveUserId(search, store)
  const testMode = testModeEnabled(search, store)

  const speech: TranscriptSource = testMode
    ? new ScriptedTranscriptSource(storedSeamCapability(store))
    : new WebSpeechTranscriptSource()

  const controller = new AssistantController({
    api: new AssistantApi({ userId }),
    speech,
    stores: new ClientStores(new LocalStorageDurableStore(), userId),
  })

  if (testMode && speech instanceof ScriptedTranscriptSource) {
    installSeams(globalThis as unknown as Record<string, unknown>, speech, controller, store)
  }

  // Offline is a real transition, not a poll: the surface hands over to the
  // list on `offline` and replays the queued turn on `online` (AC-25).
  globalThis.addEventListener('online', () => controller.setOnline(true))
  globalThis.addEventListener('offline', () => controller.setOnline(false))

  createRoot(container).render(
    <StrictMode>
      <App controller={controller} />
    </StrictMode>,
  )
  void controller.init()
  return controller
}

const root = document.getElementById('root')
if (root !== null) bootstrap(root)
