# TC-030: Every foreground transition re-reads the session BEFORE accepting new input; local stores reconcile, never override

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-030 |
| Feature | F-003 (mobile-surface) |
| Platform | mobile |
| Acceptance criteria | AC-8, F-001 AC-28 |
| Type | happy |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | tests/assistant/mobile/F-003-mobile-surface.spec.ts |
| Targets | ios, android |
| Tier | node-headless |
| Created | 2026-08-16 by qa-mobile-agent |
| Last updated | 2026-08-17 by qa-mobile-agent |

## Summary
The ordering rule that makes every other lifecycle AC safe: on **every** foreground transition — resume or cold open — the client reads `GET /assistant/session` **before** accepting new input, and renders what the server reports. Local stores reconcile against that read and never override it; the server is the source of truth for conversation history, and `client.pending_input` / `client.outgoing_turn` are the only local survivors.

## Preconditions
- Account `qamob-tc030@qa.example.com`; request spy with ordering; `AppLifecycle` and `DurableStore` doubles.

## Test steps
1. Background, then foreground. Capture the request sequence.
2. Attempt to send a turn **during** the session read (before it resolves).
3. Cold-open (fresh model, populated store). Capture the request sequence.
4. Seed a divergence: the local store holds a stale conversation view while the server reports a different history. Foreground and read the conversation.
5. Confirm `client.pending_input` and `client.outgoing_turn` are still restored after the read.
6. Foreground twice in a row rapidly; count session reads.

## Expected behaviour
- The **first** `/assistant/*` request after every foreground is `GET /assistant/session`. A turn dispatched before it fails this test.
- Step 2: input made during the read is not lost — it is held and dispatched after the read resolves, not dropped and not sent ahead of it.
- Step 3: cold open behaves identically to resume — both are foreground transitions.
- Step 4: the rendered conversation matches the **server's** history. Local state that contradicts the read is discarded, never merged on top.
- Step 5: the two local survivors are still restored — reconciliation is not "wipe everything local".
- Step 6: the surface does not deadlock or double-render; each foreground produces a read and one consistent render.

## Test data
| Field | Value |
|-------|-------|
| user | qamob-tc030@qa.example.com |
| divergence | local cache holds a turn the server does not report |

## Notes
Step 4 is where "offline-first" instincts break the AC. The temptation is to merge local and server history; AC-8 forbids it. Any merge policy is out of scope this iteration (spec, Out of Scope: offline-first sync beyond F-001 AC-25).

## Execution result — 2026-08-17 (T-021, `phase: execute`)

**FAIL on the cold-open half — [BUG-002](../../../_shared/bugs/BUG-002-cold-open-accepts-input-before-session-read.md), layer `mobile`, severity HIGH. Open.**

Resume is correct: `onForeground()` installs a `foregroundSync` gate that `send()`
and `tapMic()` wait on, so the session read genuinely comes first and input made
during it is held rather than dropped (steps 1, 2, 5, 6 all pass).

Cold open is not. `init()` performs the same reconciliation but never installs
the gate, so a turn submitted while the app is starting is dispatched **before**
`GET /assistant/session` is issued. Observed `/assistant/*` order, 3× in
isolation: `POST /assistant/turn`, then `GET /assistant/session`.

The consequence is the part that costs the user something, and it is asserted in
the same test: the racing turn carries `session_id: null`, so it opens a **new**
session — and a previously closed session's boundary message (close marker, every
declined question named with its task titles, every late outcome) is never
rendered at all. Step 3's "cold open behaves identically to resume" is exactly
what fails.

The assertion is left red on purpose. It goes green when BUG-002 is fixed.
