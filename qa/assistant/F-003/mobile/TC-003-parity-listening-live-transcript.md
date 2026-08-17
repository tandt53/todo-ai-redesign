# TC-003: Parity — live transcript while listening; nothing recognized returns to idle and sends no turn

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-003 |
| Feature | F-003 (mobile-surface) |
| Platform | mobile |
| Acceptance criteria | AC-1, F-001 AC-2 |
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
F-001 AC-2 holds identically on mobile: while listening, a live transcript renders as words are recognized, and listening that ends with **nothing** recognized returns to idle visibly and sends no turn. The negative half is the one that catches bugs — an empty recognition that still posts a turn creates an empty-transcript request the API contract rejects with `400 VALIDATION`.

## Preconditions
- Account `qamob-tc003@qa.example.com`; `TranscriptSource` double able to emit partial results then a final result.
- Turn-submission spy installed on the API client (counts `POST /assistant/turn` calls).

## Test steps
1. Tap `assistant-mic-button`. Assert state becomes listening and `assistant-state-indicator` reads the listening word (mockup: `Đang nghe…`).
2. Emit three partial recognition results in sequence.
3. Read the rendered transcript after each partial.
4. Reset. Tap the mic, emit **zero** partial results, end the recognition session with an empty final result.
5. Read the state, the composer, and the turn-submission spy.

## Expected behaviour
- Each partial result is rendered as it arrives — the transcript grows monotonically and the rendered text equals the latest partial exactly (no truncation, no lag by one).
- Mic accessible name changes to the listening variant while capture is live (mockup: `Đang nghe — nhấn để dừng`), and back afterwards (`Nhấn để nói`).
- Empty return: state goes back to **idle visibly** (the listening indicator is gone, not merely inert), composer is unchanged, and the turn-submission spy reads **0** — no empty-transcript request is ever put on the wire.
- No message is appended to the conversation for an empty return.

## Test data
| Field | Value |
|-------|-------|
| user | qamob-tc003@qa.example.com |
| partials | `["dời", "dời duyệt ngân sách", "dời duyệt ngân sách sang bốn giờ"]` |

## Notes
The partials use Vietnamese because the product ships Vietnamese; diacritics also probe that the transcript is carried as text, not normalized/ASCII-folded before render.
