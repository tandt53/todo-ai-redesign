# TC-034: WCAG 4.1.3 — an error is announced immediately, and exactly once

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-034 |
| Feature | F-001 (voice-assistant-view) |
| Platform | web |
| Acceptance criteria | AC-19 |
| Type | accessibility |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | tests/assistant/e2e/F-001-voice-assistant-view.spec.ts |
| Created | 2026-08-16 by qa-web-agent |
| Last updated | 2026-08-17 by qa-web-agent (T-070b — ADR-008 English copy sync) |

## Summary
AC-19's 4.1.3 clause carves out one message kind: "an error message is announced **immediately** rather than queued behind earlier output". Politeness is the difference — a `polite` announcement waits for the screen reader to finish whatever it is currently saying, which is exactly the wrong behaviour when the user's words failed to send and a retry is on offer. This TC verifies the error announces assertively, and that making it assertive did not make it announce twice.

## Preconditions
- Open session, fresh account `qaweb-tc034-*@qa.example.com`.
- The QA harness's always-failing delayed row is available (`qaweb delayed failure`, a `QA_EXTRA_ROWS` entry — the spec's sanctioned extension mechanism, Test strategy).

## Test steps
1. Before any turn, count assertive regions on the page (`getByRole('alert')`).
2. Send the always-failing utterance and wait for the error message.
3. Count assertive regions again; read the region's text and check it contains the error head and the retry control.
4. From the error bubble, resolve its **nearest** live-region ancestor in the page and read that ancestor's role.
5. Read the polite conversation log and confirm the error is still there as visible history.

## Expected behaviour
- **Nothing assertive at rest**: zero `role="alert"` regions before the failure. An always-present empty alert region is a common way to make this criterion appear satisfied while announcing nothing.
- **AC-19 (immediacy)**: after the failure exactly **one** assertive region exists, containing the error head ("Couldn't send") and the retry control ("Retry", `assistant-retry-button`).
- **AC-19 (nearest-ancestor rule)**: the error bubble's nearest live ancestor resolves to `role="alert"`, not to the surrounding polite `role="log"`. This is the assertion that actually proves immediacy: for an added node the nearest live ancestor wins, so if the alert were placed anywhere but on (or inside) the error bubble, the polite log would win and the announcement would queue behind earlier output — the precise failure the AC names.
- **Announced once, not twice**: exactly one alert region, so the error is not announced by both the alert and the enclosing log.
- **History intact**: the polite log still contains the error text, so the message remains readable in conversation history after the announcement.

## Test data
| Field | Value |
|-------|-------|
| user | qaweb-tc034-*@qa.example.com |
| utterance | `qaweb delayed failure` (QA_EXTRA row: 150 ms delay, always fails) |

## Notes
Same scope limit as TC-033: this verifies the mechanism and the politeness contract, not a real screen reader's utterance. The manual AT pass is tracked in the run record.

Falsifiability was checked: with `role="alert"` removed from the error bubble this TC fails at steps 3 and 4 while the rest of the suite stays green. See the run record's mutation-check section.
