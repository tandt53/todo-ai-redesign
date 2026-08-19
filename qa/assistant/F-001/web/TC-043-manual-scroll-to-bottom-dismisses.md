# TC-043: Reaching the bottom by hand dismisses the affordance identically, with no tap

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-043 |
| Feature | F-001 (voice-assistant-view) |
| Platform | web |
| Acceptance criteria | AC-30 |
| Type | happy |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | tests/assistant/e2e/F-001-voice-assistant-view.spec.ts |
| Created | 2026-08-17 by qa-web-agent |
| Last updated | 2026-08-17 by qa-web-agent |

## Summary
Clause (f)'s second trigger, stated by the AC as the general rule: **the dismissal condition is being at the bottom, not the gesture that got there.** A user who scrolls down by hand and reads the newest message must not be left with a pill telling them about a message they are looking at.

## Preconditions
- Fresh account `qaweb-tc043-{run}-*@qa.example.com`, overflowing conversation, one message arrived below the fold so the affordance is showing.

## Test steps (web)
1. Build an overflowing conversation; submit `qaweb ac30 slow one`; park at the top; wait for the affordance.
2. Scroll to the bottom with a **real wheel gesture** over the conversation — never by clicking the pill, and never by assigning `scrollTop`.
3. Read `distance_from_bottom`, the affordance count and the newest bubble's rectangle.

## Expected behaviour
- `distance_from_bottom ≤ 48`.
- Zero affordance nodes — dismissed without ever being touched.
- The newest message is inside the scrolled viewport.

## Test data
| Field | Value |
|-------|-------|
| user | qaweb-tc043-{run}-*@qa.example.com |
| arriving turn | `qaweb ac30 slow one` (QA_EXTRA, 2500ms) |

## Notes
A wheel gesture rather than a programmatic scroll, because the gesture is the half under test: a `scrollTop` assignment and a wheel both fire `scroll`, but only the gesture proves the path a user actually takes. Driving the pill here instead would have tested TC-042's path twice and left this one unguarded.
