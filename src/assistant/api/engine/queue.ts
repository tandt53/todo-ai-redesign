// Per-account FIFO promise queue (ADR-001): a session's turns are processed
// serially in receipt order (AC-10). One open session per account (ADR-005)
// makes account == session ordering. All session-touching operations (turn,
// undo, close, session read) run through the queue; task CRUD does not touch
// sessions and stays direct.

export class AccountQueue {
  private readonly tails = new Map<string, Promise<unknown>>()

  run<T>(key: string, job: () => Promise<T>): Promise<T> {
    const tail = this.tails.get(key) ?? Promise.resolve()
    const next = tail.then(job, job) // previous failure never blocks the queue
    this.tails.set(
      key,
      next.catch(() => undefined),
    )
    return next
  }
}
