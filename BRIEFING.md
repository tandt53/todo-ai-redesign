# BRIEFING — T-193

- **Task ID:** T-193 · **Agent:** design-agent · **Date:** 2026-08-21
- **Description:** Design audit — the elements are arranged badly, and only one feature is drawn

## What the owner said

> *"check lại design cẩn thận, các elements sắp xếp khá lộn xộn"*

**They have been looking at the running app.** So must you.

## Do NOT answer this by re-reading `components.md` and declaring it consistent

**Every design-level correction in this project's history came from the owner seeing a
render, and no agent raised any of them.** Your own agent file says it: *the human is the
only real taste gate in this pipeline.* An audit that reviews the catalogue against itself
will find it self-consistent — **it is self-consistent, and the app still looks wrong.**

**The app is running right now.** Drive it.

```
web    http://localhost:5173/?qaUser=design-audit-1787320423     (5 tasks seeded, Vietnamese titles)
api    http://localhost:4460
tool   playwright-cli -s=<yoursession> open <url> | resize <w> <h> | screenshot | eval "<js>"
       screenshots land in .playwright-cli/page-*.png — copy them where you want them
```

**Starting screenshots already taken, for you to build on rather than repeat:**
`output/design-audit/` — 1440, 1024, 1920, 390 wide, plus three more. **They are a starting
point, not the audit.** Get to the states that have content in them; the ones I captured
mostly do not.

## What I can already see in them, so you do not spend the audit finding it

At **1440×1000**, the Tasks column is ~70% of the width and **its content occupies the top
~12% of it.** The rest is empty. In the Talk column the headline floats at ~42% vertical
while the composer is pinned to the bottom — **~340px of nothing between them.**

**That is one observation at one width in one state.** Your job is the other widths, the
other states, and whether there is a pattern behind it.

## The second half, and it is measured

**Five features exist. `docs/design/assistant/screens/` holds screens for ONE.**

app-shell and voice-assistant-view (× web/iOS/Android) — all of them the first feature.
**Talk-back, the mobile surface, task detail and the trash have no drawn screen at any
width.** Meanwhile `components.md` is **2,371 lines across 31 sections** carrying the whole
vocabulary.

**So the system is large and its application is one feature old, and the running app is four
features past the last thing anyone drew.** That is the likeliest reason things look
arranged badly — but **check it rather than assume it.** If the arrangement is bad for a
different reason, say so.

## Read these

1. **The running app** — first, and for real.
2. `docs/design/_shared/DESIGN.md` and `information-architecture.md` — what the layout was
   supposed to be. **§ breakpoints and § the split.**
3. `docs/design/_shared/components.md` — but **only to check a specific thing you saw**, not
   as the source of findings.
4. `bash .claude/tools/design-check/run-design-check.sh` — free, mechanical. Run it first so
   you do not spend findings on what it reports.

## Return a report, not edits

**Write nothing but the report.** Do not touch `components.md`, `tokens.json` or any screen —
fixes are separate tasks the owner schedules.

**Structure it as:**
- **Layout findings**, ranked by how bad they look, each with the width and state it appears
  at and a screenshot path.
- **Whether the cause is the coverage gap** or something in the system itself. One sentence.
- **Which screens are owed, in what order**, and which existing task already covers each.
  *(Task screens are already queued as T-165; the notice-region change as T-179. Do not
  duplicate them — say where they sit in your order.)*
- **What is fine.** If the arrangement is defensible at some widths, say which and why.

## Write to

`/Users/tandt/projects/todo-ai-redesign/docs/reports/design-audit-2026-08-21.md`

Put any new screenshots under `output/design-audit/` and reference them by path.

## Success criteria

- **You drove the app and looked.** The report cites widths, states and screenshot paths.
- Findings are ranked by **how bad it looks**, not by document order.
- The coverage question is answered with a yes or a no, not deferred.
- **At least one thing is named as fine**, with why. An audit that finds everything broken is
  as useless as one that finds nothing.
