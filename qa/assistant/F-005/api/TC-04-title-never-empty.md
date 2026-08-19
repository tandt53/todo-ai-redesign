# TC-04: The title is never empty, and never silently truncated

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-04 |
| Feature | F-005 (task-detail) |
| Platform | api |
| Acceptance criteria | AC-37, AC-40 |
| Type | negative |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | tests/assistant/api/F-005-task-detail.spec.ts (`describe('TC-04 …')`) |
| Created | 2026-08-19 by qa-api-agent |
| Last updated | 2026-08-19 by qa-api-agent |

## Summary
AC-37: "an empty title is refused — the task keeps the name it had. Blank, whitespace-only and newline-only are all empty." The refusal is what makes an anonymous task unreachable, and the AC notes the original product enforced this **in its update path rather than in its UI**, which is the right place: a rename by voice, by inline edit on a row, or from the detail all reach the same rule.

## Preconditions
- In-process harness: `createApp(deps)` with the `__qa__` doors mounted in front, on an ephemeral port, driven by supertest. Fresh durable store per test.
- The clock seam and the account zone are both held at `T0 = 2026-08-19T12:00:00.000Z` / `UTC` by `POST /__qa__/set-clock` (AC-44). Every fixture instant is derived from `T0`, never from a wall clock (L-023).
- A task whose title is known, so "keeps the name it had" is assertable rather than assumed.

## Test steps (API)
| # | Case (automation `it` name) | Request | Expected |
|---|------------------------------|---------|----------|
| 1 | TC-04a blank, whitespace-only and newline-only are all refused | `PATCH /tasks/{id} {title}` for `''`, `'   '`, `'\n'`, `' \n\t '` | `400 VALIDATION` `field: 'title'` each time, and the stored title is unchanged after each |
| 2 | TC-04b the 500-character bound: 500 accepted, 501 refused, nothing written | `PATCH` at 500 then 501 characters | `200` then `400 VALIDATION field: 'title'`; the stored title is still the 500-character value |
| 3 | TC-04c a create with an empty title is refused too | `POST /tasks {title: '   '}` | `400 VALIDATION field: 'title'`, and no row exists |

## Expected behaviour
- Every one of the three empty forms is refused, not coerced.
- The bound is **refused, never silently truncated** (product P12) — the assertion after the refusal is that the value on disk is still the accepted one, which is what distinguishes a refusal from a cut.
- The rule binds the write, so the create door refuses the same value the patch door refuses (AC-40).

## Test data
| Field | Value |
|-------|-------|
| namespace | task titles `qaapi5-*`; reserved user ids in `qa/_shared/fixtures/api/f005-users.json`. No unscoped destructive operations (§10). |
| title bound | 500 characters after trim (`api-contracts.md § Validation bounds`) |

## Notes
- *Would this notice?* Yes — a handler that trimmed to 500 rather than refusing fails TC-04b's post-refusal read; one that accepted whitespace fails TC-04a.
- The turn-path half of AC-37 is TC-27c (`reason: 'empty_title'`), because AC-40 is where the rule acquires a mechanism on the door AC-36 widens.
