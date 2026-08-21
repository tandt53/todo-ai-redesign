# BRIEFING — T-204

- **Task ID:** T-204 · **Agent:** design-agent · **phase:** `screens` · **Date:** 2026-08-21
- **Description:** Redraw the core to v2 — shell, Talk, Tasks, and the task detail nobody drew

## The system is signed off. Draw against it.

You wrote it yesterday's dispatch: `DESIGN.md`, `tokens.json`, `specimen.html`. The owner
opened the specimen, was asked your three `review_guide` questions, and said **"Ok tiếp đi"**.

**Recorded honestly, because it changes how much rope you have:** that is permission to draw.
**They did not answer any of the three questions individually**, so you have no per-question
verdict on the time rail, on the light ground, or on the platform fidelity. **Draw what the
system says. Do not re-open the direction, and do not treat the silence on a question as
licence to change that part.**

## Tranche 1 of 3. This is the bounded piece.

Six surfaces × five features × three platforms in one dispatch is a dispatch nobody can
review. **You take the surfaces that exist in code today:**

| | |
|---|---|
| **App shell** | web · iOS · Android — redraw, currently v1 |
| **Talk** (voice-assistant-view) | web · iOS · Android — redraw, currently v1 |
| **Tasks** | inside the shell — redraw at every tier, including the new `wide` |
| **Task detail** | **never drawn on any platform.** Draw it. |

Lists menu, Settings and New list are **tranche 2**. The trash is **tranche 3** and waits on
its contracts. Do not draw them.

## Two things this dispatch is measured against

1. **`design-check` currently exits 1 with 510 failures** — all of them token drift on the six
   v1 mockups. **Redrawing them is what clears it.** Run the check when you finish; if it is
   not green, say exactly what is left and why.
2. **The task detail is the worst-looking screen shipping today**: every field renders 197px
   in a 1020px pane and the Name field clips the task's own title. Your own specimen plate 06
   defines field, label and form row and states the rule — *a field has no intrinsic width* —
   and includes the failing case as a counter-example. **Draw the screen that rule produces.**

## Also yours: the `components.md` sections v2 invalidates

Your return listed **19**, plus three superseded and two owed. **In this dispatch rewrite only
those the four surfaces above touch** — and say in your return which of the 19 you left for
tranche 2, so the list stays checkable.

**The two owed sections — Field/Label/FormRow and TimeRail — are yours here**, because the
task detail cannot be drawn without the first and the Tasks list cannot without the second.

**Testids do not change.** 52 published, 1,362 binding sites in code and tests. Draw new
shapes onto existing names.

## What the audit found, so you do not reintroduce it

- **The conversation is top-anchored** — 618px between the last bubble and the composer at
  1440. **The v1 mockup got this right and carried a paragraph defending it;** the app dropped
  it. Draw it right and keep the paragraph.
- **`!`/`!!`/`!!!` on three of four priority levels, hard against the title.** The system says
  one `!`, high only, at least `space.2` clear.
- **A title is never truncated to protect a column.**

## Read these

1. `docs/design/_shared/specimen.html` — **your own system, rendered.** The screens are held
   to it.
2. `docs/design/_shared/DESIGN.md`, `tokens.json`.
3. `docs/reports/design-audit-2026-08-21.md` — the seven findings and their measurements.
4. `docs/design/assistant/screens/*.html` — what you are replacing.
5. **The running app**, `http://localhost:5173/?qaUser=design-audit-1787320423` — five seeded tasks. Look at what
   ships before you draw its replacement.

## Write to

`docs/design/assistant/screens/` and `docs/design/_shared/components.md`.

**Every mockup is self-contained and opens by double-click**, as the existing ones are.

## And one file the owner opens

**Gather the drawn screens into one HTML page** the owner can open and move around in —
same as the specimen, same reason. `docs/design/assistant/screens/index.html`. Platform and
width switchable inside the page. **Not a directory of files to hunt through.**

## Success criteria

- Shell, Talk, Tasks and Task detail drawn for web, iOS and Android, against v2.
- **`design-check` green**, or every remaining failure named with its reason.
- Field/Label/FormRow and TimeRail written into `components.md`.
- **No testid invented, none renamed.**
- `index.html` opens by double-click, no server, no network.
- Your return names which invalidated sections you left for tranche 2.
