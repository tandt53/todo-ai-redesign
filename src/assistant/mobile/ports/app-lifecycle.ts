// AppLifecycle + Connectivity + Announcer — the three OS event sources the
// conversation has to react to, behind ports so the unit tier can drive them.
//
// AC-5 / AC-6 (background, kill), AC-7 (audio interruption), AC-8 (foreground
// read), AC-10 (keyboard), AC-11 (system back) all enter the controller
// through `AppLifecycle`. AC-4's offline behaviour enters through
// `Connectivity`. AC-12's announcements leave through `Announcer`.

import type { AppVisibility, AudioInterruptionReason } from '../model/lifecycle.ts'

export interface AudioInterruptionEvent {
  phase: 'began' | 'ended'
  reason: AudioInterruptionReason
}

export type Unsubscribe = () => void

export interface AppLifecycle {
  visibility(): AppVisibility
  onVisibilityChange(cb: (v: AppVisibility) => void): Unsubscribe
  /** AC-7: incoming call, system assistant, audio-focus loss, output-route
   * change — all four are the same event to us. */
  onAudioInterruption(cb: (e: AudioInterruptionEvent) => void): Unsubscribe
  /** AC-11: Android system back / iOS back-swipe out of the assistant view.
   * The callback returns true when it handled the event. */
  onNavigateBack(cb: () => boolean): Unsubscribe
  /** AC-10: software keyboard show/hide. */
  onKeyboardChange(cb: (visible: boolean) => void): Unsubscribe
}

export interface Connectivity {
  isOnline(): boolean
  onChange(cb: (online: boolean) => void): Unsubscribe
}

export interface Announcer {
  /** Fire-and-forget; never moves focus (AC-12). */
  announce(text: string, opts: { assertive: boolean }): void
}

// ---------------------------------------------------------------------------
// Doubles
// ---------------------------------------------------------------------------

function emitter<T>() {
  const listeners = new Set<(value: T) => void>()
  return {
    subscribe(cb: (value: T) => void): Unsubscribe {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    emit(value: T): void {
      for (const cb of [...listeners]) cb(value)
    },
    size(): number {
      return listeners.size
    },
  }
}

export class FakeAppLifecycle implements AppLifecycle {
  private state: AppVisibility = 'active'
  private readonly visibilityE = emitter<AppVisibility>()
  private readonly audioE = emitter<AudioInterruptionEvent>()
  private readonly keyboardE = emitter<boolean>()
  private readonly backHandlers: (() => boolean)[] = []

  visibility(): AppVisibility {
    return this.state
  }

  onVisibilityChange(cb: (v: AppVisibility) => void): Unsubscribe {
    return this.visibilityE.subscribe(cb)
  }

  onAudioInterruption(cb: (e: AudioInterruptionEvent) => void): Unsubscribe {
    return this.audioE.subscribe(cb)
  }

  onNavigateBack(cb: () => boolean): Unsubscribe {
    this.backHandlers.unshift(cb)
    return () => {
      const i = this.backHandlers.indexOf(cb)
      if (i >= 0) this.backHandlers.splice(i, 1)
    }
  }

  onKeyboardChange(cb: (visible: boolean) => void): Unsubscribe {
    return this.keyboardE.subscribe(cb)
  }

  // ---- device controls (tests only) ----

  background(): void {
    this.state = 'background'
    this.visibilityE.emit('background')
  }

  foreground(): void {
    this.state = 'active'
    this.visibilityE.emit('active')
  }

  interrupt(reason: AudioInterruptionReason = 'call'): void {
    this.audioE.emit({ phase: 'began', reason })
  }

  interruptEnded(reason: AudioInterruptionReason = 'call'): void {
    this.audioE.emit({ phase: 'ended', reason })
  }

  keyboard(visible: boolean): void {
    this.keyboardE.emit(visible)
  }

  /** Returns true when some handler consumed the press (Android convention). */
  pressBack(): boolean {
    for (const h of this.backHandlers) {
      if (h()) return true
    }
    return false
  }
}

export class FakeConnectivity implements Connectivity {
  private online: boolean
  private readonly e = emitter<boolean>()

  constructor(online = true) {
    this.online = online
  }

  isOnline(): boolean {
    return this.online
  }

  onChange(cb: (online: boolean) => void): Unsubscribe {
    return this.e.subscribe(cb)
  }

  set(online: boolean): void {
    if (online === this.online) return
    this.online = online
    this.e.emit(online)
  }
}

export class RecordingAnnouncer implements Announcer {
  readonly announcements: { text: string; assertive: boolean }[] = []

  announce(text: string, opts: { assertive: boolean }): void {
    this.announcements.push({ text, assertive: opts.assertive })
  }

  texts(): string[] {
    return this.announcements.map((a) => a.text)
  }

  clear(): void {
    this.announcements.length = 0
  }
}
