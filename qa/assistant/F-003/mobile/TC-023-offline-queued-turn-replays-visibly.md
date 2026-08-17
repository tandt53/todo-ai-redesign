# TC-023: A turn in flight when the connection drops queues and replays visibly under the same id

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-023 |
| Feature | F-003 (mobile-surface) |
| Platform | mobile |
| Acceptance criteria | AC-4, AC-6, F-001 AC-25, F-001 AC-16 |
| Type | edge |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | qa/assistant/automation/mobile/F-003-mobile-surface.spec.ts |
| Targets | ios, android |
| Tier | node-headless |
| Created | 2026-08-16 by qa-mobile-agent |
| Last updated | 2026-08-17 by qa-mobile-agent |

## Summary
The queued-replay half of F-001 AC-25, which on mobile runs through the same `client.outgoing_turn` store that AC-6 makes kill-surviving. The visible part is the point: the user must see that the turn is waiting, and then see its real outcome — not a silent retry that either duplicates the effect or loses it.

## Preconditions
- Account `qamob-tc023@qa.example.com`; `Connectivity` double able to drop mid-request; request spy capturing `client_turn_id`.

## Test steps
1. Send a turn. Drop the connection while it is in flight.
2. Read the surface: state, the turn's bubble, the banner.
3. Assert `client.outgoing_turn` holds the payload with `sent_at` and `attempts`.
4. Restore the connection. Watch the replay.
5. Compare the replayed request's `client_turn_id` against the original; read the list and the outcome.
6. Assert `client.outgoing_turn` is cleared after the ack.

## Expected behaviour
- The bubble shows the queued notice `assistant-queued-notice` (mockup: `Đang chờ mạng — sẽ gửi lại`), and `assistant-offline-banner` shows the queued count. The surface does **not** sit in a permanent thinking state.
- The replay carries the **same** `client_turn_id`. A new id would make the server treat it as a second turn — the double-apply this whole mechanism exists to prevent.
- If the original had already reached the server, the replay is deduped: `replayed: true`, the recorded outcome is re-served, and the list shows the effect **once**.
- The queued notice resolves into the turn's real outcome message; the user can see the replay happened.
- `client.outgoing_turn` is cleared only after the server acknowledges the id — never before.

## Test data
| Field | Value |
|-------|-------|
| user | qamob-tc023@qa.example.com |
| drop point | after request dispatch, before response |

## Notes
Falsification probe: make the client mint a fresh `client_turn_id` on replay. The list assertion (effect appears exactly once) must go red. If it stays green, the dedupe assertion is reading the client's own bookkeeping instead of the server's `replayed` flag.
