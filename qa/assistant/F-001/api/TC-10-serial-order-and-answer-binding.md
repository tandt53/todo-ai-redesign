# TC-10: Serial receipt order and answer binding — unclassifiable does not supersede, explicit tap binding executes

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-10 |
| Feature | F-001 (voice-assistant-view) |
| Platform | api |
| Acceptance criteria | AC-10 |
| Type | edge |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | qa/assistant/automation/api/F-001-voice-assistant-view.spec.ts |
| Created | 2026-08-16 by qa-api-agent |
| Last updated | 2026-08-17 by qa-api-agent |

## Summary
The server processes a session's turns **serially in receipt order** (AC-10, contract preamble): `seq` is strictly increasing in receipt order even for near-simultaneous sends. Binding rules: an **unclassifiable** utterance does not resolve or supersede the pending question (unlike an interpretable command, TC-07), so the question is still pending afterwards; a tap answer carrying `answer_to_turn_id` binds explicitly to that question and executes it.

> **Scenario revised 2026-08-17 (T-009b), no coverage lost:** this TC originally staged **two simultaneously pending questions** (Q1 bulk_delete, then Q2 clarify) to prove tap-binding could reach the older one. That state is unreachable against a contract-correct server: asking Q2 is itself an unrelated interpretable command, so D2/AC-10 makes it supersede Q1 the moment it is asked (the spec frames "the pending question" as singular throughout). The old step 3 therefore landed on `already_resolved`, and its assertion — which checked only `question_turn_id`, never `result` — passed anyway: a false green. The steps below assert the same binding mechanism on a reachable state, now checking the full resolution object.

## Preconditions
- User `QAAPI-U1`; seeded `qaapi-shop-eggs`, `qaapi-shop-bread`, `qaapi-shop-cheese`.
- One bulk-delete question pending over all 3 (UT-DELETE-BULK-3, asked turn `{q1}`, session `{sid}`).

## Test steps
| # | Method | Path | Headers | Body | Expected status | Assertions |
|---|--------|------|---------|------|-----------------|------------|
| 1 | POST | /assistant/turn | X-User-Id: {U1} | `{transcript: "hmm maybe", client_turn_id: {idA}, session_id: {sid}, source: "voice"}` (UT-ANS-AMBIG-1) | 200 | `outcome.kind: "unclassifiable"`; **no** resolution recorded — an unclassifiable utterance neither resolves nor supersedes (contrast TC-07's interpretable command) |
| 2 | GET | /assistant/session | X-User-Id: {U1} | — | 200 | `{q1}`'s `question.resolution` is still `null` — genuinely pending, no timeout |
| 3 | POST | /assistant/turn | X-User-Id: {U1} | tap answer: `{transcript: {q1's `question.options[0]` verbatim}, source: "tap", answer_to_turn_id: {q1}, client_turn_id: {idB}}` | 200 | explicit binding reaches `{q1}` and **executes** it: `resolutions == [{question_turn_id: {q1}, result: "executed"}]` — the full object, not just the id |
| 4 | GET | /tasks | X-User-Id: {U1} | — | 200 | all 3 questioned tasks deleted (zero remaining) — the tap genuinely executed, not `already_resolved` |
| 5 | GET | /assistant/session | X-User-Id: {U1} | — | 200 | `seq` values across the session are strictly increasing and match receipt order |
| 6 | POST ×3 (fired concurrently) | /assistant/turn | X-User-Id: {U1} | three distinct create turns, distinct `client_turn_id`s | 200 ×3 | serial processing under concurrency: each applies **exactly once** (3 tasks total), `seq` strictly increasing in receipt order |

## Expected behaviour
Unclassifiable ≠ supersede (AC-10's distinct outcome); tap → its explicit `answer_to_turn_id`; serial processing gives one deterministic receipt order for the whole session (account-scoped, ADR-005 — two devices interleave into this same order).

Voice/typed binding to "the newest unresolved question" still holds and is covered where it is reachable — with at most one question pending at a time, "newest unresolved" is that question: TC-05 (affirmative), TC-06 (negative), TC-08 (unclassifiable then affirmative).

## Test data
| Field | Value |
|-------|-------|
| user | QAAPI-U1 |
| flow | Q1 bulk_delete → UT-ANS-AMBIG-1 (no supersede) → tap w/ answer_to_turn_id → 3 concurrent creates |

## Notes
Concurrency probe (§3.9-4) for ordering; the same-id concurrency probe is TC-28. The step-3 tap uses the literal option text read back from `{q1}`'s `question.options` — never invented text (ethos §9). The one-shot / late-answer path (a tap arriving after resolution → `already_resolved`) is TC-09.
