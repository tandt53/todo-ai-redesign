# TC-038: An error message is announced immediately rather than queued behind earlier output

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-038 |
| Feature | F-003 (mobile-surface) |
| Platform | mobile |
| Acceptance criteria | AC-12, F-001 AC-19 |
| Type | accessibility |
| Priority | P1 |
| Status | draft |
| Automation | manual |
| Automation file | tests/assistant/mobile/F-003-mobile-surface.spec.ts (priority-flag half only) |
| Targets | ios, android |
| Tier | manual-pass (real screen reader) + node-headless (priority flag) |
| Created | 2026-08-16 by qa-mobile-agent |
| Last updated | 2026-08-17 by qa-mobile-agent |

## Summary
The politeness half of AC-12. A conversation that has just announced a long applied message must not make a screen-reader user wait through it to learn the next turn failed. Errors are announced **immediately** — assertive, interrupting — while ordinary messages stay polite.

## Preconditions
- Real iOS device (VoiceOver) and Android device (TalkBack).
- Account `qamob-tc038@qa.example.com`; failure injection available.

## Test steps
1. Produce a long applied message (4 changed tasks) so its announcement takes several seconds.
2. While it is still being spoken, send a turn that errors.
3. Record whether the error is spoken immediately or after the applied announcement finishes.
4. Record accessibility focus before and after.
5. Repeat in the reverse order: error first, then an ordinary message — confirm the ordinary message does **not** interrupt.
6. Confirm the error is announced exactly **once**, not repeated on re-render.

## Expected behaviour
- The error announcement **interrupts** the in-progress polite announcement — the user hears it immediately.
- Ordinary messages remain polite and never interrupt (step 5) — everything assertive would be as broken as nothing assertive.
- Focus does not move for either.
- The error is announced once. A duplicate announcement on re-render is a defect (F-001's web suite pinned the same "announced immediately, once" property).
- The spoken error content states what failed and that retry is available — not just an error tone or the state word.

## Test data
| Field | Value |
|-------|-------|
| user | qamob-tc038@qa.example.com |
| long message | a 4-task applied turn |

## Notes
**Manual by specification** (real screen reader). The node-testable half is the **priority flag**: whether the client marks the error announcement assertive/interrupting and ordinary ones polite. That again requires the announcement seam flagged as an open question in `index.md`. Without the seam, both halves are manual.
