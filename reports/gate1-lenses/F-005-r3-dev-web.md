# Gate 1 round 3 — F-005 — dev lens (web), targeted re-review

Persisted by the orchestrator per **L-009**. The lens wrote nothing.
**HIGH 3 · MEDIUM 1 · LOW 3.** Confidence HIGH. All 11 listed ACs re-read; every code
claim re-run against the repo. **All ten round-2 dispositions landed** — the three
HIGHs are defects the amendments *introduced*, which is what this round was for.

## Dispositions verified (round-2 rows)

**H1** → AC-2's third state present with a web observable (value stands, reason
announced under 4.1.3, user-invoked retry); OQ6 kept and marked CLOSED against the
corrected premise; AC-47's reload half settled in both AC-47 and OQ6. **H2** →
AC-47's supersession rule, assertable. **H3** → `## Impact` §14 states the collision
accurately and names both web sites (`shell.ts:113-115`, `ConversationPane.tsx:71`,
`DEFAULT_COLLECTION`, the meta string at `:131,135-137`); recommendation stated,
amendment left to F-001, **not re-raised**. **H4** → `pushLocalTasks`'s literal is in
§1's table at `controller.ts:733-739`, verified. **M1** → AC-44 names the **existing**
seam and says widen (`57-65,119,138` verified); five inline sites and eight defaulted
`now: Date = new Date()` parameters both check out. L-004 shape closed. **M2** →
`## API Touch Points` carries the timezone obligation. **M3** → AC-47's mechanism in
`_shared/` recorded as a fifth instance of §7's table. **L2** → both halves named
(jsdom → drag is web e2e only; AC-16's move mode is the unit tier). **L3** →
`controller.ts:673` verified.

## HIGH

**H1 — AC-2's third state is keyed to connectivity; the shipped predicate has three
disjuncts and the AC inverts the behaviour on one of them.** The real predicate is
`task.local === true || this.state.offline || !this.onlineNow()`
(`controller.ts:603,619,631`). Two failures, **opposite in kind**:

1. A task the user created offline seconds earlier (F-001 AC-25) would now have its
   rename or priority edit **refused** — while `persistLocal()` saves it (`:693-694`)
   and `pendingLocalTasks()` explicitly prefers state because *"it carries edits made
   since"* (`:769-771`). **Today that edit is kept and is sent.** The AC regresses a
   shipped, working path, and does so citing the very line that draws the distinction
   it then ignores.
2. The `task.local === true` disjunct fires **while online** — a pending or failed
   replay leaves the row local — and there the AC's trigger never fires at all, so the
   silent loss survives one door over, **with no refusal shown because the app is not
   offline.**

*Not a finding if* AC-2's third state were scoped to a server-owned row
(`local !== true`), **as the owner's decision doc itself is** — "an edit to a
**server-owned** task is never sent". *Directive:* scope the third state by row
provenance. The lens states explicitly: **"a defect in how the decision was
implemented, not a re-opening of it."**

**H2 — `## Out of Scope` and AC-14 give opposite instructions about one literal.**
`## Out of Scope` states, as a consequence of the OQ6 answer, *"no widening of
`pushLocalTasks`'s replay literal"*. AC-14 requires exactly that widening: *"the
replay carries the step's `parent_id` and its position"* — and even adds *"(that
literal is `## Impact` §1's fifteenth closed list and carries neither field today.)"*
AC-13 requires the same literal to stop replaying a bare local midnight. **There is one
literal; it cannot be frozen for edits and widened for creates.** An implementer who
reads `## Out of Scope` last does not widen it, and an offline-created **step** replays
with `parent_id` dropped — **it comes back as an ordinary top-level task, in every
collection and every count, which is precisely what AC-35 exists to prevent.** Silent,
at reconnect, and invisible to type-checking because every field on `TaskCreateBody` is
optional. **C3 does not catch it: it checks endpoint ↔ handler, not a client
projection.** *Directive:* qualify the `## Out of Scope` sentence — what is rejected is
queue-and-replay for offline *edits*, not the create-replay's field set.

**H3 — AC-47 states the reopen case twice with opposite answers.** Supersession bullet:
the field shows the user's failed value *"only while nothing newer has been stored;
once something has, the field shows the stored value."* Fourth bullet, unamended from
revision 2: *"…holding the user's value, still failed, still offering retry — **never
the stored value**."* This is round-2 H2 **reproduced inside the AC amended to close
it.** The absolute phrasing sits under a heading ("the notice and the surface never
disagree") that reads as the authoritative reconciliation. *Directive:* amend bullet 4
in place; the rest of it — one failure behind both, one retry path called from two
doors (L-005) — is unaffected and should stay.

## MEDIUM

**M1 — `## Impact` §14 treats the message-door gate as one predicate. It is two.** The
mobile client has the same gate at `mobile/model/task-link.ts:54` — `taskLinkState(…)`
returning `'link' | 'inert'` from `collectionTasks(…)`, consumed by
`AssistantScreen.tsx:24` and `a11y.ts:39` against the reserved id `talk-task-link`.
§14 names it nowhere, and neither does §7's leak table. §14's whole value is that it
routes an amendment to F-001; **routed as "one predicate", F-001 amends `shell.ts` and
the phone keeps the collection filter** — so F-001 AC-31's door means two different
things on two clients, decided by a filter the user cannot see on either. **L-005's
shape on the very finding this section exists to prevent.**

## LOW

**L1 — §1's arithmetic contradicts its own table.** Heading and body say "**six** …
gate behaviour"; the table has **seven** rows, and its own sum requires seven
(7 gating + 9 remaining = the sixteen the heading claims). The `DIFF_FIELDS` row still
opens *"The worst of **the five**"*. `## API Touch Points` compounds it: "the **six**
closed field lists … **plus** a fifteenth site" — seven described as six-plus-one.

**L2 — AC-45's retracted sentence is still present four bullets earlier**, verbatim and
unqualified: *"…so AC-3's arriving change **and F-001 AC-32's non-stale list** keep a
subject."* The correcting bullet landed and quotes it by name, so the risk is skimming
rather than ambiguity — but the layout bullet is the natural place to stop reading.

**L3 — AC-44's enumeration omits a ninth defaulted clock**: `mobile/model/task-link.ts:54`,
which decides M1's link/inert answer from a wall clock. Covered by AC-44's *rule*, but it
is a **defaulted** parameter — the class the AC itself singles out as failing silently
rather than at compile time — and it is the same file M1 is about.

## Checked, nothing found

AC-2's two pre-existing states (close-then-fail widening coherent with AC-47's "or
enters it afterwards"; buildable on the shipped `await`-and-discard shape by branching
the result; the `api-contracts.md` over-cite corrected) · AC-3 (the precedence rewrite
is implementable in React, each of the five focus classes maps to a real event, and
"the arrival cue fires exactly when the displayed value changes" is a single
observable; revision 2's unfalsifiable two-sided guarantee withdrawn **with its reason
kept**) · AC-13 (the weaken-the-assertion trap is resolved — `collections.test.ts:793`
and `app.test.tsx:1052` stay green) · AC-15/AC-16 (the reorder undo replays "the moved
step's prior position, carried by the move's own response" — the client is told where
the value comes from and holds it already) · AC-31 (F-005's, unchanged) · AC-44 (**the
inversion is correct**: the DST/zone outcomes are the assertion and the seam is the
how, so a perfect seam with an hour of drift fails) · AC-45 (still buildable; container
query at `styles.css:207-221`, no JS width read; the runtime observable is the
mutation-resistant form) · AC-47's remaining bullets · AC-48 (**the AC-3-exception
argument — an arriving *subject* is not an arriving *value* — is sound and is the thing
an implementer would otherwise get wrong**).

**No AC in this set contradicts `platform/web.md`.** Its one binding rule for this lens
— "the client never invents shapes" — is satisfied now that the `timezone` obligation
is in `## API Touch Points`.

**The no-new-AC constraint held for this lens's findings.** None of H1–H3 needs a new
AC: a scope clause on AC-2, a qualification in `## Out of Scope`, a qualification of one
AC-47 sentence.
