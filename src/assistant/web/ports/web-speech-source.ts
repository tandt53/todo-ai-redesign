// Web backing for the TranscriptSource port (src/assistant/_shared/ports/
// transcript-source.ts): the browser Web Speech API, capability-DETECTED and
// never platform-sniffed (F-001 AC-20).
//
// The port interface, its capability vocabulary and the scripted test double
// are platform-neutral and live in _shared; only this backing is web-specific
// (the mobile backing is src/assistant/mobile/ports/transcript-source.ts).

import type {
  CaptureHandlers,
  SpeechCapability,
  TranscriptSource,
} from '../../_shared/ports/transcript-source.ts'
import { INTERFACE_LANGUAGE } from '../../_shared/model/client-stores.ts'


interface SpeechRecognitionLike {
  lang: string
  interimResults: boolean
  continuous: boolean
  onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onerror: ((ev: { error: string }) => void) | null
  onend: (() => void) | null
  start(): void
  abort(): void
  stop(): void
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike

function detectCtor(): SpeechRecognitionCtor | null {
  const w = globalThis as Record<string, unknown>
  const ctor = w['SpeechRecognition'] ?? w['webkitSpeechRecognition']
  return typeof ctor === 'function' ? (ctor as SpeechRecognitionCtor) : null
}

/** How long a transient recognition failure keeps the mic dimmed before the
 * source re-reports 'available' (AC-22: returns when recognition recovers —
 * the browser API has no probe, so recovery is optimistic-after-cooldown). */
const TRANSIENT_RETRY_MS = 15_000

export class WebSpeechTranscriptSource implements TranscriptSource {
  private cap: SpeechCapability
  private readonly ctor: SpeechRecognitionCtor | null
  private rec: SpeechRecognitionLike | null = null
  private handlers: CaptureHandlers | null = null
  private text = ''
  private stopping = false
  private readonly listeners = new Set<(c: SpeechCapability) => void>()

  /** AC-23: the recognizer declares its language from the ONE declared source
   * (`client.interface_language`), never from `navigator.language` and never
   * from a literal of its own — on a Vietnamese-locale machine the old
   * `navigator.language` read handed an English sentence to a Vietnamese
   * recognizer, which is the failure this AC exists to stop, and correcting
   * the literal instead of the mechanism would leave it just as violated. */
  constructor(lang: string = INTERFACE_LANGUAGE) {
    this.lang = lang
    this.ctor = detectCtor()
    this.cap = this.ctor === null ? 'none' : 'available'
  }

  private readonly lang: string

  capability(): SpeechCapability {
    return this.cap
  }

  onCapabilityChange(cb: (capability: SpeechCapability) => void): () => void {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }

  private setCap(cap: SpeechCapability): void {
    if (cap === this.cap) return
    this.cap = cap
    for (const cb of this.listeners) cb(cap)
  }

  start(handlers: CaptureHandlers): void {
    if (this.ctor === null || this.cap !== 'available') return
    this.handlers = handlers
    this.text = ''
    this.stopping = false
    const rec = new this.ctor()
    this.rec = rec
    rec.lang = this.lang
    rec.interimResults = true
    rec.continuous = false
    rec.onresult = (ev) => {
      let full = ''
      for (let i = 0; i < ev.results.length; i++) {
        const alt = ev.results[i]?.[0]
        if (alt) full += alt.transcript
      }
      this.text = full
      this.handlers?.onTranscript(full)
    }
    rec.onerror = (ev) => {
      // 'not-allowed' / 'service-not-allowed' → the user (or platform) denied
      // permission (AC-21); everything else is transient (AC-22).
      if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') {
        this.setCap('permission-denied')
      } else if (ev.error !== 'aborted' && ev.error !== 'no-speech') {
        this.setCap('transient-failure')
        setTimeout(() => {
          if (this.cap === 'transient-failure') this.setCap('available')
        }, TRANSIENT_RETRY_MS)
      }
    }
    rec.onend = () => {
      const h = this.handlers
      this.handlers = null
      this.rec = null
      if (h === null) return
      if (this.stopping) h.onEnd('cancelled', this.text)
      else if (this.text.trim() === '') h.onEnd('speech-end-empty', '')
      else h.onEnd('speech-end', this.text)
    }
    // The permission prompt fires on this first start — before the first talk
    // attempt, never at app open (AC-21).
    try {
      rec.start()
    } catch {
      this.handlers = null
      this.rec = null
      handlers.onEnd('speech-end-empty', '')
    }
  }

  stop(): void {
    if (this.rec === null) {
      const h = this.handlers
      this.handlers = null
      h?.onEnd('cancelled', this.text)
      return
    }
    this.stopping = true
    try {
      this.rec.stop()
    } catch {
      const h = this.handlers
      this.handlers = null
      this.rec = null
      h?.onEnd('cancelled', this.text)
    }
  }

  /** A dismissed permission denial can be re-tried after the user re-grants
   * in site settings; the next tap re-probes by attempting a start. */
  reprobeAfterPermission(): void {
    if (this.cap === 'permission-denied') this.setCap('available')
  }
}
