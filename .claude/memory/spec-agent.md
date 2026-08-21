# spec-agent — procedural memory

Layer 5. Read fully at every dispatch. Keep under 100 lines: this is muscle
memory for this codebase, not a log.

---

## Adding a field to `task` touches thirteen places, five of which gate behaviour
**Context:** any spec that adds, renames or narrows a field on the task entity.
**Pattern/Lesson:** do not assume the field list lives in one place. Measured on
2026-08-18 while specifying F-005: **thirteen non-test sites enumerate the task's
fields, and five of them gate behaviour rather than merely carrying it.** The one
that matters most is `api/engine/apply.ts` — that tuple is **simultaneously the
assistant's write allowlist and the source of the turn's visible diff**, so a
field omitted there makes the engine mark a task changed, change nothing, and
emit an empty diff. That is an F-001 failure caused entirely by a new spec's
silence.
**Example:** `apply.ts` (diff + allowlist), `app.ts` `TASK_PATCH_FIELDS` and
`TASK_CREATE_FIELDS`, `task-equals.ts` (hand-kept, and its safety net currently
holds by the accident of `updated_at` being in it), `serialize.ts`.

## The validation guards the HTTP boundary; the turn path does not call it
**Context:** any AC of the form "an empty/invalid value is refused".
**Pattern/Lesson:** `taskChangesFrom` is where the field rules live, and
`applyEdit` never calls it — it assigns straight onto the row. So a rule written
against the endpoint is unguarded on the assistant's path. State field rules as
binding **the write**, not the endpoint, or say explicitly which path they cover.

## "Not expressible" needs an outcome, or it asserts nothing
**Context:** any clause saying a shape is unsupported or refused.
**Pattern/Lesson:** an absence is only assertable through what happens instead.
Write "a write carrying X is refused and the record is unchanged". Without it, a
test author guesses between 400, silently-ignored and coerced — and the wrong
guess passes against a system that silently drops the field.

## Check whether the refusal can even be attempted
**Context:** an AC refusing the assistant a capability.
**Pattern/Lesson:** F-005 AC-36 refused the assistant three structural fields —
and the interpretation type **cannot express them at all**, so no fixture row
could try, and the AC shipped asserting nothing. If the refusal is type-level,
say so and name the contract file as the observable; if it is runtime, the
AI-facing shape has to be able to carry the field.

## A decision restated in five places is narrowed in five places
**Context:** overruling or narrowing any reviewed clause in a mature spec.
**Pattern/Lesson:** F-005's *"the surface does not close over an unresolved
write"* lived in the AC sub-bullet **and** in the User Flow flowchart node, the
`## Out of Scope` *considered and rejected* list, the `## Open Questions`
revision-decision summary, and `## Impact` §13. Amending only the AC leaves four
statements asserting the overruled position — and the flowchart is the one a
downstream agent reads fastest. **Grep the spec for a distinctive phrase from the
clause before editing** (`grep -n "does not close\|unresolved write"`), fix every
hit, and strike through rather than delete in summary lists so the reversal stays
visible. Re-run `declared-elements.sh` after adding an AC even when no field was
added — it is free, and it is the only mechanical check on `## Data` drift.


