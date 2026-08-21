- 2026-08-17 orchestrator edited .claude/tools/design-check/testid-contract.sh (C14): ATTR regex now recognises resource-id and no longer treats contentDescription as an identity attribute, per F-003 AC-12's pinned rule. Tooling infra, not a task artifact — recorded here rather than in a task's Artifacts cell. The upstream template copy in claude-agents-final carries the same stale mapping and needs the same fix.
- 2026-08-16 T-006c (web-agent): return omitted the ---METRICS--- block. Work verified real by orchestrator (re-ran both suites: web 94/94, api 68/68), so recorded DONE on evidence rather than on the return's wording; noted here because the dispatch is logged as status unknown on the Layer-1 dashboard.
<!-- Discrepancies between specs and code, noted by sub-agents in their return summaries. -->
<!-- Orchestrator resolves: minor → cleanup task; significant → route to agent; spec outdated → update spec. -->
| Date | Agent | Feature | Issue | File |
|------|-------|---------|-------|------|
