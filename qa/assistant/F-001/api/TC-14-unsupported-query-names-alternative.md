# TC-14: List question — unsupported_query names the working alternative, zero mutations

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-14 |
| Feature | F-001 (voice-assistant-view) |
| Platform | api |
| Acceptance criteria | AC-15 |
| Type | negative |
| Priority | P1 |
| Status | active |
| Automation | in-progress |
| Automation file | qa/assistant/automation/api/F-001-voice-assistant-view.spec.ts |
| Created | 2026-08-16 by qa-api-agent |
| Last updated | 2026-08-16 by qa-api-agent |

## Summary
A question **about** the list ("what's on Sunday?") is out of scope for F-001 (no `find_tasks` engine): the assistant answers that it cannot do that yet and names the working alternative — `danh sách và bộ lọc trên màn hình` ("the on-screen list and its filters"). Zero mutations, no fabricated answer.

## Preconditions
- User `QAAPI-U1`, seeded tasks incl. one with a Sunday `due_at` (bait for a fabricated answer); `GET /tasks` snapshot taken.

## Test steps
| # | Method | Path | Headers | Body | Expected status | Assertions |
|---|--------|------|---------|------|-----------------|------------|
| 1 | POST | /assistant/turn | X-User-Id: {U1} | `{transcript: "what's on Sunday?", client_turn_id: {id1}, session_id: null, source: "voice"}` (UT-LISTQ-1) | 200 | `outcome.kind: "unsupported_query"`, `outcome.alternative == "danh sách và bộ lọc trên màn hình"` (contract-fixed string, api-contracts.md §9), `changed_task_ids == []`; the outcome does **not** contain the Sunday task's title (no fabricated answer) |
| 2 | GET | /tasks | X-User-Id: {U1} | — | 200 | deep-equals snapshot — zero mutations |

## Expected behaviour
Honest refusal with a named alternative (AC-15). Bait assertion in step 1 catches an implementation that half-answers by leaking task data into the refusal message.

## Test data
| Field | Value |
|-------|-------|
| user | QAAPI-U1 |
| utterance | UT-LISTQ-1 |
| bait | task `qaapi-sunday-brunch`, due next Sunday |

## Notes
The alternative string is pinned by data-model.md's TurnOutcome comment and api-contracts.md §9; if implementation renders a different phrasing, that is contract drift to file, not a test to weaken. Pinned 2026-08-16: an unsupported_query turn is non-mutating — no snapshot, itself `not_undoable`, window untouched (TC-40).

Re-synced 2026-08-16 (T-016b): the literal became Vietnamese in the T-015g Gate-3 localization pass. The expected value was updated because the **contract** changed and the server now agrees with it — this is a stale-test fix, not an assertion weakened to match the code. The assertion stays an exact-equality check on a verbatim literal (never imported from `src/`), so re-wording the refusal copy still fails this test.
