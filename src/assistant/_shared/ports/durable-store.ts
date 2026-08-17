// DurableStore port (platform web.md / mobile.md): backs the client contracts
// from data-model.md §Client-side stores — `client.pending_input`,
// `client.outgoing_turn` and (mobile) `client.permission_state` — which must
// survive tab close/reload on web (web floor of F-001 AC-26/AC-27) and
// **process kill** on mobile (F-003 AC-5/AC-6).
//
// The port is deliberately SYNCHRONOUS: the reducer and controller read the
// stores inside state transitions, so an await there would let the surface
// render a state the store has not caught up with. Platform backings that are
// natively async (React Native AsyncStorage) hydrate a snapshot at boot and
// write through in the background — see
// src/assistant/mobile/ports/durable-store.ts.
//
// Real implementations live per platform (web: localStorage; mobile: hydrated
// AsyncStorage). Tests inject MemoryDurableStore.

export interface DurableStore {
  get(key: string): string | null
  set(key: string, value: string): void
  remove(key: string): void
}

/** Test double. */
export class MemoryDurableStore implements DurableStore {
  private readonly map = new Map<string, string>()
  get(key: string): string | null {
    return this.map.get(key) ?? null
  }
  set(key: string, value: string): void {
    this.map.set(key, value)
  }
  remove(key: string): void {
    this.map.delete(key)
  }
}
