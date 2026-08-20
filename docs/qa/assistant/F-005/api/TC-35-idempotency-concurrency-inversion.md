# TC-35: Idempotency, concurrency, and the pinned contract inversion

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-35 |
| Feature | F-005 (task-detail) |
| Platform | api |
| Acceptance criteria | AC-26, AC-38, AC-41, AC-2 |
| Type | edge |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | tests/assistant/api/F-005-task-detail.spec.ts (`describe('TC-35 …')`) |
| Created | 2026-08-19 by qa-api-agent |
| Last updated | 2026-08-19 by qa-api-agent |

## Summary
The two brand-new write paths are the ones most likely to duplicate a side effect, and AC-26's "no occurrence generates a second" is a concurrency claim as much as a logic one. This case also pins the **contract inversion the contract itself names**: `POST /tasks` with `reminder_at` used to be `400` and must now be `201` — "named so nobody weakens the assertion instead."

## Preconditions
- In-process harness: `createApp(deps)` with the `__qa__` doors mounted in front, on an ephemeral port, driven by supertest. Fresh durable store per test.
- The clock seam and the account zone are both held at `T0 = 2026-08-19T12:00:00.000Z` / `UTC` by `POST /__qa__/set-clock` (AC-44). Every fixture instant is derived from `T0`, never from a wall clock (L-023).

## Test steps (API)
| # | Case (automation `it` name) | Request | Expected |
|---|------------------------------|---------|----------|
| 1 | TC-35a POST /tasks now ACCEPTS reminder_at | `POST /tasks {title, reminder_at}` | `201`, and the reminder is on the row |
| 2 | TC-35b restore and reminder-ack are idempotent | restore twice; ack twice | `restored: true` then `false`, one row; the second ack leaves the marker at the first ack's value |
| 3 | TC-35c N concurrent completions of one repeating occurrence generate at most ONE successor | four simultaneous `PATCH {status:'done'}` | all `200`; the series holds exactly two rows — the occurrence and ONE successor |
| 4 | TC-35d a read reflects the write immediately | write two fields, then read back | both values are there — no stale cache |
| 5 | TC-35e the repeat-preview writes NOTHING, however many times it is called | three previews on one row | the row is byte-identical to before, `updated_at` included |

## Expected behaviour
- Repeated calls to the new routes produce the same result and no duplicate side effect.
- Concurrent completions produce the side effect **exactly once**, not N times — the missing-idempotency-guard probe.
- The preview is pure: "it writes nothing", asserted by full-row equality rather than by spot-checking a field.

## Test data
| Field | Value |
|-------|-------|
| namespace | task titles `qaapi5-*`; reserved user ids in `docs/qa/_shared/fixtures/api/f005-users.json`. No unscoped destructive operations (§10). |
| concurrency | 4 simultaneous completions of one occurrence |

## Notes
- TC-35a replaces a shipped unit assertion the contract explicitly routes for inversion (`api/__tests__/tasks.test.ts:74`). That file is backend-agent's; this case is the api tier's own pin on the new behaviour, so the inversion cannot be lost in either place without a red test.
- *Would this notice?* Yes — a generation step outside the completing transaction fails TC-35c; a preview that committed fails TC-35e's full-row equality, which is also AC-48's "an uncommitted repeat preview is discarded rather than committed" seen from the api side.
