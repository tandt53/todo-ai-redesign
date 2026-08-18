# BRIEFING — T-143

- **Task ID:** T-143
- **Description:** F-005 revision 2 — resolve Gate 1 round 1 findings + fold in the four owner answers
- **Module:** assistant
- **Feature:** F-005
- **Agent:** spec-agent
- **Date:** 2026-08-18
- **Depends on:** T-142 (DONE — Gate 1 round 1, verdict REJECT)

---

## Why you are being dispatched

`specs/assistant/F-005-task-detail.md` (37 ACs, full scope by the owner's
explicit choice) went through Gate 1 round 1 under five lenses — tester, dev,
architect, product, design. **Verdict: REJECT. 20 HIGH, 34 MEDIUM, 8 LOW.**

**The round cap is 2. This revision is the last one that gets reviewed.**
Anything you leave unresolved and unrecorded here ships unreviewed or blocks the
feature at the human. Treat "recorded honestly in `## Open Questions`" as a
legitimate outcome and "quietly dropped" as a failure.

Since round 1 the owner answered four escalated questions. Those answers are
decisions, not suggestions — encode them in ACs. Do not re-argue them.

---

## Read these files first

1. `specs/assistant/F-005-task-detail.md` — the artifact you are revising.
2. `reports/owner-decision-2026-08-18-f005-gate1.md` — **the four owner answers.**
   Binding. Read before the lens returns, because it changes what several
   findings mean (e.g. it makes the un-delete gap mandatory to close).
3. `reports/gate1-lenses/F-005-consolidated.md` — routing: the seven
   convergences, the uniquely-seen findings, the lens-by-lens counts.
4. `reports/gate1-lenses/F-005-{tester,dev,architect,product,design}.md` — **read
   all five individually, not only the consolidation.** They are persisted for
   exactly this reason (`specs/_shared/LEARNINGS.md` L-009): clustering drops
   what one lens saw alone, and several of the highest-value findings in this
   gate were seen by one lens only. Each finding carries an id (`F1`, `T4`, `D6`
   …) — you will need those ids for your revision log.

Secondary, only as needed to check a claim: the collection-model decisions the
spec already sits on top of — `reports/owner-decision-2026-08-18-four-buckets.md`,
`owner-decision-2026-08-18-inbox-is-unfiled.md`,
`owner-decision-2026-08-18-upcoming-create.md`, and `ADR-009 § Amendment 2`.
Do not re-open them. In particular **`INV-INBOX-FILING`: `open_all` and
`inbox_count` are exactly equal today (716, all 193 accounts) and are two
different facts — never merge them.**

---

## What the revision must do

### 1. The four owner answers become spec text

| Answer | What must land |
|---|---|
| **Reminders** — passed reminders are shown when the app opens. No scheduler, no push, no permission prompt, no UC-26 dependency. | AC-11 stops being a control that either promises delivery or announces its own uselessness. AC-10 and AC-27's reminder clause follow. OQ2 is answered — remove it from `## Open Questions`. |
| **Mobile** — web-first, **but the three shared-model/server-side leaks are handled inside F-005**: the repeating-tick that creates a row on a client with no repeat indicator; the parent tick that completes steps that client never renders; the four ACs implemented in `src/assistant/_shared/` which the mobile client compiles. | Platform tags decide which QA tier covers an AC. Tagging these `(api)` / `(api, web)` means **no mobile tier ever verifies them** — that is the leak. Tag accordingly. OQ8 is answered; the stale premise in it (*"the phone is still missing rename and delete"*) is **false** — `mobile/components/TaskList.tsx` calls `editTask` and `removeTask`. Fix that sentence wherever it appears. |
| **Voice** — note, priority, due date, reminder reachable by voice; sub-task structure and recurrence stay hand-only. | AC-36's permitted half is currently *a permission, not a capability*: the interpreter's 23 fixture rows contain two edit rows, neither touching a field this feature adds. Require **one fixture row per permitted field**, so the allowlist is asserted rather than assumed. OQ9 is answered. |
| **Delete** — the list-row delete gains the undo it never had. | Two doors to one destructive action must not have different safety. OQ7 is answered. This makes convergence 1 below **mandatory**, not optional. |

