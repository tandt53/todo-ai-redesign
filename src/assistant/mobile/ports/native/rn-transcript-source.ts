// The device-backed TranscriptSource.
//
// WHAT IS REAL AND WHAT IS A SEAM — read this before judging the file:
//
//   REAL, from React Native core:
//     · Android permissions  — `PermissionsAndroid`, including the
//       never_ask_again → `permanently_denied` mapping AC-3 turns on.
//     · The Settings deep link — `Linking.openSettings()`, both platforms.
//
//   A DECLARED SEAM, because RN core ships no speech API:
//     · `NativeSpeechModule` — recognition, iOS's two authorisations
//       (AVAudioSession + SFSpeechRecognizer) and audio-session release. Its
//       native half is out of scope this phase (ADR-001: prototype-grade, no
//       store build), and the app degrades HONESTLY without it: no module means
//       no recognizer, which F-001 AC-20 already specifies as "hide the mic,
//       no error". Typing is unaffected.
//
// Nothing here is invented API surface: the interface below is exactly what
// the model needs, and the unit tier drives the same interface through
// `FakeMobileTranscriptSource`.

import { Linking, PermissionsAndroid, Platform } from 'react-native'
import type { CaptureHandlers, SpeechCapability } from '../../../_shared/ports/transcript-source.ts'
import type { PermissionState, PermissionStatus } from '../../../_shared/model/client-stores.ts'
import { INTERFACE_LANGUAGE } from '../../../_shared/model/client-stores.ts'
import type { CaptureSignals, MobilePlatform } from '../../model/permissions.ts'
import { canRequest, speechCapabilityFrom } from '../../model/permissions.ts'
import type { MobileTranscriptSource, PermissionRequestResult } from '../transcript-source.ts'

export interface NativeSpeechModule {
  /** Does this device have a recognizer at all? (F-001 AC-20) */
  isRecognizerAvailable(): Promise<boolean>
  /** Is there an on-device pack for this locale? (F-003 AC-4) */
  isLanguageAvailable(locale: string): Promise<boolean>
  /** iOS: microphone + speech recognition. Android: this may return null and
   * the source falls back to PermissionsAndroid. */
  getPermissions(): Promise<PermissionState | null>
  requestPermissions(): Promise<PermissionRequestResult | null>
  start(locale: string): Promise<void>
  stop(): Promise<void>
  /** AC-7: hand the audio session back to the interrupting app. */
  releaseAudioSession(): Promise<void>
  onTranscript(cb: (text: string) => void): () => void
  onEnd(cb: (mode: 'speech-end' | 'speech-end-empty' | 'cancelled') => void): () => void
  onError(cb: (kind: 'permission' | 'transient') => void): () => void
}

function androidStatus(result: string): PermissionStatus {
  if (result === PermissionsAndroid.RESULTS.GRANTED) return 'granted'
  // never_ask_again is the state where the OS will not show the prompt again —
  // AC-3's distinct path, and the reason the CTA has two branches.
  if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) return 'permanently_denied'
  return 'denied'
}

export class RNTranscriptSource implements MobileTranscriptSource {
  readonly platform: MobilePlatform
  private readonly native: NativeSpeechModule | null
  private readonly locale: string
  private perms: PermissionState
  private recognizer = false
  private languagePack = true
  private transient = false
  private handlers: CaptureHandlers | null = null
  private text = ''
  private readonly listeners = new Set<(c: SpeechCapability) => void>()
  private readonly unsubscribes: (() => void)[] = []

  /**
   * `locale` is a test seam, not a second source. AC-23: the recognizer
   * declares its language from the ONE declared value
   * (`client.interface_language`), never from a constant of its own — this port
   * used to hardcode `'vi-VN'`, and correcting that literal to `'en-US'` would
   * have left the AC just as violated, because the defect is the second source
   * rather than the value in it. The app shell no longer supplies a locale at
   * all (see `boot.ts`), so in production this is always the declared value.
   */
  constructor(opts: { native?: NativeSpeechModule | null; locale?: string } = {}) {
    this.platform = Platform.OS === 'ios' ? 'ios' : 'android'
    this.native = opts.native ?? null
    this.locale = opts.locale ?? INTERFACE_LANGUAGE
    this.perms =
      this.platform === 'ios'
        ? { microphone: 'undetermined', speech_recognition: 'undetermined' }
        : { microphone: 'undetermined' }
    if (this.native !== null) this.bind(this.native)
  }

