# TC-005: The affordance says something is *waiting*, not merely that something *arrived*

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-005 |
| Feature | F-001 (voice-assistant-view) |
| Platform | mobile |
| Target | iOS (model tier + real assistant server) |
| Acceptance criteria | AC-30 (e), AC-9, AC-13, AC-19 |
| Type | accessibility |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | tests/assistant/mobile/F-001-voice-assistant-view.spec.ts:424 and :798 |
| Created | 2026-08-17 by qa-mobile-agent |
| Last updated | 2026-08-17 by qa-mobile-agent |

## Summary
The most load-bearing clause of AC-30, and the one that carries the whole cost of the
owner's decision. Because the bulk-delete confirmation gets **no priority** (owner
decision 2026-08-17, rule 5), a user who has scrolled up can be asked *"Delete 3 tasks?"*
and never see it — the app then waits on an answer whose only indication is this pill.
So the pill must distinguish *a question is pending* from *messages arrived*, and it must
carry that distinction to a screen-reader user too.

## Preconditions
- `design/_shared/components.md § NewMessageAffordance` still publishes the NMA-HIDDEN /
  NMA-NEW / NMA-WAITING rows with their Label cells, the two accessible-name literals,
  and the dock's live-region politeness. Every one of those is **parsed** at run time and
  the parser throws on a miss (L-007, L-008) — none is retyped into the test.
- For the end-to-end half: the real in-process assistant server, only model
  interpretation stubbed (F-001 ## Test strategy).
- Test data namespace `qamob-ac30-` (foundations §10); one uuid user per test.

## Test steps (mobile)
1. With nothing pending, read the affordance's label at counts 1, 2, 3 and 17.
2. Put an unresolved question below the fold among ordinary messages and read the label.
3. Use a clarify head carrying typographic quotes and an em dash —
   `“Meeting” matches two tasks — which one?` — and read the label.
4. Mark the question `resolved` and read the label again.
5. Put the unresolved question **above** the fold (already seen) and read the row.
6. Read the accessible name for both rows.
7. Read the announcement produced for the NMA-NEW pill.
8. Announce NMA-NEW twice, then announce NMA-WAITING, and read back what the Announcer
   port captured.
9. **End to end:** seed three tasks, say "delete all qamob-ac30 tasks", and let the real
   server produce the bulk-delete confirmation. Read the pill's label against the
   server's own question head. Then answer "no" and read it again.

## Expected behaviour
- Step 1 → design's **two literals**, singular and plural, filled with the count. Design
  states outright these are "the whole set … not a template over a noun".
- Step 2 → row `NMA-WAITING`; label is design's `Waiting for your answer — {question}`
  with the question's own head; the label differs from the NMA-NEW label at the same
  count, and contains the head.
- Step 3 → the head is quoted **verbatim** — never re-worded, never truncated.
- Step 4 → falls back to `NMA-NEW`. A resolved question is no longer pending; design's
  precedence rule is one rule, not a special case.
- Step 5 → `NMA-NEW`. "Pending **and off screen**" — a model that scanned every message
  rather than the below-fold slice would say WAITING for a question sitting in view.
- Step 6 → design's two accessible-name literals, and in both cases the visible label is
  a **prefix** of the accessible name (WCAG 2.5.3 label-in-name).
- Step 7 → the announcement text is the accessible name, and it is **not** assertive
  (design publishes the dock as a `polite` live region). `null` in → `null` out.
- Step 8 → the repeat of an unchanged pill is **silent**; the NEW → WAITING transition
  **is** announced. RN has no live region, so the polite dock is realised on the Announcer
  port — a silent transition would spend the consistency the owner chose and return
  nothing, and a pill that re-announces on every arrival is worse than one that never does.
- Step 9 → the pill quotes the server's own head, and stops quoting it once answered.

## Test data
| Field | Value |
|-------|-------|
| Counts | 1, 2, 3, 17 |
| Confirm head | produced by the real server from three seeded tasks |
| Clarify head | `“Meeting” matches two tasks — which one?` |
| Seeded tasks | `qamob-ac30-e1`, `qamob-ac30-e2`, `qamob-ac30-e3` |
| Namespace | `qamob-ac30-`, one uuid user per test |

## Notes
- **What this TC cannot falsify.** That the label is *legible* — that the two-line clamp
  (`numberOfLines={2}`) keeps the question readable at 375 rather than ellipsising it
  away into "Waiting for your answer — Delete …", which announces that something is
  pending and withholds what. That is text shaping on a real device: TC-009.
- Mutation-checked: forcing the pending-question head to `null` (so the pill can only
  ever count) fails 6 cases; changing design's own NMA-WAITING wording in
  `components.md` fails 2 and was restored byte-identical (L-010); making the below-fold
  slice return every message fails step 5.
