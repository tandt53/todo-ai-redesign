# TC-31: Resuming an open session — full history in seq order

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-31 |
| Feature | F-001 (voice-assistant-view) |
| Platform | api |
| Acceptance criteria | AC-28, AC-23 |
| Type | happy |
| Priority | P1 |
| Status | active |
| Automation | in-progress |
| Automation file | qa/assistant/automation/api/F-001-voice-assistant-view.spec.ts |
| Created | 2026-08-16 by qa-api-agent |
| Last updated | 2026-08-16 by qa-api-agent |

## Summary
Reopening an open session resumes it visibly (AC-28): `GET /assistant/session` inside the idle window returns the same session with `messages: Turn[]` in `seq` order, including asked turns with pending questions and **failed** turns with their transcripts (AC-23 — history keeps the words). `boundary` is null while a session is open.

## Preconditions
- User `QAAPI-U3`; one open session containing, in order: applied turn, failed turn (UT-FAIL-1), asked turn (pending question). Clock advanced < 180 s.

## Test steps
| # | Method | Path | Headers | Body | Expected status | Assertions |
|---|--------|------|---------|------|-----------------|------------|
| 1 | GET | /assistant/session | X-User-Id: {U3} | — | 200 | `session.id` == the open session; `boundary: null`; `messages` length 3, `seq` strictly increasing, order == send order |
| 2 | — | inspect messages | — | — | — | applied turn carries outcome + diff; failed turn carries `status: "failed"` + `transcript_raw`; asked turn carries `question` with `resolution: null` |
| 3 | POST | /assistant/turn | X-User-Id: {U3} | new turn, `session_id: null` | 200 | resumes the **same** session (`session_id` unchanged) — null means resume-open, not new (contract rule 1) |

## Expected behaviour
One open conversation per account (ADR-005); resume is a read, not a re-open. Undo affordance and pending questions "reappear per their own rules" because the data they render from is all present in this response.

## Test data
| Field | Value |
|-------|-------|
| user | QAAPI-U3 |
| flow | seed 3-turn session → GET → POST resume |

## Notes
This is the api-side anchor for mobile's AC-27 (kill-while-thinking recovery reads exactly this endpoint).
