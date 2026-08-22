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
