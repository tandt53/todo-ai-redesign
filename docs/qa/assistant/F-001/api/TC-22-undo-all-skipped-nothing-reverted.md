# TC-22: All tasks skipped — nothing_reverted, never rendered as success

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-22 |
| Feature | F-001 (voice-assistant-view) |
| Platform | api |
| Acceptance criteria | AC-7 |
| Type | boundary |
| Priority | P1 |
| Status | active |
| Automation | in-progress |
| Automation file | tests/assistant/api/F-001-voice-assistant-view.spec.ts |
| Created | 2026-08-16 by qa-api-agent |
| Last updated | 2026-08-16 by qa-api-agent |

## Summary
Boundary of AC-7's skip rule: when **every** task of the turn was modified after apply, the outcome must say nothing was reverted (`nothing_reverted: true`) — it never renders as a successful revert.

## Preconditions
- User `QAAPI-U1`; applied single-edit turn (UT-EDIT-1) on `qaapi-buy-milk` → `qaapi-buy-oat-milk`, turn `{tid}`.
- Manual PATCH renames it again → `qaapi-buy-soy-milk` (the turn's only task now differs from the snapshot).

## Test steps
| # | Method | Path | Headers | Body | Expected status | Assertions |
|---|--------|------|---------|------|-----------------|------------|
| 1 | POST | /assistant/turn/{tid}/undo | X-User-Id: {U1} | `{via: "tap"}` | 200 | `reverted == []`, `skipped` names the one task, `nothing_reverted: true` |
| 2 | GET | /tasks | X-User-Id: {U1} | — | 200 | title still `qaapi-buy-soy-milk` — untouched |
| 3 | GET | /assistant/session | X-User-Id: {U1} | — | 200 | turn `{tid}` has `status: "undone"` — an all-skipped undo **still transitions `applied → undone`** (data-model, UndoResult); its `undo_result.nothing_reverted == true` renders the "nothing was reverted" message, not a success |
| 4 | POST | /assistant/turn/{tid}/undo | X-User-Id: {U1} | `{via: "tap"}` | 200 | the undo is consumed: retry is the AC-6 idempotent replay — `already_undone: true`, `nothing_reverted: true`, still zero writes |

## Expected behaviour
Skip-all is a distinct, honest outcome (AC-7's last sentence). Equivalence classes across TC-21/22: some-skipped vs all-skipped — both named, only the latter sets `nothing_reverted`.

## Test data
| Field | Value |
|-------|-------|
| user | QAAPI-U1 |
| flow | apply edit → manual rename → undo |

## Notes
Pinned 2026-08-16 (was index OQ 5): data-model UndoResult — an all-skipped undo still transitions `applied → undone`; the undo is consumed and a retry is the idempotent replay (steps 3–4). Consequence worth noting for TC-18's window rule: after an all-skipped undo, the turn is no longer `applied`, so the previous applied turn becomes newest.
