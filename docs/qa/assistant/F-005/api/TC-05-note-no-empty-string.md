# TC-05: The note: line breaks survive, and blank input stores no note at all

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-05 |
| Feature | F-005 (task-detail) |
| Platform | api |
| Acceptance criteria | AC-6 |
| Type | boundary |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | tests/assistant/api/F-005-task-detail.spec.ts (`describe('TC-05 …')`) |
| Created | 2026-08-19 by qa-api-agent |
| Last updated | 2026-08-19 by qa-api-agent |

## Summary
AC-6: "Empty, whitespace-only and newline-only input is stored as **no note at all, never as an empty string** — the distinction is observable on read-back." That last clause is why every assertion here reads the row back and checks for `null` **specifically**: a `toBeFalsy()` assertion passes on `""` and is exactly the assertion this AC exists to forbid.

## Preconditions
- In-process harness: `createApp(deps)` with the `__qa__` doors mounted in front, on an ephemeral port, driven by supertest. Fresh durable store per test.
- The clock seam and the account zone are both held at `T0 = 2026-08-19T12:00:00.000Z` / `UTC` by `POST /__qa__/set-clock` (AC-44). Every fixture instant is derived from `T0`, never from a wall clock (L-023).

## Test steps (API)
| # | Case (automation `it` name) | Request | Expected |
|---|------------------------------|---------|----------|
| 1 | TC-05a line breaks survive the round trip | `POST /tasks {note: 'first\nsecond\n\nfourth'}` then read back | the note is byte-identical, newlines included |
| 2 | TC-05b empty, whitespace-only and newline-only store NO NOTE AT ALL | `POST /tasks {note}` for `''`, `'   '`, `'\n'`, `'\n\n  \t'` | `note` is `null` on the response and on read-back, and explicitly not `''` |
| 3 | TC-05c clearing an existing note stores no note, and is observable | `PATCH /tasks/{id} {note: '   '}` | `200`, `task.note == null`, `prior == {note: 'something'}` |
| 4 | TC-05d the 20 000-character bound: 20 000 accepted, 20 001 refused | `PATCH` at 20 000 then 20 001 characters | `200` then `400 VALIDATION field: 'note'`; the stored note is still 20 000 long |

## Expected behaviour
- `null`, never `''`, on both the response and the read-back.
- Line breaks are preserved exactly (`## Data`: "line breaks preserved").
- The bound is refused with the value left in the field, never truncated — AC-6's rule, and the number is `api-contracts.md § Validation bounds`.

## Test data
| Field | Value |
|-------|-------|
| namespace | task titles `qaapi5-*`; reserved user ids in `docs/qa/_shared/fixtures/api/f005-users.json`. No unscoped destructive operations (§10). |
| note bound | 20 000 characters — "the field is assistant-settable (AC-36), so unbounded is not an option" |

## Notes
- Revision 1's "line breaks survive any export" clause was removed by the spec itself: nothing in this repo exports anything, so it was a permanently green line in the coverage matrix (tester T13). It is not asserted here for the same reason.
- *Would this notice?* Yes — storing `''` fails TC-05b's `not.toBe('')`; truncating fails TC-05d's post-refusal read.
