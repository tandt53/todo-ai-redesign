# TC-008: Undo by voice — "undo" / "hoàn tác" reverts and never becomes a task

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-008 |
| Feature | F-001 (voice-assistant-view) |
| Platform | web |
| Acceptance criteria | AC-5, AC-8 |
| Type | edge |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | qa/assistant/automation/e2e/F-001-voice-assistant-view.spec.ts |
| Created | 2026-08-16 by qa-web-agent |
| Last updated | 2026-08-16 by qa-web-agent |

## Summary
Undo is reachable by voice: saying "hoàn tác" or "undo" undoes the newest applied turn and never becomes a task with that name (voice-undo guard, ADR-006 in api-contracts: the turn is not interpreted, `kind: "undo"` returns). When no applied turn exists, the voice undo yields AC-8's visible refusal — never silence, never a task named "undo" (mockup `nothing-reverted` state, second exchange).

## Preconditions
- Open session. User `qaweb-tc008@qa.example.com`; baseline seed tasks.
- Newest applied turn exists (same setup as TC-007). Injectable transcript source.
- Turn stub honours the voice-undo guard: `kind: "undo"`, `undo: UndoOutcome`.

## Test steps
1. Tap mic; feed transcript exactly "undo" (fixture `WEB-T4a`); end speech.
2. Read conversation, list, and list row titles.
3. Re-seed to a session with NO applied turn (clean session). Tap mic; feed "hoàn tác" (fixture `WEB-T4b`); end speech.
4. Read conversation and list row titles again.

## Expected behaviour
- **AC-5**: Step 1–2: the turn reverts (same observable as TC-007: list read-back shows prior values); the user's voice bubble shows "Undo"; the reverted outcome message renders.
- **Never a task**: after both steps, NO task row titled "undo" / "Undo" / "hoàn tác" exists in the list (bounded check: scan all row titles).
- **AC-8 (no window)**: Step 3–4: a visible refusal message renders ("Không có gì để hoàn tác — phiên này chưa có thay đổi nào được áp dụng.", per mockup nothing-reverted second exchange and api-contracts 409 `not_undoable`) — not silence, and still no task created.

## Test data
| Field | Value |
|-------|-------|
| user | qaweb-tc008@qa.example.com |
| transcripts | fixture rows `WEB-T4a` ("undo"), `WEB-T4b` ("hoàn tác") |

## Notes
Mechanism is Open Question 6 / ADR-006; the TC asserts the fixed NEED (AC-5) via observables only: revert happened, no task materialized, refusal visible when out of window.
