# TC-07: Due date and reminder: set, clear, and the marker a reminder write clears

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-07 |
| Feature | F-005 (task-detail) |
| Platform | api |
| Acceptance criteria | AC-10, AC-20, AC-32 |
| Type | happy |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | qa/assistant/automation/api/F-005-task-detail.spec.ts (`describe('TC-07 …')`) |
| Created | 2026-08-19 by qa-api-agent |
| Last updated | 2026-08-19 by qa-api-agent |

## Summary
AC-10 has three claims and all three are asserted: the two instants are each set and cleared, **clearing stores no value** ("not a zero date, not an empty string", observable on read-back), and **writing or clearing `reminder_at` clears `reminder_shown_at`**. That last one is the one with teeth: without it "the **second** reminder a user ever sets on a task is dead on arrival, invisibly — nothing renders the marker and the happy-path case passes in every variant" (tester T20).

## Preconditions
- In-process harness: `createApp(deps)` with the `__qa__` doors mounted in front, on an ephemeral port, driven by supertest. Fresh durable store per test.
- The clock seam and the account zone are both held at `T0 = 2026-08-19T12:00:00.000Z` / `UTC` by `POST /__qa__/set-clock` (AC-44). Every fixture instant is derived from `T0`, never from a wall clock (L-023).
- A task carrying a reminder that has been acknowledged, so the marker exists to be cleared.

## Test steps (API)
| # | Case (automation `it` name) | Request | Expected |
|---|------------------------------|---------|----------|
| 1 | TC-07a due_at and reminder_at are each set and cleared; clearing stores NO value | `PATCH {due_at, reminder_at}` then `PATCH {due_at: null, reminder_at: null}` | both read back `null`, and explicitly not `''` and not the epoch |
| 2 | TC-07b writing OR clearing reminder_at clears reminder_shown_at | ack the reminder, `PATCH {reminder_at: <new>}`; ack again, `PATCH {reminder_at: null}` | `reminder_shown_at` is `null` after each — a reminder moved to a new moment is a new reminder |
| 3 | TC-07c the manual field path makes ZERO AI calls | note, priority, due, reminder, repeat set+clear, preview, delete, restore | `GET /__qa__/ai-calls` is unchanged across all of them |

## Expected behaviour
- Clearing stores the absence of a value, not a sentinel.
- The marker is cleared **server-side, in the same write** (`api-contracts.md § PATCH`), for both writing and clearing.
- Zero AI calls for the whole by-hand path — the counter, not an inference (AC-32, AC-20).

## Test data
| Field | Value |
|-------|-------|
| namespace | task titles `qaapi5-*`; reserved user ids in `qa/_shared/fixtures/api/f005-users.json`. No unscoped destructive operations (§10). |
| reminder instants | `2026-08-20T09:00:00.000Z` and `2026-08-21T09:00:00.000Z`, both derived from `T0` |

## Notes
- *Would this notice?* Yes — an implementation that cleared the marker on a write but not on a clear fails TC-07b's second half, which is the variant the happy path never reaches.
- The counter seam is the shared `CountingInterpreter` in `qa-doors.ts`, read both in-process and over `GET /__qa__/ai-calls`, so the assertion holds through the same door the e2e tier uses.
