# TC-21: Undo skips tasks modified after apply — every skipped task named

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-21 |
| Feature | F-001 (voice-assistant-view) |
| Platform | api |
| Acceptance criteria | AC-7 |
| Type | edge |
| Priority | P1 |
| Status | active |
| Automation | in-progress |
| Automation file | tests/assistant/api/F-001-voice-assistant-view.spec.ts |
| Created | 2026-08-16 by qa-api-agent |
| Last updated | 2026-08-16 by qa-api-agent |

## Summary
Undo never clobbers later work (AC-7): a task modified after the turn — by hand **or by a later turn** — is skipped via snapshot comparison against `undo_snapshot`, and the outcome names every skipped task (`skipped[].reason: "modified_since_apply"`). Zero silent overwrites; unmodified tasks in the same turn still revert (partial revert, with names).

## Preconditions
- User `QAAPI-U1`; applied 3-create turn (UT-CREATE-3), turn `{tid}` creating `qaapi-pack-bags`, `qaapi-book-taxi`, `qaapi-print-tickets`.
- Then: manual PATCH renames `qaapi-book-taxi` → `qaapi-book-taxi-7am` (undo racing a later mutation — Test strategy injection).

## Test steps
| # | Method | Path | Headers | Body | Expected status | Assertions |
|---|--------|------|---------|------|-----------------|------------|
| 1 | POST | /assistant/turn/{tid}/undo | X-User-Id: {U1} | `{via: "tap"}` | 200 | `reverted` names exactly bags + tickets; `skipped == [{task_id, title: "qaapi-book-taxi-7am", reason: "modified_since_apply"}]`; `nothing_reverted: false` |
| 2 | GET | /tasks | X-User-Id: {U1} | — | 200 | bags and tickets removed (create-revert); **`qaapi-book-taxi-7am` still present with the manual rename intact** — later work not clobbered |

## Expected behaviour
Modified-since detection is **snapshot comparison** (current state ≠ undo_snapshot entry), not timestamps. Partial revert is honest: both lists populated, every skip named.

## Test data
| Field | Value |
|-------|-------|
| user | QAAPI-U1 |
| flow | UT-CREATE-3 → PATCH one task → undo |

## Notes
Automation adds the "modified by a later turn" variant: turn B edits one of turn A's tasks... then undo of A is refused (not_newest, TC-18) — so the by-a-later-turn skip is reached by undoing B first, then A; the task B touched must then be skipped by A's undo iff its state differs from A's snapshot.
