# TC-016: iOS permission matrix row 3/4 — speech recognition denied, microphone granted → dimmed, names speech recognition

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-016 |
| Feature | F-003 (mobile-surface) |
| Platform | mobile |
| Acceptance criteria | AC-2, F-001 AC-21 |
| Type | negative |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | tests/assistant/mobile/F-003-mobile-surface.spec.ts |
| Targets | ios |
| Tier | node-headless (state + message) + device-lab (Settings deep link) |
| Created | 2026-08-16 by qa-mobile-agent |
| Last updated | 2026-08-17 by qa-mobile-agent |

## Summary
The mirror of TC-015 and the row most likely to be implemented as an afterthought: the microphone is granted, so a naive implementation reports the mic as available and then fails silently at capture time because `SFSpeechRecognizer` was refused. AC-2 requires the dimmed mode and a message naming **speech recognition** as the missing capability.

## Preconditions
- Account `qamob-tc016@qa.example.com`; `client.permission_state = {microphone: granted, speech_recognition: denied}`.

## Test steps
1. Open the surface. Read the mic mode and accessible name.
2. Activate the dimmed mic; read the message and assert nothing was captured.
3. Assert the message names **speech recognition** and not microphone.
4. Type and send a turn.
5. Flip `speech_recognition` to `granted`; re-foreground; read the mic mode.

## Expected behaviour
- Mic is **dimmed**, not available — a mic-granted-only state must not report as capturable.
- Activating it starts no capture, produces no exception surfaced to the user, and appends the permission message.
- The message names **speech recognition** (`Nhận dạng giọng nói`) as the missing grant. It must be distinguishable from TC-015's message; two denials producing identical copy fails this test.
- `assistant-permission-cta` is present.
- Typing is fully unaffected.
- Recovery returns the mic to available.

## Test data
| Field | Value |
|-------|-------|
| user | qamob-tc016@qa.example.com |
| matrix row | `PM-IOS-3` |

## Notes
This is the row where "the mic looks fine but nothing happens when you tap it" ships. The assertion that distinguishes it from TC-015 is the message text, so the copy variants must exist — flagged to design-agent in `index.md`.
