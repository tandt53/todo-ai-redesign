# TC-024: Kill while listening — recognized-so-far text survives the process kill and reopens into the composer

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-024 |
| Feature | F-003 (mobile-surface) |
| Platform | mobile |
| Acceptance criteria | AC-5, F-001 AC-26 |
| Type | edge |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | tests/assistant/mobile/F-003-mobile-surface.spec.ts |
| Targets | ios, android |
| Tier | node-headless (store outlives the model) + device-lab (real OS memory-pressure kill) |
| Created | 2026-08-16 by qa-mobile-agent |
| Last updated | 2026-08-17 by qa-mobile-agent |

## Summary
One of the two ACs this whole feature exists to deliver. **Mechanism being verified:** recognized-so-far text is written to the `client.pending_input` store as it is recognized — not on a graceful teardown handler — so that when the OS kills the process without warning, the text is already on disk and the next cold open restores it into the composer. A save-on-unmount implementation passes a graceful-background test and loses the words on a real kill.

## Preconditions
- Account `qamob-tc024@qa.example.com`; `DurableStore` double whose contents **outlive** the model instance (this is the node-tier stand-in for a process kill — a fresh model is constructed against the same store).
- `TranscriptSource` emitting partial results.

## Test steps
1. Tap the mic; emit two partial recognition results.
2. **Without** any background or teardown callback, discard the model instance and construct a fresh one against the same `DurableStore` (= process kill).
3. Read the composer of the fresh instance.
4. Assert no turn was ever sent for the killed listening session.
5. Repeat with the kill occurring **between** partial results, and with a kill immediately after the first partial.
6. Repeat the whole flow with a graceful background → kill sequence.

## Expected behaviour
- The fresh instance's composer holds the recognized-so-far text — equal to the **latest** partial that had been recognized before the kill, not an earlier one and not empty.
- The restored value is text only. `client.pending_input` never holds audio (data table: "text only, never audio").
- No turn was sent: the request spy records zero `POST /assistant/turn`. Listening that never ended does not become a turn.
- The store write does **not** depend on a teardown hook: step 2 deliberately provides none, and the test still passes. If it only passes in step 6 (graceful path), that is the defect this TC exists to find.
- The restored composer is editable and sendable — the user continues rather than restarts.
- `client.pending_input` carries `updated_at`; the restored entry is the newest.

## Test data
| Field | Value |
|-------|-------|
| user | qamob-tc024@qa.example.com |
| partials | `["mua", "mua sữa cho", "mua sữa cho ngày mai"]` |

## Notes
**Device-lab residue:** a real OS memory-pressure kill (and an iOS jetsam / Android low-memory kill in particular) cannot happen in node. This tier proves the ACs' stated observable — that the store's contents outlive the model — which is exactly what the spec's Test strategy authorises. The real-kill pass remains owed and is listed as debt in `index.md`.
