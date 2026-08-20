# TC-001: "At the bottom" is a number, and it is sampled before the append

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-001 |
| Feature | F-001 (voice-assistant-view) |
| Platform | mobile |
| Target | iOS (model tier — no simulator; see Notes) |
| Acceptance criteria | AC-30 (a) |
| Type | boundary |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | tests/assistant/mobile/F-001-voice-assistant-view.spec.ts:265 |
| Created | 2026-08-17 by qa-mobile-agent |
| Last updated | 2026-08-17 by qa-mobile-agent |

## Summary
AC-30 (a) turns "at the bottom" into arithmetic —
`distance_from_bottom = content_height − (scroll_offset + viewport_height)`, at the
bottom iff `distance_from_bottom ≤ 48` — and it fixes **when** that number is read:
immediately *before* the message is appended. Both halves are load-bearing and both
are silently satisfiable by a wrong implementation, so both get assertions here.

## Preconditions
- No simulator, emulator or Metro required. The follow model is exercised in-process
  (`npx vitest run tests/assistant/mobile`).
- `docs/specs/assistant/F-001-voice-assistant-view.md` still publishes AC-30 (a)'s
  threshold as `` `distance_from_bottom ≤ N` `` — the test **parses** it and throws
  if it does not (L-007). The number is never retyped into the test (L-004).

## Test steps (mobile)
1. Parse the threshold `N` from AC-30 (a) in the feature spec.
2. Append one message with a pre-append `distance_from_bottom` of exactly `N`.
3. Append one message with a pre-append `distance_from_bottom` of `N + 1`.
4. Repeat steps 2–3 with three different viewport/content pairs (320/900, 500/4000,
   844/20000) that all present the same distance.
5. Append one message with `distance_from_bottom` of `−40` (overscroll past the end).
6. Take a surface sitting at distance 0, and compute the verdict twice for one
   append: once from the metrics **before** the append and once from metrics whose
   `content_height` has grown by one message row (176 units, BUG-004's own figure).
7. Append a session's history against `UNMEASURED` — the first render, where nothing
   has been laid out yet.

## Expected behaviour
- Step 2 → at the bottom (`follow: true`). Step 3 → not at the bottom (`follow: false`).
  The slack is deliberate; an exact-zero rule would flip the surface between following
  and not-following during ordinary momentum scrolling.
- Step 4 → the same verdicts for all three pairs. A rule comparing `scroll_offset` to a
  constant, or to a fraction of the content, agrees for one viewport and disagrees for
  the others.
- Step 5 → still at the bottom. Overscroll is not an escape from (b).
- Step 6 → the two samples **disagree**: before → `follow: true`, after → `follow: false`.
  This is the trap AC-30 (a) names outright — a post-append sample reports every user as
  not-at-bottom, and clause (b) would never fire. If the two ever agree, the threshold
  has been widened until it absorbs a message row.
- Step 7 → at the bottom, nothing unseen, no affordance. AC-30 (b): "First render of a
  session's history also starts at the bottom."

## Test data
| Field | Value |
|-------|-------|
| Threshold | parsed from `docs/specs/assistant/F-001-voice-assistant-view.md` AC-30 (a) |
| Message row height | 176 logical units — test data, not a product fact; taken from BUG-004's own measurement |
| Viewport/content pairs | (320, 900), (500, 4000), (844, 20000) |

## Notes
- **What this TC cannot falsify.** The model receives the metrics as an argument, so it
  cannot be wrong about *when* the caller sampled them. Step 6 proves the two sample
  times give opposite answers and pins which one the AC mandates; proving the RN
  component samples before its own append needs real layout and belongs to the device
  tier (see TC-009).
- Mutation-checked: `BOTTOM_SLACK 48 → 0` fails 7 cases; `48 → 400` fails 12; moving the
  spec's own threshold to 64 fails 7 (and was restored byte-identical, L-010).
