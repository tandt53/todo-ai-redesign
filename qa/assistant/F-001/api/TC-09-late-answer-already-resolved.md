# TC-09: Late answer never executes — already_resolved outcome

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-09 |
| Feature | F-001 (voice-assistant-view) |
| Platform | api |
| Acceptance criteria | AC-10 |
| Type | edge |
| Priority | P1 |
| Status | active |
| Automation | in-progress |
| Automation file | qa/assistant/automation/api/F-001-voice-assistant-view.spec.ts |
| Created | 2026-08-16 by qa-api-agent |
| Last updated | 2026-08-16 by qa-api-agent |

## Summary
One-shot resolution (hard-won round-2 semantics): an answer arriving after its question is already resolved applies nothing — it **never** executes the questioned delete — and yields a visible `already_resolved` outcome. Probed for both prior resolutions: declined and executed.

## Preconditions
- User `QAAPI-U1`, 3 `qaapi-shop-*` tasks seeded, bulk-delete question asked (turn `{qid}`), then **declined** via UT-ANS-NO-1 (as TC-06).

## Test steps
| # | Method | Path | Headers | Body | Expected status | Assertions |
|---|--------|------|---------|------|-----------------|------------|
| 1 | POST | /assistant/turn | X-User-Id: {U1} | `{transcript: "yes", client_turn_id: {id3}, session_id: {sid}, source: "voice"}` (UT-ANS-YES-1) — after the question was declined | 200 | `outcome.kind: "resolution"`, `outcome.result: "already_resolved"`, no `executed` payload; `resolutions` reports `already_resolved` for `{qid}` |
| 2 | GET | /tasks | X-User-Id: {U1} | — | 200 | all 3 `qaapi-shop-*` tasks still present — the late "yes" deleted **nothing** |
| 3 | GET | /assistant/session | X-User-Id: {U1} | — | 200 | asked turn keeps its original `resolution.result: "declined"` — the record is immutable, not overwritten |
| 4 | POST | /assistant/turn | X-User-Id: {U1} | tap answer `{transcript: {option literal}, answer_to_turn_id: {qid}, source: "tap", client_turn_id: {id4}}` | 200 | explicit-binding late answer: same `already_resolved`, still zero mutations |

## Expected behaviour
A question resolves exactly once. A late answer — voice-bound or tap-bound — is acknowledged visibly and executes nothing. The false-green to catch: an implementation that re-runs the delete on any affirmative addressed at a known question id.

## Test data
| Field | Value |
|-------|-------|
| user | QAAPI-U1 |
| flow | UT-DELETE-BULK-3 → UT-ANS-NO-1 → UT-ANS-YES-1 (late) → tap replay |

## Notes
State-transition negative test (§3.4): `resolved → resolved` transition attempt must be rejected as already_resolved, never as a second execution.
