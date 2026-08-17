# TC-025: Background while listening — capture stops, words kept, no turn sent

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-025 |
| Feature | F-003 (mobile-surface) |
| Platform | mobile |
| Acceptance criteria | AC-5, AC-7, F-001 AC-26, F-001 AC-3 |
| Type | edge |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | qa/assistant/automation/mobile/F-003-mobile-surface.spec.ts |
| Targets | ios, android |
| Tier | node-headless |
| Created | 2026-08-16 by qa-mobile-agent |
| Last updated | 2026-08-17 by qa-mobile-agent |

## Summary
The graceful sibling of TC-024. Backgrounding while listening — home, app switcher, system back — must behave like cancel-while-listening: capture stops, recognized-so-far text is preserved, and **no turn is sent**. Sending on background would put words the user never finished on the wire, which is both a surprise mutation and a privacy problem.

## Preconditions
- Account `qamob-tc025@qa.example.com`; `AppLifecycle` double able to emit background/foreground.

## Test steps
1. Tap the mic; emit two partials.
2. Emit a background event from `AppLifecycle`.
3. Read: capture state, request spy, `client.pending_input`.
4. Emit a foreground event. Read the state and the composer.
5. Repeat with each background trigger the spec names: home, app switcher, system back.

## Expected behaviour
- Capture **stops** on background — the recognizer is not left running in the background (F-001 Out of Scope: no background capture; a listening ongoing-notification was explicitly rejected).
- The request spy records **zero** turns. This is the assertion that must not be weakened.
- `client.pending_input` holds the recognized-so-far text.
- On foreground the surface is in **idle** (not listening — capture is not silently resumed) and the composer holds the text.
- All three background triggers behave identically.

## Test data
| Field | Value |
|-------|-------|
| user | qamob-tc025@qa.example.com |
| triggers | home, app switcher, system back |

## Notes
Pairs with TC-036 (system back is non-destructive): back while listening is a background transition governed by AC-5/AC-6, not a cancel of anything already sent.
