# TC-027: Transient recognition failure — dimmed with transient cause, auto-recovers; typing unaffected

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-027 |
| Feature | F-001 (voice-assistant-view) |
| Platform | web |
| Acceptance criteria | AC-22 |
| Type | negative |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | tests/assistant/e2e/F-001-voice-assistant-view.spec.ts |
| Created | 2026-08-16 by qa-web-agent |
| Last updated | 2026-08-17 by qa-web-agent (T-070b — ADR-008 English copy sync) |

## Summary
A transient recognition failure (service busy, language pack unavailable) shows a visible message; while the capability is down the mic renders DIMMED with a message stating the transient cause — distinguishable from permission-denied — and returns to available when recognition recovers. Typing is unaffected throughout.

## Preconditions
- Permission granted. User `qaweb-tc027@qa.example.com`; failure-injection seam (spec speech test seam: transient recognition failure + recovery).

## Test steps
1. Inject a transient recognition failure. Read the mic and the message.
2. Compare the message text against TC-026's permission message (both captured).
3. While down: type and send a turn; read the outcome.
4. Inject recovery. Read the mic; tap it and confirm listening starts.

## Expected behaviour
- **Dimmed + transient wording**: mic visible, dimmed (mockup `mic-transient` — dimmed WITHOUT the permission slash; aria-label "Microphone is temporarily unavailable"); the message states the transient cause and expected self-recovery (head "Speech recognition is busy", body "The recognition service isn't answering. It usually clears in a moment — the mic will come back on its own.").
- **Distinguishable**: the transient message ≠ the permission message (explicit inequality assertion on the two rendered texts AND the two aria-label variants; the transient state lacks the permission slash/CTA).
- **Typing unaffected**: typed turn completes with full anatomy while recognition is down.
- **Recovery is visible**: mic returns to available (dimming gone, "Tap to speak"), and listening actually starts on the next tap (functional recovery, not just styling).

## Test data
| Field | Value |
|-------|-------|
| user | qaweb-tc027@qa.example.com |
| failure script | fixture row `WEB-TRANS-1` (busy → recovered) |

## Notes
State-transition pair with TC-026 covers both dimmed causes AC-21/AC-22 require the UI to distinguish. Neither is a conversation "state" (AC-29 — mic modes are orthogonal); the automation asserts the surface stays idle throughout.