### 2. The seven convergences — each found independently by 2+ lenses

Each needs a concrete disposition in the spec, not a mention.

1. **Nothing in the system can un-delete a row** (architect F2, dev F1). `DELETE`
   soft-deletes; `PATCH` 404s on a deleted row; re-`POST` 409s; the only
   un-delete reverts a *turn*, which a hand delete never creates. Three ACs
   assert on the restore. **`## API Touch Points`'s "no new assistant endpoints"
   is false** — correct it and state what the restore path actually needs.
2. **Steps become voice-addressable handles** (architect F7, dev F5). The
   interpreter builds its handle list from a **different query** than the
   predicate the step exclusion was placed in; a task with eight steps
   contributes nine handles. The message-link is gated by that same predicate,
   so the assistant would report changing a task **and the link would be inert
   with no explanation.** The spec's own test note asserts only the predicate —
   **so this passes green.** Fix the assertion as well as the rule.
3. **The dateless-repeat case has three different answers** (architect F3,
   design D6, product F8, tester T12) across two ACs and the flow diagram — and
   they differ in *which collection the task lands in* (Today vs Upcoming). Pick
   one and make all three sites agree. Note the larger of the two rule-driven
   date changes is currently the silent one.
4. **Three ACs assert on a hand-action undo nothing defines** (tester T4,
   product F7) — no lifetime, no dismissal rule, no relation to the turn-undo
   affordance. A step is currently the one thing here you can destroy
   irreversibly.
5. **The clock the web ACs read is not the clock the harness controls** (tester
   T6, dev F8) — web-tagged date behaviour reads the **device** clock; both
   seams are server-side. *"Green until a Friday CI run."*
6. **The detail's containment is unstated and the shell has no room for it**
   (design D1, dev F6). `ShellSurface` has three values; the layout branch is a
   container query with **no width read in JavaScript**, so the detail must be
   one state CSS places at both widths — and whichever an implementer picks,
   **one of two F-001 ACs is contradicted.** Say which, explicitly.
7. **The step exclusion does not reach every count** (dev F3, architect F12) —
   four live sites read the raw array, **including the one choosing between the
   first-run and the empty-collection state.** A user whose only rows are steps
   is told the collection is empty, and the a11y id set expects a row never
   drawn.

### 3. The uniquely-seen findings — do not let these fall out

- **dev:** the behaviour **AC-13 forbids is already shipped** — creating a task
  while viewing Today writes local midnight and the formatter renders
  "12:00 AM". **Not named in any of the nine `## Impact` subsections.** Add it.
- **tester:** **AC-36's refusal cannot be exercised** — the interpretation shape
  cannot express the fields it is meant to refuse, so no fixture row can try.
  Earliest catch is *never*.
- **dev:** every field validation guards the **HTTP boundary and the turn path
  never calls it** — a turn can set an empty title, a whitespace note, a
  free-string priority. The unguarded door is the one **AC-36 widens.**
- **tester:** AC-26's invariant is **broken on purpose by AC-28**, so the honest
  assertion is red on a sibling's own path.
- **architect:** recurrence is **the first non-scalar field this model has
  carried**; four mechanisms are scalar-only by construction, and the undo
  snapshot and the live row would **share one object**.
- **architect:** undo of a turn that completed a repeating task leaves **two open
  occurrences**, violating the invariant the recurrence section rests on.
- **design:** the spec implies **~48 surface states and names ~20**, and **amber
  is already spent** — assigned a different meaning the day before, on rows that
  already carry lateness.
- **product:** the independent re-derivation found **no over-build**. *"Too big"*
  was not available as a finding — do not shrink scope to close findings.

