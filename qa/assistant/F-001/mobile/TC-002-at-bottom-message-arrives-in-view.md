# TC-002: At the bottom, the message arrives in view and no affordance appears

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-002 |
| Feature | F-001 (voice-assistant-view) |
| Platform | mobile |
| Target | iOS (model tier — no simulator; see Notes) |
| Acceptance criteria | AC-30 (b) |
| Type | regression |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | qa/assistant/automation/mobile/F-001-voice-assistant-view.spec.ts:328 |
| Created | 2026-08-17 by qa-mobile-agent |
| Last updated | 2026-08-17 by qa-mobile-agent |

## Summary
The reproduction case for **BUG-004** at the mobile layer: send a turn, and the outcome
message lands below the fold with the view never moving. AC-30 (b) requires that a user
who is already at the bottom has the newest message scrolled fully into view in the same
render that appends it, with no affordance shown.

## Preconditions
- No simulator required; the follow model runs in-process.
- BUG-004 is the reason this TC is typed `regression`: `qa/_shared/bugs/BUG-004-conversation-never-scrolls-to-newest-message.md`.

## Test steps (mobile)
1. With nothing unseen and the surface at the threshold distance, append one message.
2. With **three** messages already unseen (the user was away and has since returned to
   the bottom), append a fourth.
3. For both, ask the affordance model what control the surface is showing.

## Expected behaviour
- Step 1 → `{ unseen: 0, follow: true }`. The surface follows, and nothing is left unseen.
- Step 2 → `unseen` is reset to 0 and the surface follows. A count must not survive the
  user's return to the bottom.
- Step 3 → **no affordance** in either case (NMA-HIDDEN, which design publishes as "not
  rendered; it holds no layout, so nothing reflows when it goes").

## Test data
| Field | Value |
|-------|-------|
| Threshold | parsed from AC-30 (a) |
| Leftover unseen count | 3 |

## Notes
- **What this TC cannot falsify.** That the message is *actually on screen*. This is the
  precise gap BUG-004 shipped through: every presence assertion in this repo passes
  against a message rendered 176 units below the fold. What is asserted here is the
  model's decision to follow and to publish no affordance — not the resulting pixel
  position. Real visibility is device-tier (TC-009).
- Mutation-checked: `BOTTOM_SLACK 48 → 0` turns the follow verdict false and this TC red.
