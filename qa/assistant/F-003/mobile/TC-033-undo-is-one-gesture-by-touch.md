# TC-033: Undo stays ONE gesture by touch — no confirm sheet, no long-press, no swipe discovery

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-033 |
| Feature | F-003 (mobile-surface) |
| Platform | mobile |
| Acceptance criteria | AC-9, F-001 AC-5 |
| Type | happy |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | qa/assistant/automation/mobile/F-003-mobile-surface.spec.ts |
| Targets | ios, android |
| Tier | node-headless (gesture count) + device-lab (real gesture recognisers) |
| Created | 2026-08-16 by qa-mobile-agent |
| Last updated | 2026-08-17 by qa-mobile-agent |

## Summary
F-001 AC-5's one-gesture undo carries onto touch unchanged. Mobile idioms invite exactly the regressions AC-9 forbids: a destructive-action confirmation sheet, a long-press to reveal undo, or a swipe the user has to discover. Undo is a visible button and one tap.

## Preconditions
- Account `qamob-tc033@qa.example.com`; an applied turn with `assistant-undo-button` rendered.

## Test steps
1. Perform a single tap on `assistant-undo-button`. Count the interactions required until the revert completes.
2. Assert no modal, sheet or dialog was presented between the tap and the revert.
3. Assert the affordance is visible without any preceding gesture — no long-press, no swipe, no overflow menu.
4. Repeat for a turn that changed 4 tasks (undo covers the whole turn in the same one gesture).
5. Repeat via voice, saying the undo phrase — **"undo"**, the whole closed list since ADR-008 retired the Vietnamese "hoàn tác" — and assert parity of outcome. Take the phrase from `qa/assistant/F-001/api/utterance-intent-fixtures.json` row **UT-UNDO-EN** rather than typing it: that table owns the vocabulary, and the automation reads it from there.

## Expected behaviour
- Exactly **one** interaction reverts the turn. Two (tap → confirm) fails.
- No confirmation sheet is presented. Undo-instead-of-confirm is the product rule; confirmation is reserved for multi-task **deletes** (F-001 AC-9), never for undo itself.
- `assistant-undo-button` is visible in the applied message without any reveal gesture.
- Step 4: one gesture reverts all 4 tasks — undo is whole-turn.
- Step 5: the voice path produces the same outcome message and the same list state as the tap path.

## Test data
| Field | Value |
|-------|-------|
| user | qamob-tc033@qa.example.com |
| turns | 1-task and 4-task applied turns |

## Notes
**Device-lab residue:** that no OS-level gesture recogniser (iOS shake-to-undo, an Android swipe container) intercepts or duplicates the affordance is a device observation. The headless half asserts the interaction count and the absence of a confirm step in the model's own flow.
