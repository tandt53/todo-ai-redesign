# TC-07: Unrelated command supersedes the question — declined_superseded + command proceeds

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-07 |
| Feature | F-001 (voice-assistant-view) |
| Platform | api |
| Acceptance criteria | AC-10, AC-13 |
| Type | happy |
| Priority | P1 |
| Status | active |
| Automation | in-progress |
| Automation file | tests/assistant/api/F-001-voice-assistant-view.spec.ts |
| Created | 2026-08-16 by qa-api-agent |
| Last updated | 2026-08-16 by qa-api-agent |

## Summary
Any unrelated interpretable command supersedes a pending question: the delete is declined (`declined_superseded`) and the new command proceeds normally in the same turn (AC-10; same D2 rule for clarify questions, AC-13). Both effects must be present — a supersede that declines but swallows the command, or executes the command but leaves the question pending, fails.

## Preconditions
- User `QAAPI-U1`, 3 `qaapi-shop-*` tasks seeded, bulk-delete question pending (asked turn `{qid}`, session `{sid}`).

## Test steps
| # | Method | Path | Headers | Body | Expected status | Assertions |
|---|--------|------|---------|------|-----------------|------------|
| 1 | POST | /assistant/turn | X-User-Id: {U1} | `{transcript: "add a task qaapi-call-dentist", client_turn_id: {id2}, session_id: {sid}, source: "voice"}` (UT-SUPERSEDE-1) | 200 | `turn.status: "applied"`, `outcome.kind: "applied"` for the create; `resolutions == [{question_turn_id: {qid}, result: "declined_superseded"}]` |
| 2 | GET | /tasks | X-User-Id: {U1} | — | 200 | `qaapi-call-dentist` exists; all 3 `qaapi-shop-*` tasks still exist (the questioned delete never ran) |
| 3 | GET | /assistant/session | X-User-Id: {U1} | — | 200 | asked turn `{qid}` has `question.resolution.result: "declined_superseded"` |
| 4 | — | repeat with a **clarify** question pending (UT-CLARIFY-1 asked first) | — | — | same rule: clarify question superseded visibly, create proceeds (AC-13) |

## Expected behaviour
One turn, two recorded effects: the new command's own outcome plus the supersede resolution in `resolutions[]`. The questioned delete is never executed by a supersede.

## Test data
| Field | Value |
|-------|-------|
| user | QAAPI-U1 |
| utterances | UT-DELETE-BULK-3 / UT-CLARIFY-1 → UT-SUPERSEDE-1 |

## Notes
ADR-005 consequence: a supersede may come from another device — same rule, not a race. Covered implicitly (session is account-scoped).
