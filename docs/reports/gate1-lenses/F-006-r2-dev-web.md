# F-006 Gate 1 ROUND 2 — dev (web) lens (T-186, 2026-08-21)

**Verdict:** 1 HIGH · 2 MEDIUM · 1 LOW · 11 ACs re-read. **All 6 round-1 fixes hold in the text.** Every store measurement reproduces exactly.

---

## F1 (HIGH) — AC-7, AC-9 · **the clause added to fix round-1's F1 cannot be rendered**

AC-7 requires the entry to **name the parent** and to **say when the parent's row has left
the store** — and neither the AC nor the trash read's touch point says the entry carries the
parent's **title** or the parent's **state**.

*The web client has only `parent_id` on the wire: a live parent resolves from `state.tasks`,
a deleted one **only by joining across trash entries**, and a gone one **not at all**.* **The
three cases are indistinguishable, and an implementation that renders nothing for all three
passes every fixture built on a live parent.**

## F2 (MEDIUM) — AC-11, AC-17 · the correction reached `## Impact` and not the platform doc

`platform/web.md` states the client *"drops every id in `removed`"* — which §11 itself shows
is **a no-op for trash rows** — and §10 routes that document **only for its stale
`ShellSurface` line.**

*The web agent's contract is to follow the platform doc and never invent its own pattern*, so
an implementer routes both destroys through `applyWrite`, **the destroyed entries stay on
screen**, and the earliest catch is a web e2e.

## F3 (MEDIUM) — AC-10 · the ten-second notice group is **unbuilt in both clients**

AC-10 puts the restore report in F-005 AC-47's second lifetime group, **which elapses** — and
the shipped `web/components/CarriedNotices.tsx` **contains no timer, and its header states
that absence as the requirement rather than an omission.**

*§4's "no change to AC-47's rule is needed, only a new member" is true of the rule and false
of the web client*, so this implementer **either ships a notice that never elapses or adds a
timer against a file that forbids one** — depending on whether F-005 revision 5's own
implementation lands first.

## F4 (LOW) — AC-17 · the success post-state exists only by reference

AC-9 and AC-11 each state their own. AC-17 gives *"the same post-state rule as AC-11 applies
in full"* and then enumerates three items, **all of them failure halves** — dropping the
success half **on the one act where the emptied list is the whole observable.**

---

## Round-1 findings — six of six hold

Parent-disappears orderings carried verbatim *(the half it added has no data source — F1)* ·
AC-10's phone remedy withdrawn and recorded in §11 · AC-6 closes client-side grouping rather
than offering it · AC-3's server-producer rule, **with my harness point quoted so the reason
survives** · §11 names both AC-11 and AC-17 for the `removed:` no-op *(it did not reach
`platform/web.md` — F2)* · §2 gains the click-through paragraph, verified at
`ListsMenu.tsx:95-96` and `App.tsx:130`.

## Also checked, sound

- **AC-14's read permission needs nothing new on web** — `applyWrite` filters `deleted_at` at
  both push sites, so §3's guarantee **holds against the code.**
- **§8 already absorbs the revision-4 read permission** at the two message-door lines;
  `web/shell.ts:206` gates on `deleted_at === null` as claimed.
- **AC-9's client half is stated in the AC itself**, including the second entry the parent
  invariant returns. *Better than AC-17's.*
- **AC-12's GET-that-mutates raises no web-side contradiction** — the client calls a read
  either way.

## The routed question, in dev/web terms

> **From the build side the dead end is acceptable, and the reason is that it stays cheap.**
> §8 keeps `canReveal` inert and gives the reason. **Adding a door later is a new branch in
> the single `revealTask` routine, not a change to `canReveal`'s predicate** — which
> `platform/web.md` forbids re-narrowing. So if the tester or product lens argues the cost is
> too high, **reversing it is one additive branch on each client and no contract change.**
>
> **What would change my answer:** if the reply were expected to carry a *control* rather
> than a sentence. That is a new door type in the conversation pane, **and it would want the
> deleted row addressable to work — which is the line the owner drew.**
