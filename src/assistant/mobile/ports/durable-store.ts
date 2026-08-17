// Kill-surviving storage — F-003 AC-5 and AC-6.
//
// React Native's storage APIs (AsyncStorage, MMKV's async surface) are
// promise-based, while the shared DurableStore port is synchronous on purpose:
// the controller reads `client.pending_input` and `client.outgoing_turn`
// inside state transitions, and an await there would let the surface render a
// state the store has not caught up with.
//
// `HydratedDurableStore` bridges the two: one async read at boot mirrors the
// namespace into memory, reads are served from the mirror, and writes go
// through to the device in the background. That is the whole trick, and it is
// also why the ACs are testable without a real process kill — the observable
// AC-5/AC-6 actually name is "the contents outlive the model", so a fresh
// store opened over the SAME backend reproduces a cold start exactly.
//
// Open Question 1 in the spec (AsyncStorage vs MMKV) stays open by design:
// `AsyncKeyValueBackend` is the whole surface either library has to satisfy.

import type { DurableStore } from '../../_shared/ports/durable-store.ts'

/** The subset of AsyncStorage (and of MMKV's async API) this app uses. */
export interface AsyncKeyValueBackend {
  getAllKeys(): Promise<readonly string[]>
  multiGet(keys: readonly string[]): Promise<readonly (readonly [string, string | null])[]>
  setItem(key: string, value: string): Promise<void>
  removeItem(key: string): Promise<void>
}

export class HydratedDurableStore implements DurableStore {
  private readonly backend: AsyncKeyValueBackend
  private readonly mirror = new Map<string, string>()
  private pending: Promise<unknown> = Promise.resolve()
  /** Writes that failed on the device. Non-empty means this session's
   * durability guarantee is broken and the caller should say so rather than
   * pretend — see `failedWrites()`. */
  private readonly failures: string[] = []

  /** Prefer `HydratedDurableStore.open()` — it mirrors what is already on the
   * device before the first read. Constructing directly gives a store with an
   * EMPTY mirror that still writes through, which is the right shape for a
   * first launch (and for a test that wants no prior contents), and the wrong
   * one for a relaunch. */
  constructor(backend: AsyncKeyValueBackend) {
    this.backend = backend
  }

  /** Cold start: read the device once, then serve synchronously. Call before
   * the first render — the controller's init() does. */
  static async open(backend: AsyncKeyValueBackend): Promise<HydratedDurableStore> {
    const store = new HydratedDurableStore(backend)
    try {
      const keys = await backend.getAllKeys()
      const entries = await backend.multiGet(keys)
      for (const [key, value] of entries) {
        if (value !== null) store.mirror.set(key, value)
      }
    } catch {
      // A storage read that fails leaves an empty mirror: the app starts clean
      // rather than half-restored. Nothing is lost that was not already lost.
    }
    return store
  }

  get(key: string): string | null {
    return this.mirror.get(key) ?? null
  }

  set(key: string, value: string): void {
    this.mirror.set(key, value)
    this.enqueue(key, () => this.backend.setItem(key, value))
  }

  remove(key: string): void {
    this.mirror.delete(key)
    this.enqueue(key, () => this.backend.removeItem(key))
  }

  /** Writes are serialized: two writes to one key must land in order, or a
   * kill between them could resurrect the older value. */
  private enqueue(key: string, op: () => Promise<void>): void {
    this.pending = this.pending.then(op).catch(() => {
      this.failures.push(key)
    })
  }

  /** Await the write queue. Production never needs this (the point is that
   * callers do not wait); tests and a deliberate background flush do. */
  async flush(): Promise<void> {
    await this.pending
  }

  failedWrites(): readonly string[] {
    return this.failures
  }
}

/** In-memory backend — the device that survives the process. Handing the SAME
 * instance to a second `HydratedDurableStore.open()` is what "the app was
 * killed and reopened" means in the unit tier. */
export class MemoryAsyncBackend implements AsyncKeyValueBackend {
  private readonly map = new Map<string, string>()
  /** set true to simulate a device whose storage is unavailable */
  failing = false

  async getAllKeys(): Promise<readonly string[]> {
    if (this.failing) throw new Error('storage unavailable')
    return [...this.map.keys()]
  }

  async multiGet(keys: readonly string[]): Promise<readonly (readonly [string, string | null])[]> {
    if (this.failing) throw new Error('storage unavailable')
    return keys.map((k) => [k, this.map.get(k) ?? null] as const)
  }

  async setItem(key: string, value: string): Promise<void> {
    if (this.failing) throw new Error('storage unavailable')
    this.map.set(key, value)
  }

  async removeItem(key: string): Promise<void> {
    if (this.failing) throw new Error('storage unavailable')
    this.map.delete(key)
  }

  /** What is actually on the device right now. */
  snapshot(): Record<string, string> {
    return Object.fromEntries(this.map)
  }
}
