# TC-044: Under reduce-motion, clause (b)'s follow completes without animation

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-044 |
| Feature | F-001 (voice-assistant-view) |
| Platform | web |
| Acceptance criteria | AC-30, AC-19 |
| Type | accessibility |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | tests/assistant/e2e/F-001-voice-assistant-view.spec.ts |
| Created | 2026-08-17 by qa-web-agent |
| Last updated | 2026-08-17 by qa-web-agent |

## Summary
Clause (g) attaches to **the scroll**, not to the clause that triggers it, and quantifies over every scroll this AC mandates. As written that is three paths: (b)'s follow, (f)'s activation and (h)'s submit. This case covers the **follow** — a message arriving while the user is at the bottom.

Three separate cases, one per path (TC-044/045/046), deliberately not one case parameterised over a shared setup: a shared setup is exactly what hides the door nobody guarded (L-005, L-006).

## Preconditions
- `prefers-reduced-motion: reduce` set on the page **and asserted** via `matchMedia` before the case proceeds.
- Fresh account `qaweb-tc044-{run}-*@qa.example.com`, overflowing conversation, surface at the bottom.

## Test steps (web)
1. Set reduce-motion; assert `matchMedia('(prefers-reduced-motion: reduce)').matches` is true.
2. Build an overflowing conversation; submit `qaweb ac30 slow one`; return the surface to the bottom and let the park's own scroll event drain.
3. Start recording every scroll offset the container passes through.
4. Wait for the arrival, then 700ms.
5. Stop recording; read `distance_from_bottom` and the newest bubble's rectangle.

## Expected behaviour
- The surface followed: `distance_from_bottom ≤ 48` and the newest message is inside the viewport — reduce-motion changes **how** the scroll happens, never whether it happens.
- **At most one** scroll offset is recorded: the single mandated scroll completed in one step. The observable is the absence of animation, not a shortened duration.

## Test data
| Field | Value |
|-------|-------|
| user | qaweb-tc044-{run}-*@qa.example.com |
| preference | `prefers-reduced-motion: reduce` (set with `page.emulateMedia`) |

## Notes
`test.use({ reducedMotion: 'reduce' })` is **silently inert** against this project's Playwright/browser build — under it the page reports `matches === false`. All three reduce-motion cases were first written that way and ran in ordinary motion while claiming to test reduced motion; two of them "failed" for the wrong reason and one could equally have passed for the wrong reason. `page.emulateMedia()` does take, and the `matches` assertion is what stops this becoming a silent regression again. Recorded in the run record.
