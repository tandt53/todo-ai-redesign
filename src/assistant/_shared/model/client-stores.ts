// Typed wrappers over DurableStore for the client contracts in
// specs/assistant/data-model.md §Client-side stores. Keys are namespaced per
// user so QA's per-TC users never share state (_qa-foundations §10).
//
// - client.pending_input  {text, updated_at} — survives tab close/reload;
//   reopens into the composer (web floor of AC-26).
// - client.outgoing_turn  full POST /assistant/turn payload + {sent_at,
//   attempts} — held until the server acks its client_turn_id (2xx or
//   terminal 4xx); survives reload; drives retry-with-same-id (AC-16) and the
//   visible offline replay (AC-25, web floor of AC-27). At most one is held —
//   the composer is the queue of length one.
// - local tasks — the offline no-AI create path (AC-25, ADR-7): tasks saved
//   on this device only.

import type { DurableStore } from '../ports/durable-store.ts'
import type { TaskView, TurnRequestBody } from '../types.ts'

export interface PendingInput {
  text: string
  updated_at: string
}

export interface OutgoingTurn {
  body: TurnRequestBody
  sent_at: string
  attempts: number
}

/** `client.permission_state` (data-model.md §Client-side stores; F-003 Data).
 * `permanently_denied` is reachable on Android only — it is the state where the
 * OS will never show the prompt again, so the CTA must route to app settings
 * instead of re-requesting (AC-3). */
export type PermissionStatus = 'granted' | 'denied' | 'permanently_denied' | 'undetermined'

export interface PermissionState {
  microphone: PermissionStatus
  /** iOS only — Android needs a single RECORD_AUDIO grant, web one prompt. */
  speech_recognition?: PermissionStatus
}

export const UNDETERMINED_IOS: PermissionState = {
  microphone: 'undetermined',
  speech_recognition: 'undetermined',
}

export const UNDETERMINED_ANDROID: PermissionState = { microphone: 'undetermined' }

function read<T>(store: DurableStore, key: string): T | null {
  const raw = store.get(key)
  if (raw === null) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export class ClientStores {
  private readonly store: DurableStore
  private readonly prefix: string

  constructor(store: DurableStore, userId: string) {
    this.store = store
    this.prefix = `assistant.${userId}`
  }

  // ---- client.pending_input ----

  pendingInput(): string {
    return read<PendingInput>(this.store, `${this.prefix}.pending_input`)?.text ?? ''
  }

  savePendingInput(text: string, now: () => string): void {
    if (text === '') {
      this.store.remove(`${this.prefix}.pending_input`)
      return
    }
    this.store.set(
      `${this.prefix}.pending_input`,
      JSON.stringify({ text, updated_at: now() } satisfies PendingInput),
    )
  }

  // ---- client.outgoing_turn ----

  outgoingTurn(): OutgoingTurn | null {
    return read<OutgoingTurn>(this.store, `${this.prefix}.outgoing_turn`)
  }

  saveOutgoingTurn(rec: OutgoingTurn): void {
    this.store.set(`${this.prefix}.outgoing_turn`, JSON.stringify(rec))
  }

  /** Ack rule (data-model): 2xx (incl. replayed) or terminal 4xx clears;
   * 502 AI_ERROR / network failure keeps it for a same-id retry. */
  clearOutgoingTurn(): void {
    this.store.remove(`${this.prefix}.outgoing_turn`)
  }

  // ---- client.permission_state (mobile; F-003 AC-2 / AC-3) ----

  /** null = never recorded on this device. The OS is still the authority: the
   * mobile controller re-reads the live permission surface at every talk
   * attempt and writes the result back here — this store exists so a cold
   * open knows the mic mode before the first tap, not to replace the OS. */
  permissionState(): PermissionState | null {
    return read<PermissionState>(this.store, `${this.prefix}.permission_state`)
  }

  savePermissionState(state: PermissionState): void {
    this.store.set(`${this.prefix}.permission_state`, JSON.stringify(state))
  }

  // ---- local (device-only) tasks — offline no-AI path ----

  localTasks(): TaskView[] {
    return read<TaskView[]>(this.store, `${this.prefix}.local_tasks`) ?? []
  }

  saveLocalTasks(tasks: TaskView[]): void {
    if (tasks.length === 0) this.store.remove(`${this.prefix}.local_tasks`)
    else this.store.set(`${this.prefix}.local_tasks`, JSON.stringify(tasks))
  }
}
