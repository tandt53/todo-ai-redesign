# TC-31: A hand edit makes the task modified-since, and the undo names it

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-31 |
| Feature | F-005 (task-detail) |
| Platform | api |
| Acceptance criteria | AC-5 |
| Type | edge |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | tests/assistant/api/F-005-task-detail.spec.ts (`describe('TC-31 …')`) |
| Created | 2026-08-19 by qa-api-agent |
| Last updated | 2026-08-19 by qa-api-agent |

## Summary
AC-5 introduces no new rule; "what is new is that a user can now cause it". Proving it needs the fixture tester T8 named: "`task-equals`'s field list contains `updated_at`, so a hand edit to **any** field is detected as modified-since whether or not the edited field ever joined the comparison — the assertion passes for a reason unrelated to what it claims (L-012). The proof is a case in which **`updated_at` is held equal** and the field alone differs." The held clock seam is what makes that constructible.

## Preconditions
- In-process harness: `createApp(deps)` with the `__qa__` doors mounted in front, on an ephemeral port, driven by supertest. Fresh durable store per test.
- The clock seam and the account zone are both held at `T0 = 2026-08-19T12:00:00.000Z` / `UTC` by `POST /__qa__/set-clock` (AC-44). Every fixture instant is derived from `T0`, never from a wall clock (L-023).
- The clock is **held**, so the hand edit writes the same `updated_at` the turn did and `updated_at` cannot be the reason the comparison fails.

## Test steps (API)
| # | Case (automation `it` name) | Request | Expected |
|---|------------------------------|---------|----------|
| 1 | TC-31a with updated_at HELD EQUAL, the edited field alone is what makes the task modified | a turn sets `note`; then `PATCH {priority}` at the same held instant; then undo the turn | `updated_at` is asserted equal first; the task is in `skipped` **and named by title**; `nothing_reverted: true`; the hand edit stands and the assistant's note stands |
| 2 | TC-31b an UNTOUCHED task is reverted | the same turn with no hand edit, then undo | `undone: true`, `skipped: []`, `nothing_reverted: false`, the note is gone |

## Expected behaviour
- The task is **skipped and named** in the reverted message — F-001 AC-7's contract, unchanged.
- Zero silent overwrites: the hand edit is still there afterwards.
- TC-31b is the control. Without it TC-31a would pass against an undo that skips everything always — which is precisely the failure AC-34's comparison rule prevents (TC-24a).

## Test data
| Field | Value |
|-------|-------|
| namespace | task titles `qaapi5-*`; reserved user ids in `qa/_shared/fixtures/api/f005-users.json`. No unscoped destructive operations (§10). |
| fixture utterance | `qaapi5 note the undo target` → `{note: 'assistant note'}` |

## Notes
- The held clock is doing real work here: with a moving clock the hand edit's `updated_at` differs and the case would be green whether or not the edited field joined the comparison — the assertion T8 calls out. Compare TC-20c, where the held clock has the **opposite** effect and the fixture has to advance it. Which way the clock has to move is a per-case decision, and stating it is part of the case.
- *Would this notice?* Yes — a comparison that omitted `priority` would revert the task and fail TC-31a's `nothing_reverted` and `skipped` assertions.
