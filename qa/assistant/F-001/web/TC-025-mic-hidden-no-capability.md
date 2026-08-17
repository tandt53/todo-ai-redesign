# TC-025: No speech capability — mic hidden without error; capability-detected, text-only turns

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-025 |
| Feature | F-001 (voice-assistant-view) |
| Platform | web |
| Acceptance criteria | AC-20 |
| Type | edge |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | qa/assistant/automation/e2e/F-001-voice-assistant-view.spec.ts |
| Created | 2026-08-16 by qa-web-agent |
| Last updated | 2026-08-16 by qa-web-agent |

## Summary
A browser without speech capability hides the mic without error — detected by capability, never by platform/UA name. And AC-20's payload rule at the web layer: the server receives recognized TEXT only — no audio in any turn payload.

## Preconditions
- User `qaweb-tc025@qa.example.com`; baseline seed tasks.
- Capability seam: transcript source reports "no capability" (spec speech test seam). Request capture on `POST /assistant/turn`.

## Test steps
1. Load the surface with capability = none. Read the composer area.
2. Scan the conversation for any error/warning message about speech.
3. Type and send a normal turn; inspect the captured request body.
4. (Capability-detection probe) Same seam but a spoofed/unusual UA string: behaviour must be identical — the seam, not the UA, decides.

## Expected behaviour
- **Mic hidden**: `assistant-mic-button` absent/not visible (mockup `mic-hidden` state); composer + send reflow and work normally; NO error message renders — absence of capability is not an error.
- **Typing unaffected**: the typed turn completes with full outcome anatomy.
- **Text only**: the turn request body contains `transcript` as a string and NO audio field/blob/base64 payload (bounded: assert the JSON shape matches api-contracts' request schema exactly — the contract has no audio field).
- UA variation with the same capability signal changes nothing (never platform-name detection, UC-23 AC-23.3).

## Test data
| Field | Value |
|-------|-------|
| user | qaweb-tc025@qa.example.com |
| capability script | fixture row `WEB-CAP-0` (none) |

## Notes
The known platform asymmetry note (spec, after AC-22) is context: web voice input may itself be a cloud API — irrelevant here since the seam injects text; our contract check is that OUR payload is audio-free.
