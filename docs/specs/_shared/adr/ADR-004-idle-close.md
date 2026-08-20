# ADR-004 — Idle-close: 180 s, server-owned, lazily evaluated (OQ 2)

**Status:** accepted · 2026-08-16 · architect-agent (T-004)

## Context

Two numbers exist with no measuring instrument: client code uses ~3 min, UC-11
says 2 (11-uc §6.2). The spec requires one number before ship and asks who
owns the timer — server closes on idle vs client requests close — plus an
injectable-timer harness so AC-28's close paths run in test time.

## Options considered

1. **Client-owned timer** (client calls `POST /assistant/session/close` after
   idle). Simple server; but two devices = two timers (ADR-005 shares one
   session per account), a killed app never closes its session, and the
   "stale session starts clean" guarantee would depend on a client that may
   not be running. Rejected.
2. **Server background timer** (setTimeout per session). Correct, but adds
   background state a prototype restart loses, and is harder to make
   deterministic in tests. Rejected.
3. **Server-owned lazy close**: the session stores `last_activity_at`; any
   request that touches the account's session first checks
   `now − last_activity_at ≥ idle_timeout` and, if so, closes it (reason
   `idle`) before handling the request. Chosen.

## Decision

- **Value: 180 s (3 minutes)** — current client behaviour wins over UC-11's
  2 minutes: it is the number real usage has been running on, and nothing
  measured says shorter is better. Revisit only with instrumentation
  (product may retune the constant; the mechanism doesn't change).
- **Owner: the server**, evaluated **lazily** on the next request that
  resolves the account's session (`GET /assistant/session`,
  `POST /assistant/turn`, undo, close). No background timers, no client
  timer. The close writes `close_reason: "idle"`, resolves unanswered
  questions as declined (D2), and populates the boundary — so a clean start
  after idling always renders the AC-28 boundary message.
- **Injectability (harness requirement)**: `idleCloseMs` is server config and
  `Clock` is a port (ADR-001). Tests set a small timeout or advance a fake
  clock; no real waiting. The spec's injectable-timer sentence is satisfied
  server-side; clients contain no idle logic at all.

## Consequences

- "Stale/closed session starts clean" (AC-28) holds even after app kill or
  device switch — the check runs where the truth lives.
- A session's `closed_at` is recorded at detection time, not at minute 3
  exactly; nothing user-visible depends on the difference (no countdown UI —
  the spec forbids hidden timers only for undo, and shows none for idle).
- Client stays dumb: it renders the boundary the server returns. One code
  path for both close reasons.
