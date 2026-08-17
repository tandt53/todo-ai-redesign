# ADR-001 — What "prototype-grade server" concretely means

**Status:** accepted · 2026-08-16 · architect-agent (T-004)

## Context

MANIFEST declares "prototype-grade, no real backend this phase", but F-001's
spec carries server-side contract sentences that QA's API suite must exercise
for real: serial turn processing, per-status dedupe, undo enforcement in one
transaction, and boundary outcomes on `GET /assistant/session`. Something has
to actually run those rules — a mocked server would mean the suite tests the
mock (the spec's anti-stub rule).

## Options considered

1. **No server at all — contract tests against a mock.** Cheapest, but every
   green test would be testing the mock; AC-1/6/7/10/12/16/28 are all
   server-enforced. Rejected.
2. **In-process Node/TS HTTP app (`node:http`), in-memory store + JSON file
   snapshot, injectable ports.** Real enforcement, zero infrastructure, tests
   run in-process via supertest. Chosen.
3. **Real stack now (Postgres/Supabase edge functions).** Honest but violates
   the phase constraint; slows every implementer and QA loop. Rejected.

## Decision

The prototype server is a **local, in-process Node ≥ 20 TypeScript HTTP app**
(`node:http`, no framework) at `src/assistant/api/`:

- **Store port** with one adapter: in-memory maps + JSON snapshot at
  `data/assistant.json` (dev persistence). "Transaction" = a synchronous
  mutation applied atomically to the in-memory state and snapshotted after;
  the apply/undo paths must not interleave partial writes (AC-1, AC-6).
- **Serial processing**: a per-account FIFO promise queue; a session's turns
  are processed serially in receipt order (AC-10). Interpretation context is
  read inside the queue slot (OQ 7).
- **Injectable ports**: `Interpreter` (real Anthropic client vs fixture
  stub — the stub owns answer classification per the spec's Test strategy),
  `Clock`, `idleCloseMs` config (ADR-004), `Store`. The harness wraps
  `Interpreter` with a call counter for the zero-AI-call assertions (AC-18,
  AC-25).
- **Minimal task CRUD** (`/tasks…`) so the manual path and read-back
  observables run against real endpoints (api-contracts.md).
- Auth is a stub: `X-User-Id` header = account. Good enough for namespaced
  QA test data; replaced when a real backend phase starts.

## Consequences

- QA's API suite runs the real rules (supertest, in-process, fixture
  Interpreter) — a green suite means the contract, not a mock, passed.
- No real concurrency across processes: the serial queue is trivially correct
  in-process. A future real backend must re-prove AC-10/AC-16 under real
  concurrency; this ADR does not carry over.
- JSON snapshot is not crash-safe and not multi-user-scale. Accepted for the
  phase; the Store port is the seam a real database replaces.
