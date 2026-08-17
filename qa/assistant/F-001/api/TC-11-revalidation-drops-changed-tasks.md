# TC-11: Affirmative re-validation — changed/deleted tasks dropped, actual count named

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-11 |
| Feature | F-001 (voice-assistant-view) |
| Platform | api |
| Acceptance criteria | AC-12, AC-10 |
| Type | edge |
| Priority | P1 |
| Status | active |
| Automation | in-progress |
| Automation file | qa/assistant/automation/api/F-001-voice-assistant-view.spec.ts |
| Created | 2026-08-16 by qa-api-agent |
| Last updated | 2026-08-16 by qa-api-agent |

## Summary
On an affirmative, the server re-validates the named tasks against the **ask-time snapshot** (`question.ask_snapshot`, AC-7's snapshot-comparison rule): tasks deleted or modified since the question was asked are dropped from the delete, and the executed outcome states the **actual** count and names — not the asked count.

## Preconditions
- User `QAAPI-U1`, seeded `qaapi-shop-eggs`, `qaapi-shop-bread`, `qaapi-shop-cheese`.
- Bulk-delete question asked over all 3 (UT-DELETE-BULK-3, turn `{qid}`).

## Test steps
| # | Method | Path | Headers | Body | Expected status | Assertions |
|---|--------|------|---------|------|-----------------|------------|
| 1 | PATCH | /tasks/{id of qaapi-shop-bread} | X-User-Id: {U1} | `{title: "qaapi-shop-bread-URGENT"}` | 200 | manual edit while question pending (pending question blocks nothing) |
| 2 | DELETE | /tasks/{id of qaapi-shop-cheese} | X-User-Id: {U1} | — | 200 | manual delete while question pending |
| 3 | POST | /assistant/turn | X-User-Id: {U1} | `{transcript: "yes", client_turn_id: {id2}, session_id: {sid}, source: "voice"}` (UT-ANS-YES-1) | 200 | `result: "executed"`; executed anatomy names **only** `qaapi-shop-eggs` (actual count 1); bread (modified) and cheese (already deleted) reported as dropped, by name |
| 4 | GET | /tasks | X-User-Id: {U1} | — | 200 | `qaapi-shop-eggs` deleted; `qaapi-shop-bread-URGENT` **still present and unmodified** — the affirmative did not delete a changed task |

## Expected behaviour
Snapshot comparison against ask-time state (AC-12 ↔ AC-7's rule): modified ⇒ dropped; already-deleted ⇒ dropped; outcome is honest about what actually happened. The false-green: an implementation deleting by stale id list would remove the renamed bread task — step 4 catches it.

## Test data
| Field | Value |
|-------|-------|
| user | QAAPI-U1 |
| flow | UT-DELETE-BULK-3 → manual PATCH + DELETE → UT-ANS-YES-1 |

## Notes
Boundary sub-case: if **all** named tasks changed, the executed outcome must state actual count 0 (nothing deleted) — asserted as a variant in automation.
