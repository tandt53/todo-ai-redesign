# TC-03: Bulk-delete gate — question turn applies nothing, names count and titles

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-03 |
| Feature | F-001 (voice-assistant-view) |
| Platform | api |
| Acceptance criteria | AC-9, AC-1 |
| Type | happy |
| Priority | P1 |
| Status | active |
| Automation | in-progress |
| Automation file | tests/assistant/api/F-001-voice-assistant-view.spec.ts |
| Created | 2026-08-16 by qa-api-agent |
| Last updated | 2026-08-16 by qa-api-agent |

## Summary
A delete touching more than one task is refused-to-apply and returns a `confirm` question naming the count and the task titles (AC-9, contract rule 7). The AC-1 carve-out holds: an asking turn applies **nothing** — read-back proves all tasks still exist. Boundary partner: the gate fires at exactly 2 tasks (row UT-DELETE-BULK-2), not only at 3+.

## Preconditions
- User `QAAPI-U1` with seeded tasks `qaapi-shop-eggs`, `qaapi-shop-bread`, `qaapi-shop-cheese` (via POST /tasks) and `qaapi-report-q3`, `qaapi-report-q4`.

## Test steps
| # | Method | Path | Headers | Body | Expected status | Assertions |
|---|--------|------|---------|------|-----------------|------------|
| 1 | POST | /assistant/turn | X-User-Id: {U1} | `{transcript: "delete all my qaapi shopping tasks", client_turn_id: {id1}, session_id: null, source: "voice"}` (UT-DELETE-BULK-3) | 200 | `turn.status: "asked"`, `turn.outcome.kind: "question"`, `turn.question.kind: "bulk_delete"`, `question.task_titles` == the 3 titles, count derivable == 3, `question.options` present (literal texts), `changed_task_ids == []`, `diff == []` |
| 2 | GET | /tasks | X-User-Id: {U1} | — | 200 | all 5 seeded `qaapi-` tasks still present, fields untouched (zero mutation) |
| 3 | POST | /assistant/turn | X-User-Id: {U1} | UT-DELETE-BULK-2 (2 tasks), fresh id, fresh clean session for U3 or after resolving step 1 | 200 | boundary: 2 targets also produce `question.kind: "bulk_delete"` — never immediate apply |

## Expected behaviour
Server-side refusal of unconfirmed bulk delete (the server, not the client, is the gate — AC-9). Asking turns mutate nothing (AC-1 carve-out); the question is a message with `resolution: null`, no timeout.

## Test data
| Field | Value |
|-------|-------|
| user | QAAPI-U1 |
| seed | 5 qaapi- tasks (see Preconditions) |
| utterances | UT-DELETE-BULK-3, UT-DELETE-BULK-2 |

## Notes
Step 3 runs in its own session context so the step-1 pending question does not turn it into a supersede (D2). Equivalence classes: 1 task (TC-04), 2 tasks, 3 tasks — 2 and 3 behave identically (asked).
