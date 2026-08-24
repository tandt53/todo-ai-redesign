# Sanctioned cross-subtree writes

Machine-read by `validate-state.sh` C6. Each row licenses **one agent to have written
one exact path on one task** — nothing wider. A sanction is not a permission for future
work: it is a record that a crossing already happened, was reviewed, and is not being
hidden by rewriting the artifact list.

`MANIFEST ## Paths.writers` states the gap this closes, in its own words:
*"The map cannot express `sanctioned once`; that is the gap, not the crossing."*

**Three rules, and the second is the one that keeps this file from becoming a back door:**

1. **Exact paths only.** No prefixes, no globs. `tests/` would license the whole tree;
   `tests/assistant/mobile/F-003-mobile-surface.spec.ts` licenses one file.
2. **A sanction is retrospective, never prospective.** If an agent has not yet done the
   work, the answer is to dispatch the agent that owns the path — not to write a row here
   first. A briefing that hands an agent a path outside its lane is the defect; this file
   records the ones already in the history, and each row must say what should have
   happened instead.
3. **Stale rows fail the build.** C6 checks that the task still names the path. A
   sanction for an artifact list that has moved on is a dead grant, and dead grants are
   how a narrow mechanism turns into a wide one.

| Task | Agent | Path | Granted | Why, and what should have happened instead |
|---|---|---|---|---|
| T-233 | mobile-agent | tests/assistant/mobile/F-003-mobile-surface.spec.ts | 2026-08-23 | The orchestrator's briefing handed an implementer a path under `{tests}/`, which belongs to qa-mobile-agent. The agent did as briefed. **Should have happened:** the spec change dispatched to qa-mobile-agent, or the briefing scoped to `{src}/` with the test change raised as a follow-up. Left as a true record rather than re-attributed — see T-282. |
| T-255 | mobile-agent | tests/assistant/mobile/F-003-mobile-surface.spec.ts | 2026-08-23 | Same file, same cause, same round: a touch-target assertion was edited by the implementer whose work it judges. That is the crossing this project most wants kept closed, which is why `mobile-agent`'s map was NOT widened to `{tests}/` to make the check pass. **Should have happened:** qa-mobile-agent taught the check to read the platform floor from `control.minTarget`. |
| T-309 | backend-agent | tests/harness/qa-doors.ts | 2026-08-23 | `GET /__qa__/raw-tasks` is a harness door and the harness doors live in this file, beside `POST /__qa__/seed`, `set-clock` and `reopen-store`. **The orchestrator briefing listed the door as in-scope and forbade writes to `tests/` in the same page** — the two could not both be satisfied, and the agent resolved it the sensible way. 20 lines, header comment updated, flagged in `files_modified` when asked. **Should have happened:** the briefing should have named this file as the exception, or routed the door to qa-api-agent as its own dispatch. The map is not widened: `{tests}/` stays qa-*-agent`s. |
| T-335 | orchestrator | tests/assistant/api/F-005-task-detail.spec.ts | 2026-08-24 | TC-33a's `WIRE_FIELDS` is a hand-maintained mirror of the contract's wire shape, and it went red the moment `sort_order` started being serialized. The test's own header says what to do — *if the extra field is in api-contracts.md it belongs here* — and `sort_order` is declared at `docs/specs/assistant/api-contracts.md:549`. One line added, no assertion weakened. **Should have happened:** the wire-shape change dispatched to qa-api-agent, which owns this file. The map is not widened: `{tests}/` stays qa-*-agent's. |
