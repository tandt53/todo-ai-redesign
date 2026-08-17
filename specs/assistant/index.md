# Module: assistant — Feature Index

Voice conversation that manages the todo list. See `MANIFEST.md ## Modules`.

| ID | Feature | Slug | Status | Spec |
|----|---------|------|--------|------|
| F-001 | Voice-first assistant view | voice-assistant-view | draft | [F-001-voice-assistant-view.md](F-001-voice-assistant-view.md) |
| F-002 | Talk-back (speech output) | talk-back | draft | [F-002-talk-back.md](F-002-talk-back.md) |
| F-003 | Mobile (React Native) assistant surface | mobile-surface | draft | [F-003-mobile-surface.md](F-003-mobile-surface.md) |

**F-002 is written** (2026-08-17, **revision 3** — the closing revision after Gate 1 round 2; the round cap is 2 and is reached, so revision 3 closes the gate **unreviewed**). It discharges the reservation this row previously held: talk-back / speech output (UC-20) was the binding commitment from F-001's Gate 1 decision D1, and it lands on both clients at once. It carries UC-20's minimal scope — reads, can be turned off, no barge-in and no resume-where-cut. **Three product-owner decisions dated 2026-08-17 are written into it**: talk-back is content rather than incidental sound (the ringer does not silence it), iOS Safari's gesture refusal is surfaced, and a spoken destructive confirmation must name the tasks it will delete. Two consequences of those decisions were not part of the questions asked and remain open in the spec (OQ1b, OQ6). Downstream: `design/_shared/components.md ## Spoken frames` carries the frame catalogue's IDs and slot contracts with its **wording not yet written** — design-agent owns it, and F-002 AC-22's parse test depends on it.

**F-004 is reserved, not committed** — for the spoken day summary (UC-20 AC-20.6), "what's on today" read from local data, no model, working offline. It is excluded from F-002 with reasons. Product-agent's Gate 1 finding is that F-002's spoken surface is exactly empty offline and that F-004 is what would carry that leg of ADR-11's market position — **a finding, not a product-owner decision.** Unlike F-002, which F-001's Gate 1 decision D1 made binding in writing, **nothing commits anyone to building F-004**; whether and when it happens is an open call for the owner. The id is reserved only so it is not reused.
