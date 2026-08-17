# TC-017: iOS permission matrix row 4/4 — both denied → still dimmed, never hidden

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-017 |
| Feature | F-003 (mobile-surface) |
| Platform | mobile |
| Acceptance criteria | AC-2, F-001 AC-21, F-001 AC-20 |
| Type | negative |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | qa/assistant/automation/mobile/F-003-mobile-surface.spec.ts |
| Targets | ios |
| Tier | node-headless (state + message) + device-lab (Settings deep link) |
| Created | 2026-08-16 by qa-mobile-agent |
| Last updated | 2026-08-17 by qa-mobile-agent |

## Summary
The row that most tempts an implementation into the wrong branch: with nothing granted, hiding the mic looks tidy — and is wrong. Hidden is reserved for **no capability** (F-001 AC-20). Denial of everything is still denial: dimmed, explained, recoverable.

## Preconditions
- Account `qamob-tc017@qa.example.com`; `client.permission_state = {microphone: denied, speech_recognition: denied}`; device capability present.

## Test steps
1. Open the surface. Assert the mic is present.
2. Read the mic mode and the message.
3. Activate the mic; assert `assistant-permission-cta` is offered.
4. Type and send a turn.
5. Grant both; re-foreground; assert the surface lands in TC-014's state.

## Expected behaviour
- `assistant-mic-button` is **present and dimmed**. Absent = fail: that would be the no-capability rendering and would tell the user their device cannot do this, which is false.
- The message names both missing capabilities and offers the Settings CTA.
- No capture is attempted.
- Typing fully works.
- Recovery lands in the both-granted state with no restart.

## Test data
| Field | Value |
|-------|-------|
| user | qamob-tc017@qa.example.com |
| matrix row | `PM-IOS-4` |

## Notes
Together with TC-012 (no capability → hidden) this pins the dimmed/hidden boundary in both directions. Testing only one direction lets an implementation collapse the two modes into one and still pass.
