# TC-17: Month-day overflow lands on the last day of the month, and candidates de-duplicate

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-17 |
| Feature | F-005 (task-detail) |
| Platform | api |
| Acceptance criteria | AC-24, AC-44 |
| Type | boundary |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | tests/assistant/api/F-005-task-detail.spec.ts (`describe('TC-17 …')`) |
| Created | 2026-08-19 by qa-api-agent |
| Last updated | 2026-08-19 by qa-api-agent |

## Summary
AC-24 has a **shipped failure record**: "adding a month to 31 January with the platform's own date arithmetic yields 3 March… The clamp is not a nicety on top of the date library; it is the thing the date library gets wrong." The de-duplication half is the case a plain month-boundary table would have missed — `{30, 31}` in April both resolve to the 30th, "a defect that only becomes visible once the set has two members, which is precisely why the month-boundary table the test strategy asks for would not have contained it" (architect F13).

## Preconditions
- In-process harness: `createApp(deps)` with the `__qa__` doors mounted in front, on an ephemeral port, driven by supertest. Fresh durable store per test.
- The clock and zone are re-held at each row's own due instant, so the roll is computed from the previous due and the harness never mixes two instants (L-023).
- Each row is its own fixture, so a failure names one boundary.

## Test steps (API)
| # | Case (automation `it` name) | Request | Expected |
|---|------------------------------|---------|----------|
| 1 | TC-17a the month-boundary table | 31 Jan → Feb (2027, not a leap year); 31 Jan → Feb (2028, leap); 31 Mar → Apr; 31 May → Jun; 31 Dec → Jan | 28 Feb / 29 Feb / 30 Apr / 30 Jun / 31 Jan — and the month is always the next one, never a spill and never a skip |
| 2 | TC-17b candidates are DE-DUPLICATED after clamping | monthly on `30,31`, rolled 30 Mar → 31 Mar → April → May | April yields exactly ONE successor dated the 30th, and the next roll leaves April |

## Expected behaviour
- A rule naming day 31 in a 30-day month falls on the 30th; in February, the 28th or 29th.
- It never spills into the next month ("wrong in both the day and the month") and never skips the month ("which would make the task vanish from four months a year with nothing to explain it") — the month index is asserted, not just the date string.
- `{30,31}` in April produces **one** date, not the 30th twice: exactly one successor row.

## Test data
| Field | Value |
|-------|-------|
| namespace | task titles `qaapi5-*`; reserved user ids in `qa/_shared/fixtures/api/f005-users.json`. No unscoped destructive operations (§10). |
| leap year | 2028 (29 Feb); 2027 is not a leap year (28 Feb) |
| month_days | `'31'` for the table; `'30,31'` for the de-duplication case |

## Notes
- *Would this notice?* Yes — naive `setMonth` arithmetic fails the 31 Jan rows outright; a clamp with no de-duplication produces two successors and fails TC-17b's `toHaveLength(1)`.
- The clock is moved per row and restored to `T0` afterwards, so no later case inherits a moved instant.
