# Gate 1 — F-005 — consolidation, round 1

**Verdict: REJECT.** Round 1 of a cap of 2.
**HIGH 20 · MEDIUM 34 · LOW 8** across five lenses. All five read all 37 ACs and
all five returned an explicit checked-and-clean list, so the anti-theatre rule
was satisfied by every lens.

| Lens | HIGH | MED | LOW | Verdict |
|---|---|---|---|---|
| tester | 5 | 7 | 4 | DONE |
| dev | 5 | 4 | 0 | DONE |
| architect | 4 | 7 | 2 | DONE |
| product | 3 | 8 | 3 | **REJECT** |
| design | 3 | 8 | 1 | DONE |

Individual returns are preserved beside this file per **L-009**; this
consolidation is routing, and is not a substitute for them.

## Convergences — found independently by more than one lens

These are the strongest signals in the gate: no lens saw another's work.

1. **Nothing in the system can un-delete a row** — architect F2, dev F1.
   `DELETE` soft-deletes; `PATCH` 404s on a deleted row; re-`POST` 409s; the only
   un-delete reverts a *turn*, which a hand delete never creates. **`## API Touch
   Points`'s "no new assistant endpoints" is false.** Three ACs assert on the
   restore.
2. **Steps become voice-addressable handles** — architect F7, dev F5.
   The interpreter's handle list is built from a **different query** than the
   predicate the step exclusion was placed in. A task with eight steps contributes
   nine handles; "delete everything" would name step titles the user never sees.
   **Dev carried it one step further:** the message link is gated by the same
   predicate, so the assistant would report changing a task **and the link to it
   would be inert, with no explanation available.**
   And the spec's own test note asserts only the predicate — **so this passes
   green.**
3. **The dateless-repeat case has three different answers** — architect F3,
   design D6, product F8, tester T12. Two ACs and the flow diagram disagree, and
   they differ in a way the collection model makes visible: **the task is in Today
   under one reading and Upcoming under another.** Separately, the *larger* of the
   two rule-driven date changes is the *silent* one.
4. **Three ACs assert on a hand-action undo nothing defines** — tester T4,
   product F7. No lifetime, no dismissal rule, no relationship to the turn-undo
   affordance. **A step is currently the one thing in this feature you can destroy
   irreversibly.**
5. **The clock the ACs read is not the clock the harness controls** — tester T6,
   dev F8. Web-tagged date behaviour reads the **device** clock; both seams are
   server-side. *"Green until a Friday CI run."*
6. **The detail's containment is unstated and the shell has no room for it** —
   design D1, dev F6. `ShellSurface` has three values and the layout branch is a
   container query with **no width read in JavaScript**, so the detail must be one
   state CSS places at both widths — and **whichever an implementer picks, one of
   two F-001 ACs is contradicted.**
7. **The step exclusion does not reach every count** — dev F3, architect F12.
   Four live sites read the raw array, **including the one that chooses between the
   first-run and empty-collection states.** A user whose only rows are steps is
   told the collection is empty, and the a11y id set expects a row never drawn.

## Owner-decided — see `reports/owner-decision-2026-08-18-f005-gate1.md`

- **Reminders:** show passed reminders when the app opens (an option the spec did
  not contain). This was the blocking question.
- **Mobile:** web-first, with the three shared-model leaks handled in F-005.
  The question had been put on a stale premise; corrected before answering.
- **Voice:** the four value fields become reachable; structure stays hand-only.
  One fixture row per permitted field.
- **Delete:** the row delete gains the undo it never had — which makes the
  un-delete gap above mandatory to close.

## Uniquely-seen findings that would have vanished without L-009

- **design:** the spec implies ~48 surface states and names ~20 — and **amber is
  already spent**, assigned a single meaning the day before, on rows that already
  carry lateness.
- **dev:** the behaviour AC-13 forbids **is already shipped** — creating a task
  while viewing Today writes local midnight and the formatter renders it as
  "12:00 AM". Not named in any of the nine Impact subsections.
- **tester:** AC-36's refusal **cannot be exercised** — the interpretation shape
  cannot express the fields it is meant to refuse, so no fixture row can try.
  **Earliest catch is never.**
- **tester:** AC-26's invariant is **broken on purpose by AC-28**, so the honest
  assertion is red on a sibling's own path.
- **dev:** every field validation guards the HTTP boundary, and **the turn path
  never calls it** — so a turn can set an empty title, a whitespace note, a
  free-string priority. The unguarded door is the one **AC-36 widens**.
- **architect:** recurrence is **the first non-scalar field this model has ever
  carried**, and four mechanisms are scalar-only by construction. The undo
  snapshot and the live row would **share one object**.
- **architect:** undo of a turn that completed a repeating task leaves **two open
  occurrences** — violating the invariant the recurrence section rests on.
- **product:** the independent re-derivation found **no over-build**. The full
  scope the owner chose is coherent; *"too big"* was not available as a finding.

## Not raised by any lens, noted by the orchestrator

The gate itself worked because the Impact section existed — and that section
exists only because the **owner** named the gap (**L-013**). Nothing in the
pipeline asks a new feature what it breaks. Four lenses spent significant effort
verifying Impact claims and found them accurate; that verification had no home in
the protocol and happened because the briefing invited it.
