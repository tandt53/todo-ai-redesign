# TC-06: Priority has exactly four states, and `none` is an absence rather than a string

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-06 |
| Feature | F-005 (task-detail) |
| Platform | api |
| Acceptance criteria | AC-8, AC-40 |
| Type | boundary |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | qa/assistant/automation/api/F-005-task-detail.spec.ts (`describe('TC-06 …')`) |
| Created | 2026-08-19 by qa-api-agent |
| Last updated | 2026-08-19 by qa-api-agent |

## Summary
AC-8 narrows a field that "accepts any string today", which makes it a **migration rather than an addition**. Two things are asserted that the wire cannot distinguish on its own: `none` is the **absence of a stored value**, and a stored value **outside** the set reads as `none` rather than breaking a client. The second has no fixture through the API at all — "this AC's own write path refuses exactly the value it must tolerate" — so it uses the seed door.

## Preconditions
- In-process harness: `createApp(deps)` with the `__qa__` doors mounted in front, on an ephemeral port, driven by supertest. Fresh durable store per test.
- The clock seam and the account zone are both held at `T0 = 2026-08-19T12:00:00.000Z` / `UTC` by `POST /__qa__/set-clock` (AC-44). Every fixture instant is derived from `T0`, never from a wall clock (L-023).
- `POST /__qa__/seed` available, for the out-of-set stored value.

## Test steps (API)
| # | Case (automation `it` name) | Request | Expected |
|---|------------------------------|---------|----------|
| 1 | TC-06a each of the four is settable and clearable in one action | `PATCH {priority}` for `low`, `medium`, `high`, then `none` | each returns the value it set; a fresh row reads `none` |
| 2 | TC-06b 'none' stores the ABSENCE of a value, not the string "none" | create with `priority:'none'`, then read the **store** | the stored field is `null`, explicitly not `'none'`; clearing an existing value stores `null` too |
| 3 | TC-06c a create at priority 'none' emits NO priority diff row | a turn create; and a plain create read from the store | a row with no priority stores `null`, so `applyCreate` has nothing to enumerate |
| 4 | TC-06d a write carrying any other value is rejected, and nothing is written | `PATCH {priority}` for `urgent`, `normal`, `HIGH`, `''`, `'none '`, `'1'` | `400 VALIDATION field: 'priority'` each time, stored value unchanged |
| 5 | TC-06e a stored value OUTSIDE the set reads as 'none' | seed `priority: 'Urgent'`, then `GET /tasks` | the row's wire `priority` is `'none'`, never `'Urgent'`, and the read returns `200` |

## Expected behaviour
- The wire never carries `null` for `priority`; the row stores `null` and the serializer emits `"none"`.
- The two observables AC-8 names are asserted separately: no `priority` diff row on a create (`applyCreate` skips null fields), and stored `null` comparing equal to live `none` (`taskEquals` compares `===`) — the second is TC-24a's subject.
- The tolerant read emits `none` **and** succeeds. Both halves matter: "never as itself and never as an error."

## Test data
| Field | Value |
|-------|-------|
| namespace | task titles `qaapi5-*`; reserved user ids in `qa/_shared/fixtures/api/f005-users.json`. No unscoped destructive operations (§10). |
| measured live data | 783 of 790 rows hold `null`, 7 hold `"high"` — migration-free (AC-8, 2026-08-18) |
| seeded out-of-set value | `'Urgent'` |

## Notes
- *Would this notice?* Yes — a literal `'none'` in the store fails TC-06b; a tolerant read that echoed the stored value fails TC-06e's `not.toBe('Urgent')`; a read that 500'd on it fails the same case's status assertion.
- TC-06b and TC-06c read the store directly rather than the wire, because the wire deliberately erases the distinction. That is an observation of the running system's state, not of its source.
