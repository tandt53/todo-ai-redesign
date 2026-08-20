# TC-026: Kill while thinking — the sent-but-unacked turn survives in `client.outgoing_turn`

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-026 |
| Feature | F-003 (mobile-surface) |
| Platform | mobile |
| Acceptance criteria | AC-6, F-001 AC-27 |
| Type | edge |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | tests/assistant/mobile/F-003-mobile-surface.spec.ts |
| Targets | ios, android |
| Tier | node-headless (store outlives the model) + device-lab (real OS kill) |
| Created | 2026-08-16 by qa-mobile-agent |
| Last updated | 2026-08-17 by qa-mobile-agent |

## Summary
The second AC this feature exists to deliver. **Mechanism being verified:** the outgoing turn is written to the kill-surviving `client.outgoing_turn` store **before or at dispatch** and stays there until the server acknowledges its `client_turn_id`. A kill in the thinking window therefore never loses a sent-but-unacked turn; the turn itself resolves server-side under its own id regardless.

## Preconditions
- Account `qamob-tc026@qa.example.com`; `DurableStore` double outliving the model; the server able to hold a response.

## Test steps
1. Send a turn; hold the server response so the surface stays in thinking.
2. Assert `client.outgoing_turn` already holds the full `POST /assistant/turn` payload plus `sent_at` and `attempts`.
3. Discard the model instance and construct a fresh one against the same store (= kill).
4. Read the fresh instance's `client.outgoing_turn`.
5. Let the server resolve the turn; foreground the fresh instance and read the conversation.
6. Repeat with the kill occurring **before** the request left the device.

## Expected behaviour
- Step 2: the payload is in the store **during** the thinking window, not written on completion. A store that is only populated on failure fails here.
- Step 4: the payload survives with its **original** `client_turn_id` intact, along with `sent_at` and an `attempts` count.
- Step 5: reopening within the open session shows the turn's outcome message — the turn resolved server-side and the client renders it (via the AC-8 foreground read, TC-030).
- Step 6: a turn killed before dispatch is still in the store and is dispatched on the next foreground — it is not lost, and it is not applied twice.
- The store entry is cleared **only** after the server acks the id (asserted in TC-027).

## Test data
| Field | Value |
|-------|-------|
| user | qamob-tc026@qa.example.com |
| hold point | server holds the response until released |

## Notes
**Device-lab residue:** a real OS kill mid-request. The node tier's `DurableStore` double reproduces the ACs' stated observable (contents outlive the model) per the spec's Test strategy; it does not prove that React Native's storage implementation (AsyncStorage vs MMKV — Open Question 1) actually flushes to disk before the process dies. **That flush is the single most important device-lab item in this feature** — the port makes it swappable, and an implementation that writes asynchronously without awaiting the flush will pass every test here and still lose turns on a real device.
