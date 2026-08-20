# TC-038: The affordance overlays the conversation; it never reflows the sentence being read

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-038 |
| Feature | F-001 (voice-assistant-view) |
| Platform | web |
| Acceptance criteria | AC-30 |
| Type | regression |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | tests/assistant/e2e/F-001-voice-assistant-view.spec.ts |
| Created | 2026-08-17 by qa-web-agent |
| Last updated | 2026-08-17 by qa-web-agent |

## Summary
`docs/design/_shared/components.md` §NewMessageAffordance docks the pill at **zero height** so that it floats over the last line of the conversation instead of pushing history upward. The reason is stated there and it is the same reason clause (c) exists: an affordance that appears by reflowing the pane moves the sentence the user is reading, which is the defect it was added to prevent. A control that announces "the view did not move" by moving the view has spent the guarantee to deliver the notice.

This is a real-layout property. No unit tier can see it: in jsdom every box is zero and every element is in view, so a docked pill and a pill that pushes 40px of history off the top render identically.

## Preconditions
- Fresh account `qaweb-tc038-{run}-*@qa.example.com`, overflowing conversation, surface at the bottom.
- Viewport 1280×720. QA harness row `qaweb ac30 slow one` (2500ms).

## Test steps (web)
1. Build an overflowing conversation.
2. Submit `qaweb ac30 slow one`; let clause (h)'s scroll settle; scroll to the top of the conversation.
3. Record the bounding box of the first message bubble — the one the user is looking at.
4. Wait for the affordance to appear.
5. Re-read the same bubble's bounding box.
6. Read the height of the affordance's dock container, and whether the pill's rectangle overlaps the conversation container's rectangle.
7. Read the pill's own box against the browser viewport.

## Expected behaviour
- The message's bounding box is **identical** — same x, y, width, height. Not "approximately"; the pill takes no layout, so nothing it does can move a pixel of history.
- The dock's height is `≤ 1` logical unit: it holds no layout, which is what makes the overlay an overlay and what lets NMA-HIDDEN vanish without a reflow either.
- The pill's rectangle **overlaps** the conversation container's — it is painted over the conversation, not in a strip below it.
- The pill itself is fully within the browser viewport — an overlay rendered off screen notifies nobody.

## Test data
| Field | Value |
|-------|-------|
| user | qaweb-tc038-{run}-*@qa.example.com |
| arriving turn | `qaweb ac30 slow one` (QA_EXTRA, 2500ms) |

## Notes
The dock is reached from the pill's own testid (parent of parent) rather than by class name, so the assertion does not depend on `.nm-dock` keeping its name.

**The bubble-box check alone is not sufficient, and that was found by breaking it rather than by reasoning about it.** With the user parked at the *top* of the thread, giving the dock real layout shrinks the conversation viewport from its *bottom* edge — so content anchored at scroll offset 0 does not move and the box comparison stays green straight through a reflow. The overlap assertion is what actually falsifies it. Measured in a DOM-only mutation: as shipped, pill top 590.5 against a conversation bottom of 639 (overlapping, dock 0px); with the dock given layout, pill top 598.5 against a conversation bottom of 598.5 (below it, dock 40.5px, and 40.5px of conversation gone). Both assertions are kept — the box check still catches a reflow that pushes content down, which is the other way this could break.
