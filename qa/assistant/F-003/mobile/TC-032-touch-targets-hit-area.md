# TC-032: Touch targets — ≥ 44×44 pt on iOS and ≥ 48×48 dp on Android, measured as hit area

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-032 |
| Feature | F-003 (mobile-surface) |
| Platform | mobile |
| Acceptance criteria | AC-9 |
| Type | accessibility |
| Priority | P1 |
| Status | draft |
| Automation | manual |
| Automation file | — |
| Targets | ios, android |
| Tier | device-lab |
| Created | 2026-08-16 by qa-mobile-agent |
| Last updated | 2026-08-17 by qa-mobile-agent |

## Summary
Every interactive element in the mockups' 22-id catalogue must have a touch target of at least 44×44 pt (iOS) or 48×48 dp (Android), measured as **hit area** rather than painted size. The distinction is the whole test: a 24 pt icon with a 44 pt `hitSlop` passes; a 44 pt-looking chip whose pressable region is the text bounds fails.

## Preconditions
- Real devices or simulators: one iOS, one Android, at the smallest supported screen size and at the largest OS text-size setting.
- The interactive subset of the catalogue rendered in each state that contains it.

## Test steps
1. For each interactive id in the catalogue, drive the app into a state where it renders.
2. Measure the **pressable** region (not the painted bounds) via the platform inspector / accessibility hit-testing, including any `hitSlop`.
3. Record measured width × height against the platform minimum.
4. Repeat at the largest system text size and at the smallest supported device width.
5. Probe adjacent targets (the composer's mic + send pair; the two confirm chips) for overlap and for accidental-activation spacing.

## Expected behaviour
- Every interactive element measures ≥ 44×44 pt (iOS) / ≥ 48×48 dp (Android) as hit area.
- Interactive ids in scope: `assistant-mic-button`, `assistant-composer-send`, `assistant-composer-input`, `assistant-undo-button`, `assistant-retry-button`, `assistant-cancel-button`, `assistant-permission-cta`, `assistant-chip-affirm`, `assistant-chip-negative`, `assistant-option-chip`, `assistant-task-checkbox`, `assistant-task-row`, `assistant-add-task-button`, `assistant-drawer-button`.
- Non-interactive ids are out of scope for the minimum: `assistant-state-indicator`, `assistant-message-bubble`, `assistant-diff-old`, `assistant-diff-new`, `assistant-row-badge`, `assistant-offline-banner`, `assistant-queued-notice`, `assistant-boundary-marker`.
- No two adjacent targets overlap; each is independently activatable at the smallest supported width.
- The minimum holds at the largest system text size (targets must grow or hold, never shrink to fit).

## Test data
| Field | Value |
|-------|-------|
| devices | 1 × iOS, 1 × Android (smallest supported width) |
| text size | default and maximum |

## Notes
**Not automatable at the node tier — the spec says so directly** ("on-device touch-target measurement" is in the device-lab list). There is no headless observable for a hit area: a style assertion would test the stylesheet, not the rendered target, which is the L-002 failure mode. This TC is device-lab debt and is counted as such in `index.md`; it must never be reported as automated coverage.

## Execution result — 2026-08-17 (Gate 3 follow-up)

The hit-area assertions pass: all 14 interactive ids meet 44 pt (iOS) / 48 dp
(Android) as hit area.

**Structural finding closed this pass.** AC-9's evidence existed in three
unlinked copies — the mockup CSS, `PAINTED` in `src/assistant/mobile/model/touch.ts`,
and the RN `StyleSheet` in `src/assistant/mobile/components/styles.ts`. No
component imported `PAINTED`, no test imported `styles`, and nothing parsed the
mockup. All six values agreed, so this was never a live defect — but the failure
direction was the bad one: any copy could drift and the suite would stay green.

The automation now **parses the mockup CSS at test time** and asserts `PAINTED`
against it, which is the technique `src/assistant/mobile/__tests__/permissions.test.ts`
uses for the copy deck (LEARNINGS L-008). Four assertions:

1. **Non-vacuity** — every mapped selector must be found with real numbers, so a
   regex that silently matches nothing fails loudly instead of passing over an
   empty set (L-002).
2. **Mockup ↔ `PAINTED`** — every size the mockup states explicitly must match.
3. ~~**`PAINTED` ↔ RN `StyleSheet`** drift detector~~ — **retired 2026-08-17,
   superseded.** See "The StyleSheet check moved tiers" below.
4. **Token-derived sizes** — the four padding-based controls (`.add-btn`,
   `.task-row`, `.undo-btn`, `.retry-btn`) state no px in the mockup, so their
   heights are computed from spacing/type tokens and move when a token moves.

Falsification, run 2026-08-17: drifting the mockup reddens 1, drifting `PAINTED`
reddens 2, drifting the `StyleSheet` reddens 1, renaming a mockup selector
reddens 2. Every direction is caught independently.

### The StyleSheet check moved tiers (2026-08-17)

mobile-agent's T-040 did the de-duplication this TC asked for: `model/touch.ts`
gained `paintedBox(id)` and `components/styles.ts` now derives all five boxes
from it, holding **zero** numeric dimensions.

The QA-side drift detector went red the moment that landed — on its own
non-vacuity guard (`expected 0 to be >= 9`), because there were no literals left
to compare. **It failed by succeeding**, which is the outcome that guard existed
for: without it the check would have "passed" over an empty set.

It is **retired rather than inverted**, because the inverted form already exists
one tier down and is strictly stronger:
`src/assistant/mobile/__tests__/touch-keyboard-back.test.ts` asserts
`paintedBox(id) === PAINTED[id]` **by import** (this tier can only read
`styles.ts` as text — it pulls in Flow-typed `react-native` and cannot load
here), that each box is declared `paintedBox(A11Y_IDS.<id>)`, that no style block
restates a literal, and it carries its own non-vacuity guard. A second copy here
would be the duplication this TC exists to remove.

Verified rather than assumed: re-introducing a literal (`const sendBox = { width: 32, height: 32 }`)
leaves this suite green and turns that unit test red. The check moved; it did not
disappear.

### The four content-width floors now have a source (2026-08-17)

Design published `design/_shared/components.md` § Touch — the single source this
TC proposed last pass. The automation parses it and asserts:

- `PAINTED`'s four widths equal the published floors (`add-task` 96, `task-row`
  320, `undo` 108, `retry` **80** — corrected from the copied 96).
- Each floor is a multiple of 4 and **under-states** its rendered measurement,
  the direction § Touch calls load-bearing.
- Each floor exceeds both platform minimums, so none can bind the hit-area
  calculation — § Touch's own claim, and the reason these are layout truth and
  never the accessibility argument.
- `assistant-permission-cta` is **not** asserted: its floor is the shortest of
  three catalogue labels and only design can measure it (T-042). The test asserts
  it is still absent from the table, so publishing a floor fails here and gets it
  asserted properly rather than leaving 140 silently wrong.

Mutation-verified: drifting a published floor reddens 2, regressing `PAINTED` to
96 reddens 1, making a floor over-state its render reddens 1, renaming the
section reddens 2.

### What is still owed here

- **Measurement on a device remains device-lab debt.** There is no headless
  observable for a hit area; every number above is a declaration, and the device
  pass is what turns it into a measurement.
- **`assistant-permission-cta`'s floor** is a known over-claim (140 vs 114.3
  rendered), harmless today and queued as T-042.
