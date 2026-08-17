# TC-004: Cancel while listening — words kept in composer, nothing sent

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-004 |
| Feature | F-001 (voice-assistant-view) |
| Platform | web |
| Acceptance criteria | AC-3 |
| Type | edge |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | qa/assistant/automation/e2e/F-001-voice-assistant-view.spec.ts |
| Created | 2026-08-16 by qa-web-agent |
| Last updated | 2026-08-17 by qa-web-agent (T-070b — ADR-008 English copy sync) |

## Summary
Cancel is client-local. While listening, cancelling keeps the recognized-so-far text in the composer and sends nothing. A cancelled turn that never reached the server renders nothing in the conversation.

## Preconditions
- Open session, idle. User `qaweb-tc004@qa.example.com`.
- Injectable transcript source; request counter on `POST /assistant/turn`.

## Test steps
1. Tap `assistant-mic-button`; feed partial transcript "push the budget review to fou" (fixture `WEB-T3`).
2. Cancel while still listening (tap the mic again — the listening-stop affordance, `aria-label` "Listening — tap to stop").
3. Read composer value, conversation transcript, request counter.

## Expected behaviour
- **AC-3**: Surface returns to idle (indicator gone, mic available). `assistant-composer-input` still contains exactly "push the budget review to fou" — the words are kept, editable, sendable.
- Zero `POST /assistant/turn` requests; no new message bubble of any kind renders (a never-sent turn renders nothing).
- No task list change.

## Test data
| Field | Value |
|-------|-------|
| user | qaweb-tc004@qa.example.com |
| transcript | fixture row `WEB-T3` (partial, mid-word) |

## Notes
Mobile audio-interruption semantics are mobile-tagged (AC-26 side); web covers user-initiated cancel. Pair TC: TC-005 (cancel while thinking).
