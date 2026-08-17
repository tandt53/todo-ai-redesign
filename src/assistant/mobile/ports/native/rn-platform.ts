// Device backings for AppLifecycle, Connectivity and Announcer.
//
// AppState, BackHandler, Keyboard and AccessibilityInfo are all React Native
// core, so the lifecycle port is real code end to end — the only seams are the
// two things core does not ship: audio-interruption events (they come from the
// same native speech module as recognition) and network reachability (a
// NetInfo-shaped module, injected). Both degrade the way the ACs prescribe:
// no audio module means no interruption events to miss, and no NetInfo means
// the client assumes online and finds out through a failed request, which is
// exactly F-001 AC-25's queue-and-replay path.

import { AccessibilityInfo, AppState, BackHandler, Keyboard, Platform } from 'react-native'
import type { AppVisibility, AudioInterruptionReason } from '../../model/lifecycle.ts'
import type {
  Announcer,
  AppLifecycle,
  AudioInterruptionEvent,
  Connectivity,
  Unsubscribe,
} from '../app-lifecycle.ts'

/** The audio half of the native speech module (AVAudioSession interruption
 * notifications on iOS, AudioManager focus changes on Android). */
export interface NativeAudioEvents {
  onInterruption(
    cb: (e: { phase: 'began' | 'ended'; reason: AudioInterruptionReason }) => void,
  ): () => void
}

export class RNAppLifecycle implements AppLifecycle {
  private readonly audio: NativeAudioEvents | null

  constructor(opts: { audio?: NativeAudioEvents | null } = {}) {
    this.audio = opts.audio ?? null
  }

  visibility(): AppVisibility {
    const s = AppState.currentState
    return s === 'active' ? 'active' : s === 'background' ? 'background' : 'inactive'
  }

  onVisibilityChange(cb: (v: AppVisibility) => void): Unsubscribe {
    const sub = AppState.addEventListener('change', (s) => {
      cb(s === 'active' ? 'active' : s === 'background' ? 'background' : 'inactive')
    })
    return () => sub.remove()
  }

  onAudioInterruption(cb: (e: AudioInterruptionEvent) => void): Unsubscribe {
    if (this.audio === null) return () => {}
    return this.audio.onInterruption((e) => cb({ phase: e.phase, reason: e.reason }))
  }

  /** AC-11: Android's hardware back. iOS's back-swipe is a navigator gesture,
   * so the navigator calls `controller.handleBack()` directly there — the port
   * shape is the same either way. */
  onNavigateBack(cb: () => boolean): Unsubscribe {
    if (Platform.OS !== 'android') return () => {}
    const sub = BackHandler.addEventListener('hardwareBackPress', cb)
    return () => sub.remove()
  }

  onKeyboardChange(cb: (visible: boolean) => void): Unsubscribe {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide'
    const show = Keyboard.addListener(showEvent, () => cb(true))
    const hide = Keyboard.addListener(hideEvent, () => cb(false))
    return () => {
      show.remove()
      hide.remove()
    }
  }
}

/** The NetInfo surface this app uses — injected rather than depended on, so
 * the library choice stays the app shell's to make. */
export interface NetInfoLike {
  fetch(): Promise<{ isConnected: boolean | null }>
  addEventListener(cb: (state: { isConnected: boolean | null }) => void): () => void
}

export class RNConnectivity implements Connectivity {
  private online = true
  private readonly listeners = new Set<(online: boolean) => void>()
  private unsubscribe: (() => void) | null = null

  constructor(private readonly netInfo: NetInfoLike | null = null) {
    if (netInfo === null) return
    this.unsubscribe = netInfo.addEventListener((s) => {
      const next = s.isConnected !== false
      if (next === this.online) return
      this.online = next
      for (const cb of this.listeners) cb(next)
    })
  }

  async prime(): Promise<void> {
    if (this.netInfo === null) return
    const s = await this.netInfo.fetch()
    this.online = s.isConnected !== false
  }

  isOnline(): boolean {
    return this.online
  }

  onChange(cb: (online: boolean) => void): Unsubscribe {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }

  dispose(): void {
    this.unsubscribe?.()
    this.listeners.clear()
  }
}

/** AC-12: announcements go out through the platform's own screen-reader
 * channel and never move focus. `queue: false` is the assertive branch — an
 * error interrupts rather than waiting behind earlier output. */
export class RNAnnouncer implements Announcer {
  announce(text: string, opts: { assertive: boolean }): void {
    const withOptions = AccessibilityInfo as unknown as {
      announceForAccessibilityWithOptions?: (
        announcement: string,
        options: { queue: boolean },
      ) => void
    }
    if (typeof withOptions.announceForAccessibilityWithOptions === 'function') {
      withOptions.announceForAccessibilityWithOptions(text, { queue: !opts.assertive })
      return
    }
    AccessibilityInfo.announceForAccessibility(text)
  }
}
