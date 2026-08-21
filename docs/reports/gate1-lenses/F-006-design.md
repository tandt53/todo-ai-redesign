# F-006 Gate 1 — design lens (T-182, 2026-08-21)

**Verdict:** 2 HIGH · 4 MEDIUM · all 16 ACs.
**State arithmetic: ~25 surface states implied, 9 named.** (F-005's design lens published the same measure: ~48 implied, ~20 named.)

---

## F1 (HIGH) — AC-2, AC-5, AC-15 · a network-backed surface with no failure design

AC-2 names two states — default and empty — for a surface fed by a **new server read**,
and names no in-flight, failed or offline state. *"Nothing has been deleted recently"* is
the render an empty array produces, **which is what all three unnamed states also
produce.**

*Consequence:* a failed or offline read tells the user their deleted tasks do not exist,
**on the one surface whose entire purpose is telling them the opposite.** AC-2 already
forbids drawing the empty state as a failure; nothing forbids the reverse, and the
reverse is the one that costs a task. **190 of 207 accounts have nothing deleted**, so
the empty render is right often enough that a wrong one will not look wrong.

IA §6's opening rule is the one this breaks — *"a new surface with no failure design
inherits none of it"* — and F-005 AC-45 needed `SE-DETAIL` added for exactly this.

## F2 (HIGH) — AC-10, AC-9 · the post-restore moment is undrawable

AC-10 asserts *"the restored task is on screen and named after the restore"* — and the
user is standing in Recently deleted. The spec never says whether the surface changes,
whether a receipt names the destination, or what the second restore in a row does.

**The sentence is either false as written or requires a surface transition no AC
states.** AC-10 deliberately lets a restore land the task where the user was not
looking, and its whole justification for stating no relocation rule is *that the user
can see where it went.* An implementer will default to *"the row leaves the list and
nothing else happens"* — which makes AC-10's own reasoning untrue.

## F3 (MEDIUM) — AC-11 · the confirmation content collides with a standing owner decision

*Empty trash* *"says how many entries"* — count-only. *Delete forever* gets **no content
requirement at all**.

`components.md § Spoken frames` records the owner decision of 2026-08-17 in these words:
**"a destructive confirmation names the tasks. Count-only is not a legal fallback for
this row."** AC-11 specifies count-only for the larger act and nothing for the smaller,
in what the spec itself calls the only genuinely irreversible act in the product.

*Measured:* largest trash on the live store is **9 entries**, and `title_list`'s
published overflow rule is 3 names plus *"and N more"* — **naming is affordable at real
scale, so the count-only fallback buys nothing.**

## F4 (MEDIUM) — AC-7, AC-9, AC-6 · restoring one entry silently removes another

Restoring a lone deleted step **also restores its still-deleted parent** (an invariant in
the existing contract), and by AC-6 that parent can be **its own trash entry**. No AC
says what the user sees when putting one entry back removes a second entry they did not
touch. *0 of 57 deleted rows are steps today, which is also why no test written from the
live store would find it.*

## F5 (MEDIUM) — AC-2, AC-3, AC-10 · a task deleted while DONE is indistinguishable

The state diagram carries `Done --> Deleted` explicitly, and AC-3 fixes entry content as
two dates. An entry drawn like every other **tells the user a completed task is an open
one** — and AC-10 then returns it to Done, the one collection whose empty state is
defined as having no action. *So the restore whose destination is least discoverable is
the one whose entry gives the least warning.* **2 of the 57 deleted rows are `done` — it
ships on day one.**

## F6 (MEDIUM) — AC-1, AC-3, AC-12 · `## Impact` §9 is accurate and incomplete

**(a)** AC-3 requires the entry to state *when it goes* while AC-12 forbids wording that
promises the row leaves storage. `§ Buttons`' one-word-per-concept table binds **delete**
to *"removing a task"*, so the obvious copy — *"Deletes forever on 20 Sep"* — **makes
exactly the promise AC-12 excludes**, and the table has no word for *stops being
recoverable*. F-005 routed this class of obligation to that table before screens were
drawn; F-006 creates one and routes it nowhere.

**(b)** `§ ListsMenu` defines LM-COLLECTION as *"rows the app always has and computes on
device"*, all four members sharing the exemplar `menu-collection-row`. **AC-1's row is
always present and computes nothing on device** — it points at a network read — so which
id it carries, and whether every existing assertion over that exemplar goes from four
rows to five, is undecided and unrouted.

---

## OQ3 answered — **no mark on the menu row**

1. **In this menu the absence of a number is already a signal.** Counts are *"omitted at
   zero"*, so a bare row reads *nothing here*. A dot beside a bare row is a second signal
   contradicting the first, in one cell.
2. **The mark has no colour available, and that is measured.** All five accents are
   assigned and *"no colour appears without its meaning"*. The semantically correct one
   is `danger` red, reserved for confirm-delete contexts — an alarm on a permanent
   navigation row. The only unassigned treatment is `text.muted`, which at dot size is
   not a signal. **This is F-005's design finding D14 exactly** — *"pick an accent from
   unspent tokens" naming an empty set* — which cost that spec three revisions to notice.
3. **Its information value is near zero.** It answers *"is anything in the trash"*; the
   user's question is always *"is my task in there"*, which only opening answers.

*The honest options are the count or nothing, and AC-1 already chose. Reversing is cheap.*

## On the confirmation-dialog gap

§9's claim that no visual confirmation dialog exists is **correct** — but the *container*
pattern does: `§ ListEditorSheet` publishes a modal anatomy (bottom sheet on phones,
centred dialog ≥1024px, three testids, and a failed state that does not close). §9 routes
the debt as *"two new components"*; **it is one variant of a shipped pattern, with a third
sibling already owed by F-005 AC-30.** Three one-off dialogs is how a modal vocabulary
forks.

## Checked, sound

- **AC-2's empty state has no CTA and should not** — ET-DONE's precedent is exact.
- **AC-16's 2.5.1 clause** (no path-based gesture as the only way to reach restore or
  delete-forever, which binds the phone where a swipe is the obvious drawing)
  **pre-empts the one design defect this surface reliably ships. The sharpest AC in the set.**
- **AC-12's reachability/storage distinction is un-misreadable** — except the wording
  F6(a) names.
- **Live store re-measured**; every figure the spec cites is correct.

## The 16 implied-and-unnamed states

read in flight · read failed · offline · entry restoring · entry destroying · empty-trash
in flight · restore refused because the entry expired between read and tap · restore
failed · destroy failed · last entry leaves → empty · entry for a task deleted while done
· trash after a restore cascaded into a second entry · the post-restore moment · the menu
row's active state · the menu row's optional mark · each confirmation's own failed state.

*Six are covered by F1–F5. The rest are ordinary drawing work — listed so the count is checkable.*
