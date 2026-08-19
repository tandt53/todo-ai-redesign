# TC-26: What the assistant may set — a capability, not a permission

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-26 |
| Feature | F-005 (task-detail) |
| Platform | api |
| Acceptance criteria | AC-36 |
| Type | happy |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | qa/assistant/automation/api/F-005-task-detail.spec.ts (`describe('TC-26 …')`) |
| Created | 2026-08-19 by qa-api-agent |
| Last updated | 2026-08-19 by qa-api-agent |

## Summary
"The permitted half is a **capability**, not a permission. The interpreter is a 23-row fixture table whose **two** edit rows change `title` and `status`, and **not one of them touches a field this feature adds** — so an implementation that allowlists four fields and leaves every one unreachable passes an AC that only grants permission." The requirement is **one fixture row per permitted field, on the create path as well as the edit path**, because "revision 2's wording is satisfied by an edit row alone, which is exactly how the create half would have shipped green."

## Preconditions
- In-process harness: `createApp(deps)` with the `__qa__` doors mounted in front, on an ephemeral port, driven by supertest. Fresh durable store per test.
- The clock seam and the account zone are both held at `T0 = 2026-08-19T12:00:00.000Z` / `UTC` by `POST /__qa__/set-clock` (AC-44). Every fixture instant is derived from `T0`, never from a wall clock (L-023).
- The suite's own fixture interpreter carries one row per permitted field on each path, and records the context it is handed.

## Test steps (API)
| # | Case (automation `it` name) | Request | Expected |
|---|------------------------------|---------|----------|
| 1 | TC-26a one fixture row per permitted field on the EDIT path, each actually applied | four turns: note, priority, due_at, reminder_at | each is `applied`, names the task in `changed_task_ids`, emits a diff row for that field, and the value is on the row |
| 2 | TC-26b one fixture row per permitted field on the CREATE path | one turn creating a task with note, due, reminder and priority | the created row carries all four, and the diff names every one of them |
| 3 | TC-26c the assistant can READ what it may write | a task with a note and a reminder, then any turn | the recorded context's task carries `note` and `reminder_at` with the row's values |

## Expected behaviour
- Four permitted value fields — `note`, `priority`, `due_at`, `reminder_at` — each reachable through a turn, asserted rather than assumed.
- The create door carries them too: "`applyCreate` hardcodes `reminder_at: null` and carries no note, so *'add a task to call the dentist and remind me at nine'*, the most natural sentence for the field this decision exists to make reachable, creates the task and **silently drops the reminder**, with a diff that never mentions it."
- `ContextTask` gains `note` and `reminder_at`: "*'push the reminder an hour later'* has nothing to read today."
- The create's diff describes the create **completely** (F-001 AC-2/AC-4), which is why `DIFF_FIELDS` splits in two rather than being narrowed.

## Test data
| Field | Value |
|-------|-------|
| namespace | task titles `qaapi5-*`; reserved user ids in `qa/_shared/fixtures/api/f005-users.json`. No unscoped destructive operations (§10). |
| fixture utterances | `qaapi5 set the note` / `… the priority` / `… the due date` / `… the reminder` / `qaapi5 add the dentist with a reminder` |

## Notes
- The refused half is TC-27, and it is a separate case because it needs a different observable (the `refused` outcome) and a different failure mode.
- *Would this notice?* Yes — an allowlist that grants without plumbing fails TC-26a; a hardcoded `reminder_at: null` on the create path fails TC-26b; a `ContextTask` that did not widen fails TC-26c.
