# TC-039: Three arrivals below the fold produce exactly one affordance, and it never re-mounts

## Metadata
| Field | Value |
|-------|-------|
| ID | TC-039 |
| Feature | F-001 (voice-assistant-view) |
| Platform | web |
| Acceptance criteria | AC-30 |
| Type | boundary |
| Priority | P1 |
| Status | active |
| Automation | automated |
| Automation file | qa/assistant/automation/e2e/F-001-voice-assistant-view.spec.ts |
| Created | 2026-08-17 by qa-web-agent |
| Last updated | 2026-08-17 by qa-web-agent |

## Summary
Clause (d) is a **count**, and the AC says so in those words: after N ≥ 2 messages arrive while the user is away from the bottom, the number of affordance nodes on the surface equals **one**. The owner decision states the same rule from the product side — "five messages arriving while the user reads produce the same one affordance, not five".

The count is taken after **each** arrival, not only at the end. A suite that counts once at the end cannot tell one affordance that persisted from N that stacked and were collapsed into one on the last render, and it is the stacking a user would see.

## Preconditions
- Fresh account `qaweb-tc039-{run}-*@qa.example.com`, overflowing conversation, surface at the bottom.
- Three **distinct** QA harness rows (`qaweb ac30 slow one|two|three`, 2500ms each). Distinct on purpose: three identical utterances produce three identical bubbles, which is indistinguishable from one bubble re-rendered — the exact confusion the count exists to resolve.

## Test steps (web)
1. Build an overflowing conversation; leave it at the bottom.
2. Submit all three slow turns back to back.
3. Wait 900ms — long enough for the last clause-(h) scroll to finish, short enough that no outcome can have landed (each takes 2500ms server-side).
4. Scroll to the top of the conversation. Assert the park is away from the bottom.
5. For each of the three arrivals in turn: wait for its task row, wait for its message bubble, then assert the affordance count is exactly 1.
6. Re-read `scroll_offset`.
7. Compare the affordance's DOM node identity against the node seen at the first arrival.

## Expected behaviour
- After arrival 1, after arrival 2 and after arrival 3: exactly **one** affordance node each time. Never zero (the arrival was missed), never two (it stacked).
- `scroll_offset` is still the parked value — three arrivals do not move a view that one arrival must not move.
- The affordance node is the **same element** across arrivals: it persists rather than unmounting and remounting. A control that re-mounts on every message re-announces itself in the `polite` live region and re-starts any entrance treatment, which is the same "five notifications" the owner rejected wearing one node.

## Test data
| Field | Value |
|-------|-------|
| user | qaweb-tc039-{run}-*@qa.example.com |
| arrivals | `qaweb ac30 slow one`, `... two`, `... three` (QA_EXTRA, 2500ms each) |

## Notes
The 2500ms delay is set by this case, not by the others: three submits cost ~800ms of real browser actionability and the last clause-(h) scroll needs ~500ms to settle, so an arrival must not be possible before ~1300ms. Measured at 1500ms, two of the three outcomes had already landed while the user was still at the bottom and the case silently stopped testing what it names — recorded in the harness file so the number is not "tuned" back down later.
