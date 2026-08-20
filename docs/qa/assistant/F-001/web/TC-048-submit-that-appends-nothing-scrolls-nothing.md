# TC-048: A submit that appends nothing scrolls nothing

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-048 |
| Feature | F-001 (voice-assistant-view) |
| Platform | web |
| Acceptance criteria | AC-30, AC-3 |
| Type | negative |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | tests/assistant/e2e/F-001-voice-assistant-view.spec.ts |
| Created | 2026-08-17 by qa-web-agent |
| Last updated | 2026-08-17 by qa-web-agent |

## Summary
The negative half of clause (h), and the reason the AC is careful about **which instant** the scroll attaches to: "the moment is the append of the user's own message, not the submit gesture". AC-3's cancel-before-send renders nothing, so there is nothing to scroll to — and a surface that scrolled on the gesture would drag a reader away from their place for a turn that never existed.

This is also the case that distinguishes an implementation anchored to the append from one anchored to the gesture. Both pass every other clause-(h) case; only this one separates them.

## Preconditions
- Fresh account `qaweb-tc048-{run}-*@qa.example.com`, overflowing conversation, user parked at the top of the history.
- Injectable transcript source (`window.__assistantSeams`, active under `?qaUser=`).

## Test steps (web)
1. Build an overflowing conversation; scroll to the very top; record `scroll_offset` and the message anchored at the top edge with its offset.
2. Tap the mic; confirm the surface is listening.
3. Feed a partial transcript ("add a task to ", "buy milk").
4. End the capture as **cancelled**; confirm the surface returns to idle.
5. Wait 600ms; re-read `scroll_offset`, the anchor's offset and the affordance count.

## Expected behaviour
- `scroll_offset` is exactly unchanged.
- The anchored message is still at the top edge, within 1 logical unit.
- Zero affordance nodes — nothing arrived, so there is nothing to announce either.

## Test data
| Field | Value |
|-------|-------|
| user | qaweb-tc048-{run}-*@qa.example.com |
| transcript fed | `add a task to `, `buy milk` |
| capture ending | `cancelled` (AC-3) |

## Notes
The words stay in the composer under AC-3 (TC-004 owns that guarantee); this case is only about the viewport. Both are asserted at the same instant in the running app, so a fix for one that broke the other would be caught by the pair.
