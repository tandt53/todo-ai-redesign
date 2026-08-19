# TC-045: Under reduce-motion, clause (f)'s activation completes without animation

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-045 |
| Feature | F-001 (voice-assistant-view) |
| Platform | web |
| Acceptance criteria | AC-30, AC-19 |
| Type | accessibility |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | tests/assistant/e2e/F-001-voice-assistant-view.spec.ts |
| Created | 2026-08-17 by qa-web-agent |
| Last updated | 2026-08-17 by qa-web-agent |

## Summary
Clause (g) on the **activation** path: pressing the affordance under reduce-motion lands at the bottom with no intermediate frames. This is the longest scroll of the three — from wherever the user was reading, all the way down — so it is where an animation is most visible and most likely to have been left in.

## Preconditions
- `prefers-reduced-motion: reduce` set and asserted.
- Fresh account `qaweb-tc045-{run}-*@qa.example.com`, overflowing conversation, one message arrived below the fold so the affordance is showing.

## Test steps (web)
1. Set reduce-motion; assert it took.
2. Build an overflowing conversation; submit `qaweb ac30 slow one`; park at the top; wait for the affordance.
3. Start recording scroll offsets.
4. Click the affordance; wait 800ms.
5. Stop recording; read `distance_from_bottom` and the affordance count.

## Expected behaviour
- `distance_from_bottom ≤ 48` and zero affordance nodes — the same end state clause (f) requires with motion on.
- **At most one** recorded scroll offset. For comparison, the same activation with the preference off walks through 48 intermediate offsets; that contrast is the evidence this assertion can fail.

## Test data
| Field | Value |
|-------|-------|
| user | qaweb-tc045-{run}-*@qa.example.com |
| preference | `prefers-reduced-motion: reduce` |

## Notes
Measured with the preference off, this path emits 48 offsets; with it on, one. The (b) path emits 7 against 1. Those two numbers are what make the step-count assertion falsifiable rather than decorative.
