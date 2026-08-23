# Visual audit — 2026-08-22

Requested by the owner after they found four defects in one afternoon that three Gate 1.5 lenses,
design-agent and the orchestrator had all passed: an overflow menu 68px from its trigger, a
checkbox flush against its ground, `Complete` beside `Done` in one toolbar, and two adjacent
selected rows fusing into one blob.

**Scope:** 12 mockups, 307 states, web at 1440 unless stated.

## What the machine found

A geometric probe was run over every state of every mockup, looking for the class of defect that
had actually slipped through — **relationships between elements**, not elements themselves.

| Check | Result |
|---|---|
| adjacent painted grounds touching (the fused-blob class) | **0 hits across 307 states** |
| same-role siblings misaligned horizontally | 10 hits, **all false positives** |
| content clipped by an `overflow:hidden` ancestor | 28 hits, **all false positives** |
| stacked blocks whose edges almost align (1–8px) | 120 hits, 47 distinct, **almost all deliberate symmetric insets** |

**The zero is the useful number.** T-251's ground-inset fix holds everywhere, and no other list in
the product has the same defect. That is worth more than it looks: it was the one finding a
machine could confirm.

**Everything else the probe reported was noise**, and two of the categories were noise because the
probe was wrong rather than because the design was right:

- `row-due` was flagged as a jogging column. It is right-aligned text; the probe compared **left**
  edges, which differ because `"Thu 5:00 PM"` and `"Mon 10:00 AM"` are different lengths. Right
  edges all sit at 858. **Probe defect, not a design defect.**
- `.row` was flagged as clipping 80px. That 80px is the swipe-to-delete reveal, positioned off-row
  on purpose below the container breakpoint.
- The 8px edge offsets are **symmetric** (`dl=8, dr=8`) — a nested row inset by `space.2` inside a
  section, which is the intended pattern.

**Conclusion about the method: a geometric probe cannot find what the owner found.** A menu 68px
from its trigger is geometrically valid. `Complete` beside `Done` is semantic. The probe's value is
narrowing where to look, and confirming a fix held — not judging.

## What looking found

Method that worked: render, form a suspicion by eye, then measure that suspicion. Both survivors
below were found that way. One candidate was discarded the same way.

### F1 — two columns of right-hand controls, 11px apart (`task-detail.html`)

The property rows end in a chevron; the step rows below them end in a trash icon. They sit in two
stacked lists on the same column and their control columns **do not line up**:

| | right edge |
|---|---|
| `.prop-chev` (Priority, Deadline, Reminder, Repeat) | **726** |
| step trash icon (Ring at 9…, Check the insurance…, Ask what…) | **715** |

11px is not a spacing token, so this is drift rather than a decision. Two vertical runs of icons
almost aligned is the shape that reads as sloppy without a viewer being able to name why.

### F2 — the Lists drawer has two count columns, 52px apart (`lists.html`)

| row | count right edge |
|---|---|
| Today, Done, Inbox | **810** |
| Home (a personal list) | **758** |

The personal lists carry a persistent `⋯` in the trailing slot and the collections do not, so the
numbers land in two columns 52px apart. **This one is a judgement call, not a defect**: the
trailing-action-pushes-the-count pattern is conventional. But the counts are the thing a user
scans, and scanning them currently needs two eye positions. Reserving the trailing slot on the
collection rows too would make one column, at the cost of empty space.

### Discarded after measuring — recorded so it is not "found" again

The property card looked inset from the content column, suggesting a ragged page edge. Measured:
`.prop` runs 102–734 against a content column of 98–738. **But `.prop` is the row button, not the
card, and its `padding: var(--s2)` is 8px by design.** Wrong element measured; no finding.

## Not covered by this pass

iOS and Android variants beyond the automated sweep; `voice-assistant-view.html`; every non-default
state of `task-detail.html` and `lists.html`; dark theme; breakpoints other than 1440.

---

# Second pass — dark theme, and the states nobody looked at

## Dark theme had never been checked by anything

`grep -i "dark\|theme" .claude/tools/design-check/check-design.mjs` returns **nothing**. The
render tier verifies contrast, overflow, states and testids **in the light theme only**. Half the
product had never been checked mechanically.

**Result of running it: clean.** Every text pair in every one of the 307 states meets the declared
4.5:1 in dark. The 24 hits the sweep reported were all `.dev button.on` — the mockup's own
state-switcher toolbar, not product UI.

**Worth wiring into `design-check` so it stays true** (see T-252, which is already open for a
different blind spot in the same tool).

## F3 — the search mid-query state does not narrow by title (`app-shell.html`)

**This is the significant finding of the pass**, and it is on the state this feature is built
around.

State `search-filtering` carries the query **`bill`** and shows **four rows, of which one contains
"bill"**:

| row | matches "bill"? |
|---|---|
| Send the weekly report to Hanh | no |
| Gọi nha sĩ đặt lịch khám răng | no |
| Pay the electricity bill | **yes** |
| Buy milk | no |

Against `tasks-default` (five rows) **the only change is that the done row disappeared** — which is
`AC-7` hide-completed, a different feature. The dev lens had already flagged the responsible CSS,
`.app[data-search="filtering"] .row.done{display:none}`, as contradicting `AC-2`; what nobody
noticed is that it is the *only* thing the state does.

`AC-2` is **live filtering by title**. `search-no-results` is correct by contrast — query
`meeting`, zero rows.

**Three lenses passed this, and my own briefing to T-225 called it *"the state the product lives or
dies on"*.** The spec lens recorded *"AC-2: search-filtering state shows live narrowing with query
'bill'. Covered."* It verified the state exists, not what it contains.

**The tester lens proposed the assertion that would have missed it.** Asked whether narrowing was
assertable, it answered yes — by counting visible rows. The count does fall, five to four. **A
row-count assertion goes green on this state while three of the four remaining rows do not match
the query.** The check would have confirmed the defect rather than caught it.

Filed as T-258, including the instruction to tell qa-web-agent that the test must assert every
visible row contains the query, not that the count fell.
