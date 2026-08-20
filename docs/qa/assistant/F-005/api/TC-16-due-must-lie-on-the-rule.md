# TC-16: The due date must lie on the rule, and it moves forward

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-16 |
| Feature | F-005 (task-detail) |
| Platform | api |
| Acceptance criteria | AC-23, AC-29 |
| Type | happy |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | tests/assistant/api/F-005-task-detail.spec.ts (`describe('TC-16 …')`) |
| Created | 2026-08-19 by qa-api-agent |
| Last updated | 2026-08-19 by qa-api-agent |

## Summary
AC-23's own worked example is the fixture: due Wednesday, rule "weekly on Monday and Thursday" → the due moves to Thursday. **Forward, never backward** — "backward lands it in the past and the task is overdue the instant the rule is set". And the alignment is *one operation with one order at three entry points*, so all three are exercised rather than the one that is easiest to reach.

## Preconditions
- In-process harness: `createApp(deps)` with the `__qa__` doors mounted in front, on an ephemeral port, driven by supertest. Fresh durable store per test.
- The clock seam and the account zone are both held at `T0 = 2026-08-19T12:00:00.000Z` / `UTC` by `POST /__qa__/set-clock` (AC-44). Every fixture instant is derived from `T0`, never from a wall clock (L-023).
- `T0` is a Wednesday, which is why the AC's example is the ordinary case here rather than a contrivance.

## Test steps (API)
| # | Case (automation `it` name) | Request | Expected |
|---|------------------------------|---------|----------|
| 1 | TC-16a a due the rule does not admit moves forward, never backward | due Wednesday + weekly `mo,th` | the new due is later than the old one and falls on a Thursday |
| 2 | TC-16b the same alignment applies at all THREE entry points | a due the user set; a due AC-22 just created; a due already there when the rule changed | each lands on a day the rule admits, and each moves forward |
| 3 | TC-16c the preview discloses the MOVE, and moved/created are distinct facts | `POST /tasks/{id}/repeat-preview` | `created: false`, `moved: true`, the resulting date; and **no** collection or status in the response |
| 4 | TC-16d a due the rule already admits is not moved | due Monday + weekly `mo` | `moved: false`, and the commit leaves the due where it was |

## Expected behaviour
- The move is always forward.
- All three entry points are one operation with one order (AC-23's "one operation, one order, three entry points").
- The **collection** is not returned by the preview: the server has no opinion about collections (ADR-009), and adding one "would make it a second definition of a number four artifacts already agree on".
- TC-16d is the control — without it, an implementation that always moved the due would pass TC-16a.

## Test data
| Field | Value |
|-------|-------|
| namespace | task titles `qaapi5-*`; reserved user ids in `docs/qa/_shared/fixtures/api/f005-users.json`. No unscoped destructive operations (§10). |
| Wednesday | `2026-08-19T09:00:00.000Z` |
| Thursday | `2026-08-20T09:00:00.000Z` |
| Monday | `2026-08-24T09:00:00.000Z` |

## Notes
- The AC-23 / AC-29 boundary is asserted across two cases on purpose: AC-23 governs **the occurrence in front of you at the moment the rule is set**; AC-29 governs **history** (TC-21b). Revision 1 supported both readings of the same gesture.
- *Would this notice?* Yes — a backward alignment fails TC-16a's `toBeGreaterThan`; an always-move implementation fails TC-16d.
