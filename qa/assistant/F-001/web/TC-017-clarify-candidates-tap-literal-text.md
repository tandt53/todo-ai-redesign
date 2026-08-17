# TC-017: Clarify question — real candidates as chips; tap sends the option's literal text

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-017 |
| Feature | F-001 (voice-assistant-view) |
| Platform | web |
| Acceptance criteria | AC-13, AC-1 |
| Type | happy |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | qa/assistant/automation/e2e/F-001-voice-assistant-view.spec.ts |
| Created | 2026-08-16 by qa-web-agent |
| Last updated | 2026-08-16 by qa-web-agent |

## Summary
A reference matching ≥ 2 tasks gets a clarify-question message presenting the ACTUAL candidates (real task titles, not placeholders); no data changes until answered; answering works by tap (the option's literal text as a normal turn), voice, or typing under AC-10's one-shot binding rules.

## Preconditions
- Open session. User `qaweb-tc017@qa.example.com`; baseline seed tasks with two "meeting"-matching tasks ("qaweb Team standup", "qaweb 1:1 with Ha").
- Turn stub: two-match reference → `asked` + `question {kind: clarify, options}` carrying the two real candidates; tap answer → applied turn on the chosen task.

## Test steps
1. Send "cancel the qaweb meeting" (fixture `WEB-U5`).
2. Read the clarify bubble and its `assistant-option-chip` chips; snapshot the list.
3. Tap the first candidate chip. Inspect the outgoing request. Read the outcome and the list.
4. Fresh question: answer by TYPING the candidate's text instead. Read the outcome.

## Expected behaviour
- **Candidates are real**: each chip's text matches an actual seeded task (title + disambiguating meta per mockup, e.g. "qaweb Team standup — 9:30 AM"); exactly the matching candidates render — no invented option.
- **No mutation until answered**: after step 2 the list equals its snapshot.
- **Tap = literal text**: the tap sends a normal `POST /assistant/turn` whose `transcript` is the chip's literal text, `source: "tap"`, with explicit `answer_to_turn_id` binding (api-contracts).
- **Resolution**: the chosen task's change applies with full applied anatomy (marked row, diff/outcome, Undo); the clarify bubble renders resolved; typed answer path (step 4) reaches the same outcome.

## Test data
| Field | Value |
|-------|-------|
| user | qaweb-tc017@qa.example.com |
| utterance | fixture row `WEB-U5` (two-match reference) |

## Notes
Supersede-on-clarify is covered in TC-014 step 3. UC-08's edge table beyond two candidates is api-layer scope.
