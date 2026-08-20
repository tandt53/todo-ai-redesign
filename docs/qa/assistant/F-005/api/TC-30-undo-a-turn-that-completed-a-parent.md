# TC-30: A turn that completes a parent, then undone — and no step title in the message

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-30 |
| Feature | F-005 (task-detail) |
| Platform | api |
| Acceptance criteria | AC-46, AC-19, AC-35 |
| Type | edge |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | tests/assistant/api/F-005-task-detail.spec.ts (`describe('TC-30 …')`) |
| Created | 2026-08-19 by qa-api-agent |
| Last updated | 2026-08-19 by qa-api-agent |

## Summary
This is the **changed-row** class of AC-46, and revision 4's correction is what makes it a separate case: "**AC-28's five conditions cannot be satisfied by a cascade-ticked step by construction** — it has no `series_id`, it was created long before the completion, and `updated_at !== created_at` because the cascade just wrote it. Read literally, **no cascaded step was ever reverted** — which is exactly the defect `## Impact` §4 says this AC closes, arriving through the clause written to prevent it." Eight steps, because that is the number the AC uses for the nine-diff-line failure.

## Preconditions
- In-process harness: `createApp(deps)` with the `__qa__` doors mounted in front, on an ephemeral port, driven by supertest. Fresh durable store per test.
- The clock seam and the account zone are both held at `T0 = 2026-08-19T12:00:00.000Z` / `UTC` by `POST /__qa__/set-clock` (AC-44). Every fixture instant is derived from `T0`, never from a wall clock (L-023).
- A parent with **eight** steps, one variant with a hand tick placed BEFORE the turn.

## Test steps (API)
| # | Case (automation `it` name) | Request | Expected |
|---|------------------------------|---------|----------|
| 1 | TC-30a the cascaded steps are unticked, and NO STEP TITLE appears in the reverted message | voice-complete a parent with eight steps, then undo | all eight cascade to done with `completed_by_parent: true`; after the undo all eight are open with the flag clear; the parent is reopened |
| 2 | TC-30a (absence half) | inspect `reverted` + `skipped` of the undo, and the turn's own diff | no step title appears anywhere in the reverted message; the parent IS named; the diff carries ONE task id and `changed_task_ids == [parent]` |
| 3 | TC-30b a hand tick made BEFORE the turn survives the undo | hand-tick one step, voice-complete the parent, then undo | the hand-ticked step stays done; the cascade-ticked one is reverted |

## Expected behaviour
- A cascade-ticked step is reverted **on its own snapshot comparison under AC-19's `completed_by_parent` guard** — never as a side effect of the parent's row being replaced, because `undo.ts:98` is a whole-row replacement and the replacement bypasses the guard.
- The **assertion of absence** is the third assertion `## Test strategy` requires: no step title in the reverted turn's outcome message, for a parent with eight steps.
- The undo record covers what the turn **caused**; `turn.diff`, `changed_task_ids`, `created_titles` and `deleted_titles` cover what the user **asked for**. "A voice *done* on a parent with eight steps therefore reverts nine rows and renders one diff" (ADR-013).
- TC-30b is the guard against the charitable misreading — whole-row replay with no guard "reverts hand ticks the user made after the turn, the case `completed_by_parent` exists to distinguish, and L-012's shape."

## Test data
| Field | Value |
|-------|-------|
| namespace | task titles `qaapi5-*`; reserved user ids in `docs/qa/_shared/fixtures/api/f005-users.json`. No unscoped destructive operations (§10). |
| step count | 8 |
| fixture utterance | `qaapi5 finish the parent` → `{status: 'done'}` on the parent |

## Notes
- TC-29 and TC-30 are **structurally distinct cases, not one parameterised over a shared setup**, because the AC states two rules met by different mechanisms (ADR-013's per-class revert condition). One case over both classes is what left every cascaded step un-reverted in revision 3.
- *Would this notice?* Yes — an AC-28-conditions rule applied to cascaded steps fails TC-30a's post-undo assertions on all eight; a step title in `skipped` fails the absence half; a guardless whole-row replay fails TC-30b.
