# TC-041: At 375px the pill keeps the question legible instead of ellipsising it away

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-041 |
| Feature | F-001 (voice-assistant-view) |
| Platform | web |
| Acceptance criteria | AC-30 |
| Type | accessibility |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | qa/assistant/automation/e2e/F-001-voice-assistant-view.spec.ts |
| Created | 2026-08-17 by qa-web-agent |
| Last updated | 2026-08-17 by qa-web-agent |

## Summary
`components.md` publishes a second line for NMA-WAITING and says explicitly that it is not cosmetic: at 375px a single non-wrapping line ellipsises the question away and leaves *"Waiting for your answer — Delete …"*, which announces that something is pending and withholds **what**. That is the exact failure the row exists to prevent, and it only exists at a real width with real text shaping.

## Preconditions
- Viewport 375×667, set for the whole test (not by resizing mid-test — a resize exercises the app's response to a resize, which is a different behaviour).
- Fresh account `qaweb-tc041-{run}-*@qa.example.com` seeded with `qaweb AC30 Q A|B|C`.
- QA harness row `qaweb ac30 slow confirm`.

## Test steps (web)
1. Open at 375×667; build an overflowing conversation; leave it at the bottom.
2. Submit `qaweb ac30 slow confirm`; park at the top; wait for the question to land below the fold.
3. Read the pill label's `scrollWidth`/`clientWidth` and `scrollHeight`/`clientHeight`, its computed line-height and its line clamp.
4. Read the pill's `aria-label`.
5. Read the pill's bounding box against the 375px viewport.

## Expected behaviour
- `scrollWidth ≤ clientWidth + 1`: no horizontal ellipsis. The question is not cut off.
- `scrollHeight ≤ clientHeight + 1`: nothing clipped by the two-line clamp either.
- The label occupies exactly **two** lines — the design allows one where it fits and two at most where it does not.
- The accessible name still carries the whole string, per components.md's rule that the visible text is a prefix of the name and never a replacement (WCAG 2.5.3).
- The pill is fully within the 375px viewport: a legible label rendered off the edge of a phone is not legible.

## Test data
| Field | Value |
|-------|-------|
| user | qaweb-tc041-{run}-*@qa.example.com |
| viewport | 375×667 |
| expected copy | parsed from `design/_shared/components.md` §NewMessageAffordance |

## Notes
`innerText` proves nothing here and is deliberately not the assertion: a CSS-ellipsised string still reads back **in full** from the DOM while the user sees "Waiting for your answer — Delete …". The falsifiable form is the label's own overflow geometry, which is why this case cannot exist below the browser tier.
