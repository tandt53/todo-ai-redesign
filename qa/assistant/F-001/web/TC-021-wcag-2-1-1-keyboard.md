# TC-021: WCAG 2.1.1 — mic, undo, candidate and confirm controls fully keyboard-operable

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-021 |
| Feature | F-001 (voice-assistant-view) |
| Platform | web |
| Acceptance criteria | AC-19 |
| Type | accessibility |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | qa/assistant/automation/e2e/F-001-voice-assistant-view.spec.ts |
| Created | 2026-08-16 by qa-web-agent |
| Last updated | 2026-08-16 by qa-web-agent |

## Summary
AC-19 names WCAG 2.1.1 (Keyboard) for exactly these controls: mic, undo, candidate chips, confirm chips. Every one must be reachable by Tab and operable by Enter/Space, with a visible focus indicator, and no keyboard trap anywhere on the surface.

## Preconditions
- Open session. User `qaweb-tc021@qa.example.com`; baseline seed tasks.
- Scenarios staged: applied turn (undo present), pending confirm question, pending clarify question.

## Test steps
1. From the composer, Tab through the surface; record the focus order.
2. Focus `assistant-mic-button`; press Enter, then Space — each must start listening (then stop it the same way).
3. Focus `assistant-undo-button`; press Enter → undo executes (TC-007 observables).
4. Focus `assistant-chip-affirm` / `assistant-chip-negative` / `assistant-option-chip`; operate each by keyboard on a fresh question.
5. Tab forward through the whole view and Shift+Tab back; confirm no trap (focus always escapes every region).

## Expected behaviour
- All named controls are in the Tab order and activate on Enter AND Space (native buttons per the mockup markup — this is the falsifiable check that they stay native or equivalent).
- Focus visible on each (the mockup's `:focus-visible` ring — assert a computed outline/indicator is present when focused).
- Keyboard activation produces the SAME outcome as pointer activation (undo reverts, chip answers send the literal text, mic toggles listening) — parity, not just focusability.
- No keyboard trap; composer input remains reachable and typeable at all times.

## Test data
| Field | Value |
|-------|-------|
| user | qaweb-tc021@qa.example.com |

## Notes
Voice is never the only path (spec Purpose) — this TC is that promise's keyboard half. Complements TC-022 (semantics) and TC-024 (label-in-name).