  private bind(native: NativeSpeechModule): void {
    this.unsubscribes.push(
      native.onTranscript((text) => {
        this.text = text
        this.handlers?.onTranscript(text)
      }),
      native.onEnd((mode) => {
        const h = this.handlers
        this.handlers = null
        h?.onEnd(mode, mode === 'speech-end-empty' ? '' : this.text)
      }),
      native.onError((kind) => {
        if (kind === 'permission') void this.refreshPermissions()
        else {
          this.transient = true
          this.emit()
        }
      }),
    )
  }

  /** Probe the device once at boot; capability is derived, never asserted. */
  async prime(): Promise<void> {
    if (this.native !== null) {
      this.recognizer = await this.native.isRecognizerAvailable()
      this.languagePack = this.recognizer
        ? await this.native.isLanguageAvailable(this.locale)
        : false
    }
    await this.refreshPermissions()
  }

  private signals(): CaptureSignals {
    return {
      platform: this.platform,
      permissions: this.perms,
      recognizerAvailable: this.recognizer,
      languagePackAvailable: this.languagePack && !this.transient,
    }
  }

  capability(): SpeechCapability {
    return speechCapabilityFrom(this.signals())
  }

  private emit(): void {
    const cap = this.capability()
    for (const cb of this.listeners) cb(cap)
  }

  onCapabilityChange(cb: (capability: SpeechCapability) => void): () => void {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }

  permissions(): PermissionState {
    return this.perms
  }

  async refreshPermissions(): Promise<PermissionState> {
    if (this.platform === 'android') {
      const granted = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      )
      // `check` cannot distinguish "not asked" from "denied"; a recorded
      // decision therefore wins over the probe.
      if (granted) this.perms = { microphone: 'granted' }
      else if (this.perms.microphone === 'granted') this.perms = { microphone: 'denied' }
    } else {
      const fromNative = (await this.native?.getPermissions()) ?? null
      if (fromNative !== null) this.perms = fromNative
    }
    this.emit()
    return this.perms
  }

  async requestPermissions(): Promise<PermissionRequestResult> {
    if (!canRequest(this.platform, this.perms)) {
      // The OS will show nothing — AC-3's dead-button case.
      return { state: this.perms, prompted: false }
    }
    if (this.platform === 'android') {
      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        {
          // The rationale text is AND-ASK's published body (components.md
          // § Permission copy); `buttonPositive` must stay "Allow", because
          // AND-DENIED's body tells the user to "choose Allow" by name.
          title: 'Microphone for todo-ai',
          message:
            'todo-ai needs Microphone to hear what you say and write it down. Your words become text on the device itself.',
          buttonPositive: 'Allow',
          buttonNegative: 'Not now',
        },
      )
      this.perms = { microphone: androidStatus(result) }
      this.emit()
      return { state: this.perms, prompted: true }
    }
    // iOS: ONE call covering both authorisations, behind the caller's single
    // explanation (AC-2).
    const res = (await this.native?.requestPermissions()) ?? null
    if (res !== null) this.perms = res.state
    this.emit()
    return res ?? { state: this.perms, prompted: false }
  }

  start(handlers: CaptureHandlers): void {
    if (this.capability() !== 'available' || this.native === null) return
    this.handlers = handlers
    this.text = ''
    void this.native.start(this.locale).catch(() => {
      const h = this.handlers
      this.handlers = null
      h?.onEnd('speech-end-empty', '')
    })
  }

  stop(): void {
    if (this.native === null) {
      const h = this.handlers
      this.handlers = null
      h?.onEnd('cancelled', this.text)
      return
    }
    void this.native.stop()
  }

  releaseAudioSession(): void {
    void this.native?.releaseAudioSession()
  }

  async openSettings(): Promise<void> {
    await Linking.openSettings()
  }

  recognizerAvailable(): boolean {
    return this.recognizer
  }

  languagePackAvailable(): boolean {
    return this.languagePack && !this.transient
  }

  /** A transient failure clears when the recognizer next succeeds; the mic
   * returns to available on its own (F-001 AC-22). */
  clearTransient(): void {
    if (!this.transient) return
    this.transient = false
    this.emit()
  }

  dispose(): void {
    for (const un of this.unsubscribes) un()
    this.unsubscribes.length = 0
    this.listeners.clear()
  }
}
