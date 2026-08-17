# TC-005: Cancel while thinking — sent turn completes; late outcome renders honestly

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-005 |
| Feature | F-001 (voice-assistant-view) |
| Platform | web |
| Acceptance criteria | AC-3, AC-29 |
| Type | edge |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | qa/assistant/automation/e2e/F-001-voice-assistant-view.spec.ts |
| Created | 2026-08-16 by qa-web-agent |
| Last updated | 2026-08-16 by qa-web-agent |

## Summary
Cancel is client-local and never pretends to win a race against a sent turn. Cancelling while thinking returns the surface to idle with words kept — but the already-sent turn runs to completion server-side and its late outcome renders as the matching message per its kind: applied → applied bubble + Undo; question → question message (D2 rules apply); failed → error message. This is the spec's "cancel racing apply" injection at the web layer.

## Preconditions
- Open session. User `qaweb-tc005@qa.example.com`; baseline seed tasks.
- `POST /assistant/turn` stub with injectable delay (fixture-controlled), three scripted outcomes: applied / question / failed.

## Test steps
1. Type "qaweb move dentist to Friday" and send; while `assistant-state-indicator` shows the thinking state word ("Đang xử lý…"), activate `assistant-cancel-button` (the cancel pill in the thinking indicator row; listening-cancel remains the mic tap).
2. Assert surface returns to idle immediately, composer keeps the words.
3. Let the delayed 200 (applied) arrive. Read conversation + list.
4. Repeat with the stub scripted to return a question outcome.
5. Repeat with the stub scripted to return 502 AI_ERROR.

## Expected behaviour
- **AC-3, applied race**: The late outcome renders as an applied bubble with diff AND `assistant-undo-button`; the list shows the applied change. The UI never suppresses the outcome or pretends the cancel won. Undo is the honest exit.
- **AC-3, question race**: The question message renders after cancel; it is pending and resolvable per D2 (answer / supersede / session close).
- **AC-3, failed race**: The error message renders (retry offered, words kept).
- **AC-29**: Cancel transition thinking → idle has a visible cue; the late message arrives while idle without re-entering thinking.

## Test data
| Field | Value |
|-------|-------|
| user | qaweb-tc005@qa.example.com |
| stub scripts | fixture rows `WEB-R1` (applied, delayed), `WEB-R2` (question, delayed), `WEB-R3` (502, delayed) |

## Notes
There is no cancel endpoint (api-contracts, "Deliberately absent") — the automation asserts NO cancel-shaped HTTP request is emitted on cancel.
