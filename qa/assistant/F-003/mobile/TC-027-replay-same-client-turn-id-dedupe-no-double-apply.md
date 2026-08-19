# TC-027: Kill-surviving replay uses the SAME `client_turn_id` — the server re-serves, never re-applies

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-027 |
| Feature | F-003 (mobile-surface) |
| Platform | mobile |
| Acceptance criteria | AC-6, F-001 AC-16 |
| Type | security |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | tests/assistant/mobile/F-003-mobile-surface.spec.ts |
| Targets | ios, android |
| Tier | node-headless |
| Created | 2026-08-16 by qa-mobile-agent |
| Last updated | 2026-08-17 by qa-mobile-agent |

## Summary
The mobile clause on AC-6's reconciliation, and the highest-consequence assertion in the lifecycle set. **Mechanism being verified:** an outgoing turn that survived a kill is replayed under the **same** `client_turn_id`, so a turn the server already applied re-serves its recorded outcome (`replayed: true`) and **never applies twice**; the acked turn is then cleared from the store. Getting this wrong deletes the user's tasks a second time.

## Preconditions
- Account `qamob-tc027@qa.example.com`; `DurableStore` outliving the model; request spy capturing `client_turn_id` per request; server dedupe live (not stubbed).

## Test steps
1. Send a **mutating** turn (creates two tasks); let the server apply it but withhold the response.
2. Kill (fresh model, same store). Foreground.
3. Capture the replay request. Compare `client_turn_id` with the original.
4. Read the response's `replayed` flag, the conversation, and the task list.
5. Assert `client.outgoing_turn` is cleared after the ack.
6. Repeat for each dedupe status: a turn whose recorded status is `asked`, one that is `undone`, and one that is `failed`.
7. Repeat with the turn killed **before** the server ever received it.

## Expected behaviour
- The replay carries the **identical** `client_turn_id`. A regenerated id fails the test.
- Step 4: `replayed: true`; the recorded outcome is re-served; **the task list shows the effect exactly once** — two tasks, not four. This list-count assertion is the one that catches a double-apply even if the flag is wrong.
- The re-served outcome renders as a normal message; the user is not shown a duplicate turn.
- Step 5: the store entry is cleared **after** the ack, not before dispatch.
- Step 6 (per-status dedupe, `api-contracts.md` rule 2): `applied | asked | undone` → re-serve, nothing re-executes; `failed` → re-attempt (failed → pending, same id).
- Step 7: a turn never received is executed for the first time on replay — exactly once.
- A replay whose `transcript`/`source`/`answer_to_turn_id` differ from the recorded one is **not** a replay: `409 CLIENT_TURN_ID_REUSED` and nothing executes. The client must not mutate the stored payload between attempts.

## Test data
| Field | Value |
|-------|-------|
| user | qamob-tc027@qa.example.com |
| turn under test | a 2-task create (count is the double-apply detector) |

## Notes
Typed as `security` because the failure mode is destructive and silent: a bulk delete replayed under a fresh id after a kill would execute a second time against tasks the user believes are already gone. The count assertion in step 4 is what makes this test a bug detector rather than a flag reader.
