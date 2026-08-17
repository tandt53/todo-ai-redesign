# TC-010: Parity — typed input takes the same path as speech; the manual touch path makes zero AI calls

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-010 |
| Feature | F-003 (mobile-surface) |
| Platform | mobile |
| Acceptance criteria | AC-1, F-001 AC-17, F-001 AC-18 |
| Type | happy |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | qa/assistant/automation/mobile/F-003-mobile-surface.spec.ts |
| Targets | ios, android |
| Tier | node-headless |
| Created | 2026-08-16 by qa-mobile-agent |
| Last updated | 2026-08-17 by qa-mobile-agent |

## Summary
Voice is never the only path. Typed composer input goes through the same interpretation path as speech (same endpoint, same shape, only `source` differs), and **every** list operation is doable by direct touch with **zero** AI calls — the fallback the whole feature stands on when permission is denied, the recognizer is down, or the network is gone.

## Preconditions
- Account `qamob-tc010@qa.example.com`; AI-call counter seam readable; request spy on the API client.

## Test steps
1. Send an utterance by voice; capture the request. Reset.
2. Send the **same** utterance by typing into `assistant-composer-input` + `assistant-composer-send`; capture the request.
3. Diff the two requests field by field, and diff the two rendered outcomes.
4. Read the AI-call counter, then perform create / edit / complete / delete entirely by touch (`assistant-add-task-button`, `assistant-task-row`, `assistant-task-checkbox`).
5. Read the AI-call counter again and the list.

## Expected behaviour
- The two requests differ **only** in `source` (`voice` vs `typed`). Same endpoint, same `transcript`, same field set — no extra mobile-only field, no missing field.
- The two rendered outcomes are identical in kind and content.
- Step 4–5: all four manual operations succeed and the AI-call counter delta is exactly **0**. Any `/assistant/*` request during the manual path fails this test.
- The manual path works while the mic is dimmed and while it is hidden (spot-checked in both mic modes).

## Test data
| Field | Value |
|-------|-------|
| user | qamob-tc010@qa.example.com |
| utterance | one canonical create row, driven twice |

## Notes
The counter is the proof, not the absence of an observed error — asserting "no crash" here would be the assert-nothing failure `_qa-foundations` §5 warns about.
