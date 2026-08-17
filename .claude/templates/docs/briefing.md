# Task Briefing
<!-- Written by orchestrator, OVERWRITTEN on every dispatch. -->
<!-- DELIVERY: this content is concatenated into the agent's dispatch prompt. The -->
<!-- file on disk is a debugging artifact — agents are told to use the inlined -->
<!-- copy, because parallel dispatch makes the file's contents unreliable. -->
<!-- This is NOT history — it's the current dispatch contract. -->
<!-- Previous briefings are lost. If audit trail is needed, move to briefings/ directory. -->

**Task:** T-{id} — {title}
**Agent:** {agent-name}
**Module:** {module}
**Feature:** F-{id} ({slug}) — or "cross-cutting" for _shared work
**Phase:** {for QA agents: author | execute. For others: omit or "implement"}
**Dispatched:** {YYYY-MM-DDTHH:MMZ}

## Read these files first (in order, only these)

1. {path} — {why: e.g. "your feature spec"}
2. {path} — {why: e.g. "API contracts for the endpoints this feature uses"}
3. {path} — {why: e.g. "web platform conventions"}
4. {path} — {why: e.g. "design screen for this feature — also the testid contract"}
5. {path} — {why: e.g. "pattern reference — existing file in the same module/platform"}

<!-- 3-7 files. More than 7 means the task is too big or you're over-briefing. -->
<!-- TASK INPUTS ONLY. The agent's protocol reads (_ethos, _completion-protocol,
     and its role-specific ones) are declared in the agent's own
     "## Required reads" section — they are separate from this budget and the
     agent reads them whether or not they appear here. -->

## Return contract

End your return with the `---METRICS---` block from `agents/_completion-protocol.md`.
`status:` must be one of DONE | PARTIAL | BLOCKED (gate agents: APPROVE | REJECT).
A return without the block cannot be routed and is recorded as `status: unknown`.

## Write to

- {path} — {what: e.g. "new component"}
- {path} — {what: e.g. "colocated unit tests"}

## Do not read

- Other modules ({list} — not relevant to this task)
- {specific file} — {reason: e.g. "architecture doc, not needed for this UI task"}
- Files in src/ (for QA agents: tests must come from the spec, not the code)

## Context summary

{One paragraph from the orchestrator summarizing what the sub-agent needs to know:
 how many ACs, what's already implemented, what's blocking, what changed since last dispatch.
 Keep it under 100 words — the agent will read the full files listed above.}

## Memory tags

{Comma-separated tags for the agent to grep in memory/MEMORY.md during Layer 3 retrieval.
 e.g. "auth, password, reset, session, token"}

## Update on completion

- Append your output files to F-{id}'s `## Links.{relevant field}` list
- Return your structured summary (see agents/_completion-protocol.md)
- Include `memory_read:` and `memory_entry:` fields in your summary if applicable
