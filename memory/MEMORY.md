# Project memory

Append-only. **The orchestrator is the sole writer** (`_memory-protocol.md`
§ Memory write protocol, `ORCHESTRATION.md` Step 5.8). Agents return
`memory_entry:` and the orchestrator records it here; agents never write.

Read by layers 2–4: the last ~10 entries every dispatch, plus tag-grep and
exact lookup.

**This file was empty until 2026-08-18** — not because the project had nothing
to remember, but because `ORCHESTRATION.md` had no step that recorded what agents
returned. See `specs/_shared/LEARNINGS.md` for the durable half of that.

---

## [2026-08-18] Where knowledge actually lives in this project — orchestrator
**Type:** convention
**Feature:** cross-cutting
**Tags:** memory, learnings, adr, process
---
Four homes, and choosing wrong is how a fact gets lost or duplicated:
- `specs/_shared/LEARNINGS.md` — durable lessons that cross roles. **Every agent
  skims it at startup**, so this is the strongest home and the default for
  anything another role could trip on.
- `specs/_shared/adr/` — a decision about the system's shape, with its
  alternatives. architect-agent has twice declined to write a memory entry on the
  grounds that the ADR *is* the home, and was right both times.
- `reports/owner-decision-*.md` — what the owner chose, what it beat, what it
  cost. Written so nobody re-argues a settled trade.
- `memory/` (here) — everything else, and `memory/{agent}.md` for knowledge only
  one role needs.

The test: **who needs to read this?** More than one role → LEARNINGS. One role,
procedural → the agent file. A choice with alternatives → ADR or owner decision.
