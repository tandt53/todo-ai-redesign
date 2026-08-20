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
<!-- Example:
| T-042 | web-agent | auth | F-003 | src/auth/web/ | 2026-04-07T14:22Z |
| T-043 | qa-web-agent | auth | F-003 | docs/qa/auth/F-003/web/ | 2026-04-07T14:23Z |
-->
| — | — | — | — | — | — |

---

## Blockers
<!-- Anything stopping progress. Orchestrator resolves these. -->

| ID | Description | Waiting On | Raised By |
|----|-------------|-----------|----------|
| — | — | — | — |

---

## Agent Results
<!-- Sub-agents return summaries; orchestrator records them here. -->
<!-- Recent entries only — archive old results when the file grows. -->
| Date | Agent | Task | Status | Summary | Next Action |
|------|-------|------|--------|---------|-------------|

---

## Drift Log
<!-- Discrepancies between specs and code, noted by sub-agents in their return summaries. -->
<!-- Orchestrator resolves: minor → cleanup task; significant → route to agent; spec outdated → update spec. -->
| Date | Agent | Feature | Issue | File |
|------|-------|---------|-------|------|
