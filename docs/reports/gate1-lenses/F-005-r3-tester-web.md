# Gate 1 round 3 — F-005 — tester lens (web), targeted re-review

Persisted by the orchestrator per **L-009**. The lens wrote nothing.
**HIGH 2 · MEDIUM 3 · LOW 0.** Confidence HIGH. All 25 listed ACs re-read against
the spec text; the revision-3 log's `where it landed` claims checked against the
file, not accepted.

**Disposition check: 11 of 15 landed as claimed. Four did not, or landed and broke
something.** W1, W5, W6, W9, W10, W11, W12, W13, W14, W15 verified. W2 landed and
introduced a conflict (R1). W3 landed as a new rule and left the sentence it
contradicts standing (R2). W4's mechanism is named as a seam, not as a door a
browser-driven run can open (R3). W8 landed in AC-43 and **its weaker predecessor
survives in AC-33**, the AC the a11y cases are authored from (R4). W7 landed three
clauses and the new one has no trigger (R5).

> **Two of these are the specific risk the no-new-AC constraint creates, and both
> are the same shape: the new rule was written and the old sentence it replaces was
> left in place** — in the same AC (R2) or in its sibling (R4). Both are
> one-sentence deletions.

## HIGH

**R1 — AC-3, AC-2, AC-47 — the replacement precedence rule is unconditional and
contradicts AC-2 whenever the user's write does not succeed.** AC-3 now says *"the
user's edit always reaches the store, and the control always displays what the store
holds … in the order the store accepted them."* If the user's save fails or is
refused offline, the store holds **the assistant's** arrived value, so AC-3 requires
the control to display it — while AC-2's governing sentence requires the opposite in
the same instant: *"a write that fails or is refused leaves the user's value in the
field … it never silently reverts to the stored value."* AC-3's cue clause then fires
the arrival cue on that substitution. **The behaviour AC-3 would license is verbatim
what AC-2 forbids**, and revision 3's own reasoning establishes an outage as the
ordinary producer of a failed write. `## Test strategy` calls this "the
highest-value single case in the feature" — the mirror-not-a-check outcome W2 was
raised about, reintroduced from the other side.
*Not a finding if* AC-3's rule were scoped to **accepted** writes, or AC-2 carried an
exception for a superseding stored value. *Directive:* one clause in AC-3 naming what
the control shows when the user's own write fails, whether the deferred assistant
value then applies, is held or is discarded — and that **the arrival cue does not
fire on a reversion caused by a failure**.

**R2 — AC-47 answers W3 twice, in opposite directions, and both sentences begin
identically.** Bullet 1 (new): *"Reopening … shows the user's failed value **only
while nothing newer has been stored**; once something has, the field shows the stored
value and the notice carries the superseded text."* Bullet 4 (revision 2,
unamended): *"Reopening … shows that field holding **the user's value**, still
failed, still offering retry — **never the stored value**."* The supersession rule
landed; **the sentence it exists to replace was not withdrawn.** The case is a
*required* AC-36 fixture row, not a hypothetical, and the conflicting statement is
phrased as an absolute. The retry half inherits it: bullet 4's "still offering retry"
on a superseded notice is a control that overwrites the newer stored value with the
stale failed one — **the resurrection door AC-4 and AC-47 close everywhere else.**
*Directive:* delete or narrow the "never the stored value" sentence, and say whether a
superseded notice still offers retry.

## MEDIUM

**R3 — AC-44 — the obligation landed; the named mechanism is not a door a browser can
open.** AC-44 now carries *"the test harness can set every seam and hold them at one
instant and one zone for the length of a run"*, but what it names is
`ControllerDeps.now` — an **in-process constructor parameter**. Verified:
`web/main.tsx:58-63` constructs the controller with `{api, speech, stores}` and passes
no `now`; `seams.ts`'s `window.__assistantSeams` — this project's existing named
client-side harness door, guarded by `?testMode=1` / `?qaUser=` — exposes four methods
and **no clock**; `qa/assistant/automation/pages/AssistantPage.ts:116,120` drives time
only by HTTP to the server. The one place `ControllerDeps.now` is "the seam the harness
pins" is a jsdom test that constructs the controller itself. **So "the harness can set
every seam" is satisfied, today and unchanged, by the unit harness — while the web e2e
tier AC-44 names as broken still has no door.** The AC's own failure mode, "green
until a Friday CI run", survives its own remedy: **L-014's shape at one remove.** The
spec applied the correct fix elsewhere — T22's seed path was promoted out of prose into
`## API Touch Points` with `__qa__` named as its home — and the client clock door, the
same kind of object, is in neither `## API Touch Points` nor `## Test strategy`.
*Directive:* name the client-side door. `window.__assistantSeams` is the precedent and
is already guarded.

