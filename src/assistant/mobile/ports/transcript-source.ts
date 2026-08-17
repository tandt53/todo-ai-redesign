// The mobile TranscriptSource — the shared speech port plus the surface the
// OS owns and a browser does not: two permission models, an audio session
// another app can take, and a Settings deep link.
//
// The base port (src/assistant/_shared/ports/transcript-source.ts) is
// unchanged and still carries all of F-001's capture semantics. Everything
// added here is F-003's: AC-2 (iOS dual grant), AC-3 (Android single grant +
// permanently-denied), AC-4 (recognizer without a language pack), AC-7 (audio
// session release).
//
// The double at the bottom is what makes the spec's enumerated permission
// matrix runnable under node — iOS ×4, Android ×3, no-capability, transient
// (F-003 Test strategy). Nothing native is imported in this file.

import type {
  CaptureHandlers,
  SpeechCapability,
  TranscriptSource,
} from '../../_shared/ports/transcript-source.ts'
import { ScriptedTranscriptSource } from '../../_shared/ports/transcript-source.ts'
import type { PermissionState } from '../../_shared/model/client-stores.ts'
import type { CaptureSignals, MobilePlatform } from '../model/permissions.ts'
import { canRequest, speechCapabilityFrom } from '../model/permissions.ts'

export interface PermissionRequestResult {
  state: PermissionState
  /** false = the OS was NOT shown to the user. Either every grant is already
   * decided, or the platform will never ask again (Android permanently
   * denied / any answered iOS dialog). AC-3 turns on this distinction: a CTA
   * that "re-requests" in that state is a button that does nothing. */
  prompted: boolean
}

export interface MobileTranscriptSource extends TranscriptSource {
  readonly platform: MobilePlatform
  /** Last known OS permission state. Cheap and synchronous — the controller
   * reads it on every render path. */
  permissions(): PermissionState
  /** Ask the OS, once, behind the caller's own explanation (AC-2: never at
   * app open). Returns the post-answer state and whether a dialog appeared. */
  requestPermissions(): Promise<PermissionRequestResult>
  /** Re-read the OS without prompting — a foreground transition may find the
   * user changed the grant in Settings while we were backgrounded. */
  refreshPermissions(): Promise<PermissionState>
  /** AC-7: hand the audio session back so the interrupting app (a call, the
   * system assistant) is not blocked by us holding it. */
  releaseAudioSession(): void
  /** AC-2 / AC-3: the CTA's other branch — the app's own Settings page (iOS)
   * or App info → Permissions (Android). */
  openSettings(): Promise<void>
  /** F-001 AC-20: no recognizer on this device → mic hidden, no error. */
  recognizerAvailable(): boolean
  /** F-003 AC-4: recognizer present, no pack for the interface language →
   * transient (dimmed, cause stated), NOT no-capability. */
  languagePackAvailable(): boolean
}

// ---------------------------------------------------------------------------
// Test double — the whole permission matrix, no device
// ---------------------------------------------------------------------------

export interface FakeMobileSourceOptions {
  platform: MobilePlatform
  permissions?: PermissionState
  recognizerAvailable?: boolean
  languagePackAvailable?: boolean
  /** What the OS dialog returns when it IS shown. Defaults to granting every
   * required grant. */
  grantOn?: (current: PermissionState) => PermissionState
}

function defaultPermissions(platform: MobilePlatform): PermissionState {
  return platform === 'ios'
    ? { microphone: 'undetermined', speech_recognition: 'undetermined' }
    : { microphone: 'undetermined' }
}

function grantAll(platform: MobilePlatform): PermissionState {
  return platform === 'ios'
    ? { microphone: 'granted', speech_recognition: 'granted' }
    : { microphone: 'granted' }
}

export class FakeMobileTranscriptSource
  extends ScriptedTranscriptSource
  implements MobileTranscriptSource
{
  readonly platform: MobilePlatform
  private perms: PermissionState
  private recognizer: boolean
  private languagePack: boolean
  private readonly grantOn: (current: PermissionState) => PermissionState

  /** Observations the tests assert on. */
  readonly log = {
    /** how many times an OS dialog was actually put on screen */
    prompts: 0,
    /** how many times requestPermissions() was called at all */
    requests: 0,
    settingsOpened: 0,
    audioSessionReleases: 0,
  }

  constructor(opts: FakeMobileSourceOptions) {
    super('available')
    this.platform = opts.platform
    this.perms = opts.permissions ?? defaultPermissions(opts.platform)
    this.recognizer = opts.recognizerAvailable ?? true
    this.languagePack = opts.languagePackAvailable ?? true
    this.grantOn = opts.grantOn ?? (() => grantAll(opts.platform))
    this.sync()
  }

  private signals(): CaptureSignals {
    return {
      platform: this.platform,
      permissions: this.perms,
      recognizerAvailable: this.recognizer,
      languagePackAvailable: this.languagePack,
    }
  }

  /** Capability is DERIVED, never set by hand: the same mapping the real
   * source uses (model/permissions.ts), so a matrix row cannot be made to
   * "pass" by asserting a capability the mapping would not produce. */
  private sync(): void {
    this.setCapability(speechCapabilityFrom(this.signals()))
  }

  override capability(): SpeechCapability {
    return speechCapabilityFrom(this.signals())
  }

  permissions(): PermissionState {
    return this.perms
  }

  async requestPermissions(): Promise<PermissionRequestResult> {
    this.log.requests += 1
    if (!canRequest(this.platform, this.perms)) {
      // The OS will not show anything — this is the dead-button case AC-3
      // names, and the reason the CTA has two branches.
      return { state: this.perms, prompted: false }
    }
    this.log.prompts += 1
    this.perms = this.grantOn(this.perms)
    this.sync()
    return { state: this.perms, prompted: true }
  }

  async refreshPermissions(): Promise<PermissionState> {
    this.sync()
    return this.perms
  }

  releaseAudioSession(): void {
    this.log.audioSessionReleases += 1
  }

  async openSettings(): Promise<void> {
    this.log.settingsOpened += 1
  }

  recognizerAvailable(): boolean {
    return this.recognizer
  }

  languagePackAvailable(): boolean {
    return this.languagePack
  }

  override start(handlers: CaptureHandlers): void {
    // A capture may only begin when the derived capability allows it — the
    // same guard the real recognizer applies, so a test cannot listen through
    // a denied permission.
    if (this.capability() !== 'available') return
    super.start(handlers)
  }

  // ---- device controls (tests only) ----

  setPermissions(perms: PermissionState): void {
    this.perms = perms
    this.sync()
  }

  setRecognizerAvailable(available: boolean): void {
    this.recognizer = available
    this.sync()
  }

  setLanguagePackAvailable(available: boolean): void {
    this.languagePack = available
    this.sync()
  }
}
