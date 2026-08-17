# TC-007: Undo by tap — violet button reverts the whole turn; list reads back prior values

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-007 |
| Feature | F-001 (voice-assistant-view) |
| Platform | web |
| Acceptance criteria | AC-5, AC-7 |
| Type | happy |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | qa/assistant/automation/e2e/F-001-voice-assistant-view.spec.ts |
| Created | 2026-08-16 by qa-web-agent |
| Last updated | 2026-08-16 by qa-web-agent |

## Summary
The newest applied turn has a one-gesture undo by tap. Undo covers the whole turn: a multi-task turn reverts all its tasks. After undo the list shows the prior values (read-back, not just a chat claim), the undone bubble stays visible marked "Đã hoàn tác", and the reverted-outcome message renders. Design canon: the Undo button is violet (assistant's own act) — never danger red.

## Preconditions
- Open session. User `qaweb-tc007@qa.example.com`; baseline seed tasks.
- An applied 2-op turn exists (edit "qaweb Review Q3 budget draft" 2:00→4:00 PM + create "qaweb Pick up birthday cake") — newest applied turn; no later mutations.
- `POST /assistant/turn/{turn_id}/undo` stub per api-contracts (200 UndoOutcome, all reverted, `skipped: []`).

## Test steps
1. Locate `assistant-undo-button` on the newest applied bubble; single tap.
2. Wait for the reverted outcome message (mockup state `reverted` shape, no skips here).
3. Read the task list pane.
4. Inspect the original applied bubble.

## Expected behaviour
- **AC-5 (one gesture, whole turn)**: One tap reverts BOTH operations: edited task shows 2:00 PM again; created task's row is gone from the list.
- **AC-7 (no skips case)**: The outcome message reports the revert; with nothing modified since apply, no task is skipped and none is named as skipped.
- The undone bubble stays visible, visually marked "Đã hoàn tác" (mockup `.bubble.undone` + "Đã hoàn tác" tag); its Undo affordance is gone.
- Read-back: list values assert PRIOR field values (text content), not merely a "reverted" toast.
- Style probe (design canon): the undo control renders in the primary/violet treatment, not danger red.

## Test data
| Field | Value |
|-------|-------|
| user | qaweb-tc007@qa.example.com |
| applied turn | fixture row `WEB-R1` outcome |
| undo response | fixture row `WEB-UNDO-1` |

## Notes
Voice undo is TC-008; skip-naming is TC-009; window expiry is TC-011.
