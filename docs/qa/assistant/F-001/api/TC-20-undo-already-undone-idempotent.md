# TC-20: Undo of an already-undone turn is idempotent — same success, no second revert

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-20 |
| Feature | F-001 (voice-assistant-view) |
| Platform | api |
| Acceptance criteria | AC-6 |
| Type | edge |
| Priority | P1 |
| Status | active |
| Automation | in-progress |
| Automation file | tests/assistant/api/F-001-voice-assistant-view.spec.ts |
| Created | 2026-08-16 by qa-api-agent |
| Last updated | 2026-08-16 by qa-api-agent |

## Summary
Hard-won round-2 semantics: undo of an already-undone turn returns the **same success outcome** with `already_undone: true` and performs **no second revert**. The trap this catches: a double-undo that re-applies (undo-of-undo) or re-runs the revert against state that moved on.

## Preconditions
- User `QAAPI-U1`, seeded `qaapi-buy-milk`; applied edit turn (UT-EDIT-1 → `qaapi-buy-oat-milk`), turn `{tid}`; first undo done (title back to `qaapi-buy-milk`).
- Then the user manually renames the task to `qaapi-buy-milk-2L` via PATCH (state moved on).

## Test steps
| # | Method | Path | Headers | Body | Expected status | Assertions |
|---|--------|------|---------|------|-----------------|------------|
| 1 | POST | /assistant/turn/{tid}/undo | X-User-Id: {U1} | `{via: "tap"}` | 200 | `undone: true`, `already_undone: true`, `reverted` reports the original revert result — a replay of the recorded outcome |
| 2 | GET | /tasks | X-User-Id: {U1} | — | 200 | title is **still `qaapi-buy-milk-2L`** — the replay did NOT revert again over the manual rename |
| 3 | GET | /assistant/session | X-User-Id: {U1} | — | 200 | turn `{tid}` status remains `undone`; `undo_result.undone_at` unchanged from the first undo |

## Expected behaviour
Idempotent success (AC-6): same outcome shape, zero new writes. Step 2 is the inversion that proves "no second revert" — the deliberately-moved state must survive.

## Test data
| Field | Value |
|-------|-------|
| user | QAAPI-U1 |
| flow | apply edit → undo → manual PATCH → undo replay |

## Notes
State machine: `undone` is terminal (`applied → undone` only); the replay must not create any `undone → *` transition.
