# TC-12: The order of the steps is the user's, and it survives a restart

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-12 |
| Feature | F-005 (task-detail) |
| Platform | api |
| Acceptance criteria | AC-15, AC-41, AC-43 |
| Type | happy |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | tests/assistant/api/F-005-task-detail.spec.ts (`describe('TC-12 …')`) |
| Created | 2026-08-19 by qa-api-agent |
| Last updated | 2026-08-19 by qa-api-agent |

## Summary
AC-15 names four edges the source fixes, and each gets a case that can only be reached that way (L-005, L-012). The persistence half is the one that needs the harness: "AC-15's 'survives a restart' has nothing to survive while the harness composes a fresh `new MemoryStore()` per process, so its persistence case runs against the durable store and its restart is a **store re-open**" — without that door the assertion is a re-read of the same RAM and would pass whatever persistence does.

## Preconditions
- In-process harness: `createApp(deps)` with the `__qa__` doors mounted in front, on an ephemeral port, driven by supertest. Fresh durable store per test.
- The clock seam and the account zone are both held at `T0 = 2026-08-19T12:00:00.000Z` / `UTC` by `POST /__qa__/set-clock` (AC-44). Every fixture instant is derived from `T0`, never from a wall clock (L-023).
- The harness store is durable (a per-test snapshot path), so `POST /__qa__/reopen-store` has something to re-open.
- `POST /__qa__/seed` for adjacent positions — the append rule never produces a gap of 1.

## Test steps (API)
| # | Case (automation `it` name) | Request | Expected |
|---|------------------------------|---------|----------|
| 1 | TC-12a a move writes ONE row, and its prior position rides the response | `PATCH {step_order: <midpoint>}` | `prior == {step_order: <old>}`, `changed == []`, and the read-back order is the new order |
| 2 | TC-12b a drop where the step ALREADY was writes nothing | `PATCH {step_order: <current>}` | `200`, `prior == {}`, `changed == []`, `updated_at` unmoved |
| 3 | TC-12c a gap too small to bisect renumbers the siblings and returns every row it changed | seed positions 1000/1001/1002, then move into the gap | `changed` is non-empty, all three positions remain distinct, and it was ONE request |
| 4 | TC-12d the order is NEVER derived from a step's date | give the LAST step the EARLIEST due | the order is unchanged — a date-derived order would jump it |
| 5 | TC-12e a DONE step keeps its position and can still be moved | complete a step, then move it | position kept on completion; the move succeeds and the step stays done |
| 6 | TC-12f a list of ONE step cannot be reordered | `PATCH {step_order: <current>}` on an only child | the no-op is the only reachable request |
| 7 | TC-12g the order SURVIVES A RESTART | move a step, `POST /__qa__/reopen-store`, read back | the order after the re-open is byte-identical to the order before |
| 8 | TC-12h deleting a step and then restoring returns it to the position it HELD | delete a middle step, `POST /tasks/{id}/restore` | `step_order` is the value it had, and the list order is restored |

## Expected behaviour
- A move writes **one** row: `changed == []` when the gap suffices, and `prior.step_order` is the single source for the reorder undo (ADR-015 — "AC-15's *carried by the move's own response* and *a value the client already holds* are one source, not two").
- A no-op drop is `200` with `prior: {}` and writes nothing — the observable AC-43's *no undo entry* and AC-16's *announces nothing* are asserted against.
- The restart case runs against a durable store and a genuine re-open, which is what makes it falsifiable.
- The restore case is why AC-41 exists: the order lives on a **server row**, not a client buffer.

## Test data
| Field | Value |
|-------|-------|
| namespace | task titles `qaapi5-*`; reserved user ids in `qa/_shared/fixtures/api/f005-users.json`. No unscoped destructive operations (§10). |
| sparse gap | 1024; midpoint on a move; renumber when the gap is < 2 (ADR-015) |
| seeded dense positions | 1000, 1001, 1002 |

## Notes
- *Would this notice?* Yes — a client-side order fails TC-12g; a date-derived order fails TC-12d; a renumber that did not report its rows fails TC-12c; a restore that re-created the row rather than restoring it fails TC-12h.
- TC-12e also encodes "finished does not mean no longer part of this list", which is one of AC-15's four named edges.
