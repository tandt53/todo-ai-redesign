# TC-009: Undo never clobbers later work — modified task skipped and named

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-009 |
| Feature | F-001 (voice-assistant-view) |
| Platform | web |
| Acceptance criteria | AC-7 |
| Type | edge |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | qa/assistant/automation/e2e/F-001-voice-assistant-view.spec.ts |
| Created | 2026-08-16 by qa-web-agent |
| Last updated | 2026-08-17 by qa-web-agent (T-070b — ADR-008 English copy sync) |

## Summary
A task modified after the turn (by hand or by a later turn) is skipped on undo, and the reverted-outcome message names every skipped task. Zero silent overwrites. Mirrors the mockup `reverted` state: "Undone — except one task … Skipped: {title} — it changed after my edit, so I left it alone."

## Preconditions
- Open session. User `qaweb-tc009@qa.example.com`; baseline seed tasks.
- Applied 2-op turn (edit "qaweb Review Q3 budget draft" + create "qaweb Pick up birthday cake"), still newest.
- After the apply, the edited task is modified by hand (direct touch edit — snapshot now differs).
- Undo stub per api-contracts: `reverted: [create removed]`, `skipped: [{…, reason: "modified_since_apply"}]`.

## Test steps
1. Hand-edit "qaweb Review Q3 budget draft" via the list pane (direct touch).
2. Tap `assistant-undo-button` on the applied bubble.
3. Read the reverted outcome message and the task list.

## Expected behaviour
- **AC-7**: The created task is removed (reverted); the hand-modified task KEEPS its hand-edited value — the undo did not touch it.
- The outcome message names the skipped task by title ("Skipped: {title} — it changed after my edit, so I left it alone.") and distinguishes reverted from skipped (head "Undone — except one task"). Naming is per-task and complete: every skipped task appears by title.
- Read-back: list row for the skipped task shows the HAND-EDITED value, not the pre-turn value, not the turn's value.

## Test data
| Field | Value |
|-------|-------|
| user | qaweb-tc009@qa.example.com |
| undo response | fixture row `WEB-UNDO-2` (partial skip) |

## Notes
All-skipped variant is TC-010. Snapshot-comparison mechanics are api-tagged (AC-7 api half); web asserts the visible naming + non-clobber observables.
