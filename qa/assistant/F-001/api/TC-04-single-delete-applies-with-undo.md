# TC-04: Single-task delete applies immediately, undoable, named by title

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-04 |
| Feature | F-001 (voice-assistant-view) |
| Platform | api |
| Acceptance criteria | AC-9, AC-5, AC-4 |
| Type | happy |
| Priority | P1 |
| Status | active |
| Automation | in-progress |
| Automation file | qa/assistant/automation/api/F-001-voice-assistant-view.spec.ts |
| Created | 2026-08-16 by qa-api-agent |
| Last updated | 2026-08-16 by qa-api-agent |

## Summary
The other half of the AC-9 decision table: a delete touching exactly one task applies immediately (no question), with undo available. Since no row remains, the delete is named by title in the outcome (`deleted_titles`, AC-4 delete anatomy).

## Preconditions
- User `QAAPI-U1` with seeded task `qaapi-buy-milk`.

## Test steps
| # | Method | Path | Headers | Body | Expected status | Assertions |
|---|--------|------|---------|------|-----------------|------------|
| 1 | POST | /assistant/turn | X-User-Id: {U1} | `{transcript: "delete qaapi-buy-milk", client_turn_id: {id1}, session_id: null, source: "voice"}` (UT-DELETE-1) | 200 | `turn.status: "applied"` (no question), `outcome.kind: "applied"`, `outcome.deleted_titles == ["qaapi-buy-milk"]`, `diff` row has `new: null` |
| 2 | GET | /tasks | X-User-Id: {U1} | — | 200 | `qaapi-buy-milk` absent from the list (soft-deleted) |
| 3 | POST | /assistant/turn/{turn_id_1}/undo | X-User-Id: {U1} | `{via: "tap"}` | 200 | `undone: true`, `reverted == [{task_id, title: "qaapi-buy-milk"}]` — the applied turn was undoable (AC-5 window open) |
| 4 | GET | /tasks | X-User-Id: {U1} | — | 200 | `qaapi-buy-milk` back with all fields intact |

## Expected behaviour
Decision-table row: `targets == 1 → apply immediately + undo`; `targets > 1 → ask` (TC-03). Confirmation is reserved for multi-task deletes — undo-instead-of-confirm is the rule (spec, Considered and rejected).

## Test data
| Field | Value |
|-------|-------|
| user | QAAPI-U1 |
| seed | qaapi-buy-milk |
| utterance | UT-DELETE-1 |

## Notes
Steps 3–4 double as a smoke of the undo-delete revert shape; the full shape matrix is TC-15..17.
