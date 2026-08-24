# Orchestrator defects — a session's worth, grouped by cause

**Written 2026-08-23 at the owner's request, for them to review and act on later.**
Scope: mistakes made by the orchestrator (the main session) during 2026-08-22 and
2026-08-23. Sub-agent defects are not in here — those are in each task's `Outcome`
cell. This file is about the dispatcher.

Every entry names its evidence. Where a fix is mechanical, it is proposed; where it
is a discipline, it says so, because "be more careful" is not a remedy and this
project has recorded that lesson three times already (L-014).

**The headline number:** of the defects below, **five were caught by an agent**,
**four by a validator or a check**, and **six by the orchestrator re-measuring its
own claim.** None were caught by reading more carefully.

---

## A · Briefings built on claims nobody verified

**The largest cluster, and the most expensive: a briefing that names a cause sends
an agent to fix the orchestrator's guess.**

| # | What was briefed | What was true | Caught by |
|---|---|---|---|
| A1 | T-232 pointed design-agent at colour rules 1 and 3 for `diff.remove` | Rule **6** answers it outright (`text.muted`, struck through). The agent checked what it was pointed at; `chipOld` stayed red and needed T-241 to close | Later re-audit |
| A2 | The lists agent was told to fix `.tag` in the lists mockups | `.tag` has never appeared in those files. There was no defect to fix | The agent, which reported "nothing to fix" rather than inventing one |
| A3 | T-258 said search fails *because* `.app[data-search="filtering"] .row.done{display:none}` hides the done row | **That CSS rule exists in no file in the repo.** The claim came from a Gate 1.5 lens and was repeated without checking. Worse, the defect itself had been fixed four hours earlier inside an unrelated commit (`bf37734`, verified with `git log -S`) | The agent, which measured and said so |
| A4 | T-200 told design-agent to edit `docs/specs/assistant/information-architecture.md` | The file is `docs/design/_shared/information-architecture.md`. And the defect had already been fixed by T-204/T-227 | The agent, which reported the path does not exist |
| A5 | T-181 was dispatched to architect-agent because the queue row said *"architect decides"* | `F-006-recently-deleted.md:764` says the opposite in its own words: *"OQ2 is open and is the owner's, not architecture's: it changes a promise the user sees."* The queue row and the spec disagreed and the spec was right | The agent, which raised it as NEEDS-OWNER instead of closing it |
| A6 | T-309 listed `GET /__qa__/raw-tasks` as in-scope **and** said "do not write to `tests/`" | The `__qa__` doors live in `tests/harness/qa-doors.ts`. The two instructions could not both be satisfied | The orchestrator, on seeing the agent's write land in `tests/` |

**What it cost.** A1 cost a full dispatch and a follow-up task. A2 and A4 cost a
dispatch each to establish that nothing was wrong. A3 cost a dispatch and nearly
convinced the orchestrator its own finding had been wrong. A5 would have closed an
owner's decision without the owner.

**The distinction that matters:** in A3 the *symptom was measured* (query "bill",
4 rows visible, 1 matching) and the *mechanism was inferred*. The symptom was
real. Briefing the mechanism narrowed the agent's search to a guess.

**Proposed fixes**

1. **Brief the measurement, not the cause.** *"Query 'bill', 4 rows visible, 1
   contains 'bill'"* — and let the agent find why. This is already written into
   `.claude/memory/MEMORY.md`; it is not yet a check.
2. **Mechanical, and cheap:** before dispatch, verify every path a briefing names
   exists on disk, and every line-number citation still points at what it claims.
   A5 and A4 die immediately. This could be a pre-dispatch script over the briefing
   text — extract backticked paths, `test -e` each one.
3. **A briefing that quotes a lens must say so and mark it unverified**, so the
   agent knows which half to trust. A3's rule came from a lens and was repeated as
   fact.
4. **Read the spec section a task row refers to before dispatching on that row.**
   A5's contradiction was one `grep` away.

