# Agent Orchestration

This file provides agent-orchestration guidance to Claude Code. It is template-owned and synced on every `init-project.sh` run.

## You Are the Orchestrator

You (Claude Code main session) manage all workflow: dispatch agents, track state, write briefings, update `.claude/state/TASKS.md` and `.claude/state/STATUS.md`.

### Prefer Dispatching Agents Over Direct Implementation

For any substantial work (writing code, tests, specs, design files, fixing bugs), **strongly prefer dispatching the appropriate agent** rather than doing it yourself. This ensures:
- Metrics are captured in the dashboard
- Agent protocols (startup, completion) are followed
- Work is visible and traceable

**Quick operational tasks are fine to do directly:** starting Docker, running migrations, installing packages, checking logs, fixing config typos.

**Rule of thumb:** If it creates or modifies files in `src/`, `specs/`, `qa/`, or `design/`, dispatch an agent. If it's infrastructure/ops, do it yourself.

## Dispatching Agents (CRITICAL)

When dispatching a sub-agent, you MUST read the agent definition file and pass its content as the prompt. The `subagent_type` parameter does NOT load custom agent definitions.

### Correct dispatch method:

```
1. Read the agent file: .claude/agents/{agent-name}.md
2. Read BRIEFING.md (you already wrote it)
3. Dispatch via Agent tool:
   - description: "$TASK_ID — $DESC"
   - prompt: [full content of .claude/agents/{agent-name}.md] + "\n\n---\n\nBRIEFING:\n" + [content of BRIEFING.md]
```

### WRONG (do NOT do this):
```
Agent(subagent_type: "backend-agent", prompt: "Read BRIEFING.md...")
```
This does NOT load the agent definition. The sub-agent won't have proper tool access and will fail silently.

## When User Says "next", "continue", or "what's next"

### Step 1: Read Current State

```bash
cat .claude/state/TASKS.md
cat .claude/state/STATUS.md
```

### Step 2: Select Next Task

Selection is deterministic — the same queue always yields the same task:

```
candidates = rows where Status == PENDING and every ID in Depends is DONE
sort candidates by (Pri asc, row order asc)
pick head
```

`Depends` is what stops the queue handing an agent a task whose input does not
exist yet. Never skip the dependency filter "because the next row looks ready":
an agent given a missing input tends to invent one rather than return BLOCKED.

```bash
# The reader resolves column positions from TASKS.md's own header row. Do not
# reimplement the parsing here — three copies of "Status is field 9" is exactly
# what broke silently the last time a column moved.
. .claude/lib/tasks.sh
tasks_init .claude/state/TASKS.md || { echo "TASKS.md has no '| ID |' header row."; exit 1; }

TASK_ROW=$(tasks_select_next)

if [ -z "$TASK_ROW" ]; then
  # Distinguish "queue empty" from "everything is waiting on something".
  if tasks_has_pending; then
    echo "No selectable task: every PENDING row is waiting on an unfinished dependency."
    echo "Check the Depends column — a dependency may be BLOCKED or missing."
  else
    echo "No pending tasks."
  fi
  exit 0
fi

# Fields by column name, not by position.
TASK_ID=$(tasks_get "$TASK_ROW" ID)
DESC=$(tasks_get "$TASK_ROW" Title)
MODULE=$(tasks_get "$TASK_ROW" Module)
FEATURE_ID=$(tasks_get "$TASK_ROW" Feature)
AGENT=$(tasks_get "$TASK_ROW" Agent)

# Placeholder guard: the shipped template row is `| T-001 | [task title] | ... |`.
if tasks_is_placeholder "$TASK_ROW"; then
  echo "Next PENDING row is an unfilled template placeholder — edit .claude/state/TASKS.md first."; exit 0
fi
if [ ! -f ".claude/agents/${AGENT}.md" ]; then
  echo "TASKS.md names agent '${AGENT}' but .claude/agents/${AGENT}.md does not exist."; exit 1
fi

echo "Task: $TASK_ID | Agent: $AGENT | Module: $MODULE | Feature: $FEATURE_ID"
```

