# TC-14: The recurrence shapes that exist, exactly, and nothing else is expressible

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-14 |
| Feature | F-005 (task-detail) |
| Platform | api |
| Acceptance criteria | AC-21, AC-20 |
| Type | boundary |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | tests/assistant/api/F-005-task-detail.spec.ts (`describe('TC-14 …')`) |
| Created | 2026-08-19 by qa-api-agent |
| Last updated | 2026-08-19 by qa-api-agent |

## Summary
AC-21 fixes the expressible set and its **two deliberate exclusions with the source's reasoning**: no hourly repeat (each occurrence is a row, so a four-hour cycle produces six rows a day) and no weekday selection under a daily rule ("daily, but only Mondays and Fridays is not daily, it is weekly on two days"). ADR-011's representation decision is asserted too, because it is what keeps `turn.diff`'s declared shape unchanged: **flat scalars, sets included**, canonicalised on write.

## Preconditions
- In-process harness: `createApp(deps)` with the `__qa__` doors mounted in front, on an ephemeral port, driven by supertest. Fresh durable store per test.
- The clock seam and the account zone are both held at `T0 = 2026-08-19T12:00:00.000Z` / `UTC` by `POST /__qa__/set-clock` (AC-44). Every fixture instant is derived from `T0`, never from a wall clock (L-023).
- `POST /__qa__/seed` for a non-canonical stored `repeat_weekdays` — the door is its only producer.

## Test steps (API)
| # | Case (automation `it` name) | Request | Expected |
|---|------------------------------|---------|----------|
| 1 | TC-14a every N days / weeks / months / years is expressible | create with each frequency | each is accepted, gets a `series_id`, and reads `series_live: true` |
| 2 | TC-14b NO hourly repeat | `repeat_frequency: 'hour'` | `400 VALIDATION`, nothing written |
| 3 | TC-14c NO weekday selection under a DAILY rule, and no month_days under a weekly one | three illegal combinations | `400 VALIDATION` each; the row still has no repeat |
| 4 | TC-14d the interval bound 1–999 | 1 and 999; then 0, -1, 1000 | accepted / refused respectively |
| 5 | TC-14e a set member is CANONICALISED, not refused; an out-of-set value and "" are refused | `'th,mo'`; `'15,1,15'`; `'funday'`, `''`, `'0'`, `'32'` | `'mo,th'`; `'1,15'`; `400` for the rest; clearing the member to `null` is accepted |
| 6 | TC-14f a repeat is reported as PER-MEMBER diff rows, flat scalars, on a turn delete | a turn that deletes a weekly task | one diff row per member, `old` a scalar and `new` null; no `recurrence` row and no object on either side |
| 7 | TC-14g a non-canonical STORED value is still readable | seed `repeat_weekdays: 'th,mo'`, then `GET /tasks` | `200`, the row is listed — a read never refuses |

## Expected behaviour
- The two exclusions are **refused**, not coerced into the nearest legal rule.
- A non-canonical write is canonicalised (`'th,mo'` → `'mo,th'`); a value outside the set is refused; `''` is refused, because "an empty set is not representable and is not a state" — the rule *without* the member is how you express it.
- A recurrence change is reported as per-member diff rows whose values are scalars, so `data-model.md § assistant_turn`'s declared `{task_id, field, old|null, new|null}` shape does not change and F-001 AC-4 renders `old → new` for a weekly rule exactly as for a title (ADR-011).

## Test data
| Field | Value |
|-------|-------|
| namespace | task titles `qaapi5-*`; reserved user ids in `qa/_shared/fixtures/api/f005-users.json`. No unscoped destructive operations (§10). |
| canonical order | `mo,tu,we,th,fr,sa,su`; month days ascending, comma-joined |
| interval bound | 1–999 (`api-contracts.md § Validation bounds`) |

## Notes
- TC-14f goes through a turn **delete**, not a turn set: AC-36 forbids a turn setting a repeat, so the delete path (`applyDelete` enumerates every non-null `DIFF_FIELDS` member) is the only place the per-member shape is observable — and it is the ordinary case, not an edge.
- *Would this notice?* Yes — a nested `recurrence` object would fail TC-14f's `typeof` and `not.toBeUndefined` assertions, which is the collision with the `null` sentinel ADR-011 exists to make unreachable.
