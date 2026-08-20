# TC-01: The three `__qa__` doors do what they claim

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-01 |
| Feature | F-005 (task-detail) |
| Platform | api |
| Acceptance criteria | AC-8, AC-15, AC-34, AC-44 |
| Type | edge |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | tests/assistant/api/F-005-task-detail.spec.ts (`describe('TC-01 …')`) |
| Created | 2026-08-19 by qa-api-agent |
| Last updated | 2026-08-19 by qa-api-agent |

## Summary
`api-contracts.md § Harness doors` names three test-only doors and says why each has to exist: three F-005 ACs have **no reachable fixture without them**. This case asserts the doors themselves, before any other case leans on them. A door that silently did nothing would make AC-8's tolerant read, AC-34's old-shape snapshot and AC-15's restart all green for the wrong reason (L-012) — the coverage matrix would report them covered and no test would defend them.

## Preconditions
- In-process harness: `createApp(deps)` with the `__qa__` doors mounted in front, on an ephemeral port, driven by supertest. Fresh durable store per test.
- The clock seam and the account zone are both held at `T0 = 2026-08-19T12:00:00.000Z` / `UTC` by `POST /__qa__/set-clock` (AC-44). Every fixture instant is derived from `T0`, never from a wall clock (L-023).
- `POST /__qa__/seed`, `POST /__qa__/set-clock` and `POST /__qa__/reopen-store` mounted from `tests/harness/qa-doors.ts` — one implementation, shared with the Playwright harness process.

## Test steps (API)
| # | Case (automation `it` name) | Request | Expected |
|---|------------------------------|---------|----------|
| 1 | TC-01a seed writes a row VERBATIM, bypassing every write rule | `POST /tasks {priority:'urgent'}`, then `POST /__qa__/seed` with the same value | the write path answers `400`; the seed door stores `priority: 'urgent'` verbatim |
| 2 | TC-01b seed refuses a row with no id rather than dropping it silently | `POST /__qa__/seed {tasks:[{title}]}` | `400 QA_DOOR` — a door that dropped the row would make its callers' fixtures vanish invisibly |
| 3 | TC-01c set-clock holds BOTH the instant and the zone | `POST /__qa__/set-clock {at, zone, users}` | `now` moves, `GET /account.timezone` is the new zone with `timezone_source: 'user'`, and a row created afterwards carries `created_at == at` |
| 4 | TC-01d reopen-store re-reads the durable snapshot in-process | `POST /tasks`, then `POST /__qa__/reopen-store` | `{reopened: true, reopens: 1}` and the row is served by a store instance constructed after the write |
| 5 | TC-01e an unknown harness door is a stated 404 | `POST /__qa__/no-such-door` | `404 QA_DOOR` — never a silent fall-through to the real app |

## Expected behaviour
- The seed door writes rows **verbatim**, bypassing validation, defaulting and field completion. That is the whole point: it is the only producer of an out-of-set stored `priority` (AC-8), a pre-F-005 snapshot record (AC-34), a non-canonical `repeat_weekdays` (ADR-011) and a soft-deleted row with `delete_gesture_id: null` (ADR-012).
- `set-clock` moves the clock **and** writes the zone onto the account row, because ADR-010 makes `account.timezone` the one source every date computation reads. Setting only the instant would leave the zone free to differ — L-023's exact shape.
- `reopen-store` swaps the app's store for one freshly constructed from the durable snapshot. With no `snapshotPath` it **refuses** rather than pretending, so AC-15's persistence case cannot pass against a re-read of the same RAM.

## Test data
| Field | Value |
|-------|-------|
| namespace | task titles `qaapi5-*`; reserved user ids in `docs/qa/_shared/fixtures/api/f005-users.json`. No unscoped destructive operations (§10). |
| clock | `T0` / `UTC`, held for the run |
| seeded priority | `'urgent'` — outside AC-8's four-state set, refused by the write path by design |

## Notes
- *Would this notice if the door broke?* Yes: a seed door that validated would fail TC-01a's second half; one that dropped rows would fail TC-01b; a `set-clock` that moved only the instant would fail TC-01c's `GET /account` assertion; a `reopen-store` that returned `{reopened:true}` without swapping would fail TC-01d's post-reopen read only if the store were non-durable, which is why the harness composes a durable one per test.
- The doors live in `qa-doors.ts` and are mounted by both `qa-test-server.ts` (the e2e process) and the api suites. One implementation, deliberately — two seed doors would be L-004's shape inside the instrument built to detect it.
