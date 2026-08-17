# TC-36: Internal refs never render — no draft-ref tokens, no raw uuids in message strings

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-36 |
| Feature | F-001 (voice-assistant-view) |
| Platform | api |
| Acceptance criteria | AC-4 |
| Type | security |
| Priority | P1 |
| Status | active |
| Automation | in-progress |
| Automation file | qa/assistant/automation/api/F-001-voice-assistant-view.spec.ts |
| Created | 2026-08-16 by qa-api-agent |
| Last updated | 2026-08-16 by qa-api-agent |

## Summary
The spec-mandated internal-ref fixture row (Test strategy, AC-4 / UC-52 AC-52.10): rows and messages carry the user's words and **real task titles** — draft-ref tokens (`#d1` style) exist nowhere in the API, and rendered message strings (titles, options, outcome texts, heard transcripts, boundary titles) never contain raw task uuids. Uuids may appear only in documented **identifier** fields (`task_id`, `changed_task_ids`, `turn_id`, ...).

## Preconditions
- User `QAAPI-U1`, seeded `qaapi-draft-report`; fixture row UT-INTREF-1 (utterance itself carries `#d1`; interpretation resolves internally by uuid).

## Test steps
| # | Method | Path | Headers | Body | Expected status | Assertions |
|---|--------|------|---------|------|-----------------|------------|
| 1 | POST | /assistant/turn | X-User-Id: {U1} | `{transcript: "rename #d1 to qaapi-final-report", client_turn_id: {id1}, session_id: null, source: "voice"}` | 200 | applied; scan every **string-typed rendering field** of the response: no regex match for `#d\d+` and no uuid-pattern match outside documented id fields; diff `old/new` carry field values (titles), attribution via `task_id` field only |
| 2 | POST | /assistant/turn | X-User-Id: {U1} | UT-DELETE-BULK-3 over 3 seeded tasks | 200 | `question.task_titles` are titles; `question.options` literal texts contain no uuids/`#d` tokens |
| 3 | GET | /assistant/session | X-User-Id: {U1} | — | 200 | full-history sweep: serialize, extract all string values of rendering fields (`task_titles`, `options`, `heard_transcript`, `created_titles`, `deleted_titles`, `alternative`, transcripts), assert zero `#d\d+` and zero stray uuid matches |
| 4 | — | after TC-29-style close | X-User-Id: {U1} | — | 200 | boundary `declined_questions[].task_titles` — same sweep on the boundary payload |

## Expected behaviour
`transcript_raw` legitimately echoes the user's own `#d1` (their words are preserved — AC-23); the assertion targets **assistant-rendered** fields, not the user's transcript. Automation encodes that distinction explicitly.

## Test data
| Field | Value |
|-------|-------|
| user | QAAPI-U1 |
| utterance | UT-INTREF-1 |
| patterns | `/#d\d+/`, uuid v4 regex applied to rendering fields only |

## Notes
AC-4 is tagged (web, mobile) in the spec, but its "internal refs never render" clause is enforced at the wire by the contract's Conventions — this TC pins the api half the fixture table mandates; UI halves belong to qa-web/mobile.
