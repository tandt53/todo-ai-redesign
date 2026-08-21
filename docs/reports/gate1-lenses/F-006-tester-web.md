# F-006 Gate 1 — tester (web) lens (T-182, 2026-08-21)

**Verdict:** 4 HIGH · 2 MEDIUM · 1 LOW · all 16 ACs.
**The three highest sit on one unexamined state** — a lone deleted step whose parent is deleted by a *later* gesture — which the existing restore code already handles in a way two ACs forbid.

---

## F1 (HIGH) — AC-11, AC-9, AC-7 · *delete forever* is defined twice, and the two definitions diverge

*"Exactly the rows the entry covers"* (recorded gesture membership) **versus** *"the same
membership AC-9's restore would have put back"* (which skips rows no longer deleted —
`app.ts:618`).

**On the first reading, *delete forever* on a stale entry hard-removes a LIVE task.**
Reachable today: delete step S (gesture A), delete parent P (gesture B — `plan.ts:105`
filters live rows, so S is not in B). Restoring A restores P as an invariant, leaving
entry B listed with a live P in its membership.

*This is the one irreversible act in the product, and the ambiguity is over which rows it
destroys.* The two readings differ by a task the user still owns.

## F2 (HIGH) — AC-4 · the reader list omits the readers that count raw rows

AC-4 enumerates its readers — four collections, INV-INBOX-FILING's two expressions, the
handle list, `GET /tasks` — **every one `inCollection`-shaped or server-side.** It omits
the client readers that decide from **raw row cardinality** and never consult
`inCollection` — the class F-005 AC-35 had to name explicitly for the identical negative
about steps.

`TasksSurface.tsx:413` is `nothingAnywhere = state.tasks.length === 0`; `:414` `loading`
and `:420` `failedBlank` derive from it. **Measured: 4 accounts in the live store already
hold ≥1 deleted row and ZERO live rows.** So an account holding only deleted rows renders
the empty-*collection* state instead of first-run, and never renders the skeleton — and
no AC constrains those readers.

## F3 (HIGH) — AC-6, AC-7, AC-9 · one entry's restore mutates another entry's rows

AC-6 says restoring an entry *"puts back exactly that set"*. AC-9 endorses the invariant
that a step's still-deleted parent is restored too — `app.ts:602-612` adds it **after**
the membership is assembled. When the parent was deleted by a different gesture, **both
sentences cannot hold.** No AC states what the list then shows, so the post-restore
assertion of every AC-2/AC-6/AC-7 case is undefined. *0 deleted rows carry `parent_id`, so
no fixture derived from real data reaches it.*

## F4 (HIGH) — AC-16, AC-12, AC-9, AC-2 · a required announcement with nothing to announce

AC-16 requires *"the outcome of every restore, every permanent deletion and every
**refusal**"* to be announced — **and no AC states any refusal this surface can
produce.** The reachable one: an entry that expires between the list read and the tap.
AC-12 removes expired rows *on the trash read*, so a listed entry is unexpired at list
time and can expire while on screen, and AC-3 requires it to display the date it goes —
so *"goes today"* is a rendered state.

F-005 AC-41 defines a no-op-that-says-so for a **live** row and nothing for an **expired**
one, so the client cannot distinguish refusal from success. **Wider cost:** F-005 AC-33
declares AC-43's elapse conformant because the trash is an equivalent untimed path. *A
path whose refusal is silent is not equivalent.*

## F5 (MEDIUM) — AC-10, AC-16 · no carrier named for the restore outcome

*Verified: the only three mentions of "notice" in the spec are a filename and one Impact
reference.* By AC-4 the restored task cannot appear on the surface the user is standing
on, so *"on screen"* means either a navigation this spec does not state or a notice it
does not name. **Two implementations satisfy the words and only one satisfies the
sentence that follows them.**

## F6 (MEDIUM) — AC-11 · four guarantees under one id

Destroy one entry · empty the whole trash · confirm both · state the entry count. F1
shows the first two are **keyed differently from each other** (membership vs
`deleted_at`), which is the strongest argument they are two requirements. Six or more P1
cases against one id means the matrix cannot show that the *empty trash* confirmation was
never verified while *delete forever* was. *F-005 AC-31 and AC-42 are the precedent for
splitting.*

## F7 (LOW) — AC-2, AC-3, AC-6 · the ordering key is unstated

An entry is a gesture over N rows and no AC says the rows share a `deleted_at`, nor how
ties order. *The ordinary source of an order-dependent flake.*

---

## Checked, sound

- **AC-4's "no turn can name it" IS assertable at the web tier** — the observable is
  inherited from F-001's no-match model, not missing.
- **AC-5's eleven cited line references all resolve to the filter claimed** — checked
  individually.
- **`## Impact` §2 is true and precise**: `collections.test.ts:483` asserts the exact
  four-member array, `:498` asserts `COLLECTION_GROUPS.flat()`, `shell.test.ts:436` guards
  by regex. A fifth member turns both red immediately.
- **AC-12's precondition is constructible at the web tier** — both clocks holdable at one
  instant. L-023's two-clock trap is already answered.
- **AC-15's zero-AI-calls claim has a real seam** — F-001's harness counter.

## Drift, recorded not filed

`## Impact` §1 says *"45 non-test lines"*; measured **55** (43 excluding comments). File
count (16) is correct. No claim rides on the difference.
