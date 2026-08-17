# TC-33: Cross-account isolation — another user's ids behave as 404 NOT_FOUND

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-33 |
| Feature | F-001 (voice-assistant-view) |
| Platform | api |
| Acceptance criteria | AC-1, AC-6 |
| Type | security |
| Priority | P1 |
| Status | active |
| Automation | in-progress |
| Automation file | qa/assistant/automation/api/F-001-voice-assistant-view.spec.ts |
| Created | 2026-08-16 by qa-api-agent |
| Last updated | 2026-08-16 by qa-api-agent |

## Summary
Horizontal-privilege probe (§3.8) + every 404 error row: ids owned by another user behave as `404 NOT_FOUND` — indistinguishable from nonexistent (no enumeration oracle) — and nothing of the victim's data is read or mutated. User A (QAAPI-U1) attacks user B's (QAAPI-U2) session, turn, and task ids; unknown-uuid variants pin the "unknown ≡ foreign" equivalence.

## Preconditions
- QAAPI-U2 owns: open session `{sidB}`, applied turn `{turnB}` (newest, undoable by B), asked turn `{qB}`, task `{taskB}` titled `qaapi-u2-private`.

## Test steps
| # | Method | Path | Headers | Body | Expected status | Assertions |
|---|--------|------|---------|------|-----------------|------------|
| 1 | POST | /assistant/turn | X-User-Id: {U1} | `{session_id: {sidB}, client_turn_id: {new}, transcript: "add a task qaapi-buy-milk", source: "typed"}` | 404 | `NOT_FOUND` — B's session invisible to A; B's session gains no turn |
| 2 | POST | /assistant/turn | X-User-Id: {U1} | valid body + `answer_to_turn_id: {qB}` | 404 | foreign question turn unknown to A; B's question stays pending |
| 3 | POST | /assistant/turn/{turnB}/undo | X-User-Id: {U1} | `{via: "tap"}` | 404 | A cannot undo B's turn; B's task state read-back (as U2) unchanged |
| 4 | POST | /assistant/session/close | X-User-Id: {U1} | `{session_id: {sidB}, reason: "user_closed"}` | 404 | B's session still open (read-back as U2) |
| 5 | PATCH | /tasks/{taskB} | X-User-Id: {U1} | `{title: "qaapi-stolen"}` | 404 | B's task unmodified (read-back as U2) |
| 6 | DELETE | /tasks/{taskB} | X-User-Id: {U1} | — | 404 | B's task still present |
| 7 | — | repeat 1, 3, 5 with random unknown uuids | X-User-Id: {U1} | — | 404 | same status + same envelope shape as foreign-id responses — no existence leak |
| 8 | GET | /tasks | X-User-Id: {U1} | — | 200 | A's list never contains `qaapi-u2-private` |

## Expected behaviour
Account scope everywhere (contract Conventions; ADR-005). The enumeration assertion (step 7 vs 1–6: byte-comparable error bodies modulo message ids) is the security-adjacent core: 403-style "exists but not yours" leaks are a defect.

## Test data
| Field | Value |
|-------|-------|
| attacker | QAAPI-U1 |
| victim | QAAPI-U2 (ids from preconditions) |

## Notes
Covers error rows: turn 404, close 404, undo 404, tasks PATCH/DELETE 404. GET /assistant/session needs no probe (no id parameter — scoping is implicit and asserted in step 8's philosophy via list reads).
