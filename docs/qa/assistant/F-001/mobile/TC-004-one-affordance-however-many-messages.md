# TC-004: One affordance, however many messages — a count, not a presence

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-004 |
| Feature | F-001 (voice-assistant-view) |
| Platform | mobile |
| Target | iOS (model tier — see Notes for the node-count gap) |
| Acceptance criteria | AC-30 (d) |
| Type | boundary |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | tests/assistant/mobile/F-001-voice-assistant-view.spec.ts:375 |
| Created | 2026-08-17 by qa-mobile-agent |
| Last updated | 2026-08-17 by qa-mobile-agent |

## Summary
AC-30 (d) is written as a **count**: after N ≥ 2 appends, the number of affordance nodes
on the surface equals 1. The owner's decision says the same thing in the user's words —
"five messages arriving while the user reads produce the same one affordance, not five."
A case that only checks the pill *exists* passes against an implementation that stacks
five of them.

## Preconditions
- No simulator required.

## Test steps (mobile)
1. Away from the bottom, append messages one at a time up to five. After each append,
   read the unseen count and the published affordance.
2. Append a batch of three at once, and separately append the same three one at a time;
   compare the resulting affordances.
3. Append four messages one at a time and compare the affordance's row on each step
   against the row it had on the first.

## Expected behaviour
- Step 1 → after the n-th arrival the count is `n`, the affordance is a **single value**
  (not a list), and its label carries the running total. An implementation producing one
  affordance per message could not report an aggregate.
- Step 2 → batch and one-at-a-time reach the identical count and the identical
  affordance. The affordance is a function of the accumulated state, not of the arrival
  pattern.
- Step 3 → the row is unchanged across every later arrival: it "persists across every
  later one without stacking, duplicating, or re-mounting."

## Test data
| Field | Value |
|-------|-------|
| Arrival counts | 1, 2, 3, 4, 5 |
| Batch | 3 messages appended in one call |

## Notes
- **What this TC cannot falsify — stated plainly.** The literal node count. The follow
  model returns one affordance *value* by construction, so "exactly one node" is proved
  here only as far as "the model aggregates N arrivals into one control carrying the
  total", which is the strongest falsifiable proxy available off-device. Counting
  rendered nodes needs a rendered tree: device tier, TC-009.
- The re-mount half is also only partly reachable here: an unchanged row is evidence the
  control was not rebuilt, but a component that re-mounted while keeping its row would
  look identical to the model. The announcement side of the same question is asserted in
  TC-005 (an unchanged pill must not re-announce).
