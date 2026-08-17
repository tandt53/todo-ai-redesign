# TC-30: Explicit close — declines the pending question, never re-decides a resolved one, idempotent replay

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-30 |
| Feature | F-001 (voice-assistant-view) |
| Platform | api |
| Acceptance criteria | AC-28, AC-10 |
| Type | happy |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | qa/assistant/automation/api/F-001-voice-assistant-view.spec.ts |
| Created | 2026-08-16 by qa-api-agent |
| Last updated | 2026-08-17 by qa-api-agent |

## Summary
`POST /assistant/session/close`: closes with `close_reason: "user_closed"`, resolves the unanswered question as **declined** (D2's session-close event, AC-10), reports it in `declined_question_turn_ids`, and a second close is an idempotent no-op (`already_closed: true`). A question already resolved before the close — here, superseded — keeps its original resolution: close is the terminal event for *pending* questions only, and never overwrites a recorded one.

> **Scenario revised 2026-08-17 (T-009b), coverage strengthened:** this TC originally staged **two simultaneously pending questions** and expected close to decline both. That state is unreachable against a contract-correct server: asking the second question is itself an unrelated interpretable command, so D2/AC-10 makes it supersede the first the moment it is asked (the spec frames "the pending question" as singular throughout). The steps below keep the same close semantics and add a check the old scenario never actually made — that close leaves the already-superseded question's resolution untouched.

## Preconditions
- User `QAAPI-U1`; open session `{sid}`.
- Bulk-delete question `{q1}` asked over 3 seeded `qaapi-shop-*` tasks (UT-DELETE-BULK-3).
- `qaapi-report-q3`, `qaapi-report-q4` seeded, then clarify question `{q2}` asked (UT-CLARIFY-1) — which supersedes `{q1}` on arrival. 5 `qaapi-` tasks total.

## Test steps
| # | Method | Path | Headers | Body | Expected status | Assertions |
|---|--------|------|---------|------|-----------------|------------|
| 1 | GET | /assistant/session | X-User-Id: {U1} | — | 200 | pre-close baseline: `{q1}`'s `question.resolution.result == "declined_superseded"` (resolved by `{q2}`'s arrival); `{q2}`'s resolution is `null` — the only pending question |
| 2 | POST | /assistant/session/close | X-User-Id: {U1} | `{session_id: {sid}, reason: "user_closed"}` | 200 | `session.status: "closed"`, `close_reason: "user_closed"`, `closed_at` set; `declined_question_turn_ids == [{q2}]` — **only** the still-pending question; `already_closed: false` |
| 3 | GET | /tasks | X-User-Id: {U1} | — | 200 | all 5 `qaapi-` tasks present — declining executes nothing |
| 4 | POST | /assistant/session/close | X-User-Id: {U1} | same body | 200 | `already_closed: true` — idempotent, no state change, no second decline pass |
| 5 | GET | /assistant/session | X-User-Id: {U1} | — | 200 | `session: null`; `boundary.close_reason: "user_closed"`; `declined_questions` has exactly **1** entry, `turn_id == {q2}` — `{q1}` is not re-declined and keeps `declined_superseded` (AC-28 next-open visibility) |

## Expected behaviour
Close is the terminal resolution event for every **pending** question — visible on next open via the boundary, never silent — and is not a re-decision of questions already resolved (one-shot, AC-10). The `reason` enum only accepts `user_closed` here (`idle` is server-only — a request carrying `reason: "idle"` is a 400 VALIDATION probe in TC-34).

## Test data
| Field | Value |
|-------|-------|
| user | QAAPI-U1 |
| flow | Q1 bulk_delete → Q2 clarify (supersedes Q1) → close → replay close → boundary read |

## Notes
Cross-refs: undo-after-close refusal TC-19; boundary anatomy TC-29 step 3; the supersede rule itself TC-07. Idle-close declines (the same D2 event with `close_reason: "idle"`) are TC-29.
