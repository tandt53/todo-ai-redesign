# TC-21: Editing one occurrence edits only that occurrence, and the change carries forward

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-21 |
| Feature | F-005 (task-detail) |
| Platform | api |
| Acceptance criteria | AC-29, AC-23 |
| Type | happy |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | tests/assistant/api/F-005-task-detail.spec.ts (`describe('TC-21 …')`) |
| Created | 2026-08-19 by qa-api-agent |
| Last updated | 2026-08-19 by qa-api-agent |

## Summary
AC-29: "Changing the **rule** applies to every occurrence generated afterwards; **history is never rewritten**, and the current occurrence's own due is handled by AC-23 at the moment the rule changes. This is how 'change it from now on' works without introducing a second concept." The boundary with AC-23 is what TC-16 and this case split between them.

## Preconditions
- In-process harness: `createApp(deps)` with the `__qa__` doors mounted in front, on an ephemeral port, driven by supertest. Fresh durable store per test.
- The clock seam and the account zone are both held at `T0 = 2026-08-19T12:00:00.000Z` / `UTC` by `POST /__qa__/set-clock` (AC-44). Every fixture instant is derived from `T0`, never from a wall clock (L-023).
- A completed occurrence and its successor, so "history" is a real row rather than a hypothetical.

## Test steps (API)
| # | Case (automation `it` name) | Request | Expected |
|---|------------------------------|---------|----------|
| 1 | TC-21a the edit carries forward, because the successor is generated FROM it | edit the note, then complete | the successor carries the edited note |
| 2 | TC-21b HISTORY is never rewritten | complete occ1, change the rule on occ2, complete occ2 | occ1's rule, due and `updated_at` are all unchanged; occ3's gap follows the NEW rule (14 days, not 7) |

## Expected behaviour
- The completed occurrence is untouched in every respect, `updated_at` included — a rewrite would move it.
- The new rule reaches the occurrence generated afterwards, which is what makes "from now on" work without a second scope concept.

## Test data
| Field | Value |
|-------|-------|
| namespace | task titles `qaapi5-*`; reserved user ids in `qa/_shared/fixtures/api/f005-users.json`. No unscoped destructive operations (§10). |
| interval change | weekly interval 1 → 2, so the next gap is 14 days |

## Notes
- AC-29's stated cost is recorded as **Open Question 14**: "a note added for one week travels to every occurrence after it… Comparable apps prompt for the scope on exactly this gesture; this feature does not." That is a product decision, not a defect, and no assertion here presumes otherwise.
- *Would this notice?* Yes — a rule change applied to history fails TC-21b's three `occ1` assertions; a successor generated from the rule rather than from the row fails TC-21a.
