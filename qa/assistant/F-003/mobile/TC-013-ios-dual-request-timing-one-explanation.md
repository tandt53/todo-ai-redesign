# TC-013: iOS — both grants requested before the first talk attempt, behind one explanation, never at app open

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-013 |
| Feature | F-003 (mobile-surface) |
| Platform | mobile |
| Acceptance criteria | AC-2, F-001 AC-21 |
| Type | happy |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | tests/assistant/mobile/F-003-mobile-surface.spec.ts |
| Targets | ios |
| Tier | node-headless (request sequencing) + device-lab (real dialogs) |
| Created | 2026-08-16 by qa-mobile-agent |
| Last updated | 2026-08-17 by qa-mobile-agent |

## Summary
iOS needs **two** grants — microphone and speech recognition. Both are requested before the first talk attempt and never at app open, behind **one** short explanation covering both. Asking at launch is the anti-pattern F-001 AC-21 names explicitly; asking twice with two unexplained system sheets is the mobile version of the same mistake.

## Preconditions
- Fresh install state: `client.permission_state = {microphone: undetermined, speech_recognition: undetermined}`.
- Account `qamob-tc013@qa.example.com`; permission-request spy on the `TranscriptSource` port.

## Test steps
1. Cold-open the app. Wait through the first foreground read. Read the permission-request spy.
2. Type and send a turn (no talk attempt). Read the spy again.
3. Tap `assistant-mic-button` for the first time. Read the spy, the rendered explanation, and the order of events.
4. Grant both. Assert listening starts.
5. Tap the mic a second time. Read the spy.

## Expected behaviour
- Step 1: **zero** permission requests at app open. A request logged here fails the test outright.
- Step 2: still zero — the typed path never triggers a capture permission request.
- Step 3: the explanation renders **before** the OS prompts, and one explanation covers **both** capabilities (mockup: `todo-ai cần quyền **Micro** và **Nhận dạng giọng nói** để nghe bạn.`). Both grants are then requested; `client.permission_state` records each separately.
- Step 4: with both granted, capture starts on that same tap — the user does not have to tap the mic again after granting.
- Step 5: no re-request once both are granted.
- Ordering assertion: explanation → microphone request → speech-recognition request → capture. No capture attempt precedes a grant.

## Test data
| Field | Value |
|-------|-------|
| user | qamob-tc013@qa.example.com |
| initial state | both `undetermined` |

## Notes
**Device-lab residue:** the real `AVAudioSession` / `SFSpeechRecognizer` dialogs, their Info.plist usage strings, and the deep link to the app's Settings page cannot be exercised at the node tier — this TC proves the request *sequencing* through the port, not that iOS shows the sheet. The device pass is owed and is listed as debt in `index.md`.
