# TC-036: Parked 60 units up — outside clause (a)'s slack — the view holds and the affordance appears

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-036 |
| Feature | F-001 (voice-assistant-view) |
| Platform | web |
| Acceptance criteria | AC-30 |
| Type | boundary |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | tests/assistant/e2e/F-001-voice-assistant-view.spec.ts |
| Created | 2026-08-17 by qa-web-agent |
| Last updated | 2026-08-17 by qa-web-agent |

## Summary
The outside half of clause (a)'s 48-unit boundary. At 60 units from the bottom the surface is **not** at the bottom, so clause (c) governs: the view does not move, the arriving message stays below the fold, and one affordance appears.

The 48 is deliberate slack, not "near enough" — momentum scrolling and fractional device-pixel rounding leave a few units of residue, and an exact-zero test would flip the surface between following and not-following during ordinary use. A boundary that is never probed from both sides is a constant nobody has checked.

## Preconditions
- Fresh account `qaweb-tc036-{run}-*@qa.example.com`, conversation overflowing, surface left at the bottom with no affordance.
- Viewport 1280×720. QA harness row `qaweb ac30 slow one` (2500ms).

## Test steps (web)
1. Build the conversation until it overflows; leave it at the bottom.
2. Submit `qaweb ac30 slow one`; wait 500ms for clause (h)'s scroll to settle.
3. Park at exactly `distance_from_bottom = 60`; assert the achieved distance is `> 48`; record `scroll_offset`.
4. Assert the outcome has not yet arrived.
5. Wait for the outcome to land; let 600ms pass — long enough that even a slow scroll would have landed.
6. Re-read `scroll_offset`, test the newest bubble's rectangle against the container's, count affordance nodes.

## Expected behaviour
- `scroll_offset` is **exactly** unchanged. Clause (c) is explicit that no scroll animation is started at all; a shorter or gentler scroll does not satisfy it.
- The newest message is **not** inside the scrolled viewport.
- Exactly **one** affordance node.

## Test data
| Field | Value |
|-------|-------|
| user | qaweb-tc036-{run}-*@qa.example.com |
| arriving turn | `qaweb ac30 slow one` (QA_EXTRA, 2500ms) |

## Notes
Paired with TC-035 (40 units, inside the slack). Both parks are asserted, not assumed: if an in-flight scroll overrode the park, or the outcome landed early, the case would silently measure a different scenario and report on it in this one's name.
