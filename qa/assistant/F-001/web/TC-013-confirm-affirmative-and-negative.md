# TC-013: Question resolution — affirmative executes (full applied anatomy), negative declines

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-013 |
| Feature | F-001 (voice-assistant-view) |
| Platform | web |
| Acceptance criteria | AC-10, AC-11, AC-5 |
| Type | happy |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | tests/assistant/e2e/F-001-voice-assistant-view.spec.ts |
| Created | 2026-08-16 by qa-web-agent |
| Last updated | 2026-08-17 by qa-web-agent (T-070b — ADR-008 English copy sync) |

## Summary
Decision-table rows for D2 resolution at the web layer: (a) tap affirm chip → delete executes with the FULL applied-message anatomy (rows marked, actual count and titles, Undo — AC-11's executed clause); (b) tap negative chip → visible declined outcome, nothing deleted; (c) typed affirmative and (d) typed negative behave identically to taps (the answer travels as a normal turn). The pending question blocks nothing meanwhile.

## Decision table
| Answer channel | Answer class | Expected |
|---|---|---|
| tap `assistant-chip-affirm` | affirmative | executed: tasks deleted, applied anatomy + Undo |
| tap `assistant-chip-negative` | negative | declined: visible outcome, zero deletion |
| typed "yes, delete them" | affirmative | executed (same as tap) |
| typed "no, keep them" | negative | declined (same as tap) |

## Preconditions
- Open session per row. User `qaweb-tc013@qa.example.com`; baseline seed tasks; pending bulk-delete question over 3 named tasks (TC-002 setup).
- Stub: answers are normal `POST /assistant/turn` turns; tap rows carry `answer_to_turn_id`; `resolutions[]` per api-contracts. Answer classification comes from the canonical fixture table rows (affirmative/negative), per spec Test strategy.

## Test steps
1. Row a: tap the affirm chip. Verify the request sent the chip's literal text as transcript with `source: "tap"` + explicit binding. Read outcome + list.
2. Row b (fresh question): tap the negative chip. Read outcome + list.
3. Rows c/d (fresh questions): type the answers and send. Read outcome + list.
4. Before answering in row a, verify non-blocking: toggle a checkbox by hand and confirm it works while the question is pending (AC-11).

## Expected behaviour
- **Executed rows**: outcome message with actual count + titles; the 3 rows leave the list; `assistant-undo-button` on the executed outcome (AC-5 applies unchanged); question bubble renders resolved (chips disabled per mockup resolved shape).
- **Declined rows**: visible declined outcome ("Kept all 3 tasks" shape, body "Nothing was deleted."); all 3 rows remain; no undo button (nothing applied).
- **Nothing resolves silently** (AC-11): every row ends with an outcome message.
- **Non-blocking**: manual checkbox toggle succeeds while the question is pending; list, edits, other commands all live.

## Test data
| Field | Value |
|-------|-------|
| user | qaweb-tc013@qa.example.com |
| answers | canonical fixture table affirmative/negative rows (web mirror `WEB-A1`…`WEB-A4`) |

## Notes
Tap = the option's literal text as a normal turn (UC-54 AC-54.7) — the automation asserts the wire shape, not just the UI result.
