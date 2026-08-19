# TC-22: Deleting names which of the two things it is about to do

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-22 |
| Feature | F-005 (task-detail) |
| Platform | api |
| Acceptance criteria | AC-30, AC-31, AC-25, AC-41 |
| Type | edge |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | tests/assistant/api/F-005-task-detail.spec.ts (`describe('TC-22 …')`) |
| Created | 2026-08-19 by qa-api-agent |
| Last updated | 2026-08-19 by qa-api-agent |

## Summary
AC-30's plural branch is reachable **only** through AC-28's two-open-occurrence outcome, "which is that state's only constructor" — so the fixture builds it that way rather than assuming it. And revision 2 "spent the confirmation dialog against an undo that did not cover this action": AC-43's coverage list did not name a series delete and AC-41's restore was scoped to a parent and its steps. **One undo restores every occurrence the delete trashed, each with its steps, in one call**, and that is asserted directly.

## Preconditions
- In-process harness: `createApp(deps)` with the `__qa__` doors mounted in front, on an ephemeral port, driven by supertest. Fresh durable store per test.
- The clock seam and the account zone are both held at `T0 = 2026-08-19T12:00:00.000Z` / `UTC` by `POST /__qa__/set-clock` (AC-44). Every fixture instant is derived from `T0`, never from a wall clock (L-023).
- Two open occurrences of one series, built through AC-28's constructor: complete occ2, edit its successor (clock advanced), un-complete occ2 — both rows then stand.
- A completed occ1, so the survivor rule has a subject.

## Test steps (API)
| # | Case (automation `it` name) | Request | Expected |
|---|------------------------------|---------|----------|
| 1 | TC-22a the default scope is the OCCURRENCE, and it takes the row and its steps | `DELETE /tasks/{id}` with no scope | soft delete (`deleted_at` set), the steps are in `changed`, and `GET /tasks` is empty |
| 2 | TC-22b scope=series trashes every UNFINISHED occurrence and LEAVES every completed one | `DELETE /tasks/{id}?scope=series` | occ2, occ3 and the step have `deleted_at` set; occ1 has `deleted_at: null` and is the only live row |
| 3 | TC-22c a series delete ends the series for the SURVIVOR too | the same delete, then read the survivor | its repeat is still set and its `series_id` is unchanged, but `series_live` is `false` |
| 4 | TC-22d scope=series on a row with NO series is refused | `DELETE /tasks/{id}?scope=series` on an ordinary task | `400 VALIDATION`, nothing trashed |
| 5 | TC-22e ONE undo restores every occurrence the series delete trashed | series delete then `POST /tasks/{id}/restore` | exactly the trashed set comes back, steps included, in one call |

## Expected behaviour
- A completed occurrence is left alone: "those are a record of work that was actually done, not rubbish."
- The delete also writes `series_ended_at` on **every** row of the series including the survivors, which is what makes `series_live` false for them — AC-25's fourth ending, and AC-39's third negative case.
- One restore call brings back the whole gesture's membership, because the delete recorded it (`delete_gesture_id`, ADR-012) rather than anything inferring it afterwards.
- Neither control asks a pre-action question: both have AC-43's undo, and "an action with an undo does not also need one."

## Test data
| Field | Value |
|-------|-------|
| namespace | task titles `qaapi5-*`; reserved user ids in `qa/_shared/fixtures/api/f005-users.json`. No unscoped destructive operations (§10). |
| scope parameter | `occurrence` (default) | `series` |

## Notes
- **This case caught a wrong assertion of mine during authoring, and the wrongness is instructive.** I first computed "trashed" as *membership of the response's `changed` list* — which reported the surviving completed occurrence as trashed, because a series delete legitimately puts it in `changed` (its `series_ended_at` changed). A minimal reproduction confirmed the survivor's `deleted_at` was `null` all along. The assertion now reads `deleted_at !== null`. Had the survivor genuinely been in neither list, the original assertion would have passed for the wrong reason.
- *Would this notice?* Yes — an implementation that trashed the completed occurrence fails TC-22b; one that left `series_live` true for survivors fails TC-22c, which is the defect tester T39 found ("AC-39 marked them as repeating forever — on the phone, the only thing that explains an unexpected row").
