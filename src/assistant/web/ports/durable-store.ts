// Web backing for the DurableStore port (src/assistant/_shared/ports/
// durable-store.ts): localStorage, which is what makes `client.pending_input`
// and `client.outgoing_turn` survive a tab close / reload (web floor of F-001
// AC-26 / AC-27).
//
// The port interface and the in-memory test double are platform-neutral and
// live in _shared; only this backing is web-specific.

import type { DurableStore } from '../../_shared/ports/durable-store.ts'

/** localStorage-backed store; every call guarded — storage may be denied. */
export class LocalStorageDurableStore implements DurableStore {
  get(key: string): string | null {
    try {
      return globalThis.localStorage.getItem(key)
    } catch {
      return null
    }
  }
  set(key: string, value: string): void {
    try {
      globalThis.localStorage.setItem(key, value)
    } catch {
      /* storage denied — degrade to in-memory-only for this session */
    }
  }
  remove(key: string): void {
    try {
      globalThis.localStorage.removeItem(key)
    } catch {
      /* ignore */
    }
  }
}
