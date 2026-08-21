# F-006 Gate 1 ROUND 2 — tester (web) lens (T-186, 2026-08-21)

**Verdict:** 2 HIGH · 2 MEDIUM · 13 of 17 ACs (the targeted list).
**All 7 round-1 findings hold — each disposition claims a fix the revision-4 text actually carries, verified line by line.**
**Both HIGHs are new and both sit on the two things nobody has reviewed: AC-17, and the owner's read permission.**

---

## F1 (HIGH) — AC-14, AC-15 · the reply has no declared spoken frame, and an unframed utterance **fails**

`components.md § Spoken frames` declares **no row** for that utterance and `## Impact` §9
routes none — while **F-002 AC-22's rule is that an utterance with no declared frame fails
rather than shipping generated text.**

*So `## Test strategy`'s own assertion for this half — "the reply names it and says it is in
the trash" — is **unwritable**: either the composer refuses the sentence, or an implementer
ships the free template over model text that F-002 AC-22 forbids by name.*

**Measured:** 17 frame rows, **5 closed slot types, no trash row, and no date slot** — so an
answer carrying AC-3's *"until when"* needs a sixth.

## F2 (HIGH) — AC-17, AC-11 · the confirmation imports one rule and then states another

AC-17 says its confirmation follows *"the same rule as AC-11"* — which requires **each
entry's row count** — then enumerates the entries, `title_list` overflow above three, and a
total count **of entries, never of rows**.

**The two readings differ by the scale of the largest irreversible act in the product:** a
trash of 3 entries holding a deleted series reads *"3 entries"* under one and **names 40-plus
rows** under the other. Above `title_list`'s 3-name cap **the imported per-entry rule cannot
be expressed at all**, so no assertion can be written without choosing.

*Recommendation: names + overflow + **entry count and row count** — the row total is the
number the user is actually consenting to.*

## F3 (MEDIUM) — AC-14, AC-16 · `(api)`-tagged, so the sentence the user hears is verified at no tier that renders it

*"The dead end is acceptable as a product line and is not acceptable as a test boundary."* A
reply that names the task but **omits that it is recoverable, or until when**, passes AC-14's
one stated fixture — **and the user who asked the assistant is exactly the user who never
opens the surface AC-3's dates live on.**

*Owner §7 required the elapsed undo to name the trash because "a path existing" and "a path
being available" differ. **This reply is the second signpost and the argument applies to it
unchanged.***

## F4 (MEDIUM) — AC-17, AC-2 · a trash that empties under the user has no stated state

Neither AC says whether *empty trash* is offered when the trash is empty, nor what its
confirmation names at zero entries. **AC-10 explicitly puts the user on this surface
restoring three entries in a row**, so a listed trash emptying under an already-rendered
control is a reachable transition with no defined post-state.

---

## Round-1 findings — all seven hold

| | |
|---|---|
| **F1** delete-forever defined twice | **holds** — *"AC-6's membership, restricted to rows still deleted at the moment of the act"*. **A live row can no longer be hard-removed.** |
| **F2** AC-4 omits raw-cardinality readers | **holds** — AC-4 names `TasksSurface.tsx:413/:414/:420` and the 4-account measurement; `## Test strategy` counts five readers. *My round-1 line numbers match the text.* |
| **F3** one restore mutates another entry | **holds** — the parent invariant is restore-only, unwidened, and **non-silent** |
| **F4** required announcement with nothing to announce | **holds** — AC-16 enumerates six refusals and **each exists** |
| **F5** no carrier for the restore outcome | **holds** — AC-10 names F-005 AC-47's notice region and its second lifetime group |
| **F6** AC-11 bundles four guarantees | **holds structurally** — the split is what exposed F2 above |
| **F7** ordering key unstated | **holds** — ordered by the gesture's `deleted_at`, ties by addressing id. **Order is total; no flake seam.** |

## Also checked, sound

AC-2's four states all constructible at the web tier (route-delay, 500, offline, zero-seed)
· AC-3's server-produced date closes the two-clock drift · AC-6's null-gesture singleton is
the 53-of-57 majority path and has a fixture · AC-7's orphan has a stated post-state and
AC-9 the matching refusal · AC-11's offline-refused-not-queued has an assertable web
sequence · AC-15's AI-vs-network disambiguation is clean · AC-16's expire-while-on-screen
case is stated.
