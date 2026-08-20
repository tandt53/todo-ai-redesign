# TC-037: A message arriving while the user reads history is not on screen, and moves nothing

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-037 |
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
The headline case of clause (c) and the direct inverse of BUG-004: the user has scrolled up to read history, a message arrives, and the view **holds still**. Jumping away from what someone is reading is its own defect — it is the one the owner decision explicitly bought by declining a carve-out.

The AC states "did not move" twice, in two forms, and this case asserts both. As `scroll_offset` unchanged, which is the form the web test compares on a non-inverted list; and in the AC's own general form — the message occupying the top edge of the viewport immediately before the append still occupies it afterwards, at the same offset from that edge, tolerance 1 logical unit.

## Preconditions
- Fresh account `qaweb-tc037-{run}-*@qa.example.com`, conversation overflowing, surface at the bottom.
- QA harness row `qaweb ac30 slow one` (2500ms).

## Test steps (web)
1. Build an overflowing conversation; leave it at the bottom.
2. Submit `qaweb ac30 slow one`; let clause (h)'s scroll settle.
3. Scroll to the very top of the conversation — the reading-history position. Record `scroll_offset`, and record which message bubble occupies the top edge together with its offset from that edge.
4. Assert the outcome has not yet arrived, and that the park is away from the bottom.
5. Wait for the outcome, then wait a further 700ms — long enough that a slow scroll would also have landed.
6. Re-read `scroll_offset`; re-measure the anchored bubble's offset; test the newest bubble against the viewport; count affordance nodes.

## Expected behaviour
- `scroll_offset` unchanged, exactly.
- The anchored message still sits at the top edge, within 1 logical unit of where it was.
- The newest message is **not** inside the scrolled viewport — this is asserted so that "the view did not move" cannot pass trivially because there was nothing to move for.
- Exactly one affordance node.

## Test data
| Field | Value |
|-------|-------|
| user | qaweb-tc037-{run}-*@qa.example.com |
| arriving turn | `qaweb ac30 slow one` (QA_EXTRA, 2500ms) |

## Notes
The two forms of "did not move" agree on a non-inverted list and the AC says so, but the anchor form also survives a list that later inverts, which is a plausible fix for a different scroll problem. Asserting both costs one measurement.
