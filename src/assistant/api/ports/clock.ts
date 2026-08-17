// Clock port (ADR-001/ADR-004): injectable so idle-close paths run in test
// time — no real waiting anywhere in the suite.

export interface Clock {
  /** epoch milliseconds */
  now(): number
}

export const systemClock: Clock = { now: () => Date.now() }

/** Deterministic clock for tests and QA's harness. */
export class FakeClock implements Clock {
  private t: number

  constructor(startAt: number | string = '2026-08-16T00:00:00.000Z') {
    this.t = typeof startAt === 'string' ? Date.parse(startAt) : startAt
  }

  now(): number {
    return this.t
  }

  advance(ms: number): void {
    this.t += ms
  }

  set(at: number | string): void {
    this.t = typeof at === 'string' ? Date.parse(at) : at
  }
}
