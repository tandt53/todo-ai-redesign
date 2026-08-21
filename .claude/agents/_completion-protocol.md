# Completion Protocol (shared by all sub-agents)
<!-- Every sub-agent must follow this when finishing work — successful, blocked, or failed. -->
<!-- Sub-agents do NOT write to STATUS.md, TASKS.md, or MANIFEST.md. -->
<!-- They return a structured summary; the orchestrator updates state. -->
<!-- THIS FILE IS THE SINGLE SOURCE OF TRUTH FOR THE RETURN CONTRACT. -->
<!-- No other file may define a competing return format. -->

## The return contract in one paragraph

Every return has two halves. The **prose half** is for the human reading the
transcript: a short markdown summary plus whatever agent-specific fields your
own agent file names. The **machine half** is the `---METRICS---` YAML block at
the very end — the orchestrator reads `status:` from it to route your task, and
the Layer-1 metrics hook parses it into the dashboard. The prose half may vary
per agent. **The `---METRICS---` block is identical for every agent and is never
optional.** A return without it is an incomplete return: the orchestrator cannot
route it and the dashboard records the dispatch as `status: unknown`.

## Before Returning — Self-Reflection

Every sub-agent must review its own output before claiming DONE. This catches issues before reviewer-agent.

### Step 1 — Re-read your inputs
Re-read what BRIEFING.md told you to read:
- The feature spec → acceptance criteria with AC IDs
- The api-contracts entries you depended on → request/response shapes
- The design screens → UI states (default, loading, empty, error)

### Step 2 — Check output against the spec
For each acceptance criterion or expected output, verify:
- Did I actually implement/produce this? (not just intend to)
- Does my output match the spec exactly? (not approximately)
- Did I miss any error cases, edge cases, or alternate flows?
- Did I create any files I didn't need? Any files I forgot?

### Step 3 — Run verification
- Wrote code → run tests, lint, typecheck
- Wrote docs → re-read for completeness (no empty sections, no placeholder text)
- Wrote tests → run them and confirm they pass

### Step 4 — Rate your confidence

| Confidence | Meaning | Action |
|---|---|---|
| HIGH   | All criteria met, tests pass, output matches spec | Return DONE |
| MEDIUM | Most criteria met, 1–2 minor gaps or untested edges | Return DONE, list gaps |
| LOW    | Significant gaps, tests failing, or unsure about approach | Return BLOCKED — do NOT claim DONE |

**Never return DONE with LOW confidence.**

---

## Rationalizations to Reject

These are shortcuts agents reach for when tired, rushed, or stuck. Each one is a lie you tell yourself. If you catch yourself thinking any of these, stop and do the thing you were about to skip.