---

## B · Measuring the wrong thing, then reporting it confidently

**Nothing errored in any of these. Every one produced a plausible number.**

| # | The measurement | Why it was wrong | Caught by |
|---|---|---|---|
| B1 | Time-format divergence re-probe used `querySelector('.row-due,.row-time')` | `.row-time` is `display:none` and holds the full-format string — a hidden element was measured, and a **correct finding was retracted** on the strength of it. Re-confirmed at three widths afterwards | Re-measuring |
| B2 | Six mechanical sweeps written to find visual defects | Each predicate was written from a guess about the markup: left edges of right-aligned text; rows inside a `.group` holding only its `<h3>`; class names (`dialog\|sheet\|picker`) the codebase does not use (it uses `pick`, `over`); deliberate off-canvas content read as clipping | All six returned nothing; the one true positive they did produce (an 80px `.row` clip) was **dismissed** and turned out to be the iOS title clip |
| B3 | `leaves = [t for t,l in allrows.items() if ... t not in dep]` compared `cell(l,2)` against a set of task ids | `line.split('\|')` puts **ID at [1]** and Title at [2]; a regex match after `\| T-xxx \|` puts Title at [0]. Both offsets were used within ten minutes. Comparing Title against ids made **all 88 rows look like leaves**, and the script printed `leaves: 88` with complete confidence | The validator, after 30 rows had already been moved |
| B4 | "Reserving 52px of scroller padding will stop the pinned bar occluding rows" | Measured: still 2 rows covered. Padding only adds room at the very end, where a sticky bar has already released — so it is **unnecessary**, which is the opposite of the claim | A harness built to check it |
| B5 | "A wrong containing block will float the bar down and leave a gap on a short list" | Not reproduced with `min-height: 100%`. The real risk is different: content placed *after* the wrapper, which makes the bar scroll away (measured: 401px) | The same harness |
| B6 | FAB-overlap verification measured *any* text overlapped by the FAB | The question is what the FAB covers **that the bar does not**. The FAB now sits in the bar's exact vertical band, so its additional coverage is zero. The orchestrator's metric made a correctly fixed defect look unfixed | Measuring the bands directly |

**Proposed fixes**

1. **Assert visibility before measuring.** B1 and half of B2 die if every probe
   filters on `getComputedStyle(el).display !== 'none'` and a non-zero box. Make
   that a shared helper rather than something re-typed per probe.
2. **Use `.claude/lib/tasks.sh` / `tasks.cjs` for every TASKS.md read.** They
   resolve columns by header name. B3 was a fourth hand-rolled parser; the shared
   reader exists precisely because three earlier copies of "Status is field 9"
   broke silently.
3. **A sweep that returns nothing is a suspect sweep.** Six returned nothing and
   all six were wrong. Before trusting a zero, plant a known positive and confirm
   the sweep finds it — the same break-it-first discipline already required of the
   design checks.
4. **State the metric before taking it.** B6 was not a bad measurement, it was the
   wrong question. Writing *"text covered by the FAB that the bar does not already
   cover"* before running it would have produced the right probe.

---

## C · Scope set without checking siblings

| # | | |
|---|---|---|
| C1 | T-242 was scoped to one mobile test | The web twin had the identical defect and went red later the same day when the clock reached 2026-08-23. Closed as T-273 — whose agent then checked siblings unasked and found a *second* file (`app.test.tsx`) with the same latent bug |
| C2 | T-267 was scoped to colour | Five motion literals survived, found by the new `token-literal` check on its first run |

**Proposed fix.** When a defect is found in one file, grep for its shape across
the tree **before** writing the task row, and name the full set in the row. Both of
these were one `grep` from being complete.

---

## D · Staging and commit discipline

