# Gate 1.5 — F-009 list actions — consolidated lens report

**Design under review:** the ten states T-225 drew into the three shell mockups.
**Date:** 2026-08-22 · **Round:** 1 of at most 2 (ORCHESTRATION § Gate 1.5 Step 4)
**Free check first:** `design-check` **175 passed, 0 failed, 4 skipped** — run with
`DESIGN_CHECK_BROWSER` set, without which the render tier silently skips and reports 13/0/1.

## Verdict

**0 HIGH from all three lenses. Nothing blocks implementation.** Three MEDIUM and three LOW,
of which the two MEDIUMs about selection are the same finding reached independently.

| Lens | Agent | HIGH | MED | LOW |
|---|---|---|---|---|
| dev | web-agent | 0 | 1 | 1 |
| tester | qa-web-agent | 0 | 1 | 1 |
| spec | spec-agent | 0 | 1 | 1 |

All three returned an explicit `checked:` list as well as findings, so none is a silent lens.
Coverage: all 14 briefed ACs have a drawn state (spec lens, AC-by-AC).

## M1 — completed tasks cannot be selected (dev F1 + spec F1, independently)

**Not a conflict — agreement.** Two lenses reached the same finding by different routes and
proposed compatible routings.

The design excludes done rows from selection by construction, in three converging places: the
done row's HTML carries no `select-cbx`; the JS at `app-shell.html:2639` targets
`.row:not(.done)`; and the done row also carries no `drag-handle`. Verified independently by the
orchestrator in the browser: 4 `.select-cbx` elements in `select-some`, none on the done row.

`AC-9` says selection checkboxes appear **"on each row"**, unqualified, and `components.md
§ SelectionMode` says **"every row"**. So spec and design disagree, and an implementer following
either one would be correct and would ship something different.

**Consequence, which is the part that matters:** bulk delete (AC-12) and bulk move (AC-13) cannot
reach completed tasks. Clearing out forty finished tasks becomes forty single deletions.

**Routing.** ORCHESTRATION § Gate 1.5 Step 3 is explicit that a design asserting a rule the spec
does not contain is *not* a design defect — the rule may be right, and deleting a good rule
because it was recorded in the wrong file is the worst available outcome. Both lenses agree the
rule is defensible: bulk-complete on a done task is a no-op, and including done rows would require
specifying what Complete means on an already-complete task, which neither artifact addresses.

**But whether a user can bulk-delete their completed tasks is a product decision, not a
recording one.** Escalated to the owner. The design stands either way pending that answer.

## M2 — the drag handle is the only new control without a testid (tester F1)

19 of the 20 new F-009 controls carry a `data-testid`; `.drag-handle` does not. Verified: 4 drag
handles in the DOM, 0 with a testid. AC-6 assertions would fall back to `getByLabel('Drag to
reorder')`, breaking the testid-first convention every other F-009 assertion follows.

**Routing:** revision note to design-agent — add `tasks-drag-handle` to the catalogue and the
element. Mechanical.

## L1–L3 (low)

- **Confirm dialog focuses Cancel** and AC-12 does not say so (spec). Record it, so the
  implementer does not guess. The choice itself is the conventional safe default.
- **AC-12's single-task bypass is not drawn** as a named state (tester). Testable anyway by
  negative assertion. Note it in the ConfirmDialog entry, or draw it.
- **`search-filtering` CSS hides done rows unconditionally** while AC-2 says completed tasks
  follow the hide-completed preference (dev). The dev lens judges this a demonstration shortcut
  in the mockup rather than a design error; `components.md § SearchField` should state the rule
  so there is one unambiguous source.

## Two process notes, both against this orchestrator rather than the design

1. **The lens briefings omitted design-agent's `visual_review:` block.** The dev lens said so
   directly: *"the disagreement list the protocol calls for cannot be produced without it."*
   The return carried that block and the briefing did not pass it on. Fix in the next Gate 1.5
   briefing rather than re-dispatching a round for it — no lens reported being blocked.
2. **The tester lens made one factual error that did not change its conclusion.** It wrote that
   `tasks-select-checkbox` appears "on every instance", giving it a collection to count.
   Measured: it appears **once**. Its Q1 answer rests on the per-row `aria-label`
   (`"Select: Buy milk"` and three others), which is genuinely present on all four, so the
   conclusion holds. Recorded because an unchecked supporting claim is how a wrong conclusion
   arrives next time.
