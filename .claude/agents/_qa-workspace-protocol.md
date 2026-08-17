# QA Workspace Integration Protocol

**Optional protocol — only applies when the `qa-task-manager` MCP server is reachable.** Every agent and the orchestrator follow this lazily: if the tools are not configured, skip silently. Never let a workspace call block a real task.

The qa-workspace (separate repo / sub-tree) is a personal SQLite + Next.js dashboard plus an MCP server that exposes 6 tools. When connected, it gives the user a live view of agent activity without parsing metric files. When not connected, the pipeline runs exactly as before.

---

## 1. Reachability check

Before calling any workspace tool, one cheap probe per dispatch:

- If your tool surface includes a tool named `qa_task_create` (often surfaced by the MCP host as `mcp__qa-task-manager__qa_task_create`), the workspace is reachable.
- If the tool is not present, the workspace is not configured — skip every step in this file. **Do not return BLOCKED for this.** Continue your normal work.

Do not retry on failure. A single failed workspace call should be logged in your summary's `unresolved:` (tag `tradeoff:workspace-unavailable`) and the rest of the dispatch proceeds as normal.

---

## 2. Tool reference

| Tool | Purpose |
|---|---|
| `qa_task_create` | Create a task row. Returns `{ task_id, status }`. |
| `qa_task_list` | Inspect existing tasks (rarely needed by agents). |
| `qa_task_get` | Fetch a task with comments / attachments / test runs / test cases inline. |
| `qa_task_comment` | Append a markdown comment (author: `claude-code` \| `user` \| `system`). |
| `qa_task_attach` | Attach a file (screenshot / video / HAR / log / patch / bug_report). |
| `qa_record_test_run` | Record a test execution (status / scenario / duration / error / artifacts_dir). Pass `test_case_id` when running a known TC. |
| `qa_test_case_upsert` | Create or update a test case keyed by `(feature_id, tc_id)`. Idempotent. Format-agnostic — `format` accepts `bdd`, `playwright`, `cypress`, `pytest`, `junit`, `manual`, etc. |
| `qa_test_case_list` | Inspect test cases (filter by feature / status / task). |
| `qa_test_case_get` | Fetch a TC with its run history inline. |
| `qa_feature_upsert` | Create or update a feature row keyed by `id` (e.g. F-001). Idempotent. Status: `draft \| active \| shipped \| archived`. |
| `qa_feature_list` | Inspect features (filter by status). |
| `qa_feature_get` | Fetch a feature with its acceptance criteria + linked test cases inline. |
| `qa_ac_upsert` | Create or update an acceptance criterion keyed by `(feature_id, ac_id)`. Idempotent. `platform` is free-form (`api`/`web`/`mobile`/`all`/project token). |
| `qa_knowledge_page_upsert` | Create or update a crawled-page knowledge row keyed by `(scope, url)`. The full crawler page blob (elements, forms, modals, links) goes in `metadata`. Idempotent. |
| `qa_knowledge_page_list` | Inspect crawled pages (filter by scope + substring search across url + title). |
| `qa_knowledge_page_get` | Fetch a knowledge page by id OR `(scope, url)` with `metadata` already JSON-parsed. |

Authoritative input schema lives in `qa-workspace/packages/mcp-task-manager/src/tools.ts`.

---

## 3. Where the `task_id` comes from

The orchestrator owns task creation. Every BRIEFING.md the orchestrator writes will contain (when the workspace is connected):

```
**Workspace task:** T-042
```

Sub-agents read this from BRIEFING and reuse it for every workspace call. **Do not call `qa_task_create` from a sub-agent** — duplicate task rows confuse the dashboard.

If BRIEFING does not name a workspace task ID, the workspace is either not connected or the orchestrator chose not to track this dispatch. Skip workspace calls entirely.

---

## 4. When to call what

### Sub-agent (any agent dispatched by the orchestrator)

