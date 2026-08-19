# TC-015: iOS permission matrix row 2/4 — microphone denied, speech recognition granted → dimmed, names microphone

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-015 |
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
The partial-denial rows are the cases F-001's web suite could never reach — web has a single grant, so "one of two denied" does not exist there. AC-2 is explicit: **any** partial denial produces the dimmed mic, not a hidden one, and the message **names which capability is missing**.

## Preconditions
- Account `qamob-tc015@qa.example.com`; `client.permission_state = {microphone: denied, speech_recognition: granted}`.

## Test steps
1. Open the surface. Read the mic mode, its accessible name, and the conversation.
2. Activate the dimmed `assistant-mic-button`.
3. Read the message and assert `assistant-permission-cta` is present.
4. Type and send a turn.
5. Flip `microphone` to `granted` and re-foreground; read the mic mode.

## Expected behaviour
- Mic is **dimmed** — present but non-capturing (mockup renders the mic with its slash overlay; accessible name `Micro cần quyền truy cập`). It is **not hidden**: hiding is reserved for no-capability (TC-012).
- The message **names microphone specifically** as the missing capability. A message that says only "a permission is missing", or that names both capabilities when only one is denied, fails this assertion — see the design request in `index.md`.
- `assistant-permission-cta` is present and its activation targets the app's Settings page (label per mockup: `Mở Cài đặt`).
- Activating the dimmed mic starts **no** capture and produces **no** silent failure.
- Step 4: typing is **fully unaffected** — the turn applies normally.
- Step 5: the mic returns to available on the next foreground with no restart.

## Test data
| Field | Value |
|-------|-------|
| user | qamob-tc015@qa.example.com |
| matrix row | `PM-IOS-2` |

## Notes
**Device-lab residue:** that the CTA actually opens iOS Settings at this app's page is not provable headless — the port call and its argument are. The deep-link behaviour is device-lab debt.
