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
