# TC-035: Parked 40 units up — inside clause (a)'s slack — the arriving message is brought on screen

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-035 |
| Feature | F-001 (voice-assistant-view) |
| Platform | web |
| Acceptance criteria | AC-30 |
| Type | boundary |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | qa/assistant/automation/e2e/F-001-voice-assistant-view.spec.ts |
| Created | 2026-08-17 by qa-web-agent |
| Last updated | 2026-08-17 by qa-web-agent |

## Summary
Clause (a) defines "at the bottom" as a number — `distance_from_bottom ≤ 48` logical units — and clause (b) says that from there a new message arrives **in view**. This is the inside half of that boundary: the user is parked 40 units above the bottom, which is *not* the bottom in any visual sense but *is* the bottom by the AC's definition, and the arriving message must be scrolled fully into the viewport with no affordance shown.

It is also the case that falsifies clause (a)'s sampling rule without needing to see the sample. The AC requires the measurement to be taken **immediately before** the append; a post-append sample reports every user as not-at-bottom, because appending grows `content_height`. An implementation that sampled afterwards would show an affordance here and leave the message off screen — so this case fails against exactly that mistake.

## Preconditions
- Fresh account `qaweb-tc035-{run}-*@qa.example.com`, conversation built to overflow its viewport (3 canonical `plan the week` turns) and left at the bottom with no affordance showing.
- Viewport 1280×720 (Playwright desktop default).
- QA harness row `qaweb ac30 slow one` (2500ms) so the viewport can be parked after the submit and before the outcome arrives.

## Test steps (web)
1. Build the conversation until it overflows; assert `scrollHeight > clientHeight + 200`, otherwise nothing on this page is testable.
2. Submit `qaweb ac30 slow one`. Wait 500ms for clause (h)'s own scroll to settle.
3. Park the viewport at exactly `distance_from_bottom = 40` and assert the achieved distance is `≤ 48`.
4. Assert the outcome has **not** yet arrived (the message-bubble count is unchanged) — the case is about an arrival that happens *after* the park.
5. Wait for the outcome to land (task row `qaweb AC30 Slow One`), then let the follow-scroll settle.
6. Compare the newest message bubble's rectangle against the scroll container's rectangle.
7. Re-read `distance_from_bottom` and count `assistant-new-message-affordance` nodes.

## Expected behaviour
- The newest message is **fully inside the scrolled viewport** — top and bottom edges both within the container. This is a rectangle comparison, not `toBeVisible()`: a message rendered below the fold is visible to Playwright and absent from the user's screen, which is the whole of BUG-004.
- After the follow, `distance_from_bottom ≤ 48`.
- Exactly **zero** affordance nodes: clause (b) says the message arrives in view *and* no affordance appears.

## Test data
| Field | Value |
|-------|-------|
| user | qaweb-tc035-{run}-*@qa.example.com |
| thread builder | `plan the week` ×3 (canonical row) |
| arriving turn | `qaweb ac30 slow one` (QA_EXTRA, 2500ms → 1 create) |

## Notes
Paired with TC-036, which parks 60 units up. The two differ by 20 pixels of scroll position and by the entire behaviour of this AC — that contrast is what makes them a boundary test rather than two happy paths.