| Rationalization | Why it's wrong | What to do instead |
|---|---|---|
| "Tests pass on my machine / in my head." | Untested code is undone code. The orchestrator cannot verify your intent. | Run the test command in MANIFEST. Paste the exit code into `evidence:`. |
| "Close enough to the spec." | Specs are contracts. "Close enough" produces drift that the reviewer will catch — or worse, that ships. | Either match the spec exactly or file a `drift_noted:` entry and return MEDIUM. |
| "I'll fix it in a follow-up." | Follow-ups disappear. This task is the follow-up you promised last time. | Fix in scope, or return BLOCKED with a specific unblock step. |
| "The edge case is unlikely." | If the spec lists it, it's required. "Unlikely" is not a classification the merge gate recognizes. | Implement it, or flag the AC as too weak in your summary. |
| "Linter / type warnings are noise." | Warnings are the cheapest bug reports you will ever get. | Address them, or document why each one is intentional in `unresolved:`. |
| "I didn't need to read the design / api-contract because the code was obvious." | BRIEFING.md lists inputs for a reason. Skipping inputs is how testids drift and contracts break. | Read every file BRIEFING.md named. Record them in `evidence.inputs_read:`. |
| "HIGH confidence because I'm mostly done." | HIGH means *all* criteria met. "Mostly" is MEDIUM. | Downgrade to MEDIUM and list the gaps. |
| "The test failed but the code is right — I'll weaken the assertion." | This inverts QA. A failing test is a signal, not an obstacle. | Diagnose root cause. Fix code or file drift. Never weaken the assertion to green. |
| "I'll leave a TODO / FIXME and call it done." | TODOs in shipped code are bugs waiting for a timestamp. | Implement it now, or return BLOCKED. |
| "Deps aren't installed, so I'll write the code 'as if they work' and let someone else verify later." | This is how bugs ship. If nobody verifies, nobody verifies. "Later" means "never." | Read `{specs}/_shared/platform/{your-layer}.md ## Test Harness` for the install command. Run it. If install fails for a genuine external reason (no network, missing system package), return **BLOCKED** with the specific failure — never DONE. See "Runnable workspace obligation" below. |
| "The test harness isn't up, so I can't run my tests — that's someone else's job." | There is no "someone else." The last agent to leave the code unverified is the one who shipped the bug. | Unit tests never need a harness; run them in-process using whatever the platform doc prescribes. Integration tests that genuinely require live services are the ONLY case where BLOCKED is legitimate. |
| "My sandbox is limited — let the reviewer / human catch it." | The reviewer checks structure, not runtime. The human's job is judgment calls, not running your tests. | If you wrote code, you run tests. Full stop. A sandbox that prevents running the commands named in the platform doc is a BLOCKER, not a waiver. |
| "The test is failing because of a library version mismatch, that's not my bug." | Your code runs in a real dependency graph. If your test can't resolve it, your code can't ship. | Pin the compatible version in the project's dependency manifest, document the pin in `unresolved:` tagged `tradeoff:<reason>`, re-run. If you can't pin, return BLOCKED with the specific mismatch. |

---

## Runnable workspace obligation (implementer agents)

If your task produces source code and the project is missing a runnable workspace for your layer, **scaffolding the minimum is part of your task**. You are not blocked on the orchestrator to do it for you.

**Source of truth for what your layer needs:**

1. `MANIFEST ## Stack` — tells you which language/framework applies to your module.
2. `{specs}/_shared/platform/{your-layer}.md ## Test Harness` — tells you the dependency-manifest filename, the install command, the unit-test command, and (if applicable) typecheck/lint/build commands. **This file is authoritative. Do not guess or hardcode stack-specific commands from memory — read the platform doc every time.**

**Procedure (stack-agnostic):**

1. Read the platform doc's `## Test Harness` block.
2. If the dependency-manifest file it names does not exist at the project root, create the minimum viable one by listing only the libraries your code actually imports. Do not add deps you don't use.
3. Run the platform doc's install command.
4. Run the platform doc's unit-test command against your module's test directory.
5. Copy the real output into `evidence.commands_run`.

**Legitimate BLOCKED reasons** (return BLOCKED, not DONE):

- Dependency install requires network access that is not available in this environment.
- The platform doc's commands require system packages you cannot install (root, drivers, native toolchains).
- Integration tests require a live paid external service with no documented stub.
- Tests require a simulator/emulator and none is available.

**What does NOT count as BLOCKED** (you must scaffold, not abdicate):

- "The project's dependency manifest doesn't exist yet." → Create it from your imports.
- "Dependencies aren't pinned." → Pin the versions you need.
- "I wrote unit tests but the integration harness isn't up." → Unit tests do not need an integration harness. Run them as unit tests.
- "Someone else should bootstrap the project." → You are that someone else.

If a code-producing task returns DONE with zero commands in `evidence.commands_run`, the orchestrator MUST treat that as a structural failure and re-dispatch. Reviewer C5 will FAIL it regardless.

---

## Red Flags — stop and reconsider

If any of these are true when you're about to return DONE, you are not done:

- You weakened a test assertion, or used a disabled-test marker (the skip / ignore / exclude annotation the project's test runner supports) to make a suite green.
- You added a TODO, FIXME, XXX, or `// not implemented` comment instead of implementing the thing.
- BRIEFING.md named a file you did not open.
- Your summary contains vague phrases: "should work", "mostly done", "probably fine", "I think".
- You didn't run tests because the change "seemed obvious" or "was just a rename".
- Confidence is HIGH but `unresolved:` is non-empty, or warnings exist, or a test is red.
- You created a new file when an existing file would do, without noting why.
- You cannot point to the exact AC each change satisfies.
- **You produced source code and `evidence.commands_run` is empty, or contains only static checks (`ls`, `wc`, `python -c 'import ...'`, `py_compile`).** Static import/compile is not test execution. You didn't verify your code; you verified that the Python parser is installed.
- **You returned MEDIUM or PARTIAL because "deps aren't installed" and did not attempt to install them.** See "Runnable workspace obligation" — scaffold and install, or return BLOCKED.
- **You wrote unit tests but did not run them.** Unit tests never need a harness. If you didn't run them, you didn't write them — you wrote placeholders.
- **You left a phrase like "will run once the harness is up" or "written as if deps work" in your return.** That phrase is a confession that the task is not done.

Each red flag is independently sufficient to block DONE. Fix it, or downgrade confidence and list it.

---

## QA Workspace completion ping (optional)

If BRIEFING.md named a `**Workspace task:**` and the `qa_task_comment` / `qa_task_attach` tools are available, mirror your completion to the dashboard before returning to the orchestrator. **Best-effort only — never block on workspace calls.**

1. **Final comment.** Post one `qa_task_comment` (`author: "claude-code"`) with a markdown copy of your "What" + "ACs" + "Issues" lines. Keep it under 30 lines. Skip if a workspace call already failed earlier this dispatch.
2. **Artifacts.** For each reviewer-relevant file you produced (bug report, screenshot, video, HAR, patch, console log), call `qa_task_attach` with `type` from the enum and `file_path` relative to `data/artifacts/`. Skip ordinary source files (those go in your structured `artifacts_written:`, not on the dashboard).
3. **Test runs (qa-web-agent / qa-api-agent / qa-mobile-agent, when running tests).** For every scenario / test-tag run executed, call `qa_record_test_run` once with the actual `status` (`pass | fail | skip | error`), `scenario`, `duration_ms`, and `error_message` (when failing). Pass `artifacts_dir` so screenshots/videos auto-attach. **Status must reflect the real run** — falsifying `pass` here is a reviewer-visible structural failure (Red Flag).

If any workspace call fails, log it once in `unresolved:` (tag `tradeoff:workspace-unavailable`) and continue. Do not retry. Do not return BLOCKED for workspace failures alone.

See `_qa-workspace-protocol.md` for the full tool reference, rules, and example dispatch.

---

## The head of your return — three lines the owner will actually read

Your return is read twice: once by the orchestrator, which acts on it, and once
by a human deciding what to do next. The second reader gets a summary the
orchestrator writes **from your head**, so a head that buries the answer produces
a report that buries it too.

**Open every return with exactly this, before any prose:**

```
VERDICT   one line: what you did, the measurement that proves it, and what you
          could NOT check. The gap matters more than the pass — "771/771, but no
          browser so the render half never ran" is the useful sentence.
NEEDS-OWNER  one line per decision only a human can take, or "none".
SELF-DECIDED one line per call you made that no source answered, or "none".
```

Everything else goes below this. Detail is not the enemy — detail *above the
answer* is.

**`SELF-DECIDED` is the line agents most often skip and the owner most needs.**
Every dispatch contains choices nothing in the spec settles. Listing them is what
makes them cheap to overturn: a decision surfaced in a return costs one revision,
the same decision discovered after implementation costs a rebuild. Write it even
when you are confident — especially then.

### When a decision needs the owner, give them what a decision needs

A question with no analysis attached moves the work from you to them without
moving any of the thinking. For each `NEEDS-OWNER` item, put this below the fold:

| Part | What it is |
|---|---|
| The question | In plain words, naming what the owner would *see* — never an AC id alone |
| Why now | What it costs to answer later. If it blocks, say what it blocks |
| Measurement | Real numbers from this codebase, if any exist |
| Options | Every option you can see, each with **what it gains and what it costs** |
| Common practice | What comparable, widely-used products do — named, specific |
| Your recommendation | And the cost of being wrong: cheap to reverse, or expensive |

**The options and their costs are yours to produce, not the orchestrator's.** You
did the reading; it did not. If you cannot supply the common-practice comparison
because you had no way to look, say that rather than leaving the row out — an
absent row and an unanswerable one look identical to the reader.

**Do not bundle unrelated decisions.** One question, one answer. Two questions
are one item only when answering the first changes what the second means.

---

## Returning to the Orchestrator (success path)

Return a structured summary the orchestrator can act on. The exact shape varies per agent (each agent file has a "Returning to the Orchestrator" section), but always include:

```
- Task: T-{id}
- Feature: F-{id} {slug}              (if scoped to a feature)
- Status: DONE | PARTIAL | BLOCKED    (gate agents also use APPROVE | REJECT — see vocabulary below)
- Confidence: HIGH | MEDIUM
- Files written: [list]
- Tests run: PASS/FAIL ({pass} / {total})
- Updated F-{id} ## Links: [which fields, which paths added]
- Drift noted: [if any]
- Follow-up tasks suggested: [list]
- Open questions: [for the user, if any]
- Memory read: [list of memory entries that influenced your work, by date + title — or "none relevant"]
- Memory entry: [if one of the 3 write triggers fired — see _memory-protocol.md. Otherwise omit.]
- Metrics: [structured YAML block — see _self-improvement-protocol.md for the full schema. REQUIRED on every return.]
- Evidence: [structured block — see "Evidence block" below. REQUIRED on every return.]
```

### Evidence block (required)

The evidence block is how you prove — not claim — that the work is done. The reviewer and orchestrator treat unproved claims as unproved. "I ran the tests" without the command and result is worth zero. Format:

```yaml
evidence:
  inputs_read:
    # Every file BRIEFING.md named. If you skipped one, explain why here.
    - {path}
  ac_coverage:
    # One line per AC your task was scoped to. Point to the file/line or test ID
    # that proves it. "Implemented" without a pointer does not count.
    AC-1: {file:line or TC-id} — {one-sentence how}
    AC-2: ...
  commands_run:
    # Exact commands, exit codes, and a one-line result. No paraphrasing.
    - cmd: "pnpm test src/auth"
      exit: 0
      result: "42 passed, 0 failed"
    - cmd: "pnpm typecheck"
      exit: 0
  artifacts_written:
    # Only files you actually created or modified. Cross-check against git status.
    - {path}
  unresolved:
    # Anything known-broken, deferred, or flagged. Empty list means "nothing known broken."
    # A non-empty list forces confidence ≤ MEDIUM.
    - {one-line description + why it's acceptable for this return}
```

Rules:
- If `commands_run` is empty, confidence cannot be HIGH.
- **If your task produced source code (not pure docs), `commands_run` MUST include at least one real unit-test run (per the command named in `{specs}/_shared/platform/{your-layer}.md ## Test Harness`) with pass/fail counts in the output. Parse-only / import-only / compile-but-don't-run checks do NOT count as test execution on their own — they verify the parser works, not the code.**
- **If your task produced source code and `commands_run` contains only filesystem / inspection commands (directory listing, file-size, grep, mkdir), your confidence is capped at LOW and you must return BLOCKED, not DONE.**
- If any `exit` is non-zero and you have not fixed the underlying cause, confidence cannot be HIGH.
- **`unresolved:` is tri-classed. Tag each entry:**
  - `tradeoff:<reason>` — an accepted design decision documented for transparency. Does NOT force downgrade. Example: "spec is 184 lines vs 150-line soft target; splitting would hurt downstream coordination."
  - `deferred:<owner>` — work punted to a named follow-up task or agent. Forces confidence ≤ MEDIUM unless a concrete follow-up task ID exists in `Follow-up tasks suggested`.
  - `broken:<reason>` — something known-wrong in the output. Forces confidence ≤ MEDIUM. Also blocks DONE if the broken thing is core to the task.
  Untagged unresolved entries default to `broken:` for safety.
- If an AC in your scope is missing from `ac_coverage`, you are not done.
- Fabricated or paraphrased command output is grounds for the reviewer to FAIL the task on sight. Copy real output verbatim, including warning lines and timing footers.

**Metrics are mandatory.** Every return summary must include the `metrics:` block from `_self-improvement-protocol.md`. The orchestrator uses these for pattern detection and self-improvement. Be honest — inflated metrics poison the feedback loop and get caught by spot-checks.

---

## The `---METRICS---` block (MANDATORY on every return, no exceptions)

End **every** return — DONE, PARTIAL, BLOCKED, APPROVE, or REJECT — with this
block. It must be the last thing in your output, introduced by a line containing
exactly `---METRICS---`. The orchestrator routes on `status:`; the Layer-1 hook
(`.claude/hooks/capture-agent-metrics.cjs`) parses the rest into the dashboard.

```
---METRICS---
status: DONE
confidence: HIGH
files_created:
  - src/auth/api/routes.ts
  - src/auth/api/__tests__/auth.test.ts
files_modified:
  - src/_shared/middleware/validation.ts
tests_passing: 14
tests_total: 14
acs_covered: [AC-1, AC-2, AC-5]
blockers: []
bugs_filed: [BUG-003]
```

### Field rules

| Field | Rule |
|---|---|
| `status` | One of the vocabulary below. Required. This is what the orchestrator branches on. |
| `confidence` | `HIGH` \| `MEDIUM` \| `LOW`. Required. Capped by the evidence rules above. |
| `files_created` / `files_modified` | Relative paths only, never absolute. Empty list is `[]`. Cross-check against `git status` before writing them. |
| `tests_passing` / `tests_total` | Integers. `0` / `0` if your task ran no tests (docs-only work). Never invent numbers. |
| `acs_covered` | Inline list of AC IDs, e.g. `[AC-1, AC-3]`. `[]` if your task is not AC-scoped. |
| `blockers` | `[]` when nothing is blocked. Non-empty forces `status: BLOCKED` or `PARTIAL`. |
| `bugs_filed` | BUG IDs you filed this dispatch. `[]` if none. |

Both list syntaxes parse: inline `[a, b]` and multiline `- a`. Use whichever
reads better; be consistent within one block.

### Status vocabulary (the only accepted values)

| `status` | Meaning | Who uses it |
|---|---|---|
| `DONE` | Task complete, everything in scope delivered and verified | every agent |
| `PARTIAL` | Real work landed, but something in scope is missing or deferred. Requires a non-empty `unresolved:` in the evidence block | every agent |
| `BLOCKED` | Cannot proceed — a dependency, a missing input, or a failed precondition | every agent |
| `APPROVE` | Quality gate passed | reviewer-agent, product-agent only |
| `REJECT` | Quality gate failed; orchestrator creates a revision task | reviewer-agent, product-agent only |

Gate agents (reviewer-agent, product-agent) keep their richer prose verdict —
`STRUCTURAL-PASS` / `CHANGES REQUESTED` and so on — in the prose half, and map it
to `APPROVE` or `REJECT` in `status:`. The prose is for the human; `status:` is
for the orchestrator. Never put a gate verdict string in `status:`.

There is no `DONE-with-followup`. Work that landed but left something behind is
`PARTIAL` with the leftover named in `unresolved:` and a suggested follow-up task.

### Status is derived from evidence

Pick `status:` by reading your own evidence block, not by judging how the work
felt. Two fields decide it:

| `files_created` + `files_modified` | Coverage of the ACs in your scope | `status:` |
|---|---|---|
| both empty | — | `BLOCKED` |
| non-empty | below 100% | `PARTIAL` |
| non-empty | 100% | `DONE` |

Read the table literally:

- **Empty file lists mean `BLOCKED`, never `DONE`.** Analysis, validation,
  surfacing a gap, or explaining why something cannot be built are all valuable
  returns — and none of them is production. If you wrote no file, name the
  blocker and what would unblock you.
- **Empty file lists mean `BLOCKED`, not `PARTIAL` either.** `PARTIAL` claims
  that real work landed. It requires at least one artifact on disk.
- **`DONE` requires the paths to be real.** The orchestrator checks every path
  you list; a path that does not exist turns your `DONE` into `BLOCKED` and the
  discrepancy into a drift-log entry.

Confidence narrows this further but never widens it: `LOW` confidence downgrades
`DONE` to `BLOCKED` (see the confidence table above). Confidence can never
promote a status the evidence does not support.

This rule exists because the failure it prevents is common and quiet: an agent
does careful work, produces a thoughtful written answer, writes nothing to disk,
and reports `DONE`. Downstream tasks then unblock against an artifact that was
never created.

---

The orchestrator parses this summary and updates STATUS.md `## Agent Results`, moves TASKS.md rows, and unblocks downstream tasks.

You do **not** edit STATUS.md, TASKS.md, or MANIFEST.md directly. The orchestrator owns those files.

**No sub-agent writes the feature spec's `## Links` block — not even its own field.**
The orchestrator owns it. You report the paths you produced in your return summary
under `links_to_record:` and the orchestrator writes them.

This is not ceremony. Up to seven agents contribute to that one YAML block
(`implemented_in`, `designed_in`, `api_endpoints`, `tested_by.{api,web,mobile}`),
and the pipeline dispatches them **in parallel** — two in the architecture phase,
six in the implementation phase. The orchestrator's overlap guard covers
`{src}/{module}/` subtrees, not the spec file, so concurrent appends to one block
would interleave or clobber. Reporting instead of writing removes the race
entirely and costs you nothing: you already list the paths in your summary.

Format the field like this — one line per Links key you have paths for:

```yaml
links_to_record:
  implemented_in: [src/lending/api/routes/loan-routes.js, src/lending/api/services/fee.js]
  api_endpoints:  ["POST /loans/{loanId}/return"]
  tested_by.api:  [{qa}/lending/F-001/api/, {qa}/lending/automation/api/F-001-return-book.test.js]
```

Omit keys you have nothing for. Do not invent paths — every entry must be a file
or directory you actually created and verified on disk.

---

## Returning When Blocked

```
- Task: T-{id}
- Status: BLOCKED
- Blocker: [what's blocking — be specific]
- Files affected: [list]
- What needs to happen to unblock: [specific recommendation, ideally naming an agent]
- Partial work: [files written so far, if any — orchestrator decides whether to keep]
```

A BLOCKED return still ends with the `---METRICS---` block — `status: BLOCKED`,
`blockers:` naming what stopped you, and `files_created` listing whatever partial
work landed. A blocked dispatch with no metrics block is invisible to the
dashboard, which is exactly the dispatch you most want to see there.

The orchestrator updates STATUS.md `## Blockers` and TASKS.md based on this summary.

---

## Returning When You Find Drift

Drift = the spec says X but the existing code does Y. Don't fix it as a side effect. Note it in your summary:

```
- Drift noted: spec {specs}/auth/F-001-login.md says session expires in 24h,
  but src/auth/api/session.ts uses 7 days. Did not change.
```

The orchestrator decides whether to update the spec, fix the code, or surface to the user.

---

## After Returning — Memory (if applicable)

Check if any of these three triggers apply. If none apply, skip — don't write.

1. **Non-obvious decision** — you chose approach A over B for a reason not documented elsewhere
2. **Mistake caught** — you went down the wrong path and found the real cause
3. **Reusable pattern** — you found something other agents should know

If a trigger applies, include the entry in your return summary's `memory_entry:` field. The orchestrator will append it to `.claude/memory/MEMORY.md`. Format:

```markdown
---
## [date] | [your-agent-name] | T-[task-id]
Type: decision | mistake | pattern | constraint
Tags: [domain tags]
Summary: [1-2 sentences]
Lesson: [what the next agent should do differently]
---
```

See `_memory-protocol.md` for full format and examples.
