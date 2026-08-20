# TC-040: The affordance distinguishes "waiting on you" from "something arrived"

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-040 |
| Feature | F-001 (voice-assistant-view) |
| Platform | web |
| Acceptance criteria | AC-30 |
| Type | happy |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | tests/assistant/e2e/F-001-voice-assistant-view.spec.ts |
| Created | 2026-08-17 by qa-web-agent |
| Last updated | 2026-08-17 by qa-web-agent |

## Summary
Clause (e) is the load-bearing clause of AC-30 and the AC says why. Because the bulk-delete confirmation was knowingly given **no** priority (owner decision, rule 5), a user who has scrolled up can be asked *"Delete 3 tasks?"* and never see it; the app then waits on an answer whose only indication is this one control. A label that read the same whether the app was idle or blocked would spend that consistency and return nothing.

So the two states must be **distinguishable** — to a sighted user and through the accessible name on AC-19's announcement path. This case drives both states on one surface and compares them: label, accent, accessible name.

## Preconditions
- Fresh account `qaweb-tc040-{run}-*@qa.example.com` seeded with `qaweb AC30 Q A|B|C`, overflowing conversation, surface at the bottom.
- QA harness rows `qaweb ac30 slow one` (ordinary create) and `qaweb ac30 slow confirm` (3 targets → asks, AC-9).

## Test steps (web)
1. Build an overflowing conversation; leave it at the bottom.
2. Submit `qaweb ac30 slow one`; park at the top; wait for the arrival. **NMA-NEW.**
3. Read the pill's visible text, its `aria-label`, and its computed border colour.
4. Submit `qaweb ac30 slow confirm`; park at the top again; wait for the question to land below the fold. **NMA-WAITING.**
5. Read the same three properties again, and the affordance count.
6. Activate the pill and check the question is still unanswered.

## Expected behaviour
- **NMA-NEW** carries the count label published by `docs/design/_shared/components.md` §NewMessageAffordance (`1 new message`), an accessible name of `{label}, scroll to newest`, and a border that is **not** the `question` accent.
- **NMA-WAITING** carries `Waiting for your answer — {question}` where `{question}` is the pending question's own head, verbatim (`Delete 3 tasks?`), an accessible name of `{label} Scroll to newest`, and the published `question` accent from `docs/design/_shared/tokens.json`.
- The two labels differ, and the two accents differ. Colour never carries it alone: the words change too.
- Still exactly **one** control — same position, same action, only the words and the accent change.
- Activating it **only scrolls**: the question is still pending, both OptionChips are still present. The pill must never become a second, quieter answer path.

## Test data
| Field | Value |
|-------|-------|
| user | qaweb-tc040-{run}-*@qa.example.com |
| seeded tasks | `qaweb AC30 Q A`, `qaweb AC30 Q B`, `qaweb AC30 Q C` |
| expected copy | parsed at run time from `docs/design/_shared/components.md` §NewMessageAffordance |
| expected accent | parsed at run time from `docs/design/_shared/tokens.json` (`color.*.question`) |

## Notes
The expected strings are **parsed from the owning design artifact at run time**, not retyped here (L-008). A hand-transcribed expectation turns a contract check into a self-agreement check: design and the implementation can drift apart while both halves of the test still agree with each other. The parser fails loudly if it matches nothing, because a parser that silently matches nothing is green in exactly the same way as a parser that works (L-007).
