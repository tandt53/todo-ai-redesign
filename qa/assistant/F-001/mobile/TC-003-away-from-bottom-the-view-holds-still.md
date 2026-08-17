# TC-003: Away from the bottom, the view holds still

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-003 |
| Feature | F-001 (voice-assistant-view) |
| Platform | mobile |
| Target | iOS (model tier — no simulator; see Notes) |
| Acceptance criteria | AC-30 (c) |
| Type | negative |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | qa/assistant/automation/mobile/F-001-voice-assistant-view.spec.ts:346 |
| Created | 2026-08-17 by qa-mobile-agent |
| Last updated | 2026-08-17 by qa-mobile-agent |

## Summary
The half of the owner's decision that protects the user reading history: when a message
arrives while the user is not at the bottom, the view does not move. AC-30 (c) states it
as a comparison, not a feeling — the message at the top edge before the append still
occupies it afterwards — and forbids the softened version explicitly: "No scroll
animation is started at all; a shorter or gentler scroll does not satisfy this."

## Preconditions
- No simulator required.

## Test steps (mobile)
1. Append a message at each of four distances past the threshold: `N + 1`, `N + 176`,
   900 and 12000.
2. Inspect the type of the follow decision, not only its value.
3. With four messages already unseen, scroll to three distances that are all still past
   the threshold (`N + 1`, 300, 4000) and read the unseen count back.

## Expected behaviour
- Step 1 → `follow: false` at every distance. One unit past the threshold is as much
  "not at the bottom" as twelve thousand.
- Step 2 → the decision is a **boolean** `false`. A duration, a ratio, or a truthy
  object would all read as "scrolled a bit", which is the thing (c) forbids.
- Step 3 → the unseen count is returned **unchanged** at every distance. The web form of
  (c) is "`scroll_offset` is unchanged"; the model half is that nothing about the
  affordance state moves either — a user reading history scrolls a little and the pill
  must not reset.

## Test data
| Field | Value |
|-------|-------|
| Distances past threshold | `N + 1`, `N + 176`, 900, 12000 |
| Scroll-without-arriving distances | `N + 1`, 300, 4000 |
| Unseen count carried in | 4 |

## Notes
- **What this TC cannot falsify.** That `scrollTop` is literally unchanged in a rendered
  pane, and that no animation frame was emitted. The model half asserted here is that no
  scroll is *decided*; the rendered half is device-tier (TC-009).
- Mutation-checked: widening `BOTTOM_SLACK` to 400 makes distances that should be
  "away" read as at-bottom and this TC goes red.
