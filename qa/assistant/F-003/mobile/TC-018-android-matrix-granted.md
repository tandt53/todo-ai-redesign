# TC-018: Android permission matrix row 1/3 — RECORD_AUDIO granted → mic available, no second prompt

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-018 |
| Feature | F-003 (mobile-surface) |
| Platform | mobile |
| Acceptance criteria | AC-3, F-001 AC-21 |
| Type | happy |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | qa/assistant/automation/mobile/F-003-mobile-surface.spec.ts |
| Targets | android |
| Tier | node-headless (request sequencing) + device-lab (real dialog) |
| Created | 2026-08-16 by qa-mobile-agent |
| Last updated | 2026-08-17 by qa-mobile-agent |

## Summary
Android's split from iOS: a **single** grant (`RECORD_AUDIO`) makes the mic available with **no second prompt**. The falsifiable half is the negative — an implementation that shares iOS's dual-grant path would request a second, non-existent speech permission here, and `client.permission_state.speech_recognition` must not even be present on Android.

## Preconditions
- Account `qamob-tc018@qa.example.com`; fresh state, `microphone: undetermined`; permission-request spy installed.

## Test steps
1. Cold-open. Read the spy — assert zero requests at app open.
2. Tap `assistant-mic-button` for the first time. Read the explanation and the spy.
3. Grant. Assert capture starts on that same tap.
4. Tap the mic again; read the spy.
5. Read `client.permission_state`.

## Expected behaviour
- Zero permission requests at app open (F-001 AC-21's "not at app open" holds on both platforms).
- Exactly **one** permission is requested — `RECORD_AUDIO`. A second request of any kind fails the test.
- After the grant the mic is available and capture starts without a further tap.
- Step 4: **no** re-prompt.
- `client.permission_state` carries `microphone` only; `speech_recognition` is **absent** on Android (data table: present on iOS only).

## Test data
| Field | Value |
|-------|-------|
| user | qamob-tc018@qa.example.com |
| matrix row | `PM-AND-1` |

## Notes
**Device-lab residue:** the real runtime-permission dialog and the OS's own "don't ask again" checkbox are device-lab. The port-level request count is what this tier proves.
