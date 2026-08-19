# TC-010: All tasks skipped — "nothing was reverted", never dressed as success

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-010 |
| Feature | F-001 (voice-assistant-view) |
| Platform | web |
| Acceptance criteria | AC-7 |
| Type | negative |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | tests/assistant/e2e/F-001-voice-assistant-view.spec.ts |
| Created | 2026-08-16 by qa-web-agent |
| Last updated | 2026-08-17 by qa-web-agent (T-070b — ADR-008 English copy sync) |

## Summary
If every task of the turn was modified after apply, undo reverts nothing — and the outcome message must SAY nothing was reverted, naming the untouched tasks. It must never render as a successful revert (mockup `nothing-reverted` state; api-contracts `nothing_reverted: true`).

## Preconditions
- Open session. User `qaweb-tc010@qa.example.com`; baseline seed tasks.
- Applied 2-op turn; BOTH touched tasks then modified by hand.
- Undo stub: `reverted: []`, both tasks in `skipped`, `nothing_reverted: true`.

## Test steps
1. Hand-edit both tasks the turn touched.
2. Tap `assistant-undo-button`.
3. Read the outcome message text and the task list.

## Expected behaviour
- **AC-7**: Outcome message states nothing was reverted ("Nothing was undone" head per mockup) and names BOTH tasks as unchanged/skipped ("They all changed after my edit: … I left them as they are."). It contains no success phrasing ("Undone", "Put back") as its headline.
- The list is unchanged by the undo: both hand-edited values persist (read-back assertion).
- The original bubble's undone/undo affordance state matches the contract (turn not reverted — spec/api: `already_undone` false, turn stays `applied`; the affordance behaviour on a fully-skipped undo follows the newest-applied rule of AC-8).

## Test data
| Field | Value |
|-------|-------|
| user | qaweb-tc010@qa.example.com |
| undo response | fixture row `WEB-UNDO-3` (all skipped, nothing_reverted) |

## Notes
False-green guard: assert the message head text explicitly, not just message presence — a generic "Undone" bubble would pass a weaker assertion while violating the AC.
