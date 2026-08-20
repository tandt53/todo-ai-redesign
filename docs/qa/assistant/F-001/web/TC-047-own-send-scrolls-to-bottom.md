# TC-047: The user's own send scrolls to the bottom and clears the affordance

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-047 |
| Feature | F-001 (voice-assistant-view) |
| Platform | web |
| Acceptance criteria | AC-30 |
| Type | happy |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | tests/assistant/e2e/F-001-voice-assistant-view.spec.ts |
| Created | 2026-08-17 by qa-web-agent |
| Last updated | 2026-08-17 by qa-web-agent (FAILING — BUG-006) |

## Summary
Clause (h), the single exception to clause (c), granted to the user's **action** and never to a message's importance. You are scrolled up reading history, you type something and hit send: the surface scrolls to the bottom wherever it was, and the affordance is cleared. The end state is identical to clause (f)'s — `distance_from_bottom ≤ 48`, no affordance — because they are one scroll routine called from two places.

The case then asserts what clause (h) says follows from that end state in its own words: *"having scrolled, the user is at the bottom by (a), so the assistant's reply to that same turn arrives in view through (b) on its own."* That is the whole user-visible point — you send something and you see the answer — and it is what BUG-004 took away.

The turn used is an **ordinary** canonical one, not one of the slow QA rows. The everyday case is a reply that comes back quickly, and clause (h)'s postcondition is stated without reference to how fast the answer arrives.

## Preconditions
- Fresh account `qaweb-tc047-{run}-*@qa.example.com`, overflowing conversation.
- A live affordance on screen before the send, so the case proves (h) **clears** it rather than merely co-existing with it.

## Test steps (web)
1. Build an overflowing conversation; leave it at the bottom.
2. Submit `qaweb ac30 slow one`; park at the top; wait for the affordance. Assert the surface is not at the bottom.
3. Submit a canonical `plan the week` turn from that scrolled-up position.
4. Wait for its outcome message, then a further 1500ms — well past any scroll animation.
5. Read `distance_from_bottom`, the affordance count, and the newest bubble's rectangle against the viewport.

## Expected behaviour
- `distance_from_bottom ≤ 48`.
- Zero affordance nodes — clause (h) says "the affordance is cleared".
- The reply to the user's own turn is **inside** the scrolled viewport.

## Actual behaviour — FAILING (BUG-006)
`distance_from_bottom = 121`, one affordance reading `1 new message`, and the reply to the user's own turn is below the fold. Reproduced 3 of 3 isolation runs. The scroll starts, animates, and stops 121 logical units short of the bottom — the height of the row that appended while it was moving. Filed as `docs/qa/_shared/bugs/BUG-006-own-send-lands-short-of-the-bottom.md`, layer `web`.

## Test data
| Field | Value |
|-------|-------|
| user | qaweb-tc047-{run}-*@qa.example.com |
| affordance trigger | `qaweb ac30 slow one` (QA_EXTRA, 2500ms) |
| the send under test | `plan the week` (canonical row, no delay) |

## Notes
This case is deliberately not written with a slow row. With a 150ms+ reply the defect does not reproduce, because the reply lands after the scroll has finished and clause (b) then follows it correctly. Using a slow row here would have produced a green test over a broken behaviour — coverage that cannot fail, which is the failure mode this whole AC exists to correct.
