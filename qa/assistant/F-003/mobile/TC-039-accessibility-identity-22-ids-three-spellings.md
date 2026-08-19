# TC-039: Accessibility identity — the same 22 catalogue values on `accessibilityIdentifier` (iOS) and `resource-id` (Android); none invented

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-039 |
| Feature | F-003 (mobile-surface) |
| Platform | mobile |
| Acceptance criteria | AC-12, AC-1 |
| Type | accessibility |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | tests/assistant/mobile/F-003-mobile-surface.spec.ts |
| Targets | ios, android |
| Tier | node-headless (catalogue conformance) + device-lab (native tree) |
| Created | 2026-08-16 by qa-mobile-agent |
| Last updated | 2026-08-17 by qa-mobile-agent |

## Summary
One contract, one source prop, three attribute spellings. The mobile surface carries the **same 22 values** as the web `data-testid` catalogue on a single React Native `testID` prop, which surfaces as `accessibilityIdentifier` (iOS) and as the view's `resource-id` (Android). Nothing is invented and nothing is dropped — a renamed id breaks every downstream selector, and an invented one is a contract the design system never agreed to.

**Identity and announcement are two different attributes.** `contentDescription` (from `accessibilityLabel`) carries the *announcement* text TalkBack speaks — the message content TC-037 asserts — and never a catalogue id.

## Preconditions
- The two mockups are the source of truth: `design/assistant/screens/voice-assistant-view-ios.html` and `-android.html`.
- Every mockup state reachable in the app.

## Test steps
1. Parse the id catalogue from both mockups: `accessibilityIdentifier` (iOS), `resource-id` (Android), plus the retained `data-testid` both mockups keep for design-check.
2. Assert the iOS and Android catalogues are identical to each other and to the web catalogue.
3. Drive the app through every state and collect the ids present in the rendered accessibility tree.
4. Compute two sets: **missing** (in the catalogue, never rendered in any state) and **invented** (rendered, not in the catalogue).
5. Assert every id referenced by any F-003 mobile TC or by the automation exists in the catalogue.

## Expected behaviour
- The catalogue is exactly **22** ids and is identical across iOS, Android and web.
- `missing` is empty — every catalogue id is rendered in at least one state (allowing for exemplar-once: dynamic instances share the id).
- `invented` is empty — the app renders no accessibility id outside the catalogue.
- Step 5 is empty-set clean: no TC and no automation references a selector that is not in the catalogue.
- The identity value is carried on the platform-correct attribute on each platform: `identityAttribute('ios') === 'accessibilityIdentifier'`, `identityAttribute('android') === 'resource-id'`.
- **Zero** catalogue ids appear on `contentDescription` in the Android mockup. An id parked there would be spoken by TalkBack in place of the message, failing AC-12's own announcement requirement.

## Test data
| Field | Value |
|-------|-------|
| catalogue source | the two mockups (parsed at test time, never hand-copied) |
| expected count | 22 |
| iOS identity attribute | `accessibilityIdentifier` |
| Android identity attribute | `resource-id` |
| Android announcement attribute | `contentDescription` (message text, never an id) |

## Notes
Per L-002, the catalogue is derived by **parsing the mockups at test time** rather than hand-listing it in a fixture — a hand-copied list drifts silently and turns a contract check into a self-agreement check. Steps 1–2 and step 5 run headless today with no app; steps 3–4 need the rendered accessibility tree (component-level, device-lab or an RN test renderer). The headless half is what makes step 5 a real guard against invented selectors during authoring.

**2026-08-17 (T-021, `phase: execute`) — the Android attribute was corrected from `contentDescription` to `resource-id`, and why.** At authoring this TC asserted `identityAttribute('android') === 'contentDescription'`, which was the spec's and the mockup's wording at the time, and the assertion was left **red** rather than patched — QA does not weaken an assertion to match the implementation (`_qa-foundations` §8.5). Routing it found a real spec defect instead: AC-12's two halves were mutually unsatisfiable as written, because the same attribute cannot carry a machine identity and the human-readable announcement TalkBack speaks. The decisive argument was this TC's own sibling, TC-037 — an id on `contentDescription` makes the screen reader say "assistant-message-bubble" instead of the message.

architect-agent rewrote AC-12 to separate the two (identity on one `testID` prop → `accessibilityIdentifier` / `resource-id`; announcement on `accessibilityLabel` → `contentDescription`), design-agent moved all 22 ids in the Android mockup, and the orchestrator updated `.claude/tools/design-check/testid-contract.sh`. This TC now asserts the corrected contract **and** the negative half — that no catalogue id has leaked back onto `contentDescription` — so the conflation cannot quietly return.
