# TC-014: iOS permission matrix row 1/4 — microphone granted + speech recognition granted → mic available

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-014 |
| Feature | F-003 (mobile-surface) |
| Platform | mobile |
| Acceptance criteria | AC-2 |
| Type | happy |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | tests/assistant/mobile/F-003-mobile-surface.spec.ts |
| Targets | ios |
| Tier | node-headless |
| Created | 2026-08-16 by qa-mobile-agent |
| Last updated | 2026-08-17 by qa-mobile-agent |

## Summary
Row 1 of the enumerated iOS ×4 matrix: the only combination in which the mic is fully available. It exists as its own test so the other three rows have a control — a matrix where every row renders "dimmed" would otherwise pass three of four tests while being completely broken.

## Preconditions
- Account `qamob-tc014@qa.example.com`; `client.permission_state = {microphone: granted, speech_recognition: granted}`.

## Test steps
1. Open the surface. Read the mic mode and accessible name.
2. Tap `assistant-mic-button` and drive a recognition to completion.
3. Assert no permission message is present in the conversation.
4. Assert `assistant-permission-cta` is absent.

## Expected behaviour
- Mic mode is **available** — `assistant-mic-button` present, not dimmed, accessible name `Nhấn để nói`.
- Tapping starts capture immediately with no prompt and no explanation message.
- The conversation contains **no** permission message; `assistant-permission-cta` is absent from the tree.
- The turn completes through the normal applied path.

## Test data
| Field | Value |
|-------|-------|
| user | qamob-tc014@qa.example.com |
| matrix row | `PM-IOS-1` in `docs/qa/_shared/fixtures/mobile/F-003-mobile-fixtures.json` |

## Notes
This row is also the recovery target for TC-015/016/017: after re-granting in Settings and returning to foreground, the surface must land in exactly this state.
