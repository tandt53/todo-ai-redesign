# Project memory

Append-only. **The orchestrator is the sole writer** (`_memory-protocol.md`
§ Memory write protocol, `ORCHESTRATION.md` Step 5.8). Agents return
`memory_entry:` and the orchestrator records it here; agents never write.

Read by layers 2–4: the last ~10 entries every dispatch, plus tag-grep and
exact lookup.

**This file was empty until 2026-08-18** — not because the project had nothing
to remember, but because `ORCHESTRATION.md` had no step that recorded what agents
returned. See `docs/specs/_shared/LEARNINGS.md` for the durable half of that.

---

## [2026-08-18] Where knowledge actually lives in this project — orchestrator
**Type:** convention
**Feature:** cross-cutting
**Tags:** memory, learnings, adr, process
---
Four homes, and choosing wrong is how a fact gets lost or duplicated:
- `docs/specs/_shared/LEARNINGS.md` — durable lessons that cross roles. **Every agent
  skims it at startup**, so this is the strongest home and the default for
  anything another role could trip on.
- `docs/specs/_shared/adr/` — a decision about the system's shape, with its
  alternatives. architect-agent has twice declined to write a memory entry on the
  grounds that the ADR *is* the home, and was right both times.
- `docs/reports/owner-decision-*.md` — what the owner chose, what it beat, what it
  cost. Written so nobody re-argues a settled trade.
- `memory/` (here) — everything else, and `memory/{agent}.md` for knowledge only
  one role needs.

The test: **who needs to read this?** More than one role → LEARNINGS. One role,
procedural → the agent file. A choice with alternatives → ADR or owner decision.

## [2026-08-18] A new recovery affordance collides with the ACs that remove its subject — spec-agent (T-153)
**Type:** pattern
**Feature:** F-005
**Tags:** spec, composition, recovery-paths, L-015
---
Folding in an owner answer that **adds** a recovery affordance — a retry that
outlives its surface (F-005 AC-47) — collided with an existing AC that **deletes
the subject**: AC-4, the task gone underneath, which forbids retry. The notice
would have been either dead or a resurrection door. Separately, the second owner
answer of the same day turned out to be **unbuildable without the first**: the
subject swap could not close a detail the old AC-2 held open.

**Lesson.** When an answer introduces a new recovery affordance, grep the spec for
every AC that removes the thing being recovered and write the exclusion
explicitly. And when two answers land together, check whether one is a
**precondition** of the other, not only whether they conflict. L-015's pairwise
read finds both — but only if *compose* is read as "does A enable or forbid B",
not merely "do A and B disagree".


## 2026-08-22 | T-232 | colour-token migration
Type: pattern · Tags: tokens, theme, migration, visual-drift

When `tokens.json` retires a colour key, the compatibility shim that keeps the old
name alive so the codebase compiles will also **silently change what renders**, and
no test catches it — the shim's own comment (*"mapped to closest surviving accent"*)
disguises a design decision as a compatibility choice.

**Delete the shim and update every call site in the same task.** Where a call site's
colour changes, the comment must name the design rule that decided it, not the
mapping that produced it.

**Second lesson, from the same task's briefing rather than its code:** when the
design system answers a retired key *directly*, cite that answer. The T-232 briefing
sent the agent to check `diff.remove` against rules 1 and 3 — both of which pass —
when rule 6 already named the pair outright (`text.muted`, struck through). The agent
checked what it was pointed at and the wrong colour survived. **A briefing that names
the wrong rule is worse than one that names no rule**, because it converts an open
question into a closed one.
