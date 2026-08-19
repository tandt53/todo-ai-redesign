# TC-33: Contract drift — the wire shape is exactly what the contract declares

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-33 |
| Feature | F-005 (task-detail) |
| Platform | api |
| Acceptance criteria | AC-2, AC-8, AC-13, AC-25, AC-19 |
| Type | edge |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | tests/assistant/api/F-005-task-detail.spec.ts (`describe('TC-33 …')`) |
| Created | 2026-08-19 by qa-api-agent |
| Last updated | 2026-08-19 by qa-api-agent |

## Summary
"A field present in the response but absent from `api-contracts.md` is an information leak, not a feature. Extra fields today become breaking changes when removed tomorrow." `serializeTask` "emits exactly this", and four fields are marked **internal** — `user_id`, `ever_completed` (ADR-014), `delete_gesture_id` (ADR-012), `series_ended_at`. This case asserts the exact key set on every row and every envelope, so a silent addition or removal is caught at the tier that owns the contract.

## Preconditions
- In-process harness: `createApp(deps)` with the `__qa__` doors mounted in front, on an ephemeral port, driven by supertest. Fresh durable store per test.
- The clock seam and the account zone are both held at `T0 = 2026-08-19T12:00:00.000Z` / `UTC` by `POST /__qa__/set-clock` (AC-44). Every fixture instant is derived from `T0`, never from a wall clock (L-023).
- Rows covering every shape: a plain task, a parent, a step, and a repeating task with both set-valued members populated.

## Test steps (API)
| # | Case (automation `it` name) | Request | Expected |
|---|------------------------------|---------|----------|
| 1 | TC-33a every declared field is present on every row, and NO undocumented field is | `GET /tasks` over all row shapes | each row's sorted key set equals the contract's declared list exactly; no internal field appears |
| 2 | TC-33b priority is never null on the wire; series_live and completed_by_parent are never absent | a fresh row, on the create response and on read-back | `priority == 'none'`; both flags are booleans |
| 3 | TC-33c every mutating endpoint answers the declared envelope, and only that | create, patch, preview, delete, restore | `{task, changed}` / `{task, changed, prior}` / `{due_at, due_all_day, created, moved, refusals}` / `{task, changed}` / `{task, changed, restored}` |
| 4 | TC-33d 'removed' is present only when a row was HARD-removed | an ordinary patch; then an un-complete that removes a successor | absent (or empty) then `[<successor id>]`, a list of id strings |
| 5 | TC-33e the server still has no opinion about collections | `POST /tasks {status:'today'}`; a dated row | `400 VALIDATION`; and the row carries no `collection` property |

## Expected behaviour
- The key set is asserted with equality, not with `toContain` — that is what catches an **addition**, which no per-field assertion can.
- `priority` is never `null` on the wire: the row stores `null` and the serializer emits `"none"` (AC-8).
- `removed` is "omitted when empty" and carries ids, not rows.
- F-005 does not move the ADR-009 boundary: `today` stays a rejected write value and collections stay client-side predicates.

## Test data
| Field | Value |
|-------|-------|
| namespace | task titles `qaapi5-*`; reserved user ids in `qa/_shared/fixtures/api/f005-users.json`. No unscoped destructive operations (§10). |
| declared wire fields | the 23 in `api-contracts.md § Task on the wire` |
| internal fields | `user_id`, `ever_completed`, `delete_gesture_id`, `series_ended_at` |

## Notes
- `ever_completed`, `series_ended_at` and `delete_gesture_id` are the three internal fields F-005 adds, and each is load-bearing for a derived wire value (`series_live`) or a write path (restore). Leaking them would let a client re-derive `series_live` its own way, which is the second-definition problem AC-25 exists to prevent.
- *Would this notice?* Yes — any added or removed field fails TC-33a; a `null` priority fails TC-33b; a changed envelope fails TC-33c.