### 4. `## Impact` is now a reviewed section

The 2026-08-18 template upgrade makes `## Impact` required for any feature that
is not the first in its module, and **Gate 1 reviews it under every lens** — a
missing or stale section is a HIGH finding. F-005 already has one (nine
subsections). Bring it current with everything above, minimally: the
already-shipped AC-13 behaviour, the restore path, and the mobile leaks.

### 5. MEDIUM and LOW

Resolve where the fix is cheap and local. Where it is not, each one lands in
`## Open Questions` with the AC id it would change. Do not silently drop them.

### 6. The six open questions the owner has NOT answered

OQ1, OQ3, OQ4, OQ5, OQ6, OQ10 stay open. Keep them, sharpen them if round 1 gave
you a sharper framing, and make sure each still names the ACs it would change.
The *"decisions this spec took that no source answers"* paragraph stays and is
updated — the product lens endorsed four of them and found three *right in
principle, incomplete as written*; reflect that.

---

## Write to

- `/Users/tandt/projects/todo-ai-redesign/specs/assistant/F-005-task-detail.md`
  — the revision.
- `/Users/tandt/projects/todo-ai-redesign/specs/assistant/index.md` — only if the
  AC count or the feature's one-line summary changes.
- `/Users/tandt/projects/todo-ai-redesign/reports/gate1-lenses/F-005-revision-2-log.md`
  — **new: the revision log.** One row per round-1 finding id, every HIGH
  included: `id | lens | disposition (resolved / deferred-to-OQ / rejected) |
  where it landed (AC id, section) | one line of reasoning`. This is what the
  round-2 review is read against; without it the last review round is spent
  re-deriving what you changed.

**Do not edit** the spec's `## Links` block — the orchestrator is its sole
writer. Report paths under `links_to_record:` in your return instead.

---

## Success criteria

1. All **20 HIGH** findings have an explicit disposition in the revision log, and
   every one marked `resolved` is traceable to changed spec text.
2. The four owner answers are in ACs — not in prose commentary — with correct
   platform tags, and OQ2/OQ7/OQ8/OQ9 are removed from `## Open Questions`.
3. All seven convergences are resolved at **every** site the finding names (the
   dateless-repeat case is fixed in two ACs *and* the flow diagram; the step
   exclusion at all four counting sites; the step-handle fix in the rule *and*
   the test note).
4. `## Impact` is current, and names the already-shipped AC-13 behaviour.
5. `bash .claude/tools/spec-check/declared-elements.sh specs/assistant/F-005-task-detail.md`
   exits 0 (it does today — keep it that way as fields move).
6. AC ids are **stable**: never renumber an existing AC. New ACs continue the
   sequence; a deleted AC's id is retired, not reused.
7. Every AC remains independently testable and carries its platform tags.
8. Your return ends with the `---METRICS---` block from
   `.claude/agents/_completion-protocol.md`.

## Explicitly out of scope

Architecture, data-model and API design (architect-agent, phase 3), design
screens (design-agent), and any source change. You are revising a specification.

## Two rules in your own agent definition that this task overrides

- **"Keep feature docs under 150 lines — if longer, split into multiple F-ids."**
  F-005 is 306 lines and 37 ACs **because the owner explicitly chose the full
  scope over the smaller version they were offered**, and the product lens
  independently re-derived the feature and found **no over-build**. Do not split
  F-005, and do not cut content to reach a line target. This revision will get
  longer, not shorter. Length is not a finding here.
- **The discovery interview.** There is no user to interview in this dispatch —
  the requirements exist, the review findings exist, and the four escalated
  questions are already answered in the owner-decision file. Work from those
  documents. If you hit something that genuinely needs the owner and is not
  already an open question, **do not guess and do not block**: add it to
  `## Open Questions` naming the AC it would change, and list it under
  `unresolved:` in your return so the orchestrator can escalate it.
