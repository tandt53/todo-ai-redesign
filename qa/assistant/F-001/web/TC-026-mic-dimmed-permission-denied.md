# TC-026: Permission denied — mic dimmed with re-grant path; asked before first talk; typing intact

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-026 |
| Feature | F-001 (voice-assistant-view) |
| Platform | web |
| Acceptance criteria | AC-21 |
| Type | negative |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | qa/assistant/automation/e2e/F-001-voice-assistant-view.spec.ts |
| Created | 2026-08-16 by qa-web-agent |
| Last updated | 2026-08-16 by qa-web-agent |

## Summary
Permission is requested before the FIRST talk attempt with a short explanation — not at app open. On denial: mic stays visible but dimmed; activating it leads the user to (or tells them) where to re-grant; typing fully works. The message must state the PERMISSION cause (distinguishable from TC-027's transient cause).

## Preconditions
- Fresh profile (no permission decision). User `qaweb-tc026@qa.example.com`; permission seam injectable (grant/deny scripting).

## Test steps
1. Load the surface; observe: NO permission prompt fired at open (seam records request timestamps).
2. Tap `assistant-mic-button` for the first time → the permission request fires now, alongside/after a short visible explanation.
3. Deny via the seam. Read the mic, the message, and the composer.
4. Activate the dimmed mic. Read what renders (`assistant-permission-cta` path).
5. Type and send a turn.
6. Re-grant via the seam; tap the mic.

## Expected behaviour
- **Timing**: zero permission requests before the first talk attempt; exactly one at first tap, with the short explanation visible.
- **Denied**: mic visible but dimmed (mockup `mic-permission`: reduced opacity + slash overlay + aria-label "Micro cần quyền truy cập"); a message states the mic is BLOCKED BY PERMISSION ("Trình duyệt đang chặn micro cho trang này…" shape) — permission wording, not transient wording.
- **Re-grant path**: activating the dimmed mic (or the message's `assistant-permission-cta`) tells/leads where to re-grant — the guidance renders.
- **Typing intact**: the typed turn completes normally (full anatomy).
- **Recovery**: after re-grant, the mic returns to available and listening starts on tap.

## Test data
| Field | Value |
|-------|-------|
| user | qaweb-tc026@qa.example.com |
| permission script | fixture row `WEB-PERM-1` (deny → grant) |

## Notes
Web has a single required permission (mic); the iOS dual-permission clause is mobile scope. Pair: TC-027 must be visually/textually distinguishable from this state — the automation cross-asserts the two messages differ.
