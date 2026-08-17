# TC-28: N concurrent identical requests — applied exactly once, extras 409 IN_FLIGHT or replayed

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-28 |
| Feature | F-001 (voice-assistant-view) |
| Platform | api |
| Acceptance criteria | AC-16 |
| Type | edge |
| Priority | P1 |
| Status | active |
| Automation | in-progress |
| Automation file | qa/assistant/automation/api/F-001-voice-assistant-view.spec.ts |
| Created | 2026-08-16 by qa-api-agent |
| Last updated | 2026-08-16 by qa-api-agent |

## Summary
Concurrency probe (§3.9-4): 5 byte-identical POSTs with the same `client_turn_id` fired in parallel. Exactly **one** execution. Each response is one of: the executed 200 (`replayed: false`), a dedupe replay 200 (`replayed: true`), or `409 IN_FLIGHT` (same id still processing — contract rule 2's `pending` branch). Read-back proves single apply.

## Preconditions
- User `QAAPI-U1`, no `qaapi-` tasks; body = UT-CREATE-1 with one shared `{id1}`.

## Test steps
| # | Method | Path | Headers | Body | Expected status | Assertions |
|---|--------|------|---------|------|-----------------|------------|
| 1 | POST ×5 concurrent | /assistant/turn | X-User-Id: {U1} | identical bodies, same `{id1}` | each ∈ {200, 409} | exactly one response has `replayed: false` + applied outcome; every other response is `replayed: true` **or** `409 IN_FLIGHT`; no response is a second fresh apply |
| 2 | GET | /tasks | X-User-Id: {U1} | — | 200 | exactly **one** `qaapi-buy-milk` task |
| 3 | POST | /assistant/turn | X-User-Id: {U1} | same `{id1}` once more, after quiescence | 200 | `replayed: true` — terminal dedupe now stable |

## Expected behaviour
The serial per-account queue + unique `(user_id, client_turn_id)` index make double-apply impossible; IN_FLIGHT is the visible name for "you raced yourself". The invariant asserted is the count in step 2, not a fixed distribution of statuses in step 1 (scheduling-dependent).

## Test data
| Field | Value |
|-------|-------|
| user | QAAPI-U1 |
| id | one shared uuid across 5 parallel sends |

## Notes
Triggers error-table row `409 IN_FLIGHT` (the harness may need a slow-interpreter fixture delay to widen the pending window deterministically; automation arms a latency on the stub for this test only).
