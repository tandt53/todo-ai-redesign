# TC-008: Parity — clarify question presents real candidates; tap sends the option's literal text

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-008 |
| Feature | F-003 (mobile-surface) |
| Platform | mobile |
| Acceptance criteria | AC-1, F-001 AC-13 |
| Type | happy |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | qa/assistant/automation/mobile/F-003-mobile-surface.spec.ts |
| Targets | ios, android |
| Tier | node-headless |
| Created | 2026-08-16 by qa-mobile-agent |
| Last updated | 2026-08-17 by qa-mobile-agent |

## Summary
A reference matching ≥ 2 tasks gets a clarify question presenting the **actual** candidates — real task titles, never invented ones — and no data changes until it is answered. Answering by tap must go through the same turn path as voice and typing: the tap sends the option's literal text with an explicit binding to the question's turn.

## Preconditions
- Account `qamob-tc008@qa.example.com`; two seeded tasks whose titles both match one reference.
- Request spy on the API client (captures `transcript`, `source`, `answer_to_turn_id`).

## Test steps
1. Issue the ambiguous command.
2. Read the clarify message, its candidate chips, and the list.
3. Tap the first `assistant-option-chip`. Read the request the client sent and the resulting outcome.
4. In a fresh session, repeat and answer by **voice** instead; then repeat and answer by **typing**.
5. In a fresh session, repeat and issue an unrelated command instead of answering.

## Expected behaviour
- The candidates rendered are the **real** matching tasks — each chip's label appears verbatim in the seeded task list (mockup `question-clarify`: chips carry title + time, e.g. `Họp nhanh đầu ngày — 9:30`). A candidate that does not correspond to a seeded task fails the test.
- No data changes while the question is pending — task table byte-identical.
- Step 3's captured request has `source: "tap"`, `transcript` equal to the chip's **literal text**, and `answer_to_turn_id` set to the asking turn's id. No hidden confirm protocol, no candidate index, no uuid in the transcript.
- Step 4: voice and typed answers carry no `answer_to_turn_id` and bind to the newest unresolved question. All three input paths reach the same outcome.
- Step 5: the clarify question is declined-superseded visibly and the unrelated command proceeds (same D2 rule as the confirm question).

## Test data
| Field | Value |
|-------|-------|
| user | qamob-tc008@qa.example.com |
| seeds | two `qamob-` tasks sharing one reference word |

## Notes
Could this pass for the wrong reason? Yes, if the assertion only checked that two chips rendered. It asserts chip label ↔ seeded title equality, so a client that renders plausible-looking placeholder candidates goes red.