| # | | |
|---|---|---|
| D1 | `git add -A` swept spec-agent's in-flight work into an unrelated commit | Recorded, with the lesson "stage paths, not `-A`, while an agent is writing" |
| D2 | **The same lesson was then broken with `git add docs`**, sweeping two running agents' files into `13529f5` | The lists agent found its own work already committed, concluded another agent had done it, and **declined credit for its own work** |
| D3 | **The orchestrator told the user twice that it was deliberately not committing running agents' work.** That statement was untrue when it was made | Nothing caught this but the orchestrator re-reading its own commits |

**D3 is the one worth the owner's attention.** D1 and D2 are process slips with a
mechanical remedy. D3 is a report that did not match what happened, and no check in
this repo can catch that class of error.

**Proposed fixes**

1. **Never stage a directory while any agent is in flight.** Stage explicit files.
   This has been followed consistently since D2 and is worth making a rule rather
   than a habit.
2. **A pre-commit hook could compare the staged set against `STATUS.md ## In-Flight`
   subtrees and refuse the commit.** The data to do it already exists and nothing
   reads it for this purpose.

---

## E · State bookkeeping

| # | | Caught by |
|---|---|---|
| E1 | Step 4 of the dispatch protocol (fill `Artifacts` from the return) was dropped on **13 consecutive DONE rows** | The validator, which read 13 real fixes as analyses with nothing behind them. Each was verified on disk before being filled in rather than reconstructed from commit messages |
| E2 | One script removed 38 rows from `TASKS.md` **and truncated `TASKS-archive.md` in the same run**, then crashed between the two writes. The rows existed nowhere | The validator: 3 violations became 31 |
| E3 | E2 was then **misdiagnosed** as the documented C3/DONE-cap tension — a plausible, well-recorded theory. `validate-state.sh:193-196` shows T-149's fix was already in place and archiving by age is safe | Reading the validator source instead of re-deriving the theory |
| E4 | A new task was numbered T-288 by incrementing from memory after a 23-commit merge. The other session had filed up to **T-303** | The validator's duplicate-ID check |
| E5 | A `python3 - <<PY` heredoc was left unquoted, so bash expanded the backticks and `$` inside the row text and wrote a **mangled task row** | Reading the row back |

**Proposed fixes**

1. **Write the destination first, read it back, and only then remove the source.**
   E2 is an ordering bug, not a selection bug.
2. **Take the next task id from the file, never from memory** — one command:
   `cat TASKS.md TASKS-archive.md | grep -oE '^\| T-[0-9]+' | sort -n | tail -1`.
   After any merge, every remembered number is suspect. So are remembered line
   numbers: T-181's three citations had all moved and were re-measured before
   dispatch, which is the version of this that went right.
3. **Always `<<'PY'`, quoted.** E5 corrupted data silently.
4. **E3 is the generalisable one:** a failure that matches a known, documented
   tension will be attributed to that tension. **Check whether the documented fix is
   already in the code before re-deriving the theory it came from.**

---

## What this list does not contain

Two things, deliberately.

**Sub-agent defects.** Those live in each task's `Outcome` cell and in
`.claude/memory/`. Several agents caught orchestrator errors — A2, A3, A4, A5 and
A6 were all found by the agent, not by the dispatcher — which is worth noting when
judging how much to trust a return.

**Anything not verified.** Every claim above was checked against the repo when this
file was written. Where the orchestrator's original account was itself wrong (B6,
E3), the corrected version is what appears here and the original is named so the
correction is visible.

---

## If only three things get fixed

1. **The pre-dispatch path check** (A2). Mechanical, cheap, kills the most common
   and most expensive failure in this list.
2. **The visibility filter on every measurement probe** (B1). Mechanical, and it
   killed a correct finding once already.
3. **The staged-set versus in-flight-subtree check** (D2). Mechanical, and its
   absence caused an agent to disown its own work.

The rest are disciplines. This project has recorded, three times, that a remedy
depending on someone remembering is not a remedy — so the disciplines will recur
until they are checks.
