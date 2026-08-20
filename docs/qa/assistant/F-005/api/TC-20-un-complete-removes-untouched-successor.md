# TC-20: Un-completing removes the successor only when the successor is untouched

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-20 |
| Feature | F-005 (task-detail) |
| Platform | api |
| Acceptance criteria | AC-28, AC-46 |
| Type | edge |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | tests/assistant/api/F-005-task-detail.spec.ts (`describe('TC-20 …')`) |
| Created | 2026-08-19 by qa-api-agent |
| Last updated | 2026-08-19 by qa-api-agent |

## Summary
AC-28's five conditions are **conjunctive**, and the asymmetry is the point: "un-ticking **is** the way to fix a mis-tap and it is closer than hunting for an undo, but it only works if it reverses the entire tick including the part the user never saw — while deleting something the user has already edited by hand is worse than leaving one extra row." Condition five is the one every whole-row comparison is blind to, because ticking a step touches the **step's** row and not the successor's.

## Preconditions
- In-process harness: `createApp(deps)` with the `__qa__` doors mounted in front, on an ephemeral port, driven by supertest. Fresh durable store per test.
- The clock seam and the account zone are both held at `T0 = 2026-08-19T12:00:00.000Z` / `UTC` by `POST /__qa__/set-clock` (AC-44). Every fixture instant is derived from `T0`, never from a wall clock (L-023).
- For conditions 3 and 5 the clock is **advanced** before the edit — with the instant held, an edit leaves `updated_at` byte-equal to `created_at` and the condition cannot be constructed at all.

## Test steps (API)
| # | Case (automation `it` name) | Request | Expected |
|---|------------------------------|---------|----------|
| 1 | TC-20a an UNTOUCHED successor is removed, and the removal is HARD | complete, then un-complete | the successor id is in `removed`, and `POST /restore` on it is `404` |
| 2 | TC-20b condition 4 — a successor that is itself DONE stays | complete the successor, then un-complete the occurrence | the successor is not in `removed` and is still there |
| 3 | TC-20c condition 3 — an EDITED successor stays | advance the clock, edit the successor's note, then un-complete | `updated_at != created_at` is asserted first; the successor stays with its edit |
| 4 | TC-20d condition 5 — a successor whose STEP was ticked stays | advance, tick the successor's step, then un-complete | the successor stays and its own `updated_at` is unmoved — it was never touched itself |
| 5 | TC-20e the five conditions are CONJUNCTIVE | an unrelated row that looks like a successor | only the real successor is removed; the impostor is untouched |

## Expected behaviour
- "Removes the successor" is a **hard** removal, not a soft delete: "a soft-removed successor is a row AC-41 can restore, producing the second open occurrence this whole section rests on not having." The `404` from `restore` is that assertion.
- Each condition is violated on its own, with the other four satisfied, so a failure names one condition.
- Condition five's observable is deliberately split: the successor stays **and** its own row is unchanged — which is what makes it a test of condition five rather than of condition three.

## Test data
| Field | Value |
|-------|-------|
| namespace | task titles `qaapi5-*`; reserved user ids in `docs/qa/_shared/fixtures/api/f005-users.json`. No unscoped destructive operations (§10). |
| clock advance | 60 000 ms before any edit that must differ from a create |

## Notes
- TC-20c was red on first authoring, and the cause is worth recording: AC-28's third condition is a **timestamp equality**, so under a held clock an edit is indistinguishable from no edit. The fixture has to advance the clock to construct the state at all. That is L-023's shape one level down — the fixture and the subject reading the same held value — and it is a fragility in the condition's chosen proxy, not a defect in the implementation.
- *Would this notice?* Yes — a whole-row `taskEquals` comparison passes TC-20a–c and fails TC-20d, which is the exact case AC-46 and ADR-013 both name as the one the natural test passes.
