# TC-06: Negative answer declines — zero deletion, visible declined outcome

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-06 |
| Feature | F-001 (voice-assistant-view) |
| Platform | api |
| Acceptance criteria | AC-10 |
| Type | negative |
| Priority | P1 |
| Status | active |
| Automation | in-progress |
| Automation file | tests/assistant/api/F-001-voice-assistant-view.spec.ts |
| Created | 2026-08-16 by qa-api-agent |
| Last updated | 2026-08-16 by qa-api-agent |

## Summary
A negative answer declines the questioned bulk delete: nothing is deleted, the outcome is visible (`result: "declined"`), and the question is resolved one-shot (a later "yes" cannot revive it — that path is TC-09).

## Preconditions
- User `QAAPI-U1`, 3 `qaapi-shop-*` tasks seeded, bulk-delete question pending (asked turn `{qid}`).

## Test steps
| # | Method | Path | Headers | Body | Expected status | Assertions |
|---|--------|------|---------|------|-----------------|------------|
| 1 | POST | /assistant/turn | X-User-Id: {U1} | `{transcript: "no", client_turn_id: {id2}, session_id: {sid}, source: "voice"}` (UT-ANS-NO-1) | 200 | `outcome.kind: "resolution"`, `outcome.result: "declined"`, `resolutions == [{question_turn_id: {qid}, result: "declined"}]`, no `executed` payload |
| 2 | GET | /tasks | X-User-Id: {U1} | — | 200 | all 3 `qaapi-shop-*` tasks still present, unmodified |
| 3 | GET | /assistant/session | X-User-Id: {U1} | — | 200 | asked turn shows `question.resolution.result: "declined"` |
| 4 | — | repeat 1–3 with `"không"` (UT-ANS-NO-2) against a fresh question | — | — | Vietnamese negative: same class, same behaviour |

## Expected behaviour
Negative → decline, nothing resolves silently (AC-11's api-visible half: the resolution outcome exists in the response and in session history). Zero task mutations.

## Test data
| Field | Value |
|-------|-------|
| user | QAAPI-U1 |
| utterances | UT-DELETE-BULK-3 → UT-ANS-NO-1 / UT-ANS-NO-2 |

## Notes
Decision-table row 2 of the D2 resolution table (affirmative / negative / supersede / unclassifiable / close — TC-05/06/07/08/30).
