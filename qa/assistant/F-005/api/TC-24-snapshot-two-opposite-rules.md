# TC-24: Restoring a snapshot never unsets a field the snapshot predates

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-24 |
| Feature | F-005 (task-detail) |
| Platform | api |
| Acceptance criteria | AC-34, AC-8 |
| Type | edge |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | tests/assistant/api/F-005-task-detail.spec.ts (`describe('TC-24 …')`) |
| Created | 2026-08-19 by qa-api-agent |
| Last updated | 2026-08-19 by qa-api-agent |

## Summary
AC-34 states **two records, two opposite treatments**, and revision 1 covered only the first. The fixture is a contract obligation rather than test guidance: "a snapshot captured by the current build is already the new shape, and **a test that captures its own snapshot cannot fail this AC**" (tester T22). So both records are written in the pre-F-005 shape by `POST /__qa__/seed`.

## Preconditions
- In-process harness: `createApp(deps)` with the `__qa__` doors mounted in front, on an ephemeral port, driven by supertest. Fresh durable store per test.
- The clock seam and the account zone are both held at `T0 = 2026-08-19T12:00:00.000Z` / `UTC` by `POST /__qa__/set-clock` (AC-44). Every fixture instant is derived from `T0`, never from a wall clock (L-023).
- `POST /__qa__/seed` writing a turn row whose `undo_snapshot` and `post_apply` carry **only the F-001 baseline keys** — no `note`, no `due_all_day`, no `step_order`.
- A real open session, obtained from a non-mutating turn so the undo window is untouched.

## Test steps (API)
| # | Case (automation `it` name) | Request | Expected |
|---|------------------------------|---------|----------|
| 1 | TC-24a ON COMPARISON an absent key means "not recorded" and compares EQUAL to whatever is live | seed an old-shape applied turn, then `POST /assistant/turn/{id}/undo` | `200`, `undone: true`, `skipped: []`, `nothing_reverted: false`, and the revert actually happened |
| 2 | TC-24b ON REPLAY a field the stored record does not mention is left exactly as it is | the live row carries a `note` and `priority: high`; undo | the recorded field is replayed; `note` and `priority` are untouched |
| 3 | TC-24c the stored record is NOT rewritten to the new shape | read the seeded turn back out of the store after an ordinary history read | the snapshot's key set still lacks `note`, `due_all_day` and `step_order` |

## Expected behaviour
- On comparison: without this rule "every pre-F-005 `post_apply` record compares unequal to its live row — `undefined` stored versus `null` live — for **every new field at once**, so an undo across the change reverts nothing and reports **every** task as modified: F-001 AC-7's skip path firing on tasks the user never touched."
- On replay: "a field the stored record does not mention is left exactly as it is, and 'no value' is never written over a value the user set."
- Stored records are past states and are not rewritten (`ADR-009`, `data-model.md § status` — "the method this AC copies rather than invents").

## Test data
| Field | Value |
|-------|-------|
| namespace | task titles `qaapi5-*`; reserved user ids in `qa/_shared/fixtures/api/f005-users.json`. No unscoped destructive operations (§10). |
| pre-F-005 record keys | `id, user_id, title, due_at, reminder_at, priority, status, created_at, updated_at, deleted_at` |

## Notes
- `priority` is part of the **F-001 baseline**, not an F-005 addition, so it is PRESENT in a pre-F-005 record and the fixture must carry the row's stored value (`null` for `none`). Getting that wrong made TC-24b red on first authoring — the comparison failed on `priority`, not on the absent keys, so the case was measuring the wrong thing. This is L-012's shape in a fixture.
- The comparison baseline is `post_apply`, not `undo_snapshot` (`api-contracts.md`: comparing against the pre-apply snapshot "would make undo revert nothing"). Both are seeded in the old shape so neither can rescue the other.
- AC-34's other named reader is **F-001** AC-12's bulk-delete re-validation — "the reference is to *F-001's* AC-12, not to this spec's date-picker AC of the same number, which is a collision a QA author resolving it inside this document would silently get wrong" (tester T30). It is covered by the F-001 suite's TC-11.
