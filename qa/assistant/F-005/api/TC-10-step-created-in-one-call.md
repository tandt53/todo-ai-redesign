# TC-10: A step is created in one call, positioned by the server

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-10 |
| Feature | F-005 (task-detail) |
| Platform | api |
| Acceptance criteria | AC-14 |
| Type | happy |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | qa/assistant/automation/api/F-005-task-detail.spec.ts (`describe('TC-10 …')`) |
| Created | 2026-08-19 by qa-api-agent |
| Last updated | 2026-08-19 by qa-api-agent |

## Summary
AC-14: "**A step is created in one call** — `POST /tasks` accepts `parent_id` and the rest of the field set… **Not POST-then-PATCH**: between the two calls the step exists at an undefined position, and AC-3's live-update guarantee renders that state to every other client watching" (architect F11). The offline-replay clause is asserted in both directions, because the unconditional reading — *server always assigns* — silently voids it while every AC still reads as satisfied.

## Preconditions
- In-process harness: `createApp(deps)` with the `__qa__` doors mounted in front, on an ephemeral port, driven by supertest. Fresh durable store per test.
- The clock seam and the account zone are both held at `T0 = 2026-08-19T12:00:00.000Z` / `UTC` by `POST /__qa__/set-clock` (AC-44). Every fixture instant is derived from `T0`, never from a wall clock (L-023).
- `POST /__qa__/seed` for the 200-step bound, so a bound assertion is not 200 round trips.

## Test steps (API)
| # | Case (automation `it` name) | Request | Expected |
|---|------------------------------|---------|----------|
| 1 | TC-10a POST /tasks accepts parent_id and returns a positioned step | `POST /tasks {title, parent_id}` | `201`, `parent_id` set, `step_order` a number — never null |
| 2 | TC-10b a step created without a position is appended LAST | three creates in order | strictly increasing `step_order` |
| 3 | TC-10c a create SUPPLYING step_order keeps it | `POST /tasks {parent_id, step_order: 7}` | `step_order == 7` on the response and on read-back |
| 4 | TC-10d the steps-per-parent bound is stated and REFUSED | seed 200 steps, then create the 201st | `400 VALIDATION`, and the parent still has exactly 200 |

## Expected behaviour
- There is no window in which the step exists with no position.
- A create that supplies a position keeps it — that is what makes an offline-created step come back as a step rather than as a top-level task (AC-14's replay clause, ADR-015).
- The bound is refused, never silently enforced (product P12).

## Test data
| Field | Value |
|-------|-------|
| namespace | task titles `qaapi5-*`; reserved user ids in `qa/_shared/fixtures/api/f005-users.json`. No unscoped destructive operations (§10). |
| steps-per-parent bound | 200 (`api-contracts.md § Validation bounds`) |
| sparse gap | 1024 (ADR-015) |

## Notes
- *Would this notice?* Yes — a server that always assigns fails TC-10c; a POST-then-PATCH implementation fails TC-10a's `step_order` assertion on the create response.
- `parent_id` validation is TC-11c; the nesting refusal is TC-11a.
