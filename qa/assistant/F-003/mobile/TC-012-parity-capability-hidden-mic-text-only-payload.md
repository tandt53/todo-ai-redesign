# TC-012: Parity — no recognition capability hides the mic without error; the payload is text only

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-012 |
| Feature | F-003 (mobile-surface) |
| Platform | mobile |
| Acceptance criteria | AC-1, F-001 AC-20 |
| Type | edge |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | tests/assistant/mobile/F-003-mobile-surface.spec.ts |
| Targets | ios, android |
| Tier | node-headless |
| Created | 2026-08-16 by qa-mobile-agent |
| Last updated | 2026-08-17 by qa-mobile-agent |

## Summary
Speech-to-text runs on the device; the server receives recognized **text** only — never audio. A device without the capability hides the mic without an error, and the detection is by **capability**, never by platform name. On mobile this is the row of the permission matrix that must not be confused with denial (dimmed) or a transient failure (dimmed) — no capability means *hidden*.

## Preconditions
- Account `qamob-tc012@qa.example.com`; `TranscriptSource` double reporting `capable: false`.
- Request spy capturing full `POST /assistant/turn` bodies.

## Test steps
1. Open the surface with the recognizer reporting no capability. Read the composer row.
2. Assert no error message, banner or toast appeared.
3. Type and send a turn; capture the request body.
4. Inspect every field of the body for binary/audio content.
5. Re-run the whole flow with the capability present, asserting the mic returns to visible — with **no** app restart.

## Expected behaviour
- `assistant-mic-button` is **absent** (hidden), not merely dimmed — the mockup's `mic-hidden` state shows a composer with no mic affordance.
- **No error is shown.** A "speech unavailable" banner in this state fails the test — hiding is the whole handling.
- Typing works normally and produces a normal applied outcome.
- The captured request body carries `transcript` as a string and **no** audio field, no base64 blob, no attachment — the field set matches `api-contracts.md ## POST /assistant/turn` exactly, and unknown fields would be rejected `400 VALIDATION` anyway.
- Capability detection is dynamic: turning the capability on restores the mic without a restart. An implementation that decides mic visibility from `Platform.OS` fails this step.

## Test data
| Field | Value |
|-------|-------|
| user | qamob-tc012@qa.example.com |
| capability | `false` → `true` |

## Notes
The "detected by capability, never by platform name" clause is testable at this tier precisely because the capability arrives through the `TranscriptSource` port — a platform-name branch would ignore the port and stay wrong when the port flips.
