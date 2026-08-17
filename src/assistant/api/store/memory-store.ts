// In-memory store with optional JSON file snapshot (ADR-001: memory + JSON
// snapshot at data/assistant.json behind the Store port). Not crash-safe, not
// multi-user-scale — accepted for the phase; this adapter is the seam a real
// database replaces.

import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname } from 'node:path'
import type { Store, StoreState } from './store.ts'
import { emptyState } from './store.ts'

export interface MemoryStoreOpts {
  /** when set, state is loaded from / written to this JSON file */
  snapshotPath?: string
  initial?: StoreState
}

export class MemoryStore implements Store {
  private state: StoreState
  private readonly snapshotPath: string | undefined

  constructor(opts: MemoryStoreOpts = {}) {
    this.snapshotPath = opts.snapshotPath
    if (opts.initial !== undefined) {
      this.state = opts.initial
    } else if (this.snapshotPath !== undefined && existsSync(this.snapshotPath)) {
      this.state = JSON.parse(readFileSync(this.snapshotPath, 'utf8')) as StoreState
    } else {
      this.state = emptyState()
    }
  }

  read<T>(fn: (state: StoreState) => T): T {
    return fn(this.state)
  }

  transact<T>(fn: (state: StoreState) => T): T {
    const draft = structuredClone(this.state)
    const result = fn(draft) // a throw here propagates; this.state is untouched
    this.state = draft
    this.snapshot()
    return result
  }

  private snapshot(): void {
    if (this.snapshotPath === undefined) return
    mkdirSync(dirname(this.snapshotPath), { recursive: true })
    writeFileSync(this.snapshotPath, JSON.stringify(this.state, null, 2))
  }
}