## An amend-only revision closes findings at the section that already owns them
**Context:** a revision constrained to "amend existing ACs, add none" — F-005
revision 3, after revision 2's eleven new ACs made round 2 into two reviews at once.
**Pattern/Lesson:** almost every finding that looks like it needs a new AC is a
**missing clause in an AC that already claims the behaviour**. Four checks, in order:
does an existing AC already say the words the finding falsifies (AC-36 said "refused
with a visible outcome" and never named the outcome)? Is the right home a *contract*
section rather than an AC — `## API Touch Points` is normative and is what architect
writes contracts from, so promoting prose to it discharges a finding that a
`## Test strategy` sentence does not? Is the finding a **product decision**, in which
case it is `## Open Questions` with the cost stated in the AC, never an invented
bound? Is it a **dependency on another spec**, in which case it is an `## Impact`
subsection plus a clause? Adding an AC is what a *first* revision does; a closing
revision that adds one guarantees another round.
**Also:** run `declared-elements.sh` **before** the rewrite as well as after, so a
failure afterwards can be attributed rather than assumed to be yours.

## A gate implemented twice is amended once — name both predicates by path in the spec
**Context:** amending any AC that says when a control is active, where the rule lives in client code.
**Pattern/Lesson:** F-001 AC-31's gate exists as `canReveal` (`web/shell.ts:115`) and
`taskLinkState` (`mobile/model/task-link.ts:54`). An amendment naming one leaves the other
enforcing the retired rule, and neither the AC nor any reviewer check would show it. Write
the amendment so **both predicates are named in the spec text by path** — that is what makes
a later grep return every door (L-005's remedy applied to the spec rather than the code).
Then check the AC's platform tag against the parity table that owns the other client: AC-31
is `(web)` and `F-003 ## Parity` does not list it, so the mobile half is asserted by no tier.
A retag is the other spec's amendment — name it and route it rather than doing it.

## Read the implementation of the clause you are narrowing — it often predicts the amendment
**Context:** any revision that widens or narrows a rule already shipped.
**Pattern/Lesson:** `mobile/model/task-link.ts:30-32` said outright *"The second is stricter
than it needs to be — switching collection on arrival would also satisfy the postcondition —
and it is what AC-31 says, so it is what this does. Widening it is a spec change, not a code
change."* The implementer had scoped the exact amendment and correctly refused to make it.
Reading `src/` for the clause being amended tells you whether the rule is enforced where you
think, how many copies exist, and sometimes hands you the change already argued. Cite it —
it turns a spec claim into evidence.

## Shipped copy describing an affordance is inside the amendment's blast radius
**Context:** widening the set of things an affordance applies to.
**Pattern/Lesson:** widening AC-31's gate made a width-independent meta string (*"tap a task
to find it in the list"*) false in a state that had been rare and became ordinary, and made
it render on nearly every message instead of occasionally. The spec must **not** rewrite the
string — the naming convention reserves shipped copy to design. State the constraint the copy
must satisfy, name the owning artifact, route it. Silence ships a true-looking label that lies.

## Making hidden rows reachable meets a CLIENT vocabulary, not a server field list
**Context:** any feature that surfaces rows an existing read has always filtered out — a trash, an archive, a Logbook, a search over done tasks.
**Pattern/Lesson:** the existing entry ("adding a field to `task` touches thirteen places") points at the server's closed field lists. **This is the mirror case and the sites are different.** Measured 2026-08-21 for F-006: 45 non-test lines name `deleted_at` across 16 files, and eleven of them keep the row out of something a caller sees. Two client-side facts decide whether the feature is safe, and neither is in `api-contracts.md`: (1) `Collection` (`_shared/model/tasks.ts:105`) is a closed four-member enum feeding `COLLECTION_GROUPS`, `COLLECTIONS`, `collectionName` and `dueAtForCollection` — adding a member for the new surface makes "create a task while viewing the trash" reachable and makes its count read zero forever, because `inCollection` is evaluated over `state.tasks`; (2) `inCollection` **never checks `deleted_at`** — hidden rows are excluded upstream at `controller.ts:969/974/1690`, so the moment the new surface puts them into `state.tasks` to save a fetch, every one of them silently joins Inbox, Today and Done with no error anywhere and nothing an API test can see.
**Write the spec so both are assertions**, and say in one sentence whether the new thing is a *lifecycle state* (like `Done`) or a *container* (like `Inbox`) — ADR-009 § Amendment 2's two axes make that a real question, and getting it wrong is `INV-INBOX-FILING`'s failure repeated.

## After consolidating a rule into one place, GREP for the citations rather than trusting the sentence that claims them
**Context:** any revision whose purpose is to state something once and have other sections refer to it.
**Pattern/Lesson:** on T-184 the entire point was to state the trash entry's membership once in AC-6. I wrote AC-6 saying *"AC-9, AC-11, AC-12 and AC-17 all act on this set"*, then grepped each of those four for the string `AC-6`: **AC-9 and AC-11 cited it, AC-12 and AC-17 did not** — and AC-17 was in the list wrongly, because it deliberately keys on a different set. Caught before the return; both files fixed.
**A "refers to X" claim is free to write and invisible when false** — it is the same defect the consolidation exists to remove, one level up. And **a list of ids inside the canonical statement is itself a claim**: check every member belongs, because an AC that deliberately does something different must say so in its own text rather than be silently swept in.
**Do this:** after writing the canonical statement, grep each named id's own body for the id of the statement it is supposed to cite, and **read what the grep does not return.**

## Granting a READ to something previously excluded breaks the EXCLUSIVITY claims, not the exclusion
**Context:** T-187 — the owner answered *"the assistant may read the trash, may not write to it or address a row in it"*. The briefing named three ACs to edit.
**Pattern/Lesson:** **the ACs the briefing names are the small half.** The expensive half is every *other* AC that claims a read is **exclusive**. AC-5 said *"one read path returns deleted rows, it is the only one that does"* and AC-4 said *"the trash's own read is the single exception"* — **both silently false the moment a second consumer is granted a read**, and neither was in the briefing's list. Resolve it by deciding whether the grant adds a **caller** or a **path**, and say which in the AC: *a caller keeps the exclusivity claim true; a second path breaks two ACs at once.*
**Also — check the headline separately from the clauses.** AC-4 read *"no collection, no count, and no assistant query"*: the first two are membership, **the third is a read**. The briefing said AC-4 was unchanged because its *clause* about the handle list was unchanged, and that was true — while its headline asserted the thing the owner had just reversed.
**And:** when a decision lives in a report section (`§8`), grep the spec for that marker before citing it — F-006 already used `§8` for two different `## Impact` sections, so a bare `§8` points at the wrong document.

## A status word lives in more copies than the briefing names — grep the WORD, not just the id
**Context:** T-194 — one owner decision flipped a deferred feature from *reserved* to *committed*. The briefing named two sentences.
**Pattern/Lesson:** grepping the id returned **nine** sites. Two were the briefing's, one was history (correctly left alone), and **six more asserted the old status as live fact** — including `## Purpose` in the same file, which would have contradicted the edit three sections later, and `docs/design/_shared/components.md`, which uses *"F-002 records F-004 as having no owner decision behind it"* as the **reason** a frame family does not speak. **A status word is a claim other artifacts build arguments on top of**, so the blast radius is wherever the *reason* was reused, not wherever the id appears.
**Do this:** before editing, grep the id **and** the status phrase (`reserved`, `not committed`, `no owner decision`) across `docs/`. Sort the hits into three piles — **history** (add a dated note, never rewrite), **live claims inside your write scope** (fix, and report as self-decided if the briefing did not name them), and **live claims outside it** (name them with `file:line` in the return, **the one whose argument depends on the old status first**). The third pile is the one that gets dropped, and it is the one that ships a design decision resting on a fact that stopped being true.
