# TC-03: A write that changes more than one row returns every row it changed

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-03 |
| Feature | F-005 (task-detail) |
| Platform | api |
| Acceptance criteria | AC-26, AC-2 |
| Type | happy |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | qa/assistant/automation/api/F-005-task-detail.spec.ts (`describe('TC-03 …')`) |
| Created | 2026-08-19 by qa-api-agent |
| Last updated | 2026-08-19 by qa-api-agent |

## Summary
`api-contracts.md § The multi-row response rule` states this as a **rule, not a list of the writes it applies to** — because "an enumeration reads as considered, so an implementer builds to its end" and AC-3's no-manual-refresh guarantee then has no mechanism for exactly the gestures AC-28's mis-tap recovery and AC-43's undo are built on.

## Preconditions
- In-process harness: `createApp(deps)` with the `__qa__` doors mounted in front, on an ephemeral port, driven by supertest. Fresh durable store per test.
- The clock seam and the account zone are both held at `T0 = 2026-08-19T12:00:00.000Z` / `UTC` by `POST /__qa__/set-clock` (AC-44). Every fixture instant is derived from `T0`, never from a wall clock (L-023).
- A parent with two steps, so one write legitimately changes three rows.

## Test steps (API)
| # | Case (automation `it` name) | Request | Expected |
|---|------------------------------|---------|----------|
| 1 | TC-03a a write that changes one row returns changed: [] | `PATCH /tasks/{id} {title}` | `changed == []` |
| 2 | TC-03b a write that changes more than one row returns every OTHER row it changed | `PATCH /tasks/{parent} {status:'done'}` | `changed` is exactly the two step rows; the addressed row is **not** repeated there |

## Expected behaviour
- `changed` carries every **other** row the write changed and never repeats the addressed row.
- The client can therefore apply what the write returns; a blind `GET /tasks` is not the mechanism, because the rows are already in hand.

## Test data
| Field | Value |
|-------|-------|
| namespace | task titles `qaapi5-*`; reserved user ids in `qa/_shared/fixtures/api/f005-users.json`. No unscoped destructive operations (§10). |

## Notes
- Membership of `changed` is **not** the same as "was trashed" or "was deleted". A series delete puts the surviving completed occurrence in `changed` because its `series_ended_at` changed (AC-25's fourth ending) — see TC-22's note, where reading `changed` as "deleted" was caught during authoring.
- *Would this notice?* Yes — an implementation returning `{task}` alone fails TC-03b outright.
