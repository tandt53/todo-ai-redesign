# Project Status
<!-- Orchestrator reads this every session. Sub-agents do NOT read it. -->
<!-- Orchestrator updates it from sub-agent return summaries. -->
<!-- Keep under 100 lines. This is a live snapshot, not history. -->

## Last Updated
- **By**: [agent-name]
- **At**: [timestamp]
- **Session**: [brief note]

---

## Phase
<!-- Current phase of development -->
`DISCOVERY` | `DESIGN` | `ARCHITECTURE` | `BUILD` | `VALIDATE` | `SHIP`

**Current**: DISCOVERY

---

## In-Flight
<!-- Orchestrator's working set: sub-agents currently dispatched. -->
<!-- Rule: orchestrator does not spawn two sub-agents whose {src}/{module}/ subtrees overlap. -->

| Task ID | Agent | Module | Feature | Subtree | Dispatched |
|---------|-------|--------|---------|---------|------------|
| T-143 | spec-agent | assistant | F-005 | specs/assistant/ | 2026-08-18 |
<!-- Example:
-->
| — | — | — | — | — | — |

---

## Blockers
<!-- Anything stopping progress. Orchestrator resolves these. -->

| ID | Description | Waiting On | Raised By |
|----|-------------|-----------|----------|
| — | — | — | — |

---

## Handover

**Start here: [reports/HANDOVER-2026-08-18.md](../../reports/HANDOVER-2026-08-18.md).** Sessions before 2026-08-19 ran from a different repository; that file carries the day's four owner decisions, F-005's Gate 1 verdict (REJECT, 20 HIGH), the six open questions still owed an answer, and the queue rows whose premises went stale the same day. **Next action: T-143.**

---

## Agent Results
<!-- Sub-agents return summaries; orchestrator records them here. -->
<!-- Recent entries only — archive old results when the file grows. -->
| Date | Agent | Task | Status | Summary | Next Action |
|------|-------|------|--------|---------|-------------|

---

## Drift Log
- 2026-08-17 two `tradeoff:` items are still being carried forward in qa-mobile-agent's returns but are STALE — verified closed by the orchestrator: the `Announcer` port IS in specs/_shared/platform/mobile.md (added T-027, lines 16-17,25) and the permission copy IS in design/_shared/components.md (moved T-030, extended T-033). Agents carry their own unresolved lists forward without re-checking; a future reviewer should not chase these.
- 2026-08-17 orchestrator created the repo's baseline commit b83d9c6 (441 files) to close LEARNINGS L-001: with zero commits, suite-can-fail.sh's `git checkout --` restore is a no-op on untracked files, so C12 reported PASS while leaving source mutated on four consecutive reviews. Verified the fix by mutating and restoring permissions.ts. .playwright-cli/ (5.1MB of console logs and screenshots) added to .gitignore rather than committed.
- 2026-08-17 orchestrator edited .claude/tools/design-check/testid-contract.sh (C14): ATTR regex now recognises resource-id and no longer treats contentDescription as an identity attribute, per F-003 AC-12's pinned rule. Tooling infra, not a task artifact — recorded here rather than in a task's Artifacts cell. The upstream template copy in claude-agents-final carries the same stale mapping and needs the same fix.
- 2026-08-16 T-006c (web-agent): return omitted the ---METRICS--- block. Work verified real by orchestrator (re-ran both suites: web 94/94, api 68/68), so recorded DONE on evidence rather than on the return's wording; noted here because the dispatch is logged as status unknown on the Layer-1 dashboard.
<!-- Discrepancies between specs and code, noted by sub-agents in their return summaries. -->
<!-- Orchestrator resolves: minor → cleanup task; significant → route to agent; spec outdated → update spec. -->
| Date | Agent | Feature | Issue | File |
|------|-------|---------|-------|------|
