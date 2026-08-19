// Harness seams — the spec's speech test seam (F-001 Test strategy; AC-2,
// AC-20–22) exposed to the e2e harness as `window.__assistantSeams`.
//
// GUARDED BEHIND A TEST FLAG: the seam (and the scripted transcript source
// behind it) activates only when the page URL carries `?qaUser=` or
// `?testMode=1`, or localStorage `assistant.testMode` === '1'. Production
// loads use the real Web Speech source and expose nothing.
//
// SHAPE (consumed by qa/assistant/automation/pages/AssistantPage.ts
// `bindSeams` at the execute phase):
//
//   window.__assistantSeams = {
//     // Injectable transcript source: each part is the FULL recognized-so-far
//     // text (interim-result semantics); streams into the composer.
//     feedTranscript(parts: string[]): Promise<void>
//     // End the capture: 'speech-end' (non-empty text sends a voice turn) |
//     // 'speech-end-empty' (idle, no turn) | 'cancelled' (words kept).
//     endCapture(mode): Promise<void>
//     // Capability & permission injection. 'recovered' is an alias of
//     // 'available'. Persisted to localStorage so it survives page.reload()
//     // (TC-025 sets 'none' then reloads).
//     setSpeechCapability(state): Promise<void>
//     // Re-read GET /assistant/session and re-render — how a harness-side
//     // idle close (fireIdleClose) becomes visible to the client, ending the
//     // undo window (AC-8, AC-28). Wire fireIdleClose as: harness close via
//     // injectable clock, then await window.__assistantSeams.resync().
//     resync(): Promise<void>
//     // F-005 AC-44 — hold BOTH sides of the clock at one instant and one zone
//     // for the length of a run. Paired with the server's POST /__qa__/set-clock,
//     // this is the half that did not exist: the web harness drove only the
//     // server-side FakeClock while the browser under test ran on the real wall
//     // clock, so the two sides were already at different instants — AC-44's own
//     // failure mode surviving AC-44's own remedy (L-014).
//     setClock(opts: {at: string, zone?: string}): Promise<void>
//   }
//
// The two remaining spec seams are HARNESS-side, not client-side:
// - aiCallCount() — the interpreter-call counter lives in the backend harness
//   (AC-18/AC-25 assert the counter, the client only guarantees the manual
//   path never touches /assistant/*).
// - fireIdleClose() — idle close is the server's lazy close under an
//   injectable clock (ADR-004); compose it with resync() as noted above.

import type { AssistantController } from '../_shared/controller.ts'
import { ScriptedTranscriptSource } from '../_shared/ports/transcript-source.ts'
import type { SpeechCapability } from '../_shared/ports/transcript-source.ts'

export const SEAM_CAPABILITY_KEY = 'assistant.seam.capability'

export interface AssistantSeamsGlobal {
  feedTranscript(parts: string[]): Promise<void>
  endCapture(mode: 'speech-end' | 'speech-end-empty' | 'cancelled'): Promise<void>
  setSpeechCapability(
    state: 'available' | 'none' | 'permission-denied' | 'transient-failure' | 'recovered',
  ): Promise<void>
  resync(): Promise<void>
  /**
   * **F-005 AC-44's client-side harness door.** Sets the controller's `now` and
   * its computation zone for the rest of the run, then re-renders. **Held** — it
   * does not advance on its own.
   *
   * `api-contracts § Harness doors → the client seam` names this seam by name and
   * states why: `ControllerDeps.now` is an **in-process constructor parameter**,
   * `web/main.tsx` passes none, and `window.__assistantSeams` exposed four methods
   * and **no clock** — so AC-44's *"the test harness can set every seam and hold
   * them at one instant and one zone"* was satisfied only by the unit harness,
   * while the web e2e tier the AC names as broken had no door at all.
   *
   * **A second client seam is not introduced.** `ControllerDeps.now` is the
   * existing injection point and this method drives it (`controller.setClock`).
   */
  setClock(opts: { at: string; zone?: string | null }): Promise<void>
}

export function testModeEnabled(search: string, storage: Pick<Storage, 'getItem'> | null): boolean {
  const params = new URLSearchParams(search)
  if (params.has('qaUser') || params.get('testMode') === '1') return true
  try {
    return storage?.getItem('assistant.testMode') === '1'
  } catch {
    return false
  }
}

/** The persisted capability override (survives reload — TC-025). */
export function storedSeamCapability(storage: Pick<Storage, 'getItem'> | null): SpeechCapability {
  try {
    const v = storage?.getItem(SEAM_CAPABILITY_KEY)
    if (v === 'none' || v === 'permission-denied' || v === 'transient-failure') return v
    return 'available'
  } catch {
    return 'available'
  }
}

export function installSeams(
  target: Record<string, unknown>,
  source: ScriptedTranscriptSource,
  controller: AssistantController,
  storage: Pick<Storage, 'setItem' | 'removeItem'> | null,
): void {
  const seams: AssistantSeamsGlobal = {
    feedTranscript: async (parts) => {
      source.feed(parts)
    },
    endCapture: async (mode) => {
      source.end(mode)
    },
    setSpeechCapability: async (state) => {
      const cap: SpeechCapability = state === 'recovered' ? 'available' : state
      try {
        if (cap === 'available') storage?.removeItem(SEAM_CAPABILITY_KEY)
        else storage?.setItem(SEAM_CAPABILITY_KEY, cap)
      } catch {
        /* storage denied — live update still applies */
      }
      source.setCapability(cap)
    },
    resync: async () => {
      await controller.syncSession()
    },
    setClock: async (opts) => {
      controller.setClock(opts)
    },
  }
  target['__assistantSeams'] = seams
}
