# TC-035: Send is reachable from the keyboard's own action and from `assistant-composer-send`; typed path otherwise unchanged

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-035 |
| Feature | F-003 (mobile-surface) |
| Platform | mobile |
| Acceptance criteria | AC-10, F-001 AC-17 |
| Type | happy |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | qa/assistant/automation/mobile/F-003-mobile-surface.spec.ts |
| Targets | ios, android |
| Tier | node-headless (both submit paths + state invariance) + device-lab (real keyboard return key) |
| Created | 2026-08-16 by qa-mobile-agent |
| Last updated | 2026-08-17 by qa-mobile-agent |

## Summary
Two ways to send, one path behind them. The keyboard's own action key and `assistant-composer-send` must produce the **identical** request, and neither may diverge from F-001 AC-17's typed path. This TC also carries the node-testable half of AC-10: keyboard show/hide events change no conversation state and neither send nor cancel a turn.

## Preconditions
- Account `qamob-tc035@qa.example.com`; `AppLifecycle` (or equivalent) able to emit keyboard show/hide; request spy capturing full bodies.

## Test steps
1. Type an utterance; submit via the keyboard action. Capture the request.
2. Reset; type the same utterance; tap `assistant-composer-send`. Capture the request.
3. Diff the two requests field by field, and diff the rendered outcomes.
4. Emit keyboard show, then hide, with text in the composer and no submit. Read state, composer, request spy.
5. Emit keyboard show/hide while thinking, while listening, and with a pending question.
6. Assert the send affordance's enabled state tracks composer content (empty → disabled).

## Expected behaviour
- Steps 1–3: the two requests are **identical** — same endpoint, same `transcript`, same `source: "typed"`, same field set. The keyboard action is not a different code path with a different source value.
- Both render the same outcome.
- Step 4: **zero** turns sent; composer text intact; conversation state unchanged.
- Step 5: no state transition and no turn sent or cancelled in any of the three states.
- Step 6: with an empty composer the send affordance is disabled (mockup: `aria-disabled="true"` on `assistant-composer-send` until the composer has content) and submitting is a no-op — no empty-transcript request reaches the wire (`400 VALIDATION` per `api-contracts.md`).

## Test data
| Field | Value |
|-------|-------|
| user | qamob-tc035@qa.example.com |
| utterance | one canonical create row, sent twice by the two paths |

## Notes
**Device-lab residue:** that the RN `returnKeyType`/`onSubmitEditing` wiring actually fires from the real keyboard on both platforms. The equality of the two submit paths is what this tier proves.
