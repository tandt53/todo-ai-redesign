# TC-042: Activating the affordance goes to the bottom and the affordance is gone

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-042 |
| Feature | F-001 (voice-assistant-view) |
| Platform | web |
| Acceptance criteria | AC-30, AC-19 |
| Type | happy |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | qa/assistant/automation/e2e/F-001-voice-assistant-view.spec.ts |
| Created | 2026-08-17 by qa-web-agent |
| Last updated | 2026-08-17 by qa-web-agent |

## Summary
Clause (f), first dismissal path. Activating the affordance — by tap, click **or keyboard**, since it is a control under AC-19's WCAG 2.1.1 and exposes name/role/value under 4.1.2 — scrolls the surface to the bottom; afterwards `distance_from_bottom ≤ 48` by clause (a) and the affordance is gone.

The activation is driven from the **keyboard** here rather than the mouse, because that is the half a click-only case leaves unguarded, and because components.md places the control in DOM order between the conversation and the Composer specifically so `Tab` reaches it.

## Preconditions
- Fresh account `qaweb-tc042-{run}-*@qa.example.com`, overflowing conversation, one message arrived below the fold so the affordance is showing.

## Test steps (web)
1. Build an overflowing conversation; submit `qaweb ac30 slow one`; park at the top; wait for the affordance.
2. Assert the control's role is `button`.
3. Focus the composer input and press `Shift+Tab`; assert the affordance is now focused. (Driven backwards from the composer on purpose: tabbing *forwards* out of the conversation moves focus through the message controls, and focusing a control inside the conversation scrolls it into view — which dismisses the affordance before the case gets to it.)
4. Press `Enter` on the affordance.
5. Read `distance_from_bottom`, the affordance count, and the newest bubble's rectangle against the viewport.

## Expected behaviour
- `distance_from_bottom ≤ 48` after activation.
- Zero affordance nodes.
- The newest message is **inside** the scrolled viewport — the point of pressing it.

## Test data
| Field | Value |
|-------|-------|
| user | qaweb-tc042-{run}-*@qa.example.com |
| arriving turn | `qaweb ac30 slow one` (QA_EXTRA, 2500ms) |

## Notes
Clause (f)'s other dismissal path — reaching the bottom by hand — is TC-043, written as a structurally different case rather than a second phase here. The AC gives one obligation two triggers, and one setup shared between them is what hides the trigger nobody wired (L-005/L-006).
