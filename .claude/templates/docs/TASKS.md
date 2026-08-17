# Task Queue
<!-- Orchestrator writes and archives. Sub-agents read the task assigned to them. -->
<!-- Hard limit: 300 lines. Orchestrator auto-archives when exceeded (see below). -->

## Format

One table. Status is a **column**, not a section — a task never moves between
tables, only its `Status` cell changes. Moving rows between sections drops
columns and duplicates tasks; changing one cell cannot fail that way.

```
| ID | Title | Module | Feature | Agent | Pri | Depends | Status | Artifacts | Outcome |
```

- **Module** — business domain this task targets (e.g. `auth`, `payments`, `_shared`). Orchestrator assigns at dispatch.
- **Feature** — feature ID this task belongs to (e.g. `F-003`) or `—` for cross-cutting tasks.
- **Pri** — `P0` … `P3`. Drives selection order.
- **Depends** — comma-separated task IDs that must be `DONE` before this task is selectable; `—` if none.
- **Status** — `PENDING` · `IN_PROGRESS` · `PARTIAL` · `BLOCKED` · `DONE` · `CANCELLED`
- **Artifacts** — real paths the task produced, resolvable through `MANIFEST ## Paths`. `—` until the task has produced something.
- **Outcome** — exactly one line, including a measurement (`5/7 AC`, `12 tests pass`, `exit 0`). `—` while pending.

Task statuses and agent-return statuses are different vocabularies that overlap.
An agent returns `DONE | PARTIAL | BLOCKED` (plus `APPROVE | REJECT` for gate
agents) in its `---METRICS---` block; the orchestrator maps that onto the
`Status` column here. `PENDING`, `IN_PROGRESS` and `CANCELLED` are queue states
that no agent ever returns.

The orchestrator is the sole dispatcher. Sub-agents do not claim tasks themselves — they receive a briefing via `BRIEFING.md` and act on it.

### Status is derived, not declared

The orchestrator sets `Status` from the evidence in the agent's return, not from
the agent's own wording:

| `files_created` + `files_modified` | Coverage of in-scope ACs | → `Status` |
|---|---|---|
| empty | — | `BLOCKED` |
| non-empty | below 100% | `PARTIAL` |
| non-empty | 100% | `DONE` |

An agent that reports `status: DONE` while listing no files has not completed a
task — it has produced an analysis. Record it as `BLOCKED` with the blocker
named. The full rule, including the confidence interaction, is in
`agents/_completion-protocol.md ## Status is derived from evidence`.

`Artifacts` is what makes this checkable: every `DONE` or `PARTIAL` row must name
at least one path, and every path named must exist on disk.

## Selection order

`"next"` picks the head of this ordering — see `.claude/ORCHESTRATION.md` Step 2
for the executable version:

```
candidates = rows where Status == PENDING and every ID in Depends is DONE
sort candidates by (Pri asc, row order asc)
pick head
```

`Depends` is mandatory for any task whose input is produced by another task.
Without it the queue can hand an agent a task whose input does not exist yet, and
an agent facing a missing input tends to invent one rather than return `BLOCKED`.

## Archival (automatic)

The orchestrator runs this check at the start of every session:
- If TASKS.md total line count > 300, **or** rows with `Status` = `DONE` exceed 50:
  1. Read `TASKS-archive.md` (create if missing)
  2. Move `DONE` rows older than 14 days (or all of them if ages unclear) into `TASKS-archive.md`, grouped by ISO week
  3. Leave a single line here: `<!-- N tasks archived — see TASKS-archive.md -->`

## QA phase: two dispatches per platform

Each platform QA agent (qa-api-agent, qa-web-agent, qa-mobile-agent) is dispatched **twice per feature**:

1. **Authoring phase** (`phase: author` in BRIEFING.md) — runs in parallel with the matching implementer. Writes markdown test cases in `{qa}/{module}/F-{id}/{platform}/`, drafts automation scripts. No test harness needed.
2. **Execution phase** (`phase: execute` in BRIEFING.md) — runs **in parallel** after all implementers return and the orchestrator brings up the test harness. All three QA agents execute simultaneously with namespaced test data (see `_qa-foundations.md` section 10). Runs tests, triages failures, files bugs with layer attribution.

A single feature with api + web + mobile therefore generates **6 QA tasks** (3 authoring + 3 execution) in addition to implementer tasks. The orchestrator creates them automatically; spec-agent and architect-agent do not.

The execution task depends on its authoring task — record that in `Depends`, so
the queue cannot dispatch execution before the test cases exist.

## Merge gate (hard rule, enforced by orchestrator)

A task that completes a feature cannot be set to `Status` = `DONE` until **all** of:
1. At least one P1 test case exists in `{qa}/{module}/F-{id}/{platform}/` for every (AC, platform) pair declared in the feature spec's AC platform tags
2. Reviewer-agent C2 (per-platform AC coverage) passes
3. Reviewer-agent C3 (API contract consistency, uses qa-api-agent's tests as evidence) passes
4. Test suite runs clean (reviewer-agent C5)
5. No open bugs in the feature spec's `## Links.known_bugs` (non-empty is a WARNING, not an auto-fail, but it surfaces to the human reviewer)

If any gate fails, the task stays `IN_PROGRESS` and a follow-up task is dispatched: bug fixes go to the implementer named in the bug's `layer:` field; coverage gaps go to the matching platform QA agent.

---

## Tasks

| ID | Title | Module | Feature | Agent | Pri | Depends | Status | Artifacts | Outcome |
|----|-------|--------|---------|-------|-----|---------|--------|-----------|---------|
| T-001 | [task title] | [module] | [F-xxx or —] | [agent-name] | P0 | — | PENDING | — | — |
<!-- Examples — the parser strips HTML comments, so these never dispatch:
| T-002 | Implement login endpoint | auth | F-001 | backend-agent | P0 | T-001 | IN_PROGRESS | — | — |
| T-003 | Build login UI | auth | F-001 | web-agent | P1 | T-002 | BLOCKED | — | needs POST /auth/login first |
| T-004 | Author web test cases | auth | F-001 | qa-web-agent | P1 | T-001 | DONE | qa/auth/F-001/web/ | 9 TC, 7/7 AC covered |
| T-00X | Crawl existing app for QA knowledge | — | — | qa-explorer-agent | P2 | — | PENDING | — | — |
-->
