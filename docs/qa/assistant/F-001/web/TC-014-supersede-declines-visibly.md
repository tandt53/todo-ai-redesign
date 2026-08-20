# TC-014: Supersede — an unrelated command declines the question visibly and proceeds

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-014 |
| Feature | F-001 (voice-assistant-view) |
| Platform | web |
| Acceptance criteria | AC-10, AC-11, AC-13 |
| Type | edge |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | tests/assistant/e2e/F-001-voice-assistant-view.spec.ts |
| Created | 2026-08-16 by qa-web-agent |
| Last updated | 2026-08-17 by qa-web-agent (T-070b — ADR-008 English copy sync) |

## Summary
Any unrelated new command supersedes a pending question: the delete is declined (declined_superseded) and the new command proceeds normally — both visibly (mockup `declined-superseded` state: resolved question with disabled chips, "Kept all N tasks" head with the body "The delete was set aside because you moved on to something else. Nothing was deleted." outcome, then the new command's applied message). Applies to confirm AND clarify questions (same D2 rule, AC-13).

## Preconditions
- Open session. User `qaweb-tc014@qa.example.com`; baseline seed tasks; pending bulk-delete question over 3 named tasks.
- Turn stub: unrelated create → `resolutions: [{result: declined_superseded}]` + applied turn.

## Test steps
1. With the question pending, type "qaweb add call the bank tomorrow at 9" and send.
2. Read, in order: the question bubble, the superseded outcome message, the new command's outcome, the list.
3. Repeat with a pending CLARIFY question (fixture `WEB-U5` two-match reference) superseded by an unrelated command.

## Expected behaviour
- **Declined visibly**: a declined-because-superseded outcome message renders naming what was kept (count/titles); the question bubble flips to resolved (chips disabled, muted per mockup) — it never stays actionable.
- **Command proceeds**: the unrelated create applies normally — applied bubble + Undo + new list row (full AC-1/AC-4 anatomy).
- **Zero deletion**: all 3 questioned tasks remain in the list (bounded check by title).
- Clarify variant: same shape — clarify question resolved-superseded visibly, no mutation from it, new command applied.

## Test data
| Field | Value |
|-------|-------|
| user | qaweb-tc014@qa.example.com |
| utterances | fixture rows `WEB-U6` (unrelated create), `WEB-U5` (clarify trigger) |

## Notes
Ordering matters and is asserted: superseded outcome and new-command outcome are separate messages (mockup shows both), so the user can reconstruct what happened.
