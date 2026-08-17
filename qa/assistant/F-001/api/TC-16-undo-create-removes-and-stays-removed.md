# TC-16: Undo of a create removes the created tasks — and they stay removed on fresh read

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-16 |
| Feature | F-001 (voice-assistant-view) |
| Platform | api |
| Acceptance criteria | AC-6, AC-5 |
| Type | happy |
| Priority | P1 |
| Status | active |
| Automation | in-progress |
| Automation file | qa/assistant/automation/api/F-001-voice-assistant-view.spec.ts |
| Created | 2026-08-16 by qa-api-agent |
| Last updated | 2026-08-16 by qa-api-agent |

## Summary
Revert shape "create" (AC-6): created tasks are removed and **stay removed on a fresh task-list read**. Uses the 3-task create (UT-CREATE-3) to also pin AC-5's whole-turn scope: one undo reverts all tasks of the turn, not just the first.

## Preconditions
- User `QAAPI-U1`, no `qaapi-` tasks; applied turn via UT-CREATE-3 (3 tasks), turn id `{tid}`.

## Test steps
| # | Method | Path | Headers | Body | Expected status | Assertions |
|---|--------|------|---------|------|-----------------|------------|
| 1 | POST | /assistant/turn/{tid}/undo | X-User-Id: {U1} | `{via: "tap"}` | 200 | `undone: true`, `reverted` names all **3** created tasks, `nothing_reverted: false` |
| 2 | GET | /tasks | X-User-Id: {U1} | — | 200 | zero `qaapi-` tasks — none of the 3 remains |
| 3 | GET | /tasks | X-User-Id: {U1} | — | 200 | second, fresh read: still zero (stays removed — not a cache illusion) |
| 4 | GET | /assistant/session | X-User-Id: {U1} | — | 200 | turn `{tid}` `status: "undone"`; `undo_snapshot` recorded the created ids (data-model rule: nothing pre-existing to snapshot) |

## Expected behaviour
Create-revert = removal of exactly the turn's created ids; whole-turn coverage (AC-5: "a 4-task turn reverts all 4" — here 3 of 3).

## Test data
| Field | Value |
|-------|-------|
| user | QAAPI-U1 |
| flow | UT-CREATE-3 applied → tap undo |

## Notes
Scope check: any pre-existing `qaapi-` task from another TC must not be touched — automation runs this in an isolated store instance.