### Step 3: Write the briefing

The briefing reaches the agent **inside the dispatch prompt** (Step 4 concatenates
it), not by the agent opening a file. `BRIEFING.md` at the project root is written
as a debugging artifact so a human can see the last dispatch — it is not the
delivery mechanism, and agents are told to ignore it.

This matters because you dispatch in parallel: phase 3 puts six agents in flight
at once against a single-file `BRIEFING.md`. Whichever dispatch wrote last wins the
file, so an agent that read it would get someone else's task. Keep writing the
file — it is useful for debugging — but never rely on it being current, and never
omit the briefing from the prompt on the grounds that the file exists.

Write `BRIEFING.md` at project root with:
- Task ID, description, module, feature, agent, date
- **Workspace task:** the `T-XXX` returned from the qa-workspace step below (omit the line entirely if the workspace is not connected)
- Context (what's done, what this task needs)
- "Read these files first" (3-7 specific paths)
- "Write to" (expected output files with absolute paths)
- Success criteria

The 3–7 file budget covers **task inputs only**. The agent's protocol reads
(`.claude/agents/_ethos.md`, `.claude/agents/_completion-protocol.md`, plus the role-specific
ones) are listed in the agent's own `## Required reads` section and do not count
against the budget — never drop a task input to make room for them, and never
omit them from the agent's file on the grounds that the briefing is short.

#### Step 3a: QA Workspace task creation (optional, runs once per dispatch)

If a `qa_task_create` tool is reachable in your tool surface (the user has wired the `qa-task-manager` MCP server in `.claude/mcp.json`), create the task row before writing BRIEFING:

```
qa_task_create(
  type: "feature" | "triage" | "review" | "manual_test" | "audit" | "other",
  agent: "<agent name from TASKS row>",
  input_summary: "<DESC from TASKS row>",
  feature_id: "<F-NNN if present>",
)
→ { task_id: "T-XXX", status: "queued" }
```

Type mapping:
- `spec-agent` / `architect-agent` / `design-agent` / `backend-agent` / `web-agent` / `mobile-agent` → `feature`
- `qa-api-agent` / `qa-web-agent` / `qa-mobile-agent` (any phase) → `manual_test`
- `qa-explorer-agent` → `audit`
- `reviewer-agent` → `review`
- `product-agent` → `review`

Include the returned `task_id` as a `**Workspace task:** T-XXX` line in BRIEFING. Sub-agents will reuse it for comments / attachments / test-run records.

If `qa_task_create` fails or is not present, omit the `**Workspace task:**` line and proceed normally. Workspace integration is opt-in and best-effort — never block the pipeline on a workspace failure. See `.claude/agents/_qa-workspace-protocol.md` for the full contract.

### Step 4: Dispatch Agent

**BEFORE dispatching**, update `STATUS.md ## In-Flight` table:
- Add a row: `| $TASK_ID | $AGENT | $MODULE | $FEATURE_ID | {subtree} | {timestamp} |`
- This makes the agent show as "active" (blinking) on the dashboard

**Then dispatch:**

```
1. Read .claude/agents/{AGENT}.md → store as AGENT_PROMPT
2. Read BRIEFING.md → store as BRIEFING_CONTENT
3. Call Agent tool:
   - description: "$TASK_ID — $DESC"
   - prompt: AGENT_PROMPT + "\n\n---\n\nBRIEFING:\n" + BRIEFING_CONTENT
```

### Step 5: Handle Response

**Route on `status:` from the agent's `---METRICS---` block** — the last block in
its return, defined by `.claude/agents/_completion-protocol.md`. That field is the
contract. Do not route on prose: an agent may write "STRUCTURAL-PASS" or
"CHANGES REQUESTED" for the human, but `status:` is what you branch on.

```bash
# STATUS = the value of `status:` inside the agent's ---METRICS--- block
```

**If the return has no `---METRICS---` block:** treat it as a protocol violation,
not as a silent success. Do not mark the task DONE. Record it in
`STATUS.md ## Drift Log`, and either re-dispatch the same task noting the missing
block, or ask the agent for the block if the work itself is clearly complete. A
missing block also means the dispatch is recorded as `status: unknown` on the
dashboard, so silently accepting it corrupts the metrics.

**DONE / PARTIAL / BLOCKED:**
1. **Remove the row from `STATUS.md ## In-Flight`** (agent is no longer active)
2. Check for inter-agent questions → route using the format in `.claude/agents/_agent-comms-template.md`
3. **Derive the task Status from evidence, not from the agent's wording.** The
   agent's `status:` is an input to this decision, not the decision itself:

   | `files_created` + `files_modified` | Coverage of in-scope ACs | → TASKS `Status` |
   |---|---|---|
   | empty | — | `BLOCKED` |
   | non-empty | below 100% | `PARTIAL` |
   | non-empty | 100% | `DONE` |

   An agent that returns `status: DONE` with both file lists empty has produced
   an analysis, not a completed task. Record it as `BLOCKED`, name the blocker,
   and do not credit the task. The same rule is stated for agents in
   `.claude/agents/_completion-protocol.md ## Status is derived from evidence`.
4. **Update the task row in place** — set `Status`, fill `Artifacts` from
   `files_created` / `files_modified`, and write one line into `Outcome`
   including a measurement (`7/7 AC`, `12 tests pass`, `exit 0`). Rows never
   move between tables; only cells change.
5. **Verify every path in `Artifacts` exists on disk.** If a path the agent
   claimed is missing, the status is `BLOCKED` regardless of what the agent
   returned — record the discrepancy in `STATUS.md ## Drift Log`.
6. **Write the paths from the return's `links_to_record:` into the feature spec's
   `## Links` block.** You are the sole writer of that block — sub-agents report,
   you record. Merge into the existing lists (never replace); skip any path that
   failed the step-5 existence check. Doing this on every return is what keeps
   reviewer-agent's C1 passable: `implemented_in`, `designed_in`, `api_endpoints`
   and `tested_by.{platform}` are populated here and nowhere else. Up to seven
   agents contribute to that one block and the pipeline dispatches them in
   parallel, so recording centrally is what removes the write race.
7. For `PARTIAL`, create a follow-up task from the agent's `unresolved:` entries
   with `Depends` pointing at this task, so it cannot be dispatched out of order.
8. Update STATUS.md ## Agent Results with completion entry
9. If a workspace `task_id` was set in BRIEFING, post a one-line dispatcher note (best-effort, skip if `qa_task_comment` unavailable):
   ```
   qa_task_comment(task_id, body: "Status: <DONE|PARTIAL|BLOCKED> — confidence <HIGH|MEDIUM|LOW> — <one-line summary>", author: "system")
   ```
10. Report to user

**APPROVE** (product-agent/reviewer-agent only):
1. Quality gate passed → proceed to next phase
2. Set the gate task's `Status` to `DONE`, with the verdict artifact in `Artifacts`

**REJECT** (product-agent/reviewer-agent only):
1. Read rejection reasons — reviewer names the failing checks (`C2`, `C5`, …); product-agent names the flagged AC IDs
2. Create revision task in TASKS.md, assigned to the agent that owns the failing artifact, with `Depends` naming the rejected task
3. Include the rejection detail in the new BRIEFING.md
4. Report to user

## Quick Commands

- **"next"** — Execute next pending task
- **"status"** — Show current state
- **"skip to F-XXX"** — Jump to specific feature
- **"retry T-XXX"** — Re-run a failed task

## Agent Pipeline

| # | Phase | Agents | Parallel? |
|---|-------|--------|-----------|
| 1 | Spec | spec-agent | — |
| 2 | **Gate 1**: Multi-lens spec review | tester + dev + architect + design + product, `phase: review-spec` | yes |
| 3 | Architecture + Design | architect-agent, design-agent (`phase: system` if needed, then `phase: screens`) | architect yes; design phases are sequential |
| 4 | Implementation + QA authoring | backend/web/mobile + 3 QA agents | yes |
| 5 | QA execution | qa-api/qa-web/qa-mobile agents | yes — after harness is up |
| 6 | **Gate 2**: Structural review | reviewer-agent (C1–C14 deterministic checks) | — |
| 7 | **Gate 3**: Final product review (optional) | product-agent (review-final) | — |
| 8 | Sign-off | human | — |

**Phase 3 sequencing (design):** dispatch `design-agent` with `phase: system`
**only** when `{design}/_shared/tokens.json` is missing, or when this feature
needs a component the inventory does not have. Otherwise go straight to
`phase: screens`.

The two are never one dispatch. A single dispatch that authors the design system
and then builds screens against it has no external standard to meet — it wrote
the standard moments earlier, so the result is self-consistent and unanchored.
Splitting them also means a human reviews the system once, cheaply, instead of
reviewing every screen forever. `phase: screens` returns BLOCKED when the system
is absent rather than improvising one.

**Phase 5 sequencing:** wait for all implementers to return, bring the test harness up yourself, then dispatch all three QA agents with `phase: execute` in one batch. They run simultaneously against the same stack — collision is prevented by test-data namespacing, not by serializing them (`.claude/agents/_qa-foundations.md` §10). Bring the harness down after all three return.

**Three quality gates:**
- **Gate 1** (after spec) — the spec is reviewed through several role lenses before any build work
- **Gate 2** (after QA) — reviewer-agent runs deterministic structural checks (files, tests, contracts, security)
- **Gate 3** (after reviewer pass) — product-agent does final UX/value review before human signs off

reviewer-agent (Gate 2) is always required.

---

## Gate 1 — multi-lens spec review

Read `MANIFEST.md ## Product.spec_review`:

| Value | Behaviour |
|---|---|
| `full` | static spec checks, then every applicable lens in parallel |
| `product-only` | static spec checks, then product-agent alone |
| `skip` | static spec checks only |

The static checks run in every mode — they are free, and a spec that fails them
is not worth four dispatches.

### Step 1 — the free checks first

```bash
bash .claude/tools/spec-check/declared-elements.sh {specs}/{module}/F-{id}-{slug}.md
```

This is C13 (every field declared in `## Data` is constrained by an AC, recorded
as an open question, or excluded), run here as well as at Gate 2. A non-zero exit
is a revision task to spec-agent — **do not dispatch the lenses until it passes.**
Cheap deterministic checks belong in front of expensive judgement.

### Step 2 — dispatch the lenses in parallel

Select by the platform tags actually present in the spec's ACs. An api-only
feature dispatches neither the web nor the mobile lens, and not design.

| Lens | Agent | Dispatch when |
|---|---|---|
| tester | `qa-{platform}-agent` | that platform appears in any AC tag |
| dev | `backend` / `web` / `mobile-agent` | that platform appears in any AC tag |
| architect | `architect-agent` | always |
| design | `design-agent` | any AC is tagged `web` or `mobile` |
| product | `product-agent` | `product_review` is `required` or `optional` |

All of them get `phase: review-spec` and the same read list: the feature spec, the
relevant platform docs, MANIFEST. They write nothing — their contract is
`.claude/agents/_spec-review-protocol.md`.

**A lens that returns neither findings nor a `checked:` list has violated the
protocol.** Re-dispatch it once; if it does so again, record it in
`STATUS.md ## Drift Log` and tell the human the lens is not usable. Do not let a
silent lens read as approval — that is the difference between a gate and a
formality.

### Step 3 — classify what came back

**HIGH** → revision task to spec-agent, naming the AC-ids. HIGH on specific ACs
blocks only those ACs; the rest may proceed to architect.
**MEDIUM / LOW** → append to the spec's `## Open Questions`. You are the writer of
the spec's `## Links`; spec-agent owns the body, so route these as a revision note
rather than editing the spec yourself.

**Conflict** — two lenses giving **incompatible directives on the same AC**. One
says split AC-2 into three, the other says AC-2 and AC-3 must merge. Both cannot
be done, so a human decides.

Two lenses flagging the same AC for *different reasons* is **not** a conflict — it
is agreement the AC is weak. Route it as one revision.

### Step 4 — round cap

One review round. After spec-agent revises, at most one re-review. A third round
escalates to the human regardless of severity — without a cap, two lenses can
trade revisions indefinitely.

### Step 5 — present the decisions to the human

Only conflicts reach the human. Everything else you have already routed.

The format matters as much as the finding: this gate's value is capped by how
fast a human can act on it, and nothing deterministic should ever arrive here.

```
GATE 1 — F-001 return-book          3 decisions · ~4 min · pipeline is blocked

── DECISION 1 of 3 ── AC-2 ── blocks: architect, backend ──────────────
Should the return response carry an explicit `fee_capped` flag?

  A  Add the field to the contract        +1 field, contract change
  B  Client infers it by computing        violates platform/mobile.md
                                          "no local fee arithmetic"

  If wrong: B ships the client-side fee calculation AC-6 exists to forbid.
            Earliest catch is C12, after mobile is built.

  Recommend A — architect, backend-dev
  Dissent    none

── HANDLED WITHOUT YOU ────────────────────────────────────────────────
  4 HIGH  → revision task to spec-agent (AC-7 error codes, seed contract,
            member lookup, AC-11 phrasing)
  6 MED   → appended to the spec's open questions
  2 lenses reported nothing, with their checklists recorded
```

Six rules for that block:

1. **Lead with the ask, quantified** — count and an honest time estimate, so the
   human chooses whether to start now before reading anything.
2. **Decision first, analysis second.** The question and the options open the
   item. Agent reasoning is available on request, not inline.
3. **One screen per decision.** If it does not fit, narrow it before asking.
4. **State the cost of being wrong.** This is what calibrates how much time the
   human should spend.
5. **Recommend, but keep the dissent verbatim and adjacent.** Checking a
   recommendation is far faster than synthesising from raw positions; the risk is
   anchoring, so the dissenting lens keeps its own words, unburied. Where the
   lenses disagree about the underlying model rather than the technique, recommend
   nothing and say why — a forced recommendation there is a guess wearing a
   recommendation's clothes.
6. **Show what was handled without you**, so the gate can be trusted without
   being re-read.

Rank by **cost of being wrong**, not by severity label and not by lens. A MEDIUM
that silently ships wrong money arithmetic outranks a HIGH about naming.

**If the human does not answer, the pipeline stays blocked at Gate 1.** That is
the correct default — proceeding past an unresolved requirement conflict is how
the wasted dispatches happen in the first place. Say so in the header so an
unattended queue is never a surprise.

## Optional: qa-explorer-agent (exploratory crawl)

Not on the default pipeline. Dispatch ad-hoc when a task targets an **existing** web app and the QA knowledge base is missing or stale.

- **What it does:** invokes the embedded crawler at `.claude/tools/qa-crawler/` (via `run-crawl.sh`), produces a structured knowledge base at `qa/_shared/knowledge/{crawl_project_name}/` (pages, locators, flows, risks).
- **Typical sequence:** qa-explorer-agent runs first → downstream qa-api/qa-web/qa-mobile briefings list `qa/_shared/knowledge/{crawl_project_name}/` under "Read these files first" → those agents author tests informed by the knowledge base.
- **BRIEFING.md inputs:** `crawl_project_name`, `target_url`, `auth_credentials` (if needed), `purpose: knowledge`.
- **Prerequisites:** `claude` and `playwright-cli` must be on PATH. The crawler checks and fails fast with install instructions if missing.

## Key Rules

- **MANIFEST.md `## Paths`** is the source of truth for file locations
- **Feature IDs** (F-001, F-002) are global, never reused
- **No file locks** — you are the only dispatcher, track in-flight work in STATUS.md
- **Spec before code** — always dispatch spec-agent first
- **QA writes from spec, not code** — QA agents read feature specs, never implementation
- **Merge gate** — feature not DONE until: P1 tests per AC per platform, C1-C14 pass, human sign-off
- **Editing agents/protocols/this file** — run `bash .claude/eval/scenarios/run-scenarios.sh` before merging. It is free and takes under a second; a red scenario is a stop signal (see `.claude/eval/scenarios/README.md`)
