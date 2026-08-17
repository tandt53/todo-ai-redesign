# TC-006: Reaching the bottom dismisses it — by tap, or by hand

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-006 |
| Feature | F-001 (voice-assistant-view) |
| Platform | mobile |
| Target | iOS (model tier — see Notes for the tap gap) |
| Acceptance criteria | AC-30 (f), AC-19 |
| Type | happy |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | qa/assistant/automation/mobile/F-001-voice-assistant-view.spec.ts:514 |
| Created | 2026-08-17 by qa-mobile-agent |
| Last updated | 2026-08-17 by qa-mobile-agent |

## Summary
AC-30 (f) makes the dismissal condition **being at the bottom**, not the gesture that got
there. Two doors into one room, which is exactly the shape L-005 warns about — so the two
paths are written as two structurally different tests rather than one parameterised over
a shared setup, and a third case proves the dismissal is not simply "any scroll at all".

## Preconditions
- No simulator required.

## Test steps (mobile)
1. Away from the bottom, let three messages arrive; confirm a pill is showing. Then
   arrive at distance 0 (the activation path) and read the state back.
2. **Separately, with no activation anywhere in the setup:** let a bulk-delete question
   arrive at distance 900, confirm the pill is `NMA-WAITING` — the state a
   gesture-keyed implementation is most tempted to treat specially — then reach the
   threshold distance by a plain scroll and read the state back.
3. From an unseen count of 3, scroll to exactly one unit past the threshold.
4. Compare the end state reached by (f)'s activation with the end state reached by (h)'s
   submit.

## Expected behaviour
- Step 1 → the count clears to 0 and no affordance is published. `distance_from_bottom ≤ 48`
  by (a), pill gone.
- Step 2 → identical outcome, from a different starting row and with no tap involved. The
  condition is position, not gesture.
- Step 3 → **nothing is dismissed**; the count is still 3. Without this, steps 1 and 2
  both pass against an implementation that clears the count on any scroll at all.
- Step 4 → the two paths reach the same state. AC-30 (h): "Because the postcondition is
  the same, (f) and (h) are one scroll routine called from two places" — two
  implementations of one postcondition drift (L-005).

## Test data
| Field | Value |
|-------|-------|
| Activation path start | 3 messages unseen at distance `N + 176` |
| Hand-scroll path start | an unresolved bulk-delete question at distance 900 |
| Near-miss distance | `N + 1` |

## Notes
- **What this TC cannot falsify.** That *tapping the pill actually scrolls*. The
  activation is a control under AC-19 (WCAG 2.1.1 keyboard-operable, 4.1.2 name/role/value)
  and its scroll lives in the RN component; what is asserted here is the postcondition
  the AC states, reached through the same model call the manual path uses. The tap itself
  is device-tier (TC-009).
- The affordance's hit area is covered separately: `assistant-new-message-affordance` is
  in `INTERACTIVE_IDS` and is asserted against the 44 pt / 48 dp minimum by the F-003
  suite (`qa/assistant/automation/mobile/F-003-mobile-surface.spec.ts`, "every
  interactive element meets the minimum as HIT AREA on both platforms").
- Mutation-checked: making the scroll handler never clear the count fails 4 cases.
