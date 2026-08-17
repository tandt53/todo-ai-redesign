# TC-022: WCAG 4.1.2 — controls expose name / role / value

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-022 |
| Feature | F-001 (voice-assistant-view) |
| Platform | web |
| Acceptance criteria | AC-19 |
| Type | accessibility |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | qa/assistant/automation/e2e/F-001-voice-assistant-view.spec.ts |
| Created | 2026-08-16 by qa-web-agent |
| Last updated | 2026-08-17 by qa-web-agent (T-070b — ADR-008 English copy sync) |

## Summary
AC-19 names WCAG 4.1.2 (Name, Role, Value) for the mic, undo, candidate and confirm controls. Each must expose an accessible name, a correct role, and — where stateful — a current value/state that UPDATES with the UI (mic pressed-state across listening; checkbox pressed-state; send disabled-state).

## Preconditions
- Open session. User `qaweb-tc022@qa.example.com`; baseline seed tasks; staged applied turn + both question kinds.

## Test steps
1. Query each control by role + accessible name (`getByRole('button', {name})`) — mic ("Tap to speak"), undo ("Undo"), affirm/negative chips (their literal texts, "Delete N tasks" / "Keep them"), candidate chips (candidate texts), checkboxes (per-task "Mark “…” done" / "Mark “…” not done" names), send ("Send"), drawer ("Open lists").
2. Start listening; re-read the mic's `aria-pressed` and accessible name.
3. Deny/degrade mic (permission seam); re-read the mic's accessible name.
4. Toggle a checkbox; re-read its `aria-pressed`. Empty the composer; read send's `aria-disabled`.
5. Trigger listening/thinking and read the state announcement region (`assistant-state-indicator` carries `aria-live="polite"` in the mockup).

## Expected behaviour
- Every control resolves by role=button with its expected accessible name — none is a bare div/span reachable only by testid.
- **Value updates**: mic `aria-pressed` false→true entering listening and its name changes to the listening variant ("Listening — tap to stop" per mockup script); permission-denied name variant ("Microphone needs permission") when dimmed; checkbox `aria-pressed` tracks done-state; send `aria-disabled` tracks composer emptiness.
- State changes ("Listening…"/"Thinking…") are announced via the live region — the region exists with `aria-live` and its text content changes with state. (The conversation live region itself — WCAG 4.1.3 — is covered by TC-033/TC-034; announcing the state word alone does NOT satisfy 4.1.3, see AC-19.)

## Test data
| Field | Value |
|-------|-------|
| user | qaweb-tc022@qa.example.com |

## Notes
The mockup's aria vocabulary (aria-pressed, aria-label variants, aria-live) is the design contract; the app must match or strengthen it, never drop it.
