# TC-028: AI error — surface says so, retry offered, words kept, list fully usable by hand

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-028 |
| Feature | F-001 (voice-assistant-view) |
| Platform | web |
| Acceptance criteria | AC-24, AC-29 |
| Type | negative |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | qa/assistant/automation/e2e/F-001-voice-assistant-view.spec.ts |
| Created | 2026-08-16 by qa-web-agent |
| Last updated | 2026-08-16 by qa-web-agent |

## Summary
When AI errors, the conversation surface says so and offers retry; the user's words are kept (no re-speaking); the FULL todo list remains usable by hand (create, edit, complete, delete — all four verified, not sampled). Retry re-enters thinking and, per the contract, re-sends the same `client_turn_id`.

## Preconditions
- Open session. User `qaweb-tc028@qa.example.com`; baseline seed tasks.
- Turn stub: 502 AI_ERROR per api-contracts (body `{error, turn}` with persisted transcript), then success on retry. Request capture (to compare `client_turn_id` across attempts).

## Test steps
1. Send "qaweb move my gym session to Monday at 7". Stub returns 502.
2. Read the error message, `assistant-retry-button`, the composer, and the mic/state.
3. Before retrying, run all four manual ops by direct touch (create/edit/complete/delete — TC-020's sequence, abbreviated data).
4. Tap Retry. Inspect the retry request; read the final outcome + list.

## Expected behaviour
- **Says so**: error message renders (mockup `error` state: danger-edged bubble, "Chưa gửi được" head, "Chưa có gì thay đổi — lời của bạn vẫn được giữ bên dưới" body); surface is in the error state with a visible cue (AC-29 — error IS one of the four states); mic/danger treatment per mockup.
- **Words kept**: the composer retains the utterance (mockup keeps it: "Move my gym session to Monday at 7") — re-speaking/retyping not required.
- **Retry**: `assistant-retry-button` visible and operable; the retried request carries the SAME `client_turn_id` (AC-16's web face — asserted on the wire); on success the applied anatomy renders and the surface returns to idle.
- **List usable during error**: all four manual ops succeed while the error message is showing; zero AI calls for them.
- Nothing was changed by the failed turn: list diff empty vs pre-turn snapshot.

## Test data
| Field | Value |
|-------|-------|
| user | qaweb-tc028@qa.example.com |
| stub script | fixture row `WEB-R3` (502 then success, same id) |

## Notes
The msg-meta caption "your list still works by hand" (mockup) is design copy — asserted as behaviour (step 3), not just as text.
