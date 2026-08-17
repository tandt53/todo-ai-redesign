# TC-12: Ambiguous reference — clarify question with real candidates, zero mutation, tap answer

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-12 |
| Feature | F-001 (voice-assistant-view) |
| Platform | api |
| Acceptance criteria | AC-13 |
| Type | happy |
| Priority | P1 |
| Status | active |
| Automation | in-progress |
| Automation file | qa/assistant/automation/api/F-001-voice-assistant-view.spec.ts |
| Created | 2026-08-16 by qa-api-agent |
| Last updated | 2026-08-16 by qa-api-agent |

## Summary
A reference matching ≥ 2 tasks gets a clarify-question message presenting the **actual candidates** (real titles, not invented); no data changes until answered; answering by tap sends the option's literal text as a normal turn under AC-10's one-shot binding.

## Preconditions
- User `QAAPI-U1`, seeded `qaapi-report-q3` and `qaapi-report-q4`.

## Test steps
| # | Method | Path | Headers | Body | Expected status | Assertions |
|---|--------|------|---------|------|-----------------|------------|
| 1 | POST | /assistant/turn | X-User-Id: {U1} | `{transcript: "delete the report task", client_turn_id: {id1}, session_id: null, source: "voice"}` (UT-CLARIFY-1) | 200 | `turn.status: "asked"`, `question.kind: "clarify"`, `question.task_titles` == both real titles, `question.options` are literal texts, `question.ask_snapshot` captured; `changed_task_ids == []` |
| 2 | GET | /tasks | X-User-Id: {U1} | — | 200 | both report tasks untouched — no data changed until answered |
| 3 | POST | /assistant/turn | X-User-Id: {U1} | tap: `{transcript: {options[0] verbatim}, source: "tap", answer_to_turn_id: {qid}, client_turn_id: {id2}}` | 200 | resolution executes against the chosen candidate only: exactly one report task deleted, named in the executed outcome |
| 4 | GET | /tasks | X-User-Id: {U1} | — | 200 | the un-chosen report task still present |

## Expected behaviour
Clarify follows the same D2 machinery as confirm (one-shot, supersede-able — supersede variant in TC-07 step 4). Candidates are the actual matching tasks; a single-match reference must NOT clarify (covered by TC-04's immediate apply — equivalence boundary 1 vs 2 matches).

## Test data
| Field | Value |
|-------|-------|
| user | QAAPI-U1 |
| utterance | UT-CLARIFY-1; tap answer = question.options[0] verbatim |

## Notes
The tap's transcript comes from the returned `question.options` — the test must not invent option text (ethos §9).
