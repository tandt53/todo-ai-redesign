# TC-15: Undo of an edit restores prior field values — read-back proven

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-15 |
| Feature | F-001 (voice-assistant-view) |
| Platform | api |
| Acceptance criteria | AC-6, AC-5 |
| Type | happy |
| Priority | P1 |
| Status | active |
| Automation | in-progress |
| Automation file | tests/assistant/api/F-001-voice-assistant-view.spec.ts |
| Created | 2026-08-16 by qa-api-agent |
| Last updated | 2026-08-16 by qa-api-agent |

## Summary
Revert shape "edit" (AC-6): undo restores the prior field values from `turn.undo_snapshot`; the observable for "survives sync" is the read-back — a subsequent `GET /tasks` returns the reverted values. The undone turn stays visible with `turn.status: "undone"`.

## Preconditions
- User `QAAPI-U1`, seeded `qaapi-buy-milk`.
- Applied edit turn via UT-EDIT-1 (rename → `qaapi-buy-oat-milk`), turn id `{tid}`.

## Test steps
| # | Method | Path | Headers | Body | Expected status | Assertions |
|---|--------|------|---------|------|-----------------|------------|
| 1 | POST | /assistant/turn/{tid}/undo | X-User-Id: {U1} | `{via: "tap"}` | 200 | `undone: true`, `already_undone: false`, `reverted == [{task_id, title: "qaapi-buy-milk"}]`, `skipped == []`, `nothing_reverted: false`, `via: "tap"` |
| 2 | GET | /tasks | X-User-Id: {U1} | — | 200 | the task's `title == "qaapi-buy-milk"` again — prior value restored, other fields untouched |
| 3 | GET | /assistant/session | X-User-Id: {U1} | — | 200 | turn `{tid}` still present with `status: "undone"` and `undo_result` populated (visible, marked undone) |

## Expected behaviour
Edit-revert restores exactly the snapshot values; the turn history keeps the undone turn (never deleted from the conversation).

## Test data
| Field | Value |
|-------|-------|
| user | QAAPI-U1 |
| flow | seed → UT-EDIT-1 applied → tap undo |

## Notes
Companion shapes: create (TC-16), delete (TC-17). Whole-turn scope (a 4-task turn reverts all 4) is asserted in TC-16's multi-create variant.
