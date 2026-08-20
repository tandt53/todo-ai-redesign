# TC-08: `due_all_day`: a date-only due never behaves as a time nobody chose

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-08 |
| Feature | F-005 (task-detail) |
| Platform | api |
| Acceptance criteria | AC-13, AC-44 |
| Type | boundary |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | tests/assistant/api/F-005-task-detail.spec.ts (`describe('TC-08 …')`) |
| Created | 2026-08-19 by qa-api-agent |
| Last updated | 2026-08-19 by qa-api-agent |

## Summary
`due_all_day` is "a requirement, not a schema instruction": a date-only deadline must be **distinguishable from one at midnight**, because AC-22 creates date-only deadlines by rule and a fabricated 00:00 would show up as a time the user never picked. The contract's three resolution rules are asserted one per case, including the two that only the seed door can construct — measured, **0 of 790 live rows carry the flag**, so on day one rule 2 and rule 3 are every row on every `GET /tasks`.

## Preconditions
- In-process harness: `createApp(deps)` with the `__qa__` doors mounted in front, on an ephemeral port, driven by supertest. Fresh durable store per test.
- The clock seam and the account zone are both held at `T0 = 2026-08-19T12:00:00.000Z` / `UTC` by `POST /__qa__/set-clock` (AC-44). Every fixture instant is derived from `T0`, never from a wall clock (L-023).
- `POST /__qa__/seed`, for rows with no stored flag and for an account with `timezone: null`.

## Test steps (API)
| # | Case (automation `it` name) | Request | Expected |
|---|------------------------------|---------|----------|
| 1 | TC-08a a timed due is timed; a due at the local start of its own day is all-day | create with `due_at` at 09:00, and at the day's local start | `false` and `true` respectively |
| 2 | TC-08b a STORED flag is authoritative | create the SAME instant twice, once `due_all_day: false` and once `true` | each keeps what it was given, and it survives a read |
| 3 | TC-08c absent flag + a zone: the server resolves it and does NOT rewrite the row | seed two rows with `due_all_day: null`, then `GET /tasks` | the wire carries `true` / `false`; the STORE still carries `null` for both |
| 4 | TC-08d the next write that touches due_at stores the resolved value | seed a `null`-flag row, then `PATCH {due_at}` | the store now carries a boolean — the `null` population drains by itself |
| 5 | TC-08e absent flag + NO zone: the wire carries null, and the READ still succeeds | seed an account with `timezone: null` and a `null`-flag row; `GET /tasks` zoneless | `200`, `due_all_day: null`, `due_at` unchanged |

## Expected behaviour
- Rule 1 — a stored flag is authoritative on every tier.
- Rule 2 — absent with a zone, the server resolves it (all-day iff the instant is the local start of its own day) and emits the answer **without rewriting the row**.
- Rule 3 — absent with no zone, the wire carries `null`, meaning *not determined*. **A read never refuses**: AC-18's "a refused write writes nothing" governs writes; a read withholds a derived value, never a row.
- The same instant with opposite flags is the falsifiable form of "distinguishable from one at midnight".

## Test data
| Field | Value |
|-------|-------|
| namespace | task titles `qaapi5-*`; reserved user ids in `docs/qa/_shared/fixtures/api/f005-users.json`. No unscoped destructive operations (§10). |
| local day start | `2026-08-19T00:00:00.000Z` (zone `UTC`) |
| timed due | `2026-08-20T09:00:00.000Z` |
| measured | 0 of 790 live rows carry `due_all_day` (spec, 2026-08-19) |

## Notes
- *Would this notice?* Yes — an implementation that rewrote the row on read fails TC-08c's store assertion; one that refused the zoneless read fails TC-08e's status; one that ignored a supplied flag fails TC-08b.
- TC-08c and TC-08e read the store and the wire separately on purpose: "the row is not rewritten by the read" is invisible from the wire alone.
