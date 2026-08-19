# TC-02: Every change is a field-level write, falsifiable both ways

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-02 |
| Feature | F-005 (task-detail) |
| Platform | api |
| Acceptance criteria | AC-2 |
| Type | happy |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | tests/assistant/api/F-005-task-detail.spec.ts (`describe('TC-02 …')`) |
| Created | 2026-08-19 by qa-api-agent |
| Last updated | 2026-08-19 by qa-api-agent |

## Summary
AC-2 is falsifiable in two directions and both are asserted here: the request body carries **exactly** the changed keys, and a value changed on the same task by an assistant turn between load and save is **still present afterwards**. "A whole-object write that happens to look correct fails this AC" — so the negative half is the interleaving, not an inspection of the body.

## Preconditions
- In-process harness: `createApp(deps)` with the `__qa__` doors mounted in front, on an ephemeral port, driven by supertest. Fresh durable store per test.
- The clock seam and the account zone are both held at `T0 = 2026-08-19T12:00:00.000Z` / `UTC` by `POST /__qa__/set-clock` (AC-44). Every fixture instant is derived from `T0`, never from a wall clock (L-023).
- A task with a note and a priority already set, so an unmentioned field has a value that a whole-object write would clobber.

## Test steps (API)
| # | Case (automation `it` name) | Request | Expected |
|---|------------------------------|---------|----------|
| 1 | TC-02a the request carries exactly the changed keys; prior names only them | `PATCH /tasks/{id} {priority}` | `200`, `prior == {priority: <previous>}` with exactly one key; `note` and `title` unchanged; `updated_at` advanced |
| 2 | TC-02b a no-op write returns prior {} and writes nothing | `PATCH /tasks/{id} {priority: <same>}` | `200`, `prior == {}` |
| 3 | TC-02c a value changed by an assistant turn between load and save survives | load → `POST /assistant/turn` sets `note` → `PATCH /tasks/{id} {priority}` | the saved response carries the assistant's `note`, not the value the surface loaded |

## Expected behaviour
- `prior` names **only** the fields the write actually changed (ADR-015) — it is the contract's own evidence that the write was field-level.
- `updated_at` advances on every accepted change (UC-27 AC-27.1).
- In the interleaving, a whole-object write would have posted `note: null` (the value the surface loaded) and silently lost the arrival. The assertion is on the arrival surviving, not on the request body, because that is the half an implementation can fail while looking correct.

## Test data
| Field | Value |
|-------|-------|
| namespace | task titles `qaapi5-*`; reserved user ids in `qa/_shared/fixtures/api/f005-users.json`. No unscoped destructive operations (§10). |
| interleaved turn | `qaapi5 note the interleaved one` → `{note: 'the assistant got here first'}` |

## Notes
- *Would this notice?* Yes — TC-02c goes red the moment `PATCH` sends or applies fields the user did not change; TC-02a goes red if `prior` reports more than the changed set.
- AC-2's failed-write and offline-refusal states are `(web, mobile)` surface obligations (AC-47, AC-2's third state) and are not observable at this tier.