**R4 — AC-33 carries the predecessor of the rule AC-43 just replaced.** W8's fix landed
in AC-43 (*"it does not elapse"*); AC-33's new 2.2.1 sentence reads *"No affordance
this feature adds is withdrawn by time alone"* — **which a five-second timer extended
on focus satisfies**, since that is not time alone: the precise reading W8 removed. The
same bullet also **quotes AC-43 as saying a sentence AC-43 no longer contains.** AC-33's
own 4.1.3 bullet establishes that "the a11y cases are authored from this clause", so the
tier verifying 2.2.1 authors from the weaker rule. **The stale quotation is what makes
it survive review — it reads as a faithful citation of a sibling AC.**

**R5 — AC-38 gained all three clauses W7 asked for, and the new one turns on a verb with
no trigger.** *"`reminder_shown_at` is written when the user acknowledges the surfacing,
not when it renders."* Nothing says what constitutes an acknowledgement — dismissing,
opening the task, tapping the row, scrolling past — and with N reminders it must be
per-item. **The negative case is constructible and the positive case is not**, so the
only available assertion is that reminders never retire. That leaves the door open for
the defect P1 closed to arrive through a different gesture: an implementation
acknowledging on any incidental interaction is *"render is resolution"* renamed, and it
passes every test AC-38 supports. W13's shape, on a clause added in revision 3.
*Directive:* state that acknowledgement is a deliberate per-reminder action and that
rendering, scrolling and opening the task are not it; which control stays design's.

## Checked, sound — verified in the spec text, not from the log

- **W1 → AC-2, AC-47** — trigger widened to "whenever it fails"; AC-2's in-flight bullet
  routes the post-close failure to AC-47; `## Test strategy` gains close-then-fail.
- **W5 → AC-1** — "the surface's own account of itself" named as the accessible
  enumeration of its own controls; all seven fields appear whether or not they hold a
  value; reaching a field has a budget of **one further action**, counted per field.
- **W6 → AC-25, AC-30, AC-39** — `series_live` defined once in AC-25 (repeat still set
  **and** not ended), explicitly not `series_id`, carried on the wire; AC-39 cites it and
  adds both negative cases; AC-30's second control keys off it.
- **W9 → AC-47, AC-4** — deletion is an ender, stated from both sides, reported once,
  carried value legible, **no** retry.
- **W10 → AC-45** — crossing `breakpoints.split` changes nothing the detail holds: task,
  focused field, dirty value, uncommitted preview, outstanding notice. No longer
  verifiable only by grep (L-002).
- **W11 → AC-13** — the answer is **in the AC**: "the stored instant does not change; the
  flag and the formatter do", with both shipped assertions named there and in §10, and §9
  routing ADR-009 §4. Re-read both cited tests (`collections.test.ts:791-796`,
  `app.test.tsx:1046-1054`): **neither turns red** under AC-13 as now written.
- **W12 → AC-33 et al** — 4.1.3 is a rule ("every refusal and every status message this
  spec states is announced") naming the four it was closed against; AC-36 carries "the
  refusal is verified on web as well as api".
- **W13 → AC-16** — `cancelled` has its trigger, its outcome and its announcement.
- **W14 → `## Test strategy`** — the AC-7 differential holds the row equal against
  **three** mutations, AC-39 named.
- **W15 → AC-9** — `none` never marks, `high` always does, `low`/`medium` are design's
  within the one-glyph vocabulary under OQ5, all four distinguished in the accessible
  name — the disposal this lens's own disproof clause named.
- **W8 → AC-43** itself is sound; the residue is R4, in AC-33.

Examined for amendment damage and found none: AC-4, AC-7, AC-8, AC-12, AC-17, AC-23,
AC-25, AC-30, AC-31, AC-36/AC-40, AC-39, AC-42, AC-43's coverage list and offline
non-availability, AC-45's three edges and its "the detail is not preserved" answer.

`## Impact` in tester terms: **§10 is now correct** about which shipped assertions move
and which do not — the one place this section stopped short in round 2 — and §9 routes
ADR-009 §4 alongside them.

**On the constraint.** It held for this lens's findings: none of R1–R5 needs a new AC,
and each names an existing home (AC-3, AC-47, AC-44 or `## API Touch Points`, AC-33,
AC-38). What it *cost* is visible in R2 and R4.