| Moment | Tool | Body |
|---|---|---|
| Right after reading BRIEFING (after Step 1 in `_startup-protocol.md`) | `qa_task_comment` | `body: "Started — reading inputs."` `author: "claude-code"` |
| When you finish | `qa_task_comment` | Markdown copy of your final summary's "What" + "ACs" lines. Keep it under 30 lines — full detail is in the agent's structured return. |
| Each artifact you produce that will be reviewed (bug report, screenshot, HAR) | `qa_task_attach` | `file_path` is relative to `data/artifacts/` per the workspace contract; type per the enum. |
| `spec-agent` after writing REQUIREMENTS-{slug}.md (Mode 1: new-feature) | `qa_feature_upsert` then `qa_ac_upsert` per AC | One feature upsert with `id`, `title`, `slug`, `status: "draft"` (or `"active"` if signed off), `source_path`. Then loop the FRs / ACs and upsert each AC with `feature_id`, `ac_id`, `parent_fr`, `platform` (from the AC's tag — e.g. `(api, web)`), `text`. The dashboard's coverage matrix joins on `(feature_id, ac_id)`. |
| `reviewer-agent` (optional, on lifecycle change) | `qa_feature_upsert` | When a feature is being archived or shipped after final sign-off, update `status` only. Don't create new ACs from review. |
| `qa-explorer-agent` (or any agent driving qa-crawler / a Phase-0 explore) | `qa_knowledge_page_upsert` | One call per captured page after the crawl finishes. Pass `scope` (the crawl-run name from BRIEFING), `url`, `title`, `source_path` (path to the page JSON), and the **full crawler page blob** in `metadata` — elements (with locators), forms, modals, links. The MCP server auto-derives `elements_count` from `metadata.elements.length` so callers don't count manually. Don't truncate the blob; the dashboard renders whatever the crawler captured. |
| Any QA agent (`qa-api-agent` / `qa-web-agent` / `qa-mobile-agent`), `phase: author`, writing a test case | `qa_test_case_upsert` | One call per TC: `feature_id`, `tc_id`, `title`, `acs_covered` (CSV — must match the AC IDs spec-agent upserted), `priority`, `status: "planned"`. Capture the returned `test_case_id` in your summary so downstream phases can reuse it. |
| Any QA agent, `phase: author`, automating a TC | `qa_test_case_upsert` | Same `(feature_id, tc_id)` key. Update `status: "automated"`, set `format` (`bdd` for Cucumber/Gherkin `.feature`; `playwright` / `cypress` / `pytest` / `junit` / `appium` for code-based runners; whatever value matches MANIFEST), and `test_path` (path you wrote). |
| Any QA agent, end of `phase: execute` (and `triage`) | `qa_record_test_run` | One call per scenario / test-tag run with `status: pass\|fail\|skip\|error`, `scenario`, `duration_ms`, `error_message`, `artifacts_dir`, AND `test_case_id` if the run targeted a known TC (look it up via `qa_test_case_get` or remember the id from your earlier upsert). The id wires the run to the TC's run history on the dashboard. |
| Any QA agent, `phase: triage`, flipping a TC's quality state | `qa_test_case_upsert` | When a TC is reclassified `flaky` (intermittent), `failing` (product bug filed), or `archived` (superseded), update `status` accordingly. Do NOT call this for clean passes — `qa_record_test_run` records run outcomes; `qa_test_case_upsert` records steady-state TC status. |

If a single dispatch produces N test runs, call `qa_record_test_run` N times — one row per run. The dashboard's Task detail page renders them in chronological order.

### Orchestrator

| Moment | Tool | Body |
|---|---|---|
| Before writing BRIEFING.md for a new dispatch | `qa_task_create` | `type` from agent role (spec → `feature`, qa-web `triage` → `triage`, reviewer → `review`, qa-web other phases → `manual_test`); `agent` is the agent name; `input_summary` is the TASKS row description; `feature_id` if present. Reuse the returned `task_id` in BRIEFING's `**Workspace task:**` line. |
| When the agent returns DONE / PARTIAL / BLOCKED | `qa_task_comment` | One-line dispatcher note (`author: system`): `Status: DONE — confidence HIGH — 12 ACs covered`. |
| When the agent surfaces files via metric digest (Layer 1 hook ingestor handles this automatically; orchestrator does not need to re-attach) | — | — |

---

## 5. Best-effort semantics

Every workspace call is fire-and-forget:

```
TRY: call qa_task_comment
ON FAILURE:
  - log one line in your summary: "workspace_call_failed: qa_task_comment ({reason})"
  - tag in unresolved as: "tradeoff:workspace-unavailable"
  - continue your task; do NOT mark BLOCKED, do NOT retry
```

The workspace is a side channel, not a critical path. Treat it like a Slack notification — nice to have, never blocking.

---

## 6. What NOT to do

- ❌ Call `qa_task_create` from a sub-agent. Only the orchestrator creates tasks.
- ❌ Retry failed workspace calls. One try per moment, then move on.
- ❌ Spam comments. One at start, one at end, plus one per artifact / per test run is the budget. If you find yourself wanting to comment mid-task, write a memory entry instead (`_memory-protocol.md`).
- ❌ Use the workspace as a substitute for the structured return summary. The orchestrator parses the metrics block; the workspace is a UI surface for the human.
- ❌ Falsify a `qa_record_test_run` status. The dashboard's test-run rows are reviewer-visible; pass/fail must reflect actual run results.
- ❌ Falsify a `qa_test_case_upsert` status (e.g. setting `passing` when no run has succeeded). The TC table feeds the same review surface — same Red Flag rule applies.
- ❌ Call `qa_test_case_upsert` from the orchestrator. Sub-agents own their TCs.
- ❌ Call `qa_feature_upsert` from any agent other than spec-agent (or reviewer-agent on lifecycle change). The spec is the source of truth; ACs flow from it.
- ❌ Invent `platform` values for ACs. Use whatever the REQUIREMENTS doc declares (`api`, `web`, `mobile`, `all`, or project-specific tag). Omit if unstated.
- ❌ Truncate the `metadata` blob on `qa_knowledge_page_upsert`. Pass the full crawler page JSON — the dashboard parses it lazily and surfaces whatever's there. Stripping fields hides locators reviewers will need.
- ❌ Block the dispatch on a workspace failure. Workspace down ≠ task blocked.

---

## 7. Example dispatch (orchestrator → spec-agent)

```
1. Orchestrator decides next dispatch: spec-agent for REQ-001 / login-email-password
2. Orchestrator calls qa_task_create:
     type: "feature"
     agent: "spec-agent"
     input_summary: "Write requirements for login-email-password"
     feature_id: "F-001"
   → returns { task_id: "T-007", status: "queued" }
3. Orchestrator writes BRIEFING.md including:
     **Workspace task:** T-007
4. Orchestrator dispatches spec-agent (Read agent prompt + BRIEFING).
5. spec-agent reads BRIEFING, sees Workspace task: T-007.
6. spec-agent calls qa_task_comment(T-007, "Started — reading REQUIREMENTS template.", "claude-code")
7. spec-agent writes REQUIREMENTS-login-email-password.md.
8. spec-agent calls qa_task_comment(T-007, "DONE — wrote 7 FRs / 25 ACs. Confidence HIGH.", "claude-code")
9. spec-agent returns its structured summary to orchestrator.
10. Orchestrator calls qa_task_comment(T-007, "Status: DONE — confidence HIGH — 25 ACs", "system").
```

If at any of steps 2 / 6 / 8 / 10 the workspace is unreachable, the line is logged and skipped — the rest of the dispatch is unchanged.

---

## 8. Testing the integration

Before relying on this protocol, the orchestrator should sanity-check the workspace once per session:

```
Try: qa_task_list with limit=1
- If it returns a list (possibly empty) → workspace is up; integration enabled for this session.
- If the tool is not present → integration disabled for this session; document in STATUS.md ## Drift Log.
- If the tool errors → integration disabled for this session; surface to user.
```

The workspace setup (running the MCP server, configuring it in `.claude/mcp.json`) is documented in `qa-workspace/README.md`. If the user has not set it up, none of the tools will appear in the agent's tool surface and this protocol is a no-op.
