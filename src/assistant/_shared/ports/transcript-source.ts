// TranscriptSource port — the spec's speech test seam (F-001 Test strategy;
// AC-2, AC-20–22; F-003 Test strategy extends it to mobile). No client ever
// talks to a recognition API directly: it talks to this port, so tests inject
// scripted transcripts, capability, permission-denial and transient failures
// with no real audio and no device.
//
// Capability is DETECTED, never platform-sniffed (AC-20): the web source
// reports 'none' iff the SpeechRecognition constructor is absent; the mobile
// source reports 'none' iff the device has no recognizer
// (src/assistant/mobile/ports/transcript-source.ts, which extends this port
// with the OS permission surface F-003 AC-2/AC-3 require).
//
// Semantics:
// - onTranscript(text) delivers the FULL recognized-so-far text (interim
//   results replace, they do not append) — it streams into the composer.
// - onEnd('speech-end', text)      → end of speech; a non-empty text is sent
//   as a voice turn (spec User Flow).
// - onEnd('speech-end-empty', '')  → nothing recognized; back to idle, no
//   turn (AC-2).
// - onEnd('cancelled', text)       → user cancel / audio interruption; text
//   stays in the composer, nothing is sent (AC-3).

export type SpeechCapability = 'available' | 'none' | 'permission-denied' | 'transient-failure'

export type CaptureEndMode = 'speech-end' | 'speech-end-empty' | 'cancelled'

export interface CaptureHandlers {
  onTranscript(text: string): void
  onEnd(mode: CaptureEndMode, text: string): void
}

export interface TranscriptSource {
  capability(): SpeechCapability
  /** Subscribe to capability changes (permission denied, transient failure,
   * recovery). Returns an unsubscribe function. */
  onCapabilityChange(cb: (capability: SpeechCapability) => void): () => void
  /** Begin a capture. Only legal when capability() === 'available'. */
  start(handlers: CaptureHandlers): void
  /** User-initiated stop (mic tap while listening) — cancel semantics:
   * ends the capture via onEnd('cancelled', recognizedSoFar). */
  stop(): void
}

// ---------------------------------------------------------------------------
// Scripted source — test double + the seam backend (window.__assistantSeams)
// ---------------------------------------------------------------------------

export class ScriptedTranscriptSource implements TranscriptSource {
  private cap: SpeechCapability
  private handlers: CaptureHandlers | null = null
  private text = ''
  private readonly listeners = new Set<(c: SpeechCapability) => void>()

  constructor(initial: SpeechCapability = 'available') {
    this.cap = initial
  }

  capability(): SpeechCapability {
    return this.cap
  }

  onCapabilityChange(cb: (capability: SpeechCapability) => void): () => void {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }

  start(handlers: CaptureHandlers): void {
    this.handlers = handlers
    this.text = ''
  }

  stop(): void {
    const h = this.handlers
    this.handlers = null
    h?.onEnd('cancelled', this.text)
  }

  // ---- seam controls ----

  /** Feed recognized-text increments. Each part is the full recognized-so-far
   * text (interim-result semantics — see module header). */
  feed(parts: string[]): void {
    for (const part of parts) {
      this.text = part
      this.handlers?.onTranscript(part)
    }
  }

  end(mode: CaptureEndMode): void {
    const h = this.handlers
    const text = mode === 'speech-end-empty' ? '' : this.text
    this.handlers = null
    h?.onEnd(mode, text)
  }

  setCapability(cap: SpeechCapability): void {
    if (cap === this.cap) return
    this.cap = cap
    // capability loss during a capture behaves as an audio interruption:
    // cancel-while-listening semantics, text preserved (AC-3)
    if (cap !== 'available' && this.handlers !== null) this.stop()
    for (const cb of this.listeners) cb(cap)
  }

  listening(): boolean {
    return this.handlers !== null
  }
}
