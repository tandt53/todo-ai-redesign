# TC-13: What happens to a step when its parent moves — all four transitions

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-13 |
| Feature | F-005 (task-detail) |
| Platform | api |
| Acceptance criteria | AC-19, AC-26, AC-41 |
| Type | happy |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | qa/assistant/automation/api/F-005-task-detail.spec.ts (`describe('TC-13 …')`) |
| Created | 2026-08-19 by qa-api-agent |
| Last updated | 2026-08-19 by qa-api-agent |

## Summary
AC-19 lists four transitions "because these are where an under-specified spec hands the decision to whoever writes the code". The un-complete case is the one with a shipped-wrong alternative: "the plausible invention — compare a step's `updated_at` to the parent's — is wrong for the exact case the rule exists to protect: tick a step, tick the parent a second later, lose your own tick on un-complete" (product F1). So the observable is the recorded `completed_by_parent` flag, not a timestamp.

## Preconditions
- In-process harness: `createApp(deps)` with the `__qa__` doors mounted in front, on an ephemeral port, driven by supertest. Fresh durable store per test.
- The clock seam and the account zone are both held at `T0 = 2026-08-19T12:00:00.000Z` / `UTC` by `POST /__qa__/set-clock` (AC-44). Every fixture instant is derived from `T0`, never from a wall clock (L-023).
- A parent with three steps, one of them ticked **by hand** before the parent is completed.

## Test steps (API)
| # | Case (automation `it` name) | Request | Expected |
|---|------------------------------|---------|----------|
| 1 | TC-13a parent completed → the steps are completed WITH it | `PATCH {status:'done'}` on the parent | `changed` is exactly the step rows, each `done` with `completed_by_parent: true` |
| 2 | TC-13b parent completed with steps OUTSTANDING is allowed | complete a parent with three open steps | `200` — never a 400 or 409; the count informs, never gates |
| 3 | TC-13c parent un-completed → the cascade is undone, AND ONLY the cascade | hand-tick one step, complete the parent, then un-complete it | the hand-ticked step stays done; the cascade-ticked ones come back and their flag clears; `changed` names the reverted steps and not the hand-ticked one |
| 4 | TC-13d a hand UNTICK of a cascade-ticked step also clears the flag | cascade, untick one step by hand, then un-complete the parent | the unticked step is not re-ticked as if the cascade owned it |
| 5 | TC-13e parent deleted → its steps go with it, under ONE delete gesture | `DELETE` the parent, then `POST /tasks/{id}/restore` | the delete returns the steps in `changed`; the restore brings back the whole cluster in one call |

## Expected behaviour
- The cascade **records** what it ticked (`completed_by_parent`), and a hand tick or untick clears the flag. Which is which is recorded, never inferred.
- Completing with steps outstanding is allowed: "a todo app that refuses to let you finish something is arguing with its user."
- The delete/restore pair is atomic at the cluster level (AC-41, AC-43), which is why AC-41 had to exist.

## Test data
| Field | Value |
|-------|-------|
| namespace | task titles `qaapi5-*`; reserved user ids in `qa/_shared/fixtures/api/f005-users.json`. No unscoped destructive operations (§10). |
| step count | 3 (one hand-ticked, two cascaded) |

## Notes
- *Would this notice?* Yes — an `updated_at` comparison instead of the flag fails TC-13c, because the frozen clock makes the hand tick and the cascade indistinguishable by timestamp. That is the case product F1 named, and the held clock makes it the ordinary path rather than a race.
- AC-19's `(mobile)` obligation ("the cascade neither corrupts the list nor leaves a step visible") is qa-mobile-agent's; the api half is the cascade itself and AC-35's exclusion (TC-25).
