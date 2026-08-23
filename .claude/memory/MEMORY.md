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

## 2026-08-23 — A prohibition written without its exception will be obeyed exactly

`tokens.json motion.rule` said *"NO spring, NO bounce, NO breathing loop."* An agent
cleaning the palette read it correctly and deleted the token behind it. That token also
carried the assistant's **thinking dots**, the speaking waveform and the mic orb, so the
only signal that the machine is working went static — and `design-check` reported
**202 passed, 0 failed** over it.

Nobody was wrong. The rule was right (v1's decorative aurora loop deserved retirement),
the deletion was right, and the consequence was a product defect.

The durable half: **a rule stated as an absolute gets applied as an absolute.** If it has
an exception, the exception belongs *inside the rule text*, not in the judgement of
whoever reads it next. The rewritten rule now opens by distinguishing a decorative loop
from a status-indicator loop and says, in the rule itself, that *an agent that reads "no
loops" without that distinction will correctly remove the only sign the machine is
working.* That sentence is the fix, not the new token.

## 2026-08-23 — A briefing that repeats a claim about a MECHANISM sends an agent to fix nothing

Twice in one day, an agent was dispatched against a defect described in terms of a cause
the orchestrator had not verified:

- the search state "does not narrow **because** `.app[data-search="filtering"] .row.done
  {display:none}` hides the done row" — that CSS rule exists in **no file in the repo**.
  The claim came from a Gate 1.5 lens and was repeated without checking.
- a `.tag` sweep briefed for files where `.tag` has never appeared.

Both agents checked and reported "nothing to fix" rather than inventing one, which is the
behaviour that saved it. But a full dispatch was spent each time, and the second one
nearly convinced the orchestrator the finding had been wrong.

The distinction that matters: **the symptom was measured, the mechanism was inferred.**
The search state genuinely was wrong when it was found (`git log -S` puts the fix four
hours later, inside an unrelated commit). Brief the measurement — *"query 'bill', 4 rows
visible, 1 contains 'bill'"* — and let the agent find the cause. A briefing that names the
cause narrows the search to the orchestrator's guess.

## The design is the source of truth and the code follows it

**Owner instruction, 2026-08-23**, given after a day spent closing the gap between the two.

**Two things follow, and the second is what actually failed.**

**When the build and the mockup disagree, the mockup wins by default.** Not the orchestrator's
impression. This was tested the same day: a briefing asked for `No tasks yet` to be *smaller* than
the bar title on the grounds that a secondary heading should not out-rank a primary one. The mockup
sets the bar title at 17px and the empty heading at 28 — deliberately larger, because the bar title
is persistent chrome and the empty heading is the screen's content. **An opinion had been written
into a briefing in the grammar of a defect, and an agent implemented it.**

**A design change is not finished until an implementation task exists naming what it drew.** Over
two days the pipeline ran phase 3 roughly a dozen times and phase 4 not once, because every piece of
owner feedback was about how something looked and so went back to design-agent. The signal was there
and was misread: `app.test.tsx`'s `NOT_BUILT` map grew to 35 drawn-and-unbuilt ids and read as good
hygiene rather than as a queue.

**The structural reason it stays invisible: the mockups are HTML and the app is React and React
Native, with nothing connecting them.** A mockup edit can never touch the build, so *design
approved* never implies *app changed* — only a dispatch does. See [[T-290]].
