# TC-13: No-match honesty — zero mutations, heard transcript quoted

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-13 |
| Feature | F-001 (voice-assistant-view) |
| Platform | api |
| Acceptance criteria | AC-14 |
| Type | negative |
| Priority | P1 |
| Status | active |
| Automation | in-progress |
| Automation file | qa/assistant/automation/api/F-001-voice-assistant-view.spec.ts |
| Created | 2026-08-16 by qa-api-agent |
| Last updated | 2026-08-16 by qa-api-agent |

## Summary
A command matching no task applies **zero task mutations** and the outcome quotes the heard transcript verbatim (`outcome.heard_transcript`) so a misheard word is distinguishable from an absent task. Bounded check per AC-14: task table unchanged, no unrelated task edited, no task created.

## Preconditions
- User `QAAPI-U1`, seeded tasks `qaapi-buy-milk`, `qaapi-report-q3` (a known baseline set); full `GET /tasks` snapshot taken.

## Test steps
| # | Method | Path | Headers | Body | Expected status | Assertions |
|---|--------|------|---------|------|-----------------|------------|
| 1 | POST | /assistant/turn | X-User-Id: {U1} | `{transcript: "delete the unicorn task", client_turn_id: {id1}, session_id: null, source: "voice"}` (UT-NOMATCH-1) | 200 | `outcome.kind: "no_match"`, `outcome.heard_transcript == "delete the unicorn task"` (verbatim, not paraphrased), `changed_task_ids == []`, `diff == []` |
| 2 | GET | /tasks | X-User-Id: {U1} | — | 200 | task list **deep-equals** the precondition snapshot: nothing deleted, nothing edited, nothing created (no invented "unicorn" task — AC-14's "assistant may not invent tasks") |

## Expected behaviour
Honesty on no-match: the response never fabricates an action; the quote is the exact `transcript` sent (which stands in for what STT heard — AC-20 means the server only ever has text).

## Test data
| Field | Value |
|-------|-------|
| user | QAAPI-U1 |
| utterance | UT-NOMATCH-1 |

## Notes
Deep-equality on the task list (not just count) is the false-green inversion: count-only would miss an edit to an unrelated task. Pinned 2026-08-16: a no_match turn is non-mutating — it captures no `undo_snapshot`, is itself `not_undoable`, and neither holds nor ends the undo window (TC-40 pins the window behaviour).
